from datetime import date, timedelta

from django.test import TestCase
from django.utils import timezone

from inventory.models import Medication, StockBatch
from inventory.forecasting import (
    generate_medication_forecast,
    generate_stock_intelligence,
    get_total_stock_for_medication,
)
from inventory.serializers import MedicationSerializer
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

        self.assertTrue(
            {
                "medication",
                "current_stock",
                "predicted_weekly_demand",
                "weeks_of_cover",
                "recommendation",
                "risk_level",
            }.issubset(metformin_forecast)
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
        self.assertEqual(metformin_forecast["stock_status"], "ADEQUATE")
        self.assertEqual(metformin_forecast["target_stock"], 56)
        self.assertEqual(
            metformin_forecast["recommended_order_quantity"],
            0,
        )

    def test_forecast_uses_three_prefetched_queries(self):
        with self.assertNumQueries(3):
            generate_medication_forecast()

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

    def test_minimum_threshold_and_target_cover_improve_recommendations(self):
        self.medication.minimum_stock_level = 120
        self.medication.reorder_threshold = 140
        self.medication.save()

        below_minimum = generate_medication_forecast()[0]

        self.assertEqual(below_minimum["stock_status"], "BELOW_MINIMUM")
        self.assertEqual(below_minimum["risk_level"], "High")
        self.assertEqual(below_minimum["target_stock"], 140)
        self.assertEqual(
            below_minimum["recommended_order_quantity"],
            40,
        )

        self.medication.minimum_stock_level = 50
        self.medication.reorder_threshold = 120
        self.medication.save()

        threshold_reached = generate_medication_forecast()[0]

        self.assertEqual(
            threshold_reached["stock_status"],
            "REORDER_THRESHOLD",
        )
        self.assertEqual(threshold_reached["risk_level"], "Medium")
        self.assertEqual(
            threshold_reached["recommended_order_quantity"],
            20,
        )

        self.medication.minimum_stock_level = 0
        self.medication.reorder_threshold = 0
        self.medication.target_weeks_of_cover = 8
        self.medication.save()

        below_target = generate_medication_forecast()[0]

        self.assertEqual(below_target["stock_status"], "BELOW_TARGET")
        self.assertEqual(below_target["target_stock"], 112)
        self.assertEqual(
            below_target["recommended_order_quantity"],
            12,
        )

    def test_inactive_dead_and_excess_stock_are_classified(self):
        today = timezone.localdate()
        recent_inactive = Medication.objects.create(
            name="Recent Inactive",
            strength="5mg",
            form="Tablet",
        )
        StockBatch.objects.create(
            medication=recent_inactive,
            batch_number="RECENT-INACTIVE",
            quantity=20,
            expiry_date=today + timedelta(days=365),
            received_date=today,
        )
        dead_stock = Medication.objects.create(
            name="Dead Stock",
            strength="10mg",
            form="Tablet",
        )
        StockBatch.objects.create(
            medication=dead_stock,
            batch_number="DEAD-STOCK",
            quantity=30,
            expiry_date=today + timedelta(days=365),
            received_date=today - timedelta(days=181),
        )
        excess_stock = Medication.objects.create(
            name="Excess Stock",
            strength="20mg",
            form="Tablet",
        )
        StockBatch.objects.create(
            medication=excess_stock,
            batch_number="EXCESS-STOCK",
            quantity=100,
            expiry_date=today + timedelta(days=365),
            received_date=today,
        )
        no_stock = Medication.objects.create(
            name="No Demand No Stock",
            strength="1mg",
            form="Tablet",
        )
        patient = Patient.objects.create(
            first_name="Stock",
            last_name="Analytics",
            date_of_birth=date(1965, 1, 1),
        )
        DosetteRecord.objects.create(
            patient=patient,
            medication=excess_stock,
            morning_dose="1",
            is_active=True,
        )

        forecasts = {
            item["medication_id"]: item
            for item in generate_medication_forecast()
        }

        self.assertEqual(
            forecasts[recent_inactive.id]["stock_status"],
            "INACTIVE",
        )
        self.assertEqual(
            forecasts[dead_stock.id]["stock_status"],
            "DEAD_STOCK",
        )
        self.assertEqual(
            forecasts[excess_stock.id]["stock_status"],
            "EXCESS_STOCK",
        )
        self.assertEqual(
            forecasts[excess_stock.id]["excess_quantity"],
            72,
        )
        self.assertEqual(
            forecasts[no_stock.id]["stock_status"],
            "NO_DEMAND",
        )

        intelligence = generate_stock_intelligence()

        self.assertEqual(intelligence["summary"]["total_medications"], 5)
        self.assertEqual(intelligence["summary"]["inactive_stock"], 1)
        self.assertEqual(intelligence["summary"]["dead_stock"], 1)
        self.assertEqual(intelligence["summary"]["excess_stock"], 1)
        self.assertEqual(intelligence["summary"]["no_active_demand"], 1)
        self.assertEqual(intelligence["summary"]["adequate_stock"], 1)

    def test_medication_threshold_validation_is_explainable(self):
        serializer = MedicationSerializer(
            self.medication,
            data={
                "minimum_stock_level": 50,
                "reorder_threshold": 20,
            },
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("reorder_threshold", serializer.errors)

        valid_serializer = MedicationSerializer(
            self.medication,
            data={
                "minimum_stock_level": 50,
                "reorder_threshold": 80,
                "target_weeks_of_cover": "6.0",
            },
            partial=True,
        )

        self.assertTrue(valid_serializer.is_valid(), valid_serializer.errors)
