from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.roles import PharmacyRole, assign_role
from dosette.models import DosetteRecord
from inventory.models import Medication, StockBatch
from patients.models import Patient

from .models import AuditEvent


class AuditEventTest(APITestCase):
    def setUp(self):
        self.password = "AuditTestPassword123!"
        self.user = get_user_model().objects.create_user(
            username="audit_pharmacist",
            password=self.password,
        )
        assign_role(self.user, PharmacyRole.MANAGER)
        self.client.force_authenticate(self.user)

        self.patient = Patient.objects.create(
            first_name="Existing",
            last_name="Patient",
            date_of_birth=date(1950, 1, 1),
        )
        self.medication = Medication.objects.create(
            name="Audit Medicine",
            strength="10mg",
            form="Tablet",
        )
        self.batch = StockBatch.objects.create(
            medication=self.medication,
            batch_number="AUDIT-001",
            quantity=100,
            expiry_date=timezone.now().date() + timedelta(days=90),
            received_date=timezone.now().date(),
        )
        DosetteRecord.objects.create(
            patient=self.patient,
            medication=self.medication,
            morning_dose="1",
            is_active=True,
        )

    def test_patient_crud_actions_create_safe_audit_events(self):
        create_response = self.client.post(
            reverse("patients-list"),
            {
                "first_name": "Private",
                "last_name": "Person",
                "date_of_birth": "1960-01-01",
                "notes": "Sensitive note must never enter the audit summary.",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        patient_id = create_response.data["id"]

        update_response = self.client.patch(
            reverse("patients-detail", args=[patient_id]),
            {"contact_number": "01234567890"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)

        delete_response = self.client.delete(
            reverse("patients-detail", args=[patient_id])
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

        events = AuditEvent.objects.filter(
            entity_type="Patient",
            entity_identifier=str(patient_id),
        ).order_by("timestamp", "id")

        self.assertEqual(
            list(events.values_list("action", flat=True)),
            [
                AuditEvent.Action.CREATE,
                AuditEvent.Action.UPDATE,
                AuditEvent.Action.DELETE,
            ],
        )
        self.assertTrue(all(event.actor == self.user for event in events))
        self.assertTrue(all(event.actor_username == self.user.username for event in events))
        self.assertTrue(all(event.request_path.startswith("/api/patients") for event in events))

        summaries = " ".join(event.summary for event in events)
        self.assertNotIn("Private", summaries)
        self.assertNotIn("Sensitive note", summaries)
        self.assertIn("contact_number", summaries)

    def test_other_governed_records_are_audited(self):
        medication_response = self.client.patch(
            reverse("medications-detail", args=[self.medication.id]),
            {"manufacturer": "Updated Manufacturer"},
            format="json",
        )
        batch_response = self.client.post(
            reverse("stock-batches-adjust", args=[self.batch.id]),
            {
                "movement_type": "ADJUSTMENT",
                "quantity_change": -20,
                "reason": "Audit test stock count.",
            },
            format="json",
        )
        dosette = DosetteRecord.objects.get(patient=self.patient)
        dosette_response = self.client.patch(
            reverse("dosette-records-detail", args=[dosette.id]),
            {"evening_dose": "1"},
            format="json",
        )

        self.assertEqual(medication_response.status_code, status.HTTP_200_OK)
        self.assertEqual(batch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(dosette_response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.UPDATE,
                entity_type="Medication",
                entity_identifier=str(self.medication.id),
            ).exists()
        )
        self.assertTrue(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.UPDATE,
                entity_type="StockBatch",
                entity_identifier=str(self.batch.id),
            ).exists()
        )
        self.assertTrue(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.UPDATE,
                entity_type="DosetteRecord",
                entity_identifier=str(dosette.id),
            ).exists()
        )

    def test_operational_access_is_audited(self):
        picking_response = self.client.get(
            reverse("patient_picking_list", args=[self.patient.id])
        )
        forecast_response = self.client.get(reverse("medication_forecasts"))
        intelligence_response = self.client.get(reverse("stock_intelligence"))
        alerts_response = self.client.get(reverse("expiry_alerts"))

        self.assertEqual(picking_response.status_code, status.HTTP_200_OK)
        self.assertEqual(forecast_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            intelligence_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(alerts_response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.GENERATE,
                entity_type="PatientPickingList",
                entity_identifier=str(self.patient.id),
            ).exists()
        )
        self.assertTrue(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.ACCESS,
                entity_type="MedicationForecast",
            ).exists()
        )
        self.assertTrue(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.ACCESS,
                entity_type="StockIntelligence",
            ).exists()
        )
        self.assertTrue(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.ACCESS,
                entity_type="ExpiryAlert",
            ).exists()
        )

    def test_audit_api_is_authenticated_paginated_and_read_only(self):
        AuditEvent.objects.create(
            actor=self.user,
            actor_username=self.user.username,
            action=AuditEvent.Action.ACCESS,
            entity_type="TestRecord",
            entity_identifier="1",
            summary="Viewed test record.",
            request_path="/api/test/",
        )

        response = self.client.get(reverse("audit-events-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["actor_display"], self.user.username)

        for method in ("post", "put", "patch", "delete"):
            with self.subTest(method=method):
                request_method = getattr(self.client, method)
                write_response = request_method(
                    reverse("audit-events-list"),
                    {},
                    format="json",
                )
                self.assertEqual(
                    write_response.status_code,
                    status.HTTP_405_METHOD_NOT_ALLOWED,
                )

        self.client.force_authenticate(user=None)
        unauthenticated_response = self.client.get(reverse("audit-events-list"))
        self.assertEqual(
            unauthenticated_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_audit_events_are_immutable(self):
        event = AuditEvent.objects.create(
            actor=self.user,
            actor_username=self.user.username,
            action=AuditEvent.Action.ACCESS,
            entity_type="TestRecord",
            summary="Viewed test record.",
        )

        event.summary = "Changed"

        with self.assertRaises(ValidationError):
            event.save()

        with self.assertRaises(ValidationError):
            event.delete()

        with self.assertRaises(ValidationError):
            AuditEvent.objects.filter(pk=event.pk).update(summary="Changed")

        with self.assertRaises(ValidationError):
            AuditEvent.objects.filter(pk=event.pk).delete()

    def test_login_and_logout_are_audited(self):
        self.client.force_authenticate(user=None)

        login_response = self.client.post(
            reverse("token_obtain_pair"),
            {
                "username": self.user.username,
                "password": self.password,
            },
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )
        logout_response = self.client.post(reverse("logout"))

        self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(
            AuditEvent.objects.filter(
                actor_username=self.user.username,
                action=AuditEvent.Action.LOGIN,
                entity_type="StaffSession",
            ).exists()
        )
        self.assertTrue(
            AuditEvent.objects.filter(
                actor_username=self.user.username,
                action=AuditEvent.Action.LOGOUT,
                entity_type="StaffSession",
            ).exists()
        )
