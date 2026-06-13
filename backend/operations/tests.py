from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.roles import PharmacyRole, assign_role
from auditlog.models import AuditEvent

from .models import OpeningHour, OperationalTask


class OperationalTaskApiTest(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.manager = user_model.objects.create_user(
            username="operations_manager",
            password="OperationsTest123!",
        )
        assign_role(self.manager, PharmacyRole.MANAGER)
        self.pharmacist = user_model.objects.create_user(
            username="operations_pharmacist",
            password="OperationsTest123!",
        )
        assign_role(self.pharmacist, PharmacyRole.PHARMACIST)
        self.dispenser = user_model.objects.create_user(
            username="operations_dispenser",
            password="OperationsTest123!",
        )
        assign_role(self.dispenser, PharmacyRole.DISPENSER)
        self.read_only = user_model.objects.create_user(
            username="operations_read_only",
            password="OperationsTest123!",
        )
        assign_role(self.read_only, PharmacyRole.READ_ONLY)
        self.client.force_authenticate(self.manager)
        self.url = reverse("operational-tasks-list")

    def create_task(self, **overrides):
        payload = {
            "title": "Review stock delivery",
            "description": "Internal detail must stay out of audit summaries.",
            "category": OperationalTask.Category.STOCK,
            "priority": OperationalTask.Priority.HIGH,
            "assigned_user": self.pharmacist.id,
            "due_at": (timezone.now() + timedelta(days=1)).isoformat(),
        }
        payload.update(overrides)
        return self.client.post(self.url, payload, format="json")

    def test_manager_creates_assigned_task_with_safe_audit_event(self):
        response = self.create_task()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        task = OperationalTask.objects.get(pk=response.data["id"])
        self.assertEqual(task.assigned_user, self.pharmacist)
        self.assertEqual(task.assigned_username, self.pharmacist.username)
        self.assertEqual(task.created_by, self.manager)
        self.assertEqual(task.created_by_username, self.manager.username)
        self.assertEqual(response.data["status"], OperationalTask.Status.TODO)

        event = AuditEvent.objects.get(
            action=AuditEvent.Action.CREATE,
            entity_type="OperationalTask",
            entity_identifier=str(task.id),
        )
        self.assertNotIn(task.title, event.summary)
        self.assertNotIn(task.description, event.summary)

    def test_non_manager_visibility_is_assigned_or_unassigned_only(self):
        former_user = get_user_model().objects.create_user(
            username="former_operations_user",
            password="OperationsTest123!",
        )
        assigned = OperationalTask.objects.create(
            title="Pharmacist task",
            assigned_user=self.pharmacist,
            assigned_username=self.pharmacist.username,
        )
        unassigned = OperationalTask.objects.create(title="Team task")
        other = OperationalTask.objects.create(
            title="Dispenser task",
            assigned_user=self.dispenser,
            assigned_username=self.dispenser.username,
        )
        former = OperationalTask.objects.create(
            title="Former staff task",
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
        self.assertNotIn(former.id, visible_ids)

        self.client.force_authenticate(self.manager)
        manager_response = self.client.get(self.url)
        self.assertEqual(manager_response.data["count"], 4)

    def test_staff_claim_start_and_complete_guarded_lifecycle(self):
        task = OperationalTask.objects.create(
            title="Prepare local stock count",
            category=OperationalTask.Category.STOCK,
        )
        self.client.force_authenticate(self.pharmacist)

        early_complete = self.client.post(
            reverse("operational-tasks-complete", args=[task.id]),
            {},
            format="json",
        )
        claim_response = self.client.post(
            reverse("operational-tasks-claim", args=[task.id]),
            {},
            format="json",
        )
        start_response = self.client.post(
            reverse("operational-tasks-start", args=[task.id]),
            {},
            format="json",
        )
        complete_response = self.client.post(
            reverse("operational-tasks-complete", args=[task.id]),
            {},
            format="json",
        )

        self.assertEqual(
            early_complete.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            claim_response.data["assigned_user"],
            self.pharmacist.id,
        )
        self.assertEqual(
            start_response.data["status"],
            OperationalTask.Status.IN_PROGRESS,
        )
        self.assertEqual(
            complete_response.data["status"],
            OperationalTask.Status.COMPLETED,
        )
        self.assertIsNotNone(complete_response.data["completed_at"])

        events = AuditEvent.objects.filter(
            entity_type="OperationalTask",
            entity_identifier=str(task.id),
            action=AuditEvent.Action.UPDATE,
        )
        self.assertEqual(events.count(), 3)

    def test_read_only_cannot_claim_and_other_staff_cannot_change_task(self):
        unassigned = OperationalTask.objects.create(title="Unassigned task")
        assigned = OperationalTask.objects.create(
            title="Pharmacist task",
            assigned_user=self.pharmacist,
            assigned_username=self.pharmacist.username,
        )

        self.client.force_authenticate(self.read_only)
        claim_response = self.client.post(
            reverse("operational-tasks-claim", args=[unassigned.id]),
            {},
            format="json",
        )
        self.assertEqual(
            claim_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.client.force_authenticate(self.dispenser)
        start_response = self.client.post(
            reverse("operational-tasks-start", args=[assigned.id]),
            {},
            format="json",
        )
        self.assertEqual(start_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_manager_cancels_with_reason_and_closed_task_is_read_only(self):
        response = self.create_task()
        task_id = response.data["id"]

        blank_cancel = self.client.post(
            reverse("operational-tasks-cancel", args=[task_id]),
            {"reason": "   "},
            format="json",
        )
        cancel_response = self.client.post(
            reverse("operational-tasks-cancel", args=[task_id]),
            {"reason": "No longer required after workflow review."},
            format="json",
        )
        edit_response = self.client.patch(
            reverse("operational-tasks-detail", args=[task_id]),
            {"title": "Must not change"},
            format="json",
        )

        self.assertEqual(
            blank_cancel.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            cancel_response.data["status"],
            OperationalTask.Status.CANCELLED,
        )
        self.assertEqual(
            edit_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_filters_summary_and_invalid_values(self):
        overdue = OperationalTask.objects.create(
            title="Overdue critical task",
            priority=OperationalTask.Priority.CRITICAL,
            due_at=timezone.now() - timedelta(hours=1),
        )
        OperationalTask.objects.create(
            title="Assigned dosette task",
            category=OperationalTask.Category.DOSETTE,
            assigned_user=self.pharmacist,
            assigned_username=self.pharmacist.username,
        )

        summary = self.client.get(reverse("operational-tasks-summary"))
        category = self.client.get(
            self.url,
            {"category": OperationalTask.Category.DOSETTE},
        )
        priority = self.client.get(
            self.url,
            {"priority": OperationalTask.Priority.CRITICAL},
        )
        search = self.client.get(self.url, {"search": "Overdue"})
        invalid = self.client.get(self.url, {"status": "UNKNOWN"})

        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertEqual(summary.data["overdue"], 1)
        self.assertEqual(summary.data["critical"], 1)
        self.assertEqual(summary.data["unassigned"], 1)
        self.assertEqual(category.data["count"], 1)
        self.assertEqual(priority.data["results"][0]["id"], overdue.id)
        self.assertEqual(search.data["count"], 1)
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)


class OpeningHourApiTest(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.manager = user_model.objects.create_user(
            username="hours_manager",
            password="OpeningHours123!",
        )
        assign_role(self.manager, PharmacyRole.MANAGER)
        self.pharmacist = user_model.objects.create_user(
            username="hours_pharmacist",
            password="OpeningHours123!",
        )
        assign_role(self.pharmacist, PharmacyRole.PHARMACIST)
        self.client.force_authenticate(self.manager)
        self.url = reverse("opening-hours-list")

    def test_manager_configures_hours_and_validation_is_clear(self):
        response = self.client.post(
            self.url,
            {
                "day_of_week": OpeningHour.Day.MONDAY,
                "opening_time": "09:00",
                "closing_time": "18:00",
                "notes": "  Standard local hours.  ",
            },
            format="json",
        )
        reversed_response = self.client.post(
            self.url,
            {
                "day_of_week": OpeningHour.Day.TUESDAY,
                "opening_time": "18:00",
                "closing_time": "09:00",
            },
            format="json",
        )
        closed_response = self.client.post(
            self.url,
            {
                "day_of_week": OpeningHour.Day.SUNDAY,
                "opening_time": "09:00",
                "closing_time": "12:00",
                "is_closed": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["day_label"], "Monday")
        self.assertEqual(response.data["notes"], "Standard local hours.")
        self.assertEqual(
            reversed_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(closed_response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(closed_response.data["opening_time"])
        self.assertIsNone(closed_response.data["closing_time"])
        self.assertTrue(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.CREATE,
                entity_type="OpeningHour",
            ).exists()
        )

    def test_non_manager_can_read_but_cannot_change_hours(self):
        opening_hour = OpeningHour.objects.create(
            day_of_week=OpeningHour.Day.MONDAY,
            opening_time="09:00",
            closing_time="18:00",
        )
        self.client.force_authenticate(self.pharmacist)

        list_response = self.client.get(self.url)
        patch_response = self.client.patch(
            reverse("opening-hours-detail", args=[opening_hour.id]),
            {"closing_time": "17:00"},
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            patch_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
