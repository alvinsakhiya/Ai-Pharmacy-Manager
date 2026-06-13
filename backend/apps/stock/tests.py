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
