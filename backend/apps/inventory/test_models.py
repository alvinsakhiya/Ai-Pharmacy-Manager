from datetime import date
from decimal import Decimal

import pytest
from django.db import IntegrityError

from apps.catalogue.models import Medication, MedicationForm
from apps.tenancy.models import Group, Pharmacy

from .models import StockBatch, StockItem


def create_stock_data():
    group = Group.objects.create(name="Group One", slug="inventory-model-group")
    pharmacy_one = Pharmacy.objects.create(group=group, name="Pharmacy One", code="P1")
    pharmacy_two = Pharmacy.objects.create(group=group, name="Pharmacy Two", code="P2")
    medication_one = Medication.objects.create(
        group=group,
        name="Paracetamol",
        form=MedicationForm.TABLET,
        strength="500 mg",
    )
    medication_two = Medication.objects.create(
        group=group,
        name="Ibuprofen",
        form=MedicationForm.TABLET,
        strength="200 mg",
    )
    return group, pharmacy_one, pharmacy_two, medication_one, medication_two


@pytest.mark.django_db
def test_stock_item_can_be_created():
    _, pharmacy, _, medication, _ = create_stock_data()

    stock_item = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=medication,
        unit_price=Decimal("0.03"),
        reorder_level=20,
    )

    assert stock_item.pharmacy == pharmacy
    assert stock_item.medication == medication
    assert stock_item.unit_price == Decimal("0.03")
    assert stock_item.reorder_level == 20
    assert stock_item.is_active is True


@pytest.mark.django_db
def test_stock_item_is_unique_per_pharmacy_and_medication():
    _, pharmacy, _, medication, _ = create_stock_data()
    StockItem.objects.create(pharmacy=pharmacy, medication=medication)

    with pytest.raises(IntegrityError):
        StockItem.objects.create(pharmacy=pharmacy, medication=medication)


@pytest.mark.django_db
def test_same_medication_can_be_stocked_in_different_pharmacies():
    _, pharmacy_one, pharmacy_two, medication, _ = create_stock_data()

    first = StockItem.objects.create(pharmacy=pharmacy_one, medication=medication)
    second = StockItem.objects.create(pharmacy=pharmacy_two, medication=medication)

    assert first.pk != second.pk


@pytest.mark.django_db
def test_batch_number_is_unique_per_stock_item():
    _, pharmacy, _, medication, _ = create_stock_data()
    stock_item = StockItem.objects.create(pharmacy=pharmacy, medication=medication)
    StockBatch.objects.create(
        stock_item=stock_item,
        batch_number="BATCH-1",
        expiry_date=date(2027, 1, 31),
        quantity=10,
        quantity_received=10,
        received_at=date(2026, 1, 1),
    )

    with pytest.raises(IntegrityError):
        StockBatch.objects.create(
            stock_item=stock_item,
            batch_number="BATCH-1",
            expiry_date=date(2027, 2, 28),
            quantity=10,
            quantity_received=10,
            received_at=date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_same_batch_number_can_exist_under_different_stock_items():
    _, pharmacy, _, medication_one, medication_two = create_stock_data()
    stock_item_one = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=medication_one,
    )
    stock_item_two = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=medication_two,
    )

    first = StockBatch.objects.create(
        stock_item=stock_item_one,
        batch_number="BATCH-1",
        expiry_date=date(2027, 1, 31),
        quantity=10,
        quantity_received=10,
        received_at=date(2026, 1, 1),
    )
    second = StockBatch.objects.create(
        stock_item=stock_item_two,
        batch_number="BATCH-1",
        expiry_date=date(2027, 1, 31),
        quantity=10,
        quantity_received=10,
        received_at=date(2026, 1, 1),
    )

    assert first.pk != second.pk


@pytest.mark.django_db
def test_batches_are_fefo_ordered_by_expiry_then_id():
    _, pharmacy, _, medication, _ = create_stock_data()
    stock_item = StockItem.objects.create(pharmacy=pharmacy, medication=medication)
    later = StockBatch.objects.create(
        stock_item=stock_item,
        batch_number="LATER",
        expiry_date=date(2027, 6, 30),
        quantity=10,
        quantity_received=10,
        received_at=date(2026, 1, 1),
    )
    earliest = StockBatch.objects.create(
        stock_item=stock_item,
        batch_number="EARLIEST",
        expiry_date=date(2027, 1, 31),
        quantity=10,
        quantity_received=10,
        received_at=date(2026, 1, 1),
    )
    same_expiry_first = StockBatch.objects.create(
        stock_item=stock_item,
        batch_number="SAME-1",
        expiry_date=date(2027, 3, 31),
        quantity=10,
        quantity_received=10,
        received_at=date(2026, 1, 1),
    )
    same_expiry_second = StockBatch.objects.create(
        stock_item=stock_item,
        batch_number="SAME-2",
        expiry_date=date(2027, 3, 31),
        quantity=10,
        quantity_received=10,
        received_at=date(2026, 1, 1),
    )

    assert list(StockBatch.objects.all()) == [
        earliest,
        same_expiry_first,
        same_expiry_second,
        later,
    ]
    assert same_expiry_first.id < same_expiry_second.id
