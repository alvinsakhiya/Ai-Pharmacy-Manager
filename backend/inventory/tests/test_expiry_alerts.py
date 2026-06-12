from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from inventory.models import Medication, StockBatch
from inventory.utils import get_expiry_alerts


class ExpiryAlertTest(TestCase):

    def setUp(self):
        self.medication = Medication.objects.create(
            name="Amlodipine",
            strength="5mg",
            form="Tablet"
        )

        today = timezone.now().date()

        StockBatch.objects.create(
            medication=self.medication,
            batch_number="EXP001",
            quantity=20,
            expiry_date=today - timedelta(days=1),
            received_date=today
        )

        StockBatch.objects.create(
            medication=self.medication,
            batch_number="ONE001",
            quantity=30,
            expiry_date=today + timedelta(days=15),
            received_date=today
        )

        StockBatch.objects.create(
            medication=self.medication,
            batch_number="THREE001",
            quantity=40,
            expiry_date=today + timedelta(days=60),
            received_date=today
        )

        StockBatch.objects.create(
            medication=self.medication,
            batch_number="SIX001",
            quantity=50,
            expiry_date=today + timedelta(days=120),
            received_date=today
        )

    def test_expiry_alert_categories(self):
        alerts = get_expiry_alerts()

        self.assertEqual(alerts["expired"].count(), 1)
        self.assertEqual(alerts["one_month"].count(), 1)
        self.assertEqual(alerts["three_months"].count(), 1)
        self.assertEqual(alerts["six_months"].count(), 1)

        self.assertEqual(alerts["expired"].first().batch_number, "EXP001")
        self.assertEqual(alerts["one_month"].first().batch_number, "ONE001")
        self.assertEqual(alerts["three_months"].first().batch_number, "THREE001")
        self.assertEqual(alerts["six_months"].first().batch_number, "SIX001")