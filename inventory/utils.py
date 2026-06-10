from datetime import timedelta
from django.utils import timezone
from .models import StockBatch


def get_fefo_batches_for_medication(medication):
    return StockBatch.objects.filter(
        medication=medication,
        quantity__gt=0
    ).order_by("expiry_date")


def allocate_stock_fefo(medication, required_quantity):
    batches = get_fefo_batches_for_medication(medication)

    remaining_quantity = required_quantity
    allocation = []

    for batch in batches:
        if remaining_quantity <= 0:
            break

        quantity_from_batch = min(batch.quantity, remaining_quantity)

        allocation.append({
            "batch": batch,
            "quantity": quantity_from_batch,
            "expiry_date": batch.expiry_date,
        })

        remaining_quantity -= quantity_from_batch

    return {
        "medication": medication,
        "required_quantity": required_quantity,
        "allocated": allocation,
        "shortfall": remaining_quantity,
    }


def get_expiry_alerts():
    today = timezone.now().date()

    return {
        "expired": StockBatch.objects.filter(
            expiry_date__lt=today,
            quantity__gt=0
        ).order_by("expiry_date"),

        "one_month": StockBatch.objects.filter(
            expiry_date__gte=today,
            expiry_date__lte=today + timedelta(days=30),
            quantity__gt=0
        ).order_by("expiry_date"),

        "three_months": StockBatch.objects.filter(
            expiry_date__gt=today + timedelta(days=30),
            expiry_date__lte=today + timedelta(days=90),
            quantity__gt=0
        ).order_by("expiry_date"),

        "six_months": StockBatch.objects.filter(
            expiry_date__gt=today + timedelta(days=90),
            expiry_date__lte=today + timedelta(days=180),
            quantity__gt=0
        ).order_by("expiry_date"),
    }