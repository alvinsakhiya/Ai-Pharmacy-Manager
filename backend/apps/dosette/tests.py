"""Dosette plan / cycle and picking-list generation tests."""
from datetime import date

import pytest

from apps.dosette.models import DAYS, DosetteCycle, DosetteItem, DosettePlan
from apps.patients.models import Patient
from apps.picking.services import generate_picking_list


@pytest.fixture
def patient(db):
    return Patient.objects.create(patient_id="PT-1", first_name="A", last_name="B",
                                  date_of_birth=date(1950, 1, 1), is_dosette=True)


@pytest.mark.django_db
def test_doses_per_week_counts_slots(patient, medicine):
    plan = DosettePlan.objects.create(patient=patient)
    item = DosetteItem.objects.create(
        plan=plan, medicine=medicine, dose_quantity=1,
        schedule={d: ["morning", "bedtime"] for d in DAYS})  # 2/day x 7 days
    assert item.doses_per_week() == 14


@pytest.mark.django_db
def test_cycle_generation_sets_proactive_due_date(patient, medicine):
    plan = DosettePlan.objects.create(patient=patient, frequency="weekly")
    cycle = DosetteCycle.generate_for_plan(plan, start=date.today())
    assert cycle.cycle_start == date.today()
    assert cycle.status == DosetteCycle.Status.SCHEDULED
    assert (cycle.cycle_end - cycle.cycle_start).days == 6


@pytest.mark.django_db
def test_final_check_requires_pharmacist(auth, patient, medicine):
    plan = DosettePlan.objects.create(patient=patient)
    cycle = DosetteCycle.generate_for_plan(plan)
    cycle.status = DosetteCycle.Status.ASSEMBLED
    cycle.save()
    # dispenser is blocked from the pharmacist-only final check
    assert auth("dispenser").post(f"/api/dosette-cycles/{cycle.id}/final_check/").status_code == 403
    assert auth("pharmacist").post(f"/api/dosette-cycles/{cycle.id}/final_check/").status_code == 200


@pytest.mark.django_db
def test_picking_list_aggregates_demand(patient, medicine):
    plan = DosettePlan.objects.create(patient=patient)
    DosetteItem.objects.create(plan=plan, medicine=medicine, dose_quantity=1,
                               schedule={d: ["morning"] for d in DAYS})  # 7/week
    plist = generate_picking_list(date.today(), weeks=1)
    item = plist.items.get(medicine=medicine)
    assert item.quantity_required == 7
    assert item.patient_count == 1
