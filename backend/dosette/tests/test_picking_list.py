from datetime import date, timedelta

from django.test import TestCase

from patients.models import Patient
from inventory.models import Medication, StockBatch
from dosette.models import DosetteRecord
from dosette.utils import generate_patient_picking_list


class PickingListGenerationTest(TestCase):

    def setUp(self):
        self.patient = Patient.objects.create(
            first_name="John",
            last_name="Smith",
            date_of_birth=date(1940, 5, 15)
        )

        self.medication = Medication.objects.create(
            name="Paracetamol",
            strength="500mg",
            form="Tablet"
        )

        DosetteRecord.objects.create(
            patient=self.patient,
            medication=self.medication,
            morning_dose="1",
            afternoon_dose="0",
            evening_dose="1",
            bedtime_dose="0",
            is_active=True
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
            batch_number="EMPTY001",
            quantity=0,
            expiry_date=date.today() + timedelta(days=7),
            received_date=date.today(),
        )

        StockBatch.objects.create(
            medication=self.medication,
            batch_number="ACTIVE001",
            quantity=10,
            expiry_date=date.today() + timedelta(days=30),
            received_date=date.today(),
        )

    def test_weekly_quantity_calculation(self):
        picking_list = generate_patient_picking_list(self.patient)

        self.assertEqual(len(picking_list), 1)

        item = picking_list[0]

        self.assertEqual(item["weekly_quantity"], 14)
        self.assertEqual(item["morning_dose"], "1")
        self.assertEqual(item["evening_dose"], "1")

    def test_picking_list_only_allocates_usable_stock(self):
        picking_list = generate_patient_picking_list(self.patient)
        allocation = picking_list[0]["fefo_allocation"]

        allocated_batches = [
            item["batch"].batch_number
            for item in allocation["allocated"]
        ]

        self.assertEqual(allocated_batches, ["ACTIVE001"])
        self.assertEqual(allocation["allocated"][0]["quantity"], 10)
        self.assertEqual(allocation["shortfall"], 4)
