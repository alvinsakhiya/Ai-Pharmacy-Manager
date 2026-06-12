from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from dosette.models import DosetteRecord
from dosette.utils import (
    InvalidDoseValue,
    calculate_weekly_quantity,
    normalise_dose_value,
)
from inventory.models import Medication
from patients.models import Patient


class DoseValueTest(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="dose_safety_user",
            password="SecureDosePassword123!",
        )
        self.client.force_authenticate(self.user)

        self.patient = Patient.objects.create(
            first_name="Dose",
            last_name="Safety",
            date_of_birth=date(1950, 1, 1),
        )
        self.medication = Medication.objects.create(
            name="Dose Test Medicine",
            strength="10mg",
            form="Tablet",
        )

    def dosette_payload(self, **overrides):
        payload = {
            "patient": self.patient.id,
            "medication": self.medication.id,
            "morning_dose": "1",
            "afternoon_dose": "",
            "evening_dose": "0.5",
            "bedtime_dose": "0",
            "instructions": "",
            "is_active": True,
        }
        payload.update(overrides)
        return payload

    def test_normalise_dose_accepts_numbers_and_blank_values(self):
        self.assertEqual(normalise_dose_value("1.5"), Decimal("1.5"))
        self.assertEqual(normalise_dose_value(""), Decimal("0"))
        self.assertEqual(normalise_dose_value("   "), Decimal("0"))
        self.assertEqual(normalise_dose_value(None), Decimal("0"))

    def test_invalid_negative_and_non_finite_doses_are_rejected(self):
        invalid_values = {
            "not a number": "must be a valid number",
            "-1": "cannot be negative",
            "NaN": "must be a finite number",
            "Infinity": "must be a finite number",
            "-Infinity": "must be a finite number",
        }

        for value, expected_error in invalid_values.items():
            with self.subTest(value=value):
                response = self.client.post(
                    reverse("dosette-records-list"),
                    self.dosette_payload(morning_dose=value),
                    format="json",
                )

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("morning_dose", response.data)
                self.assertIn(
                    expected_error,
                    str(response.data["morning_dose"][0]).lower(),
                )

    def test_valid_decimal_doses_preserve_weekly_calculation(self):
        response = self.client.post(
            reverse("dosette-records-list"),
            self.dosette_payload(
                morning_dose="0.5",
                evening_dose="0.5",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        record = DosetteRecord.objects.get(id=response.data["id"])
        self.assertEqual(calculate_weekly_quantity(record), 7)

    def test_legacy_invalid_dose_fails_explicitly_during_calculation(self):
        record = DosetteRecord.objects.create(
            patient=self.patient,
            medication=self.medication,
            morning_dose="invalid legacy value",
            is_active=True,
        )

        with self.assertRaisesRegex(InvalidDoseValue, "Morning dose"):
            calculate_weekly_quantity(record)

    def test_picking_list_reports_legacy_invalid_dose(self):
        DosetteRecord.objects.create(
            patient=self.patient,
            medication=self.medication,
            morning_dose="-2",
            is_active=True,
        )

        response = self.client.get(
            reverse("patient_picking_list", args=[self.patient.id])
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot be negative", response.data["detail"])

    def test_forecast_reports_legacy_invalid_dose(self):
        DosetteRecord.objects.create(
            patient=self.patient,
            medication=self.medication,
            morning_dose="Infinity",
            is_active=True,
        )

        response = self.client.get(reverse("medication_forecasts"))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("must be a finite number", response.data["detail"])
