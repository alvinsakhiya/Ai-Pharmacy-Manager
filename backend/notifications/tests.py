from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.roles import PharmacyRole, assign_role
from auditlog.models import AuditEvent

from .models import Notification


class NotificationApiTest(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.manager = user_model.objects.create_user(
            username="notification_manager",
            password="NotificationTest123!",
        )
        assign_role(self.manager, PharmacyRole.MANAGER)
        self.pharmacist = user_model.objects.create_user(
            username="notification_pharmacist",
            password="NotificationTest123!",
        )
        assign_role(self.pharmacist, PharmacyRole.PHARMACIST)
        self.dispenser = user_model.objects.create_user(
            username="notification_dispenser",
            password="NotificationTest123!",
        )
        assign_role(self.dispenser, PharmacyRole.DISPENSER)
        self.client.force_authenticate(self.manager)
        self.url = reverse("notifications-list")

    def create_notification(self, **overrides):
        tomorrow = timezone.localdate() + timedelta(days=1)
        payload = {
            "title": "Review medicine shortage",
            "message": "Check the local stock position before the next cycle.",
            "priority": Notification.Priority.HIGH,
            "assigned_user": self.pharmacist.id,
            "due_date": tomorrow.isoformat(),
            "expiry_date": (tomorrow + timedelta(days=3)).isoformat(),
            "related_entity_type": "Medication",
            "related_entity_id": "42",
        }
        payload.update(overrides)
        return self.client.post(self.url, payload, format="json")

    def test_manager_creates_safe_audited_notification(self):
        sensitive_message = "Private operational detail stays out of audit."

        response = self.create_notification(
            title="  Urgent stock review  ",
            message=f"  {sensitive_message}  ",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        notification = Notification.objects.get(pk=response.data["id"])
        self.assertEqual(notification.title, "Urgent stock review")
        self.assertEqual(notification.message, sensitive_message)
        self.assertEqual(notification.assigned_user, self.pharmacist)
        self.assertEqual(
            notification.assigned_username,
            self.pharmacist.username,
        )
        self.assertEqual(response.data["status"], Notification.Status.NEW)

        event = AuditEvent.objects.get(
            action=AuditEvent.Action.CREATE,
            entity_type="Notification",
            entity_identifier=str(notification.id),
        )
        self.assertNotIn(sensitive_message, event.summary)
        self.assertNotIn("Urgent stock review", event.summary)

    def test_non_manager_cannot_create_or_edit_notification_content(self):
        response = self.create_notification()
        notification_id = response.data["id"]
        self.client.force_authenticate(self.pharmacist)

        create_response = self.create_notification()
        edit_response = self.client.patch(
            reverse("notifications-detail", args=[notification_id]),
            {"message": "Unauthorised change."},
            format="json",
        )

        self.assertEqual(
            create_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            edit_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_visibility_is_scoped_to_recipient_and_unassigned_notices(self):
        former_user = get_user_model().objects.create_user(
            username="former_notification_user",
            password="NotificationTest123!",
        )
        assigned = Notification.objects.create(
            title="Pharmacist task",
            message="Assigned only to the pharmacist.",
            assigned_user=self.pharmacist,
            assigned_username=self.pharmacist.username,
        )
        unassigned = Notification.objects.create(
            title="General notice",
            message="Visible to all authorised staff.",
        )
        other = Notification.objects.create(
            title="Dispenser task",
            message="Assigned only to the dispenser.",
            assigned_user=self.dispenser,
            assigned_username=self.dispenser.username,
        )
        former_assignment = Notification.objects.create(
            title="Former staff task",
            message="Must not become a general notice after account deletion.",
            assigned_user=former_user,
            assigned_username=former_user.username,
        )
        former_user.delete()

        self.client.force_authenticate(self.pharmacist)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        visible_ids = {item["id"] for item in response.data["results"]}
        self.assertEqual(visible_ids, {assigned.id, unassigned.id})
        self.assertNotIn(other.id, visible_ids)
        self.assertNotIn(former_assignment.id, visible_ids)

        self.client.force_authenticate(self.manager)
        manager_response = self.client.get(self.url)
        self.assertEqual(manager_response.data["count"], 4)

    def test_recipient_completes_guarded_lifecycle(self):
        create_response = self.create_notification(
            message="Lifecycle content must not enter audit summaries.",
        )
        notification_id = create_response.data["id"]
        self.client.force_authenticate(self.pharmacist)

        early_resolve = self.client.post(
            reverse("notifications-resolve", args=[notification_id]),
            {"resolution_reason": "Too early."},
            format="json",
        )
        read_response = self.client.post(
            reverse("notifications-mark-read", args=[notification_id]),
            {},
            format="json",
        )
        acknowledge_response = self.client.post(
            reverse("notifications-acknowledge", args=[notification_id]),
            {},
            format="json",
        )
        blank_resolution = self.client.post(
            reverse("notifications-resolve", args=[notification_id]),
            {"resolution_reason": "   "},
            format="json",
        )
        resolve_response = self.client.post(
            reverse("notifications-resolve", args=[notification_id]),
            {"resolution_reason": "Stock position checked and documented."},
            format="json",
        )

        self.assertEqual(
            early_resolve.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(read_response.data["status"], Notification.Status.READ)
        self.assertEqual(
            acknowledge_response.data["status"],
            Notification.Status.ACKNOWLEDGED,
        )
        self.assertIsNotNone(acknowledge_response.data["acknowledged_at"])
        self.assertEqual(
            blank_resolution.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            resolve_response.data["status"],
            Notification.Status.RESOLVED,
        )
        self.assertIsNotNone(resolve_response.data["resolved_at"])
        self.assertEqual(
            resolve_response.data["resolution_reason"],
            "Stock position checked and documented.",
        )

        summaries = " ".join(
            AuditEvent.objects.filter(
                entity_type="Notification",
                entity_identifier=str(notification_id),
            ).values_list("summary", flat=True)
        )
        self.assertNotIn("Lifecycle content", summaries)
        self.assertNotIn("Stock position checked", summaries)

    def test_only_recipient_or_manager_can_change_lifecycle(self):
        response = self.create_notification()
        notification_id = response.data["id"]
        unassigned = Notification.objects.create(
            title="General notice",
            message="Manager-controlled broadcast.",
        )
        self.client.force_authenticate(self.dispenser)

        assigned_response = self.client.post(
            reverse("notifications-mark-read", args=[notification_id]),
            {},
            format="json",
        )
        unassigned_response = self.client.post(
            reverse("notifications-mark-read", args=[unassigned.id]),
            {},
            format="json",
        )

        self.assertEqual(
            assigned_response.status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            unassigned_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.client.force_authenticate(self.manager)
        manager_response = self.client.post(
            reverse("notifications-mark-read", args=[unassigned.id]),
            {},
            format="json",
        )
        self.assertEqual(manager_response.status_code, status.HTTP_200_OK)

    def test_filters_validation_and_summary_counts(self):
        today = timezone.localdate()
        Notification.objects.create(
            title="Critical overdue",
            message="Needs action.",
            priority=Notification.Priority.CRITICAL,
            assigned_user=self.pharmacist,
            assigned_username=self.pharmacist.username,
            due_date=today - timedelta(days=1),
        )
        Notification.objects.create(
            title="Expired notice",
            message="Past its visibility date.",
            priority=Notification.Priority.LOW,
            expiry_date=today - timedelta(days=1),
        )
        Notification.objects.create(
            title="Resolved item",
            message="Already complete.",
            priority=Notification.Priority.CRITICAL,
            status=Notification.Status.RESOLVED,
            resolved_at=timezone.now(),
        )
        self.client.force_authenticate(self.pharmacist)

        summary = self.client.get(reverse("notifications-summary"))
        critical_filter = self.client.get(
            self.url,
            {"priority": Notification.Priority.CRITICAL},
        )
        invalid_filter = self.client.get(self.url, {"status": "unknown"})

        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertEqual(summary.data["total_visible"], 3)
        self.assertEqual(summary.data["new"], 2)
        self.assertEqual(summary.data["unresolved"], 2)
        self.assertEqual(summary.data["critical"], 1)
        self.assertEqual(summary.data["overdue"], 1)
        self.assertEqual(summary.data["expired"], 1)
        self.assertEqual(critical_filter.data["count"], 2)
        self.assertEqual(
            invalid_filter.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_payload_validation_and_manager_assignee_directory(self):
        today = timezone.localdate()
        invalid_dates = self.create_notification(
            due_date=(today + timedelta(days=5)).isoformat(),
            expiry_date=(today + timedelta(days=2)).isoformat(),
        )
        incomplete_relation = self.create_notification(
            related_entity_type="",
            related_entity_id="42",
        )
        blank_message = self.create_notification(message="   ")
        assignees = self.client.get(reverse("notifications-assignees"))

        self.assertEqual(
            invalid_dates.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            incomplete_relation.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            blank_message.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(assignees.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {user["username"] for user in assignees.data},
            {
                self.manager.username,
                self.pharmacist.username,
                self.dispenser.username,
            },
        )

        self.client.force_authenticate(self.pharmacist)
        denied_assignees = self.client.get(reverse("notifications-assignees"))
        self.assertEqual(
            denied_assignees.status_code,
            status.HTTP_403_FORBIDDEN,
        )
