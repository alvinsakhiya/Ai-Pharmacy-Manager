"""Prototype operational stock reports only.

Reports in this module are read-only exports derived from inventory analytics.
They do not query or return patient data, do not perform clinical
decision-making, and make no compliance claim.
"""

from django.utils import timezone

from apps.analytics.services import stock_overview_for
from apps.inventory.models import MovementType, StockMovement

ALLOWED_STOCK_ATTENTION_FLAGS = {
    "near_expiry",
    "low_stock",
    "stockout",
    "dead_stock",
    "slow_moving",
}
DEFAULT_MOVEMENT_REPORT_LIMIT = 500
MAX_MOVEMENT_REPORT_LIMIT = 1000


class InvalidStockAttentionFlag(ValueError):
    def __init__(self, flag: str):
        self.flag = flag
        super().__init__(f"Invalid stock attention flag: {flag}")


class InvalidMovementType(ValueError):
    def __init__(self, movement_type: str):
        self.movement_type = movement_type
        super().__init__(f"Invalid movement type: {movement_type}")


def _has_any_attention_flag(row: dict) -> bool:
    return any(row["flags"].values())


def stock_attention_report(
    user,
    *,
    pharmacy_id: int | None = None,
    flag: str | None = None,
    needs_attention: bool = False,
) -> dict:
    overview = stock_overview_for(user, pharmacy_id=pharmacy_id)
    rows = list(overview["items"])

    if flag is not None:
        if flag not in ALLOWED_STOCK_ATTENTION_FLAGS:
            raise InvalidStockAttentionFlag(flag)
        rows = [row for row in rows if row["flags"][flag] is True]

    if needs_attention:
        rows = [row for row in rows if _has_any_attention_flag(row)]

    return {
        "report": "stock_attention",
        "generated_at": overview["generated_at"],
        "thresholds": overview["thresholds"],
        "filters": {
            "pharmacy_id": pharmacy_id,
            "flag": flag,
            "needs_attention": needs_attention,
        },
        "summary": overview["summary"],
        "row_count": len(rows),
        "rows": rows,
    }


def stock_movements_report(
    user,
    *,
    pharmacy_id: int | None = None,
    medication_id: int | None = None,
    stock_item_id: int | None = None,
    movement_type: str | None = None,
    date_from=None,
    date_to=None,
    limit: int = DEFAULT_MOVEMENT_REPORT_LIMIT,
) -> dict:
    if movement_type is not None and movement_type not in MovementType.values:
        raise InvalidMovementType(movement_type)

    limit = max(1, min(limit, MAX_MOVEMENT_REPORT_LIMIT))
    queryset = (
        StockMovement.scoped.for_user(user)
        .select_related("stock_item", "stock_item__medication", "batch")
        .order_by("-created_at", "-id")
    )

    if pharmacy_id is not None:
        queryset = queryset.filter(stock_item__pharmacy_id=pharmacy_id)
    if medication_id is not None:
        queryset = queryset.filter(stock_item__medication_id=medication_id)
    if stock_item_id is not None:
        queryset = queryset.filter(stock_item_id=stock_item_id)
    if movement_type is not None:
        queryset = queryset.filter(movement_type=movement_type)
    if date_from is not None:
        queryset = queryset.filter(created_at__date__gte=date_from)
    if date_to is not None:
        queryset = queryset.filter(created_at__date__lte=date_to)

    movements = list(queryset[: limit + 1])
    limited = len(movements) > limit
    movements = movements[:limit]
    rows = [
        {
            "movement_id": movement.id,
            "created_at": movement.created_at,
            "stock_item_id": movement.stock_item_id,
            "medication_id": movement.stock_item.medication_id,
            "medication_name": movement.stock_item.medication.name,
            "pharmacy_id": movement.stock_item.pharmacy_id,
            "batch_id": movement.batch_id,
            "batch_number": movement.batch.batch_number if movement.batch else None,
            "movement_type": movement.movement_type,
            "quantity_delta": movement.quantity_delta,
            "balance_after": movement.balance_after,
            "reference": movement.reference,
        }
        for movement in movements
    ]

    return {
        "report": "stock_movements",
        "generated_at": timezone.now(),
        "filters": {
            "pharmacy_id": pharmacy_id,
            "medication_id": medication_id,
            "stock_item_id": stock_item_id,
            "movement_type": movement_type,
            "date_from": date_from,
            "date_to": date_to,
            "limit": limit,
        },
        "row_count": len(rows),
        "limited": limited,
        "rows": rows,
    }
