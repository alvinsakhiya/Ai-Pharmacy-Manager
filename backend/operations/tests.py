from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.roles import PharmacyRole, assign_role
from auditlog.models import AuditEvent

from patients.models import Patient
from .models import (
    FridgeTemperatureLog,
    InternalResourceLink,
    LocalDelivery,
    OpeningHour,
    OperationalAppointment,
    OperationalTask,
)


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


class FridgeTemperatureLogApiTest(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.manager = user_model.objects.create_user(
            username="fridge_manager",
            password="FridgeTest123!",
        )
        assign_role(self.manager, PharmacyRole.MANAGER)
        self.pharmacist = user_model.objects.create_user(
            username="fridge_pharmacist",
            password="FridgeTest123!",
        )
        assign_role(self.pharmacist, PharmacyRole.PHARMACIST)
        self.dispenser = user_model.objects.create_user(
            username="fridge_dispenser",
            password="FridgeTest123!",
        )
        assign_role(self.dispenser, PharmacyRole.DISPENSER)
        self.stock_assistant = user_model.objects.create_user(
            username="fridge_stock_assistant",
            password="FridgeTest123!",
        )
        assign_role(
            self.stock_assistant,
            PharmacyRole.STOCK_ASSISTANT,
        )
        self.read_only = user_model.objects.create_user(
            username="fridge_read_only",
            password="FridgeTest123!",
        )
        assign_role(self.read_only, PharmacyRole.READ_ONLY)
        self.url = reverse("fridge-temperature-logs-list")
        self.client.force_authenticate(self.manager)

    def create_reading(self, **overrides):
        payload = {
            "temperature_celsius": "4.5",
            "action_taken": "",
            "notes": "Routine internal fridge check.",
        }
        payload.update(overrides)
        return self.client.post(self.url, payload, format="json")

    def test_temperature_api_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_authorised_staff_records_safe_reading_with_audit(self):
        self.client.force_authenticate(self.stock_assistant)

        response = self.create_reading()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["is_within_range"])
        self.assertEqual(response.data["range_status"], "WITHIN_RANGE")
        reading = FridgeTemperatureLog.objects.get(pk=response.data["id"])
        self.assertEqual(reading.recorded_by, self.stock_assistant)
        self.assertEqual(
            reading.recorded_by_username,
            self.stock_assistant.username,
        )

        event = AuditEvent.objects.get(
            action=AuditEvent.Action.CREATE,
            entity_type="FridgeTemperatureLog",
            entity_identifier=str(reading.id),
        )
        self.assertNotIn(str(reading.temperature_celsius), event.summary)
        self.assertNotIn(reading.notes, event.summary)

    def test_out_of_range_requires_corrective_action_and_boundaries_are_safe(self):
        missing_action = self.create_reading(
            temperature_celsius="9.0",
        )
        high = self.create_reading(
            temperature_celsius="9.0",
            action_taken="Quarantined affected stock and escalated locally.",
        )
        low_boundary = self.create_reading(temperature_celsius="2.0")
        high_boundary = self.create_reading(temperature_celsius="8.0")
        non_finite = self.create_reading(temperature_celsius="NaN")

        self.assertEqual(
            missing_action.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(high.status_code, status.HTTP_201_CREATED)
        self.assertFalse(high.data["is_within_range"])
        self.assertTrue(low_boundary.data["is_within_range"])
        self.assertTrue(high_boundary.data["is_within_range"])
        self.assertEqual(
            non_finite.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_role_access_and_immutable_history(self):
        response = self.create_reading()
        reading_id = response.data["id"]

        self.client.force_authenticate(self.dispenser)
        dispenser_read = self.client.get(self.url)
        dispenser_write = self.create_reading()

        self.client.force_authenticate(self.read_only)
        read_only_read = self.client.get(self.url)

        self.client.force_authenticate(self.manager)
        patch_response = self.client.patch(
            reverse("fridge-temperature-logs-detail", args=[reading_id]),
            {"temperature_celsius": "6.0"},
            format="json",
        )
        delete_response = self.client.delete(
            reverse("fridge-temperature-logs-detail", args=[reading_id])
        )

        self.assertEqual(dispenser_read.status_code, status.HTTP_200_OK)
        self.assertEqual(
            dispenser_write.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(read_only_read.status_code, status.HTTP_200_OK)
        self.assertEqual(
            patch_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            delete_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_summary_and_filters_report_range_status(self):
        safe = self.create_reading(temperature_celsius="5.0")
        unsafe = self.create_reading(
            temperature_celsius="1.5",
            action_taken="Moved stock to a validated backup fridge.",
        )

        summary = self.client.get(
            reverse("fridge-temperature-logs-summary")
        )
        within = self.client.get(
            self.url,
            {"range_status": "WITHIN_RANGE"},
        )
        outside = self.client.get(
            self.url,
            {"range_status": "OUT_OF_RANGE"},
        )
        invalid = self.client.get(
            self.url,
            {"range_status": "UNKNOWN"},
        )
        invalid_date = self.client.get(
            self.url,
            {"date_from": "not-a-date"},
        )

        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertEqual(summary.data["readings_today"], 2)
        self.assertEqual(summary.data["within_range_today"], 1)
        self.assertEqual(summary.data["out_of_range_today"], 1)
        self.assertTrue(summary.data["has_reading_today"])
        self.assertEqual(summary.data["latest"]["id"], unsafe.data["id"])
        self.assertEqual(within.data["count"], 1)
        self.assertEqual(within.data["results"][0]["id"], safe.data["id"])
        self.assertEqual(outside.data["count"], 1)
        self.assertEqual(
            invalid.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            invalid_date.status_code,
            status.HTTP_400_BAD_REQUEST,
        )


class OperationalAppointmentApiTest(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.manager = user_model.objects.create_user(
            username="appointment_manager",
            password="AppointmentTest123!",
        )
        assign_role(self.manager, PharmacyRole.MANAGER)
        self.pharmacist = user_model.objects.create_user(
            username="appointment_pharmacist",
            password="AppointmentTest123!",
        )
        assign_role(self.pharmacist, PharmacyRole.PHARMACIST)
        self.dispenser = user_model.objects.create_user(
            username="appointment_dispenser",
            password="AppointmentTest123!",
        )
        assign_role(self.dispenser, PharmacyRole.DISPENSER)
        self.other_dispenser = user_model.objects.create_user(
            username="other_appointment_dispenser",
            password="AppointmentTest123!",
        )
        assign_role(self.other_dispenser, PharmacyRole.DISPENSER)
        self.stock_assistant = user_model.objects.create_user(
            username="appointment_stock",
            password="AppointmentTest123!",
        )
        assign_role(
            self.stock_assistant,
            PharmacyRole.STOCK_ASSISTANT,
        )
        self.read_only = user_model.objects.create_user(
            username="appointment_read_only",
            password="AppointmentTest123!",
        )
        assign_role(self.read_only, PharmacyRole.READ_ONLY)
        self.patient = Patient.objects.create(
            first_name="Morgan",
            last_name="Appointment",
            date_of_birth="1980-08-15",
        )
        self.url = reverse("operational-appointments-list")
        self.client.force_authenticate(self.manager)

    def create_appointment(self, **overrides):
        start = timezone.now() + timedelta(days=1)
        payload = {
            "title": "Review local dosette workflow",
            "appointment_type": (
                OperationalAppointment.AppointmentType.DOSETTE_REVIEW
            ),
            "patient": self.patient.id,
            "scheduled_start": start.isoformat(),
            "scheduled_end": (start + timedelta(minutes=30)).isoformat(),
            "assigned_user": self.dispenser.id,
            "notes": "Private appointment detail must stay out of audit text.",
        }
        payload.update(overrides)
        return self.client.post(self.url, payload, format="json")

    def test_appointment_api_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_manager_creates_appointment_with_safe_snapshots_and_audit(self):
        response = self.create_appointment()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        appointment = OperationalAppointment.objects.get(
            pk=response.data["id"]
        )
        self.assertEqual(appointment.patient_name, "Morgan Appointment")
        self.assertEqual(
            appointment.assigned_username,
            self.dispenser.username,
        )
        self.assertEqual(appointment.created_by, self.manager)

        event = AuditEvent.objects.get(
            action=AuditEvent.Action.CREATE,
            entity_type="OperationalAppointment",
            entity_identifier=str(appointment.id),
        )
        self.assertNotIn(appointment.title, event.summary)
        self.assertNotIn(appointment.patient_name, event.summary)
        self.assertNotIn(appointment.notes, event.summary)

    def test_appointment_validation_rejects_unsafe_inputs(self):
        start = timezone.now() + timedelta(days=1)
        missing_patient = self.create_appointment(patient=None)
        reversed_time = self.create_appointment(
            scheduled_start=start.isoformat(),
            scheduled_end=(start - timedelta(minutes=1)).isoformat(),
        )
        past_start = timezone.now() - timedelta(hours=2)
        past = self.create_appointment(
            appointment_type=OperationalAppointment.AppointmentType.GENERAL,
            patient=None,
            scheduled_start=past_start.isoformat(),
            scheduled_end=(
                past_start + timedelta(minutes=30)
            ).isoformat(),
        )
        invalid_assignee = self.create_appointment(
            assigned_user=self.stock_assistant.id
        )

        self.assertEqual(
            missing_patient.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            reversed_time.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(past.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            invalid_assignee.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_patient_care_role_access_is_enforced(self):
        self.client.force_authenticate(self.pharmacist)
        pharmacist_create = self.create_appointment()

        self.client.force_authenticate(self.read_only)
        read_response = self.client.get(self.url)
        denied_create = self.create_appointment()

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

    def test_assigned_dispenser_completes_appointment_with_outcome(self):
        appointment_id = self.create_appointment().data["id"]

        self.client.force_authenticate(self.other_dispenser)
        denied = self.client.post(
            reverse(
                "operational-appointments-complete",
                args=[appointment_id],
            ),
            {"outcome": "Must not be accepted."},
            format="json",
        )

        self.client.force_authenticate(self.dispenser)
        completed = self.client.post(
            reverse(
                "operational-appointments-complete",
                args=[appointment_id],
            ),
            {"outcome": "Local review completed; follow-up task recorded."},
            format="json",
        )

        self.client.force_authenticate(self.manager)
        edit_finished = self.client.patch(
            reverse(
                "operational-appointments-detail",
                args=[appointment_id],
            ),
            {"title": "Must not change"},
            format="json",
        )

        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            completed.data["status"],
            OperationalAppointment.Status.COMPLETED,
        )
        self.assertIsNotNone(completed.data["completed_at"])
        self.assertEqual(
            edit_finished.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_cancellation_requires_reason(self):
        appointment_id = self.create_appointment().data["id"]

        blank = self.client.post(
            reverse(
                "operational-appointments-cancel",
                args=[appointment_id],
            ),
            {"reason": "   "},
            format="json",
        )
        cancelled = self.client.post(
            reverse(
                "operational-appointments-cancel",
                args=[appointment_id],
            ),
            {"reason": "Patient requested a later local review."},
            format="json",
        )

        self.assertEqual(blank.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            cancelled.data["status"],
            OperationalAppointment.Status.CANCELLED,
        )

    def test_summary_filters_assignees_and_deleted_patient_snapshot(self):
        overdue = OperationalAppointment.objects.create(
            title="Overdue local review",
            appointment_type=(
                OperationalAppointment.AppointmentType.PATIENT_REVIEW
            ),
            patient=self.patient,
            patient_name=str(self.patient),
            scheduled_start=timezone.now() - timedelta(hours=2),
            scheduled_end=timezone.now() - timedelta(hours=1),
        )
        upcoming = self.create_appointment()

        summary = self.client.get(
            reverse("operational-appointments-summary")
        )
        filtered = self.client.get(
            self.url,
            {
                "appointment_type": (
                    OperationalAppointment.AppointmentType.DOSETTE_REVIEW
                )
            },
        )
        search = self.client.get(self.url, {"search": "Morgan"})
        invalid = self.client.get(self.url, {"status": "UNKNOWN"})
        assignees = self.client.get(
            reverse("operational-appointments-assignees")
        )

        patient_name = overdue.patient_name
        self.patient.delete()
        overdue.refresh_from_db()

        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertEqual(summary.data["overdue"], 1)
        self.assertEqual(summary.data["upcoming"], 1)
        self.assertEqual(summary.data["unassigned"], 1)
        self.assertEqual(summary.data["next"]["id"], upcoming.data["id"])
        self.assertEqual(filtered.data["count"], 1)
        self.assertEqual(search.data["count"], 2)
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn(
            self.stock_assistant.username,
            {user["username"] for user in assignees.data},
        )
        self.assertIsNone(overdue.patient)
        self.assertEqual(overdue.patient_name, patient_name)


class InternalResourceLinkApiTest(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.manager = user_model.objects.create_user(
            username="resource_manager",
            password="ResourceTest123!",
        )
        assign_role(self.manager, PharmacyRole.MANAGER)
        self.pharmacist = user_model.objects.create_user(
            username="resource_pharmacist",
            password="ResourceTest123!",
        )
        assign_role(self.pharmacist, PharmacyRole.PHARMACIST)
        self.client.force_authenticate(self.manager)
        self.url = reverse("internal-resources-list")

    def create_resource(self, **overrides):
        payload = {
            "title": "Local operating procedure",
            "description": "Original internal reference material.",
            "url": "https://example.com/pharmacy-procedure",
            "category": InternalResourceLink.Category.OPERATIONS,
            "is_active": True,
            "sort_order": 10,
        }
        payload.update(overrides)
        return self.client.post(self.url, payload, format="json")

    def test_resource_api_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_manager_creates_resource_with_safe_audit(self):
        response = self.create_resource()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        resource = InternalResourceLink.objects.get(pk=response.data["id"])
        self.assertEqual(resource.created_by, self.manager)
        self.assertEqual(
            resource.created_by_username,
            self.manager.username,
        )
        event = AuditEvent.objects.get(
            action=AuditEvent.Action.CREATE,
            entity_type="InternalResourceLink",
            entity_identifier=str(resource.id),
        )
        self.assertNotIn(resource.title, event.summary)
        self.assertNotIn(resource.url, event.summary)

    def test_resource_url_must_be_https_without_credentials(self):
        insecure = self.create_resource(url="http://example.com/resource")
        credentials = self.create_resource(
            url="https://user:secret@example.com/resource"
        )

        self.assertEqual(
            insecure.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            credentials.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_staff_only_see_active_resources_and_cannot_write(self):
        active = self.create_resource().data["id"]
        self.create_resource(
            title="Inactive resource",
            url="https://example.com/inactive",
            is_active=False,
        )
        self.client.force_authenticate(self.pharmacist)

        response = self.client.get(self.url)
        denied = self.create_resource(
            title="Must not create",
            url="https://example.com/denied",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["id"] for item in response.data},
            {active},
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_filters_and_updates_resource_state(self):
        resource_id = self.create_resource(
            category=InternalResourceLink.Category.TRAINING,
        ).data["id"]
        self.create_resource(
            title="Policy reference",
            url="https://example.com/policy",
            category=InternalResourceLink.Category.POLICY,
        )

        filtered = self.client.get(
            self.url,
            {"category": InternalResourceLink.Category.TRAINING},
        )
        search = self.client.get(self.url, {"search": "Policy"})
        invalid = self.client.get(self.url, {"category": "UNKNOWN"})
        updated = self.client.patch(
            reverse("internal-resources-detail", args=[resource_id]),
            {"is_active": False},
            format="json",
        )

        self.assertEqual(len(filtered.data), 1)
        self.assertEqual(filtered.data[0]["id"], resource_id)
        self.assertEqual(len(search.data), 1)
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(updated.data["is_active"])
