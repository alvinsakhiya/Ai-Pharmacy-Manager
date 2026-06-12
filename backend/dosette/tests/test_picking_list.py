from datetime import date

from django.test import TestCase

from patients.models import Patient
from inventory.models import Medication
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

    def test_weekly_quantity_calculation(self):
        picking_list = generate_patient_picking_list(self.patient)

        self.assertEqual(len(picking_list), 1)

        item = picking_list[0]

        self.assertEqual(item["weekly_quantity"], 14)
        self.assertEqual(item["morning_dose"], "1")
        self.assertEqual(item["evening_dose"], "1")