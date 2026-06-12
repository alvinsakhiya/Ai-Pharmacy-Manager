from datetime import date

from django.test import TestCase

from inventory.models import Medication, StockBatch
from inventory.forecasting import generate_medication_forecast
from patients.models import Patient
from dosette.models import DosetteRecord


class ForecastingTest(TestCase):

    def setUp(self):
        self.medication = Medication.objects.create(
            name="Metformin",
            strength="500mg",
            form="Tablet"
        )

        StockBatch.objects.create(
            medication=self.medication,
            batch_number="MET001",
            quantity=100,
            expiry_date=date(2027, 12, 31),
            received_date=date.today()
        )

        patient = Patient.objects.create(
            first_name="Mary",
            last_name="Johnson",
            date_of_birth=date(1950, 6, 20)
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