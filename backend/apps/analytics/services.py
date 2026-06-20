"""Prototype stock analytics only.

This module derives explainable stock signals from inventory records. It does
not query or return patient data, does not perform clinical decision-making, and
makes no compliance claim.
"""

from datetime import date, timedelta

from django.db.models import IntegerField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.inventory.models import StockMovement
from apps.inventory.selectors import stock_items_for

NEAR_EXPIRY_DAYS = 90
DEAD_STOCK_DAYS = 90
SLOW_MOVING_THRESHOLD = 5


def _days_to_expiry(today: date, earliest_expiry: date | None) -> int | None:
    if earliest_expiry is None:
        return None
    return (earliest_expiry - today).days


def stock_overview_for(user, *, pharmacy_id=None, today=None) -> dict:
    today = today or timezone.now().date()
    generated_at = timezone.now()
    window_start = generated_at - timedelta(days=DEAD_STOCK_DAYS)

    stock_items = stock_items_for(user)
    if pharmacy_id is not None:
        stock_items = stock_items.filter(pharmacy_id=pharmacy_id)

    stock_items = list(stock_items)
    stock_item_ids = [item.id for item in stock_items]
    consumption_by_stock_item = {
        row["stock_item_id"]: abs(row["consumed_quantity"])
        for row in (
            StockMovement.objects.filter(
                stock_item_id__in=stock_item_ids,
                created_at__gte=window_start,
                quantity_delta__lt=0,
            )
            .values("stock_item_id")
            .annotate(
                consumed_quantity=Coalesce(
                    Sum(
                        "quantity_delta",
                        filter=Q(quantity_delta__lt=0),
                    ),
                    Value(0),
                    output_field=IntegerField(),
                )
            )
        )
    }

    summary = {
        "total_items": len(stock_items),
        "stockout": 0,
        "low_stock": 0,
        "near_expiry": 0,
        "dead_stock": 0,
        "slow_moving": 0,
        "needs_attention": 0,
    }
    items = []

    for stock_item in stock_items:
        quantity_on_hand = stock_item.quantity_on_hand
        reorder_level = stock_item.reorder_level
        earliest_expiry = stock_item.earliest_expiry
        days_to_expiry = _days_to_expiry(today, earliest_expiry)
        consumption_window = consumption_by_stock_item.get(stock_item.id, 0)

        flags = {
            "near_expiry": (
                quantity_on_hand > 0
                and days_to_expiry is not None
                and 0 <= days_to_expiry <= NEAR_EXPIRY_DAYS
            ),
            "low_stock": (reorder_level > 0 and 0 < quantity_on_hand <= reorder_level),
            "stockout": quantity_on_hand == 0,
            "dead_stock": quantity_on_hand > 0 and consumption_window == 0,
            "slow_moving": (
                quantity_on_hand > 0 and 0 < consumption_window < SLOW_MOVING_THRESHOLD
            ),
        }

        attention_score = 0
        reasons = []
        if flags["stockout"]:
            attention_score += 50
            reasons.append("Stockout: 0 units on hand")
        if flags["near_expiry"]:
            attention_score += 25
            reasons.append(
                f"Near expiry: earliest batch expires in {days_to_expiry} days"
            )
        if flags["dead_stock"]:
            attention_score += 20
            reasons.append(
                f"Dead stock: no outbound movement in {DEAD_STOCK_DAYS} days"
            )
        if flags["low_stock"]:
            attention_score += 15
            reasons.append(
                "Low stock: "
                f"{quantity_on_hand} on hand at or below reorder level "
                f"{reorder_level}"
            )
        if flags["slow_moving"]:
            attention_score += 10
            reasons.append(
                f"Slow moving: only {consumption_window} units consumed in "
                f"{DEAD_STOCK_DAYS} days"
            )

        suggested_reorder_quantity = max(reorder_level - quantity_on_hand, 0)
        if suggested_reorder_quantity > 0:
            reasons.append(
                "Reorder suggested: "
                f"{suggested_reorder_quantity} units to reach reorder level"
            )

        attention_score = min(attention_score, 100)
        for flag, is_triggered in flags.items():
            if is_triggered:
                summary[flag] += 1
        if any(flags.values()):
            summary["needs_attention"] += 1

        items.append(
            {
                "stock_item_id": stock_item.id,
                "medication_id": stock_item.medication_id,
                "medication_name": stock_item.medication.name,
                "pharmacy_id": stock_item.pharmacy_id,
                "quantity_on_hand": quantity_on_hand,
                "reorder_level": reorder_level,
                "earliest_expiry": earliest_expiry,
                "days_to_expiry": days_to_expiry,
                "consumption_window": consumption_window,
                "flags": flags,
                "attention_score": attention_score,
                "suggested_reorder_quantity": suggested_reorder_quantity,
                "reasons": reasons,
            }
        )

    items.sort(key=lambda item: (-item["attention_score"], item["medication_name"]))

    return {
        "generated_at": generated_at,
        "thresholds": {
            "near_expiry_days": NEAR_EXPIRY_DAYS,
            "dead_stock_days": DEAD_STOCK_DAYS,
            "slow_moving_threshold": SLOW_MOVING_THRESHOLD,
        },
        "summary": summary,
        "items": items,
    }
