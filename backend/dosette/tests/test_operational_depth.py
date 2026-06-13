from datetime import date

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.roles import PharmacyRole, assign_role
from auditlog.models import AuditEvent
from dosette.models import DosetteMedicationChange, DosetteRecord
from inventory.models import Medication
from patients.models import Patient


class DosetteOperationalDepthTest(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="dosette_history_pharmacist",
            password="DosetteHistory123!",
        )
        assign_role(self.user, PharmacyRole.PHARMACIST)
        self.client.force_authenticate(self.user)
        self.patient = Patient.objects.create(
            first_name="Cycle",
            last_name="Patient",
            date_of_birth=date(1950, 1, 1),
            care_setting=Patient.CareSetting.CARE_HOME,
        )
        self.medication = Medication.objects.create(
            name="Cycle Medicine",
            strength="10mg",
            form="Tablet",
        )

    def payload(self, **overrides):
        data = {
            "patient": self.patient.id,
            "medication": self.medication.id,
            "morning_dose": "1",
            "afternoon_dose": "",
            "evening_dose": "0.5",
            "bedtime_dose": "",
            "instructions": "Sensitive administration instruction.",
            "is_active": True,
            "cycle_start_date": "2026-06-15",
            "cycle_length_weeks": 4,
            "review_date": "2026-07-13",
        }
        data.update(overrides)
        return data

    def create_record(self, **overrides):
        return self.client.post(
            reverse("dosette-records-list"),
            self.payload(**overrides),
            format="json",
        )

    def test_create_records_cycle_metadata_and_safe_immutable_snapshot(self):
        response = self.create_record()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["cycle_start_date"], "2026-06-15")
        self.assertEqual(response.data["cycle_length_weeks"], 4)
        self.assertEqual(response.data["review_date"], "2026-07-13")
        self.assertEqual(
            response.data["patient_care_setting"],
            Patient.CareSetting.CARE_HOME,
        )
        self.assertEqual(
            response.data["patient_care_setting_label"],
            "Care home",
        )

        history = DosetteMedicationChange.objects.get(
            dosette_record_identifier=response.data["id"]
        )
        self.assertEqual(
            history.change_type,
            DosetteMedicationChange.ChangeType.CREATED,
        )
        self.assertEqual(history.patient_identifier, self.patient.id)
        self.assertEqual(history.medication_identifier, self.medication.id)
        self.assertEqual(history.morning_dose, "1")
        self.assertEqual(history.evening_dose, "0.5")
        self.assertEqual(history.cycle_start_date, date(2026, 6, 15))
        self.assertEqual(history.review_date, date(2026, 7, 13))
        self.assertEqual(history.actor, self.user)
        self.assertIn("instructions", history.changed_fields)
        self.assertNotIn(
            "Sensitive administration instruction",
            " ".join(
                [
                    history.patient_name,
                    history.medication_name,
                    history.actor_username,
                    str(history.changed_fields),
                ]
            ),
        )
        self.assertTrue(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.CREATE,
                entity_type="DosetteRecord",
                entity_identifier=str(response.data["id"]),
            ).exists()
        )

    def test_updates_and_status_changes_create_explainable_history(self):
        create_response = self.create_record()
        record_id = create_response.data["id"]

        update_response = self.client.patch(
            reverse("dosette-records-detail", args=[record_id]),
            {
                "morning_dose": "2",
                "review_date": "2026-08-10",
            },
            format="json",
        )
        deactivate_response = self.client.patch(
            reverse("dosette-records-detail", args=[record_id]),
            {"is_active": False},
            format="json",
        )
        activate_response = self.client.patch(
            reverse("dosette-records-detail", args=[record_id]),
            {"is_active": True},
            format="json",
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(deactivate_response.status_code, status.HTTP_200_OK)
        self.assertEqual(activate_response.status_code, status.HTTP_200_OK)

        changes = list(
            DosetteMedicationChange.objects.filter(
                dosette_record_identifier=record_id
            ).order_by("id")
        )
        self.assertEqual(
            [change.change_type for change in changes],
            [
                DosetteMedicationChange.ChangeType.CREATED,
                DosetteMedicationChange.ChangeType.UPDATED,
                DosetteMedicationChange.ChangeType.DEACTIVATED,
                DosetteMedicationChange.ChangeType.ACTIVATED,
            ],
        )
        self.assertEqual(
            changes[1].changed_fields,
            ["morning_dose", "review_date"],
        )
        self.assertEqual(changes[1].morning_dose, "2")
        self.assertEqual(changes[1].review_date, date(2026, 8, 10))
        self.assertFalse(changes[2].is_active)
        self.assertTrue(changes[3].is_active)

    def test_delete_preserves_snapshot_and_history_cannot_be_mutated(self):
        create_response = self.create_record()
        record_id = create_response.data["id"]

        response = self.client.delete(
            reverse("dosette-records-detail", args=[record_id])
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(DosetteRecord.objects.filter(pk=record_id).exists())
        deleted = DosetteMedicationChange.objects.get(
            dosette_record_identifier=record_id,
            change_type=DosetteMedicationChange.ChangeType.DELETED,
        )
        self.assertEqual(deleted.patient_name, str(self.patient))
        self.assertEqual(deleted.medication_name, str(self.medication))

        deleted.morning_dose = "9"
        with self.assertRaises(DjangoValidationError):
            deleted.save()
        with self.assertRaises(DjangoValidationError):
            deleted.delete()
        with self.assertRaises(DjangoValidationError):
            DosetteMedicationChange.objects.filter(pk=deleted.pk).update(
                morning_dose="9"
            )
        with self.assertRaises(DjangoValidationError):
            DosetteMedicationChange.objects.filter(pk=deleted.pk).delete()

    def test_history_endpoint_is_read_only_filterable_and_validated(self):
        first = self.create_record()
        other_patient = Patient.objects.create(
            first_name="Other",
            last_name="Cycle",
            date_of_birth=date(1960, 1, 1),
        )
        second = self.create_record(patient=other_patient.id)
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)

        history_url = reverse("dosette-changes-list")
        patient_response = self.client.get(
            history_url,
            {"patient": self.patient.id},
        )
        record_response = self.client.get(
            history_url,
            {"dosette_record": first.data["id"]},
        )
        type_response = self.client.get(
            history_url,
            {"change_type": "created"},
        )
        search_response = self.client.get(
            history_url,
            {"search": "Cycle Medicine"},
        )

        self.assertEqual(patient_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patient_response.data["count"], 1)
        self.assertEqual(record_response.data["count"], 1)
        self.assertEqual(type_response.data["count"], 2)
        self.assertEqual(search_response.data["count"], 2)
        history_item = record_response.data["results"][0]
        self.assertEqual(history_item["actor_display"], self.user.username)
        self.assertEqual(history_item["change_type_label"], "Created")
        self.assertNotIn("instructions", history_item)

        invalid_patient = self.client.get(history_url, {"patient": "bad"})
        invalid_record = self.client.get(
            history_url,
            {"dosette_record": "bad"},
        )
        invalid_type = self.client.get(
            history_url,
            {"change_type": "unknown"},
        )
        write_response = self.client.post(history_url, {}, format="json")

        self.assertEqual(
            invalid_patient.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            invalid_record.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            invalid_type.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            write_response.status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def test_cycle_and_care_setting_values_are_validated(self):
        zero_cycle = self.create_record(cycle_length_weeks=0)
        long_cycle = self.create_record(cycle_length_weeks=53)
        invalid_care_setting = self.client.patch(
            reverse("patients-detail", args=[self.patient.id]),
            {"care_setting": "UNSUPPORTED"},
            format="json",
        )

        self.assertEqual(
            zero_cycle.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("cycle_length_weeks", zero_cycle.data)
        self.assertEqual(
            long_cycle.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("cycle_length_weeks", long_cycle.data)
        self.assertEqual(
            invalid_care_setting.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("care_setting", invalid_care_setting.data)
