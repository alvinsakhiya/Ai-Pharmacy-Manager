"""Picking API validation and workflow-guard tests."""
from datetime import date

import pytest

from apps.dosette.models import DAYS, DosetteItem, DosettePlan
from apps.patients.models import Patient
from apps.picking.services import generate_picking_list


@pytest.fixture
def picking_item(db, medicine):
    patient = Patient.objects.create(
        patient_id="PT-PICK",
        first_name="Pick",
        last_name="Test",
        date_of_birth=date(1950, 1, 1),
        is_dosette=True,
    )
    plan = DosettePlan.objects.create(patient=patient)
    DosetteItem.objects.create(
        plan=plan,
        medicine=medicine,
        schedule={day: ["morning"] for day in DAYS},
    )
    return generate_picking_list(date.today()).items.get()


@pytest.mark.django_db
def test_generate_rejects_invalid_date(auth):
    response = auth("dispenser").post(
        "/api/picking-lists/generate/",
        {"period_start": "not-a-date", "weeks": 1},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_picking_item_cannot_be_patched_directly(auth, picking_item):
    response = auth("dispenser").patch(
        f"/api/picking-items/{picking_item.id}/",
        {"is_picked": True},
        format="json",
    )

    assert response.status_code == 405
    picking_item.refresh_from_db()
    assert picking_item.is_picked is False


@pytest.mark.django_db
def test_toggle_picked_records_authenticated_user(auth, users, picking_item):
    response = auth("dispenser").post(
        f"/api/picking-items/{picking_item.id}/toggle-picked/"
    )

    assert response.status_code == 200
    picking_item.refresh_from_db()
    assert picking_item.is_picked is True
    assert picking_item.picked_by == users["dispenser"]
    assert picking_item.picked_at is not None
