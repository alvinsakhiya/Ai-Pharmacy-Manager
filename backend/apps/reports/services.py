"""Prototype operational stock reports only.

Reports in this module are read-only exports derived from inventory analytics.
They do not query or return patient data, do not perform clinical
decision-making, and make no compliance claim.
"""

from datetime import timedelta
from typing import cast

from django.db.models import Max
from django.utils import timezone

from apps.analytics.models import ForecastRun, TransferSuggestion
from apps.analytics.services import stock_overview_for
from apps.blister.models import CycleStatus, DosetteCycle
from apps.inventory.models import MovementType, StockBatch, StockMovement
from apps.tenancy.models import Group, Pharmacy
from apps.tenancy.permissions import Action, can
from apps.tenancy.policy import resolve_scope

ALLOWED_STOCK_ATTENTION_FLAGS = {
    "near_expiry",
    "low_stock",
    "stockout",
    "dead_stock",
    "slow_moving",
}
DEFAULT_MOVEMENT_REPORT_LIMIT = 500
MAX_MOVEMENT_REPORT_LIMIT = 1000
DEFAULT_EXPIRY_WINDOW_DAYS = 30
DEFAULT_DEAD_STOCK_WINDOW_DAYS = 90
REPORT_WINDOW_CHOICES = {30, 60, 90}
TRANSFER_STATUSES = set(TransferSuggestion.Status.values)


class InvalidStockAttentionFlag(ValueError):
    def __init__(self, flag: str):
        self.flag = flag
        super().__init__(f"Invalid stock attention flag: {flag}")


class InvalidMovementType(ValueError):
    def __init__(self, movement_type: str):
        self.movement_type = movement_type
        super().__init__(f"Invalid movement type: {movement_type}")


class InvalidReportWindow(ValueError):
    def __init__(self, window_days: int):
        self.window_days = window_days
        super().__init__(f"Invalid report window: {window_days}")


class InvalidTransferStatus(ValueError):
    def __init__(self, status: str):
        self.status = status
        super().__init__(f"Invalid transfer status: {status}")


def _validate_window(window_days: int) -> int:
    if window_days not in REPORT_WINDOW_CHOICES:
        raise InvalidReportWindow(window_days)
    return window_days


def _scoped_pharmacy_ids(user) -> list[int]:
    scope = resolve_scope(user)
    if scope.is_global:
        return list(
            Pharmacy.objects.filter(is_active=True).values_list("id", flat=True)
        )
    return list(scope.pharmacy_ids)


def _scoped_group_ids(user) -> list[int]:
    scope = resolve_scope(user)
    if scope.is_global:
        return list(Group.objects.filter(is_active=True).values_list("id", flat=True))
    return list(scope.group_ids)


def _expiry_severity(days_until_expiry: int) -> str:
    if days_until_expiry < 0:
        return "expired"
    if days_until_expiry <= 7:
        return "critical"
    if days_until_expiry <= 30:
        return "warning"
    return "watch"


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


def expiry_report(
    user,
    *,
    pharmacy_id: int | None = None,
    window_days: int = DEFAULT_EXPIRY_WINDOW_DAYS,
) -> dict:
    window_days = _validate_window(window_days)
    today = timezone.now().date()
    window_end = today + timedelta(days=window_days)
    queryset = (
        StockBatch.scoped.for_user(user)
        .filter(is_active=True, quantity__gt=0, expiry_date__lte=window_end)
        .select_related("stock_item", "stock_item__medication", "stock_item__pharmacy")
        .order_by("expiry_date", "stock_item__medication__name", "id")
    )
    if pharmacy_id is not None:
        queryset = queryset.filter(stock_item__pharmacy_id=pharmacy_id)

    rows = []
    for batch in queryset:
        days_until_expiry = (batch.expiry_date - today).days
        rows.append(
            {
                "pharmacy_id": batch.stock_item.pharmacy_id,
                "pharmacy_name": batch.stock_item.pharmacy.name,
                "medication_label": batch.stock_item.medication.name,
                "batch_number": batch.batch_number,
                "expiry_date": batch.expiry_date,
                "quantity": batch.quantity,
                "days_until_expiry": days_until_expiry,
                "severity": _expiry_severity(days_until_expiry),
            }
        )

    return {
        "report": "expiry",
        "generated_at": timezone.now(),
        "filters": {
            "pharmacy_id": pharmacy_id,
            "window_days": window_days,
        },
        "row_count": len(rows),
        "rows": rows,
    }


def dead_stock_report(
    user,
    *,
    pharmacy_id: int | None = None,
    window_days: int = DEFAULT_DEAD_STOCK_WINDOW_DAYS,
) -> dict:
    window_days = _validate_window(window_days)
    overview = stock_overview_for(user, pharmacy_id=pharmacy_id)
    stock_item_ids = [row["stock_item_id"] for row in overview["items"]]
    latest_outbound = {
        row["stock_item_id"]: row["last_outbound_at"]
        for row in (
            StockMovement.objects.filter(
                stock_item_id__in=stock_item_ids,
                quantity_delta__lt=0,
            )
            .values("stock_item_id")
            .annotate(last_outbound_at=Max("created_at"))
        )
    }
    now = timezone.now()
    rows = []
    for item in overview["items"]:
        flags = item["flags"]
        status_value = "active"
        suggested_action = "Monitor through normal stock routines."
        if flags["dead_stock"]:
            status_value = "dead"
            suggested_action = (
                "Review for return, transfer, or replenishment hold. Human review "
                "required."
            )
        elif flags["slow_moving"]:
            status_value = "slow"
            suggested_action = (
                "Review movement trend before purchasing or transfer decisions."
            )

        last_outbound_at = latest_outbound.get(item["stock_item_id"])
        days_since_last_outbound = (
            None if last_outbound_at is None else (now - last_outbound_at).days
        )
        if status_value == "active" and days_since_last_outbound is not None:
            if days_since_last_outbound >= window_days:
                status_value = "dead"
                suggested_action = (
                    "No recent outbound movement. Human review required before "
                    "stock action."
                )
            elif days_since_last_outbound >= max(1, window_days // 2):
                status_value = "slow"
                suggested_action = (
                    "Limited recent movement. Review before replenishment."
                )

        rows.append(
            {
                "pharmacy_id": item["pharmacy_id"],
                "medication_label": item["medication_name"],
                "quantity_on_hand": item["quantity_on_hand"],
                "days_since_last_outbound": days_since_last_outbound,
                "status": status_value,
                "suggested_action": suggested_action,
            }
        )

    rows.sort(
        key=lambda row: (
            {"dead": 0, "slow": 1, "active": 2}[row["status"]],
            row["medication_label"],
        )
    )
    return {
        "report": "dead_stock",
        "generated_at": timezone.now(),
        "filters": {
            "pharmacy_id": pharmacy_id,
            "window_days": window_days,
        },
        "row_count": len(rows),
        "rows": rows,
    }


def forecast_reorder_report(
    user,
    *,
    pharmacy_id: int | None = None,
) -> dict:
    pharmacy_ids = _scoped_pharmacy_ids(user)
    if pharmacy_id is not None:
        pharmacy_ids = [pharmacy_id] if pharmacy_id in pharmacy_ids else []

    rows: list[dict[str, object]] = []
    for scoped_pharmacy_id in pharmacy_ids:
        try:
            pharmacy = Pharmacy.objects.get(pk=scoped_pharmacy_id, is_active=True)
        except Pharmacy.DoesNotExist:
            continue
        if not can(user, Action.FORECAST_VIEW, target=pharmacy):
            continue

        run = (
            ForecastRun.objects.filter(
                pharmacy_id=scoped_pharmacy_id,
                status=ForecastRun.Status.COMPLETED,
            )
            .select_related("pharmacy", "group")
            .prefetch_related("items")
            .first()
        )
        if run is None:
            continue

        rows.extend(
            {
                "pharmacy_id": run.pharmacy_id,
                "pharmacy_name": run.pharmacy.name,
                "medication_label": item.medication_label,
                "predicted_usage_units": item.predicted_usage_units,
                "current_stock_units": item.current_stock_units,
                "suggested_reorder_units": item.suggested_reorder_units,
                "suggested_reorder_packs": item.suggested_reorder_packs,
                "confidence": item.confidence,
                "explanation_summary": item.explanation,
                "human_review_required": True,
                "forecast_run_id": run.id,
                "forecast_created_at": run.created_at,
            }
            for item in run.items.all()
        )

    def _forecast_sort_key(row: dict[str, object]) -> tuple[str, int, str]:
        return (
            str(row["pharmacy_name"]),
            -cast(int, row["suggested_reorder_units"]),
            str(row["medication_label"]),
        )

    rows.sort(key=_forecast_sort_key)
    return {
        "report": "forecast_reorder",
        "generated_at": timezone.now(),
        "filters": {
            "pharmacy_id": pharmacy_id,
        },
        "row_count": len(rows),
        "rows": rows,
    }


def transfer_suggestions_report(
    user,
    *,
    group_id: int | None = None,
    status_filter: str | None = None,
) -> dict:
    if status_filter is not None and status_filter not in TRANSFER_STATUSES:
        raise InvalidTransferStatus(status_filter)

    group_ids = _scoped_group_ids(user)
    if group_id is not None:
        group_ids = [group_id] if group_id in group_ids else []

    queryset = (
        TransferSuggestion.objects.select_related(
            "group",
            "source_pharmacy",
            "destination_pharmacy",
        )
        .filter(group_id__in=group_ids)
        .order_by("-created_at", "-suggested_quantity_units", "medication_label")
    )
    if status_filter is not None:
        queryset = queryset.filter(status=status_filter)

    rows = []
    for suggestion in queryset:
        if not can(user, Action.TRANSFER_SUGGESTION_VIEW, target=suggestion.group):
            continue
        rows.append(
            {
                "group_id": suggestion.group_id,
                "group_name": suggestion.group.name,
                "source_pharmacy_id": suggestion.source_pharmacy_id,
                "source_pharmacy_name": suggestion.source_pharmacy.name,
                "destination_pharmacy_id": suggestion.destination_pharmacy_id,
                "destination_pharmacy_name": suggestion.destination_pharmacy.name,
                "medication_label": suggestion.medication_label,
                "suggested_quantity_units": suggestion.suggested_quantity_units,
                "suggested_quantity_packs": suggestion.suggested_quantity_packs,
                "confidence": suggestion.confidence,
                "status": suggestion.status,
                "reason": suggestion.reason,
                "created_at": suggestion.created_at,
                "human_review_required": True,
            }
        )

    return {
        "report": "transfer_suggestions",
        "generated_at": timezone.now(),
        "filters": {
            "group_id": group_id,
            "status": status_filter,
        },
        "row_count": len(rows),
        "rows": rows,
    }


def mds_workload_report(
    user,
    *,
    pharmacy_id: int | None = None,
    window_days: int = DEFAULT_EXPIRY_WINDOW_DAYS,
) -> dict:
    window_days = _validate_window(window_days)
    today = timezone.now().date()
    window_end = today + timedelta(days=window_days)
    queryset = DosetteCycle.scoped.for_user(user).select_related("patient__pharmacy")
    if pharmacy_id is not None:
        queryset = queryset.filter(patient__pharmacy_id=pharmacy_id)

    buckets: dict[tuple[int, str], dict] = {}
    for cycle in queryset:
        pharmacy = cycle.patient.pharmacy
        key = (pharmacy.id, cycle.status)
        row = buckets.setdefault(
            key,
            {
                "pharmacy_id": pharmacy.id,
                "pharmacy_name": pharmacy.name,
                "cycle_status": cycle.status,
                "due_count": 0,
                "overdue_count": 0,
                "upcoming_cycles": 0,
            },
        )
        if cycle.status not in {CycleStatus.COMPLETED, CycleStatus.CANCELLED}:
            if cycle.end_date < today:
                row["overdue_count"] += 1
            if today <= cycle.end_date <= window_end:
                row["due_count"] += 1
            if today <= cycle.start_date <= window_end:
                row["upcoming_cycles"] += 1

    rows = sorted(
        buckets.values(),
        key=lambda row: (row["pharmacy_name"], row["cycle_status"]),
    )
    return {
        "report": "mds_workload",
        "generated_at": timezone.now(),
        "filters": {
            "pharmacy_id": pharmacy_id,
            "window_days": window_days,
        },
        "row_count": len(rows),
        "rows": rows,
    }


def reports_dashboard(
    user,
    *,
    pharmacy_id: int | None = None,
    group_id: int | None = None,
) -> dict:
    cards = []
    if can(user, Action.STOCK_VIEW):
        stock_attention = stock_attention_report(
            user,
            pharmacy_id=pharmacy_id,
            needs_attention=True,
        )
        cards.extend(
            [
                {
                    "report": "stock_attention",
                    "title": "Stock attention",
                    "row_count": stock_attention["row_count"],
                    "available_exports": ["csv"],
                    "human_review_required": False,
                },
                {
                    "report": "stock_movements",
                    "title": "Stock movements",
                    "row_count": stock_movements_report(
                        user,
                        pharmacy_id=pharmacy_id,
                        limit=1,
                    )["row_count"],
                    "available_exports": ["csv"],
                    "human_review_required": False,
                },
                {
                    "report": "expiry",
                    "title": "Expiry risk",
                    "row_count": expiry_report(
                        user,
                        pharmacy_id=pharmacy_id,
                    )["row_count"],
                    "available_exports": ["csv"],
                    "human_review_required": False,
                },
                {
                    "report": "dead_stock",
                    "title": "Dead/slow stock",
                    "row_count": dead_stock_report(
                        user,
                        pharmacy_id=pharmacy_id,
                    )["row_count"],
                    "available_exports": ["csv"],
                    "human_review_required": True,
                },
            ]
        )
    if can(user, Action.FORECAST_VIEW):
        cards.append(
            {
                "report": "forecast_reorder",
                "title": "Forecast & reorder",
                "row_count": forecast_reorder_report(
                    user,
                    pharmacy_id=pharmacy_id,
                )["row_count"],
                "available_exports": ["csv"],
                "human_review_required": True,
            }
        )
    if can(user, Action.TRANSFER_SUGGESTION_VIEW):
        cards.append(
            {
                "report": "transfer_suggestions",
                "title": "Transfer suggestions",
                "row_count": transfer_suggestions_report(
                    user,
                    group_id=group_id,
                    status_filter="OPEN",
                )["row_count"],
                "available_exports": ["csv"],
                "human_review_required": True,
            }
        )
    if can(user, Action.BLISTER_VIEW):
        cards.append(
            {
                "report": "mds_workload",
                "title": "MDS workload",
                "row_count": mds_workload_report(
                    user,
                    pharmacy_id=pharmacy_id,
                )["row_count"],
                "available_exports": ["csv"],
                "human_review_required": False,
            }
        )

    return {
        "report": "dashboard",
        "generated_at": timezone.now(),
        "filters": {
            "pharmacy_id": pharmacy_id,
            "group_id": group_id,
        },
        "cards": cards,
    }
