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
            batch_number="EXPIRED001",
            quantity=100,
            expiry_date=date.today() - timedelta(days=1),
            received_date=date.today(),
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

    def test_fefo_excludes_expired_batches(self):
        allocation = allocate_stock_fefo(
            self.medication,
            120
        )

        allocated_batches = [
            item["batch"].batch_number
            for item in allocation["allocated"]
        ]

        self.assertEqual(allocated_batches, ["B001", "B002"])
        self.assertEqual(allocation["shortfall"], 20)

    def test_batch_expiring_today_remains_available(self):
        StockBatch.objects.create(
            medication=self.medication,
            batch_number="TODAY001",
            quantity=10,
            expiry_date=date.today(),
            received_date=date.today(),
        )

        allocation = allocate_stock_fefo(
            self.medication,
            10
        )

        self.assertEqual(
            allocation["allocated"][0]["batch"].batch_number,
            "TODAY001"
        )
        self.assertEqual(allocation["shortfall"], 0)
