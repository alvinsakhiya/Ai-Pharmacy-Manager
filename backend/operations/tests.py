from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.roles import PharmacyRole, assign_role
from auditlog.models import AuditEvent

from patients.models import Patient
from .models import LocalDelivery, OpeningHour, OperationalTask


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


class LocalDeliveryApiTest(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.manager = user_model.objects.create_user(
            username="delivery_manager",
            password="DeliveryTest123!",
        )
        assign_role(self.manager, PharmacyRole.MANAGER)
        self.pharmacist = user_model.objects.create_user(
            username="delivery_pharmacist",
            password="DeliveryTest123!",
        )
        assign_role(self.pharmacist, PharmacyRole.PHARMACIST)
        self.dispenser = user_model.objects.create_user(
            username="delivery_dispenser",
            password="DeliveryTest123!",
        )
        assign_role(self.dispenser, PharmacyRole.DISPENSER)
        self.other_dispenser = user_model.objects.create_user(
            username="other_delivery_dispenser",
            password="DeliveryTest123!",
        )
        assign_role(self.other_dispenser, PharmacyRole.DISPENSER)
        self.stock_assistant = user_model.objects.create_user(
            username="delivery_stock_assistant",
            password="DeliveryTest123!",
        )
        assign_role(
            self.stock_assistant,
            PharmacyRole.STOCK_ASSISTANT,
        )
        self.read_only = user_model.objects.create_user(
            username="delivery_read_only",
            password="DeliveryTest123!",
        )
        assign_role(self.read_only, PharmacyRole.READ_ONLY)
        self.patient = Patient.objects.create(
            first_name="Alex",
            last_name="Delivery",
            date_of_birth="1975-04-10",
        )
        self.url = reverse("local-deliveries-list")
        self.client.force_authenticate(self.manager)

    def create_delivery(self, **overrides):
        payload = {
            "patient": self.patient.id,
            "scheduled_date": (
                timezone.localdate() + timedelta(days=1)
            ).isoformat(),
            "delivery_window": LocalDelivery.Window.AFTERNOON,
            "assigned_user": self.dispenser.id,
            "instructions": (
                "Internal delivery instructions must not enter audit summaries."
            ),
        }
        payload.update(overrides)
        return self.client.post(self.url, payload, format="json")

    def test_delivery_api_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_manager_creates_delivery_with_snapshots_and_safe_audit(self):
        response = self.create_delivery()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        delivery = LocalDelivery.objects.get(pk=response.data["id"])
        self.assertEqual(delivery.patient_name, "Alex Delivery")
        self.assertEqual(delivery.assigned_username, self.dispenser.username)
        self.assertEqual(delivery.created_by, self.manager)
        self.assertEqual(
            delivery.created_by_username,
            self.manager.username,
        )

        event = AuditEvent.objects.get(
            action=AuditEvent.Action.CREATE,
            entity_type="LocalDelivery",
            entity_identifier=str(delivery.id),
        )
        self.assertNotIn(delivery.patient_name, event.summary)
        self.assertNotIn(delivery.instructions, event.summary)

    def test_delivery_validation_rejects_past_date_and_non_care_assignee(self):
        past = self.create_delivery(
            scheduled_date=(
                timezone.localdate() - timedelta(days=1)
            ).isoformat()
        )
        invalid_assignee = self.create_delivery(
            assigned_user=self.stock_assistant.id
        )
        missing_patient = self.create_delivery(patient=None)
        omitted_patient = self.client.post(
            self.url,
            {
                "scheduled_date": (
                    timezone.localdate() + timedelta(days=1)
                ).isoformat(),
            },
            format="json",
        )

        self.assertEqual(past.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            invalid_assignee.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            missing_patient.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            omitted_patient.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_patient_care_role_access_is_enforced(self):
        self.client.force_authenticate(self.pharmacist)
        pharmacist_create = self.create_delivery(assigned_user=None)

        self.client.force_authenticate(self.read_only)
        read_response = self.client.get(self.url)
        denied_create = self.create_delivery()

        self.client.force_authenticate(self.stock_assistant)
        denied_read = self.client.get(self.url)

        self.assertEqual(
            pharmacist_create.status_code,
            status.HTTP_201_CREATED,
        )
        self.assertEqual(read_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            denied_create.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            denied_read.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_dispenser_claims_and_completes_guarded_lifecycle(self):
        response = self.create_delivery(assigned_user=None)
        delivery_id = response.data["id"]
        self.client.force_authenticate(self.dispenser)

        early_dispatch = self.client.post(
            reverse("local-deliveries-dispatch", args=[delivery_id]),
            {},
            format="json",
        )
        claim_response = self.client.post(
            reverse("local-deliveries-claim", args=[delivery_id]),
            {},
            format="json",
        )
        ready_response = self.client.post(
            reverse("local-deliveries-ready", args=[delivery_id]),
            {},
            format="json",
        )
        dispatch_response = self.client.post(
            reverse("local-deliveries-dispatch", args=[delivery_id]),
            {},
            format="json",
        )
        deliver_response = self.client.post(
            reverse("local-deliveries-deliver", args=[delivery_id]),
            {},
            format="json",
        )

        self.assertEqual(
            early_dispatch.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            claim_response.data["assigned_user"],
            self.dispenser.id,
        )
        self.assertEqual(
            ready_response.data["status"],
            LocalDelivery.Status.READY,
        )
        self.assertEqual(
            dispatch_response.data["status"],
            LocalDelivery.Status.OUT_FOR_DELIVERY,
        )
        self.assertEqual(
            deliver_response.data["status"],
            LocalDelivery.Status.DELIVERED,
        )
        self.assertIsNotNone(deliver_response.data["delivered_at"])

        events = AuditEvent.objects.filter(
            entity_type="LocalDelivery",
            entity_identifier=str(delivery_id),
            action=AuditEvent.Action.UPDATE,
        )
        self.assertEqual(events.count(), 4)

    def test_failure_and_cancellation_require_reasons(self):
        response = self.create_delivery()
        delivery_id = response.data["id"]
        self.client.force_authenticate(self.other_dispenser)
        denied = self.client.post(
            reverse("local-deliveries-ready", args=[delivery_id]),
            {},
            format="json",
        )

        self.client.force_authenticate(self.dispenser)
        self.client.post(
            reverse("local-deliveries-ready", args=[delivery_id]),
            {},
            format="json",
        )
        self.client.post(
            reverse("local-deliveries-dispatch", args=[delivery_id]),
            {},
            format="json",
        )
        blank_fail = self.client.post(
            reverse("local-deliveries-fail", args=[delivery_id]),
            {"reason": "   "},
            format="json",
        )
        failed = self.client.post(
            reverse("local-deliveries-fail", args=[delivery_id]),
            {"reason": "No authorised recipient was available."},
            format="json",
        )

        self.client.force_authenticate(self.manager)
        cancel_target = self.create_delivery().data["id"]
        blank_cancel = self.client.post(
            reverse("local-deliveries-cancel", args=[cancel_target]),
            {"reason": ""},
            format="json",
        )
        cancelled = self.client.post(
            reverse("local-deliveries-cancel", args=[cancel_target]),
            {"reason": "Patient requested a new delivery date."},
            format="json",
        )

        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            blank_fail.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(failed.data["status"], LocalDelivery.Status.FAILED)
        self.assertEqual(
            blank_cancel.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            cancelled.data["status"],
            LocalDelivery.Status.CANCELLED,
        )

    def test_summary_filters_assignees_and_deleted_patient_snapshot(self):
        overdue = LocalDelivery.objects.create(
            patient=self.patient,
            patient_name=str(self.patient),
            scheduled_date=timezone.localdate() - timedelta(days=1),
        )
        self.create_delivery()

        summary = self.client.get(reverse("local-deliveries-summary"))
        planned = self.client.get(
            self.url,
            {"status": LocalDelivery.Status.PLANNED},
        )
        search = self.client.get(self.url, {"search": "Alex"})
        invalid = self.client.get(self.url, {"status": "UNKNOWN"})
        invalid_date = self.client.get(
            self.url,
            {"date_from": "not-a-date"},
        )
        reversed_dates = self.client.get(
            self.url,
            {
                "date_from": "2026-06-14",
                "date_to": "2026-06-13",
            },
        )
        assignees = self.client.get(reverse("local-deliveries-assignees"))

        patient_name = overdue.patient_name
        self.patient.delete()
        overdue.refresh_from_db()

        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertEqual(summary.data["overdue"], 1)
        self.assertEqual(summary.data["unassigned"], 1)
        self.assertEqual(planned.data["count"], 2)
        self.assertEqual(search.data["count"], 2)
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            invalid_date.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            reversed_dates.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(assignees.status_code, status.HTTP_200_OK)
        self.assertNotIn(
            self.read_only.username,
            {user["username"] for user in assignees.data},
        )
        self.assertNotIn(
            self.stock_assistant.username,
            {user["username"] for user in assignees.data},
        )
        self.assertIsNone(overdue.patient)
        self.assertEqual(overdue.patient_name, patient_name)
