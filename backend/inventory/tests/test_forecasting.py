from datetime import date, timedelta

from django.test import TestCase
from django.utils import timezone

from inventory.models import Medication, StockBatch
from inventory.forecasting import (
    generate_medication_forecast,
    get_total_stock_for_medication,
)
from patients.models import Patient
from dosette.models import DosetteRecord


class ForecastingTest(TestCase):

    def setUp(self):
        today = timezone.now().date()

        self.medication = Medication.objects.create(
            name="Metformin",
            strength="500mg",
            form="Tablet"
        )

        StockBatch.objects.create(
            medication=self.medication,
            batch_number="MET001",
            quantity=100,
            expiry_date=today + timedelta(days=365),
            received_date=today,
        )

        StockBatch.objects.create(
            medication=self.medication,
            batch_number="EXPIRED-MET",
            quantity=1000,
            expiry_date=today - timedelta(days=1),
            received_date=today,
        )

        StockBatch.objects.create(
            medication=self.medication,
            batch_number="EMPTY-MET",
            quantity=0,
            expiry_date=today + timedelta(days=30),
            received_date=today,
        )

        patient = Patient.objects.create(
            first_name="Mary",
            last_name="Johnson",
            date_of_birth=date(1950, 6, 20),
        )

        DosetteRecord.objects.create(
            patient=patient,
            medication=self.medication,
            morning_dose="1",
            afternoon_dose="0",
            evening_dose="1",
            bedtime_dose="0",
            is_active=True
        )

    def test_forecast_generation(self):
        forecasts = generate_medication_forecast()

        metformin_forecast = next(
            item for item in forecasts
            if "Metformin" in item["medication"]
        )

        self.assertEqual(
            set(metformin_forecast),
            {
                "medication",
                "current_stock",
                "predicted_weekly_demand",
                "weeks_of_cover",
                "recommendation",
                "risk_level",
            },
        )

        self.assertEqual(
            metformin_forecast["current_stock"],
            100
        )

        self.assertEqual(
            metformin_forecast["predicted_weekly_demand"],
            14
        )

        self.assertEqual(
            metformin_forecast["weeks_of_cover"],
            7.1
        )

        self.assertEqual(
            metformin_forecast["risk_level"],
            "Low"
        )

    def test_total_stock_helper_excludes_expired_batches(self):
        self.assertEqual(
            get_total_stock_for_medication(self.medication),
            100,
        )

    def test_expired_stock_cannot_reduce_reorder_risk(self):
        StockBatch.objects.filter(batch_number="MET001").update(quantity=5)

        forecasts = generate_medication_forecast()
        metformin_forecast = next(
            item for item in forecasts
            if "Metformin" in item["medication"]
        )

        self.assertEqual(metformin_forecast["current_stock"], 5)
        self.assertEqual(metformin_forecast["weeks_of_cover"], 0.4)
        self.assertEqual(metformin_forecast["risk_level"], "High")
        self.assertEqual(
            metformin_forecast["recommendation"],
            "Urgent reorder required",
        )
