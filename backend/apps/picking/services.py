"""Picking-list generation from active dosette plans."""
from collections import defaultdict
from datetime import date, timedelta

from apps.dosette.models import DosettePlan
from apps.stock.models import Medicine

from .models import PickingItem, PickingList


def generate_picking_list(period_start: date, weeks: int = 1, *, created_by=None,
                          name: str | None = None) -> PickingList:
    """Aggregate the medicine quantities needed across all active dosette plans.

    A plan's contribution scales with how many of its weeks fall in the window
    (weekly plans contribute `weeks` cycles; monthly contribute pro-rata).
    """
    period_end = period_start + timedelta(days=7 * weeks - 1)
    name = name or f"Picking list w/c {period_start:%d %b %Y}"
    plist = PickingList.objects.create(
        name=name, period_start=period_start, period_end=period_end,
        created_by=created_by,
    )

    required = defaultdict(int)
    patients = defaultdict(set)
    for plan in DosettePlan.objects.filter(is_active=True).prefetch_related("items"):
        for item in plan.items.all():
            weekly = item.doses_per_week()
            required[item.medicine_id] += weekly * weeks
            patients[item.medicine_id].add(plan.patient_id)

    for medicine_id, qty in required.items():
        medicine = Medicine.objects.get(pk=medicine_id)
        PickingItem.objects.create(
            picking_list=plist, medicine=medicine,
            quantity_required=qty,
            quantity_available=medicine.quantity_on_hand(),
            patient_count=len(patients[medicine_id]),
        )
    return plist
