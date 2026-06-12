from django.test import TestCase
from datetime import date, timedelta

from inventory.models import Medication, StockBatch
from inventory.utils import allocate_stock_fefo


class FEFOAllocationTest(TestCase):

    def setUp(self):
        self.medication = Medication.objects.create(
            name="Paracetamol",
            strength="500mg",
            form="Tablet"
        )

        StockBatch.objects.create(
            medication=self.medication,
            batch_number="B001",
            quantity=50,
            expiry_date=date.today() + timedelta(days=30),
            received_date=date.today(),
        )

        StockBatch.objects.create(
            medication=self.medication,
            batch_number="B002",
            quantity=50,
            expiry_date=date.today() + timedelta(days=90),
            received_date=date.today(),
        )

    def test_fefo_uses_earliest_expiry_first(self):
        allocation = allocate_stock_fefo(
            self.medication,
            60
        )

        self.assertEqual(
            allocation["allocated"][0]["batch"].batch_number,
            "B001"
        )

        self.assertEqual(
            allocation["allocated"][0]["quantity"],
            50
        )

        self.assertEqual(
            allocation["allocated"][1]["batch"].batch_number,
            "B002"
        )

        self.assertEqual(
            allocation["allocated"][1]["quantity"],
            10
        )

        self.assertEqual(
            allocation["shortfall"],
            0
        )