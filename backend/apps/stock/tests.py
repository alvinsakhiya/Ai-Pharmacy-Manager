"""Tests for FEFO allocation and inventory aggregates."""
from datetime import date, timedelta

import pytest

from apps.stock.models import InsufficientStock, StockBatch, StockMovement, fefo_allocate


@pytest.mark.django_db
def test_fefo_uses_soonest_expiry_first(medicine, batches):
    # Need 150 units: should fully drain the 100-unit short-dated batch first.
    plan = fefo_allocate(medicine, 150, commit=True, reference="t")
    assert plan[0]["batch"].batch_number == "OLD1"
    assert plan[0]["taken"] == 100
    assert plan[1]["taken"] == 50
    batches[0].refresh_from_db()
    batches[1].refresh_from_db()
    assert batches[0].quantity_on_hand == 0
    assert batches[1].quantity_on_hand == 150
    assert StockMovement.objects.filter(kind="dispense").count() == 2


@pytest.mark.django_db
def test_fefo_skips_expired_batches(medicine, supplier):
    today = date.today()
    StockBatch.objects.create(medicine=medicine, supplier=supplier, batch_number="EXP",
                              expiry_date=today - timedelta(days=1),
                              quantity_received=500, quantity_on_hand=500, unit_cost="0.03")
    StockBatch.objects.create(medicine=medicine, supplier=supplier, batch_number="OK",
                              expiry_date=today + timedelta(days=100),
                              quantity_received=80, quantity_on_hand=80, unit_cost="0.03")
    plan = fefo_allocate(medicine, 80, commit=False)
    assert len(plan) == 1 and plan[0]["batch"].batch_number == "OK"


@pytest.mark.django_db
def test_fefo_raises_when_short(medicine, batches):
    with pytest.raises(InsufficientStock):
        fefo_allocate(medicine, 10_000, commit=False)


@pytest.mark.django_db
def test_fefo_rejects_non_positive_quantity(medicine, batches):
    with pytest.raises(ValueError):
        fefo_allocate(medicine, 0, commit=False)


@pytest.mark.django_db
def test_quantity_on_hand_and_low_stock(medicine, batches):
    assert medicine.quantity_on_hand() == 300
    assert medicine.is_low_stock() is False
    batches[1].quantity_on_hand = 50
    batches[1].save()
    batches[0].quantity_on_hand = 50
    batches[0].save()
    assert medicine.is_low_stock() is True  # 100 <= reorder_level 200


@pytest.mark.django_db
def test_expiry_band(medicine, batches):
    assert batches[0].expiry_band == "le_30"
    assert batches[1].expiry_band in ("fresh",)


@pytest.mark.django_db
def test_batch_quantity_cannot_be_patched_without_movement(auth, batches):
    batch = batches[0]

    response = auth("dispenser").patch(
        f"/api/batches/{batch.id}/",
        {"quantity_on_hand": 1},
        format="json",
    )

    assert response.status_code == 400
    batch.refresh_from_db()
    assert batch.quantity_on_hand == 100
    assert StockMovement.objects.filter(batch=batch).count() == 0


@pytest.mark.django_db
def test_batches_and_medicines_cannot_be_deleted_through_api(auth, medicine, batches):
    client = auth("pharmacist")

    assert client.delete(f"/api/batches/{batches[0].id}/").status_code == 405
    assert client.delete(f"/api/medicines/{medicine.id}/").status_code == 405


@pytest.mark.django_db
def test_adjustment_validates_direction_and_records_actor(auth, users, batches):
    batch = batches[0]
    client = auth("dispenser")

    assert client.post(
        "/api/movements/adjust/",
        {"batch": batch.id, "quantity": 5, "kind": "waste", "reason": "Damaged"},
        format="json",
    ).status_code == 400
    assert client.post(
        "/api/movements/adjust/",
        {"batch": batch.id, "quantity": -5, "kind": "return", "reason": "Returned"},
        format="json",
    ).status_code == 400

    response = client.post(
        "/api/movements/adjust/",
        {"batch": batch.id, "quantity": -5, "kind": "waste", "reason": "Damaged"},
        format="json",
    )

    assert response.status_code == 201
    batch.refresh_from_db()
    assert batch.quantity_on_hand == 95
    movement = StockMovement.objects.get(batch=batch)
    assert movement.quantity == -5
    assert movement.actor == users["dispenser"]


@pytest.mark.django_db
def test_fefo_preview_rejects_invalid_quantity(auth, medicine):
    response = auth("pharmacist").post(
        f"/api/medicines/{medicine.id}/fefo-preview/",
        {"quantity": "not-a-number"},
        format="json",
    )

    assert response.status_code == 400
