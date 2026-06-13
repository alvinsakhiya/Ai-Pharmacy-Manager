"""Generate notifications by scanning current operational state.

Idempotent per logical alert via `dedupe_key`, so repeated runs (e.g. a nightly
job) refresh rather than duplicate.
"""
from datetime import date, timedelta

from apps.dosette.models import DosettePlan
from apps.stock.models import Medicine, StockBatch

from .models import Notification


def _upsert(dedupe_key, **fields):
    Notification.objects.update_or_create(
        dedupe_key=dedupe_key,
        defaults={**fields, "is_read": False},
    )


def generate_notifications() -> int:
    created = 0

    # Low stock
    for medicine in Medicine.objects.filter(is_active=True):
        if medicine.is_low_stock():
            _upsert(
                f"low_stock:{medicine.id}",
                level=Notification.Level.WARNING,
                category=Notification.Category.LOW_STOCK,
                title=f"Low stock: {medicine.label}",
                message=f"{medicine.quantity_on_hand()} units on hand "
                        f"(reorder level {medicine.reorder_level}).",
                link="/stock",
            )
            created += 1

    # Expiry within 30 days
    cutoff = date.today() + timedelta(days=30)
    for batch in StockBatch.objects.filter(
        quantity_on_hand__gt=0, expiry_date__lte=cutoff, expiry_date__gte=date.today()
    ).select_related("medicine"):
        _upsert(
            f"expiry:{batch.id}",
            level=Notification.Level.DANGER if batch.days_to_expiry <= 14
                  else Notification.Level.WARNING,
            category=Notification.Category.EXPIRY,
            title=f"Expiring soon: {batch.medicine.label}",
            message=f"Batch {batch.batch_number} expires {batch.expiry_date} "
                    f"({batch.days_to_expiry} days), {batch.quantity_on_hand} units.",
            link="/expiry",
        )
        created += 1

    # Overdue dosage reviews
    for plan in DosettePlan.objects.filter(
        is_active=True, review_date__lt=date.today()
    ).select_related("patient"):
        _upsert(
            f"review:{plan.id}",
            level=Notification.Level.WARNING,
            category=Notification.Category.REVIEW,
            title=f"Dosage review overdue: {plan.patient.full_name}",
            message=f"Review was due {plan.review_date}.",
            link="/dosette",
        )
        created += 1

    return created
