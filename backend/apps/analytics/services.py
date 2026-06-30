"""Prototype stock analytics only.

This module derives explainable stock signals from inventory records. It does
not query or return patient data, does not perform clinical decision-making, and
makes no compliance claim.
"""

from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from math import ceil
from typing import TypedDict

from django.db import transaction
from django.db.models import IntegerField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import serializers

from apps.blister.models import CycleStatus, DosetteCycle, PatientMedication
from apps.blister.services import stock_item_for_medication_line
from apps.inventory.models import StockBatch, StockItem, StockMovement
from apps.inventory.selectors import stock_items_for
from apps.tenancy.models import Group, Pharmacy
from apps.tenancy.permissions import Action, can

from .models import ForecastItem, ForecastRun, TransferSuggestion

NEAR_EXPIRY_DAYS = 90
DEAD_STOCK_DAYS = 90
SLOW_MOVING_THRESHOLD = 5
FORECAST_MODEL_VERSION = "baseline-1"
DEFAULT_FORECAST_HORIZON_DAYS = 30
DEFAULT_FORECAST_LOOKBACK_DAYS = 90
DEFAULT_SAFETY_BUFFER_RATIO = Decimal("0.15")
TRANSFER_SUGGESTION_MODEL_VERSION = "transfer-baseline-1"
DEFAULT_TRANSFER_DEAD_DAYS = 30
SOURCE_BUFFER_RATIO = Decimal("0.20")
DEFAULT_MDS_DEMAND_HORIZON_DAYS = 28
EXPIRY_BUCKETS = (
    ("expired", "Expired", None, -1),
    ("d0_7", "0-7 days", 0, 7),
    ("d8_30", "8-30 days", 8, 30),
    ("d31_60", "31-60 days", 31, 60),
    ("d61_90", "61-90 days", 61, 90),
    ("d90_plus", "90+ days", 91, None),
)
MDS_DEMAND_STATUSES = {
    CycleStatus.DRAFT,
    CycleStatus.NEEDS_CHANGES,
    CycleStatus.PREPARED,
    CycleStatus.CHECKED,
}


class ExpiryBucketAccumulator(TypedDict):
    key: str
    label: str
    units: int
    estimated_value: Decimal
    unpriced_units: int
    batch_count: int
    product_ids: set[int]


def _days_to_expiry(today: date, earliest_expiry: date | None) -> int | None:
    if earliest_expiry is None:
        return None
    return (earliest_expiry - today).days


def _safe_medication_label(medication) -> str:
    product = getattr(medication, "catalogue_product", None)
    return product.full_label if product is not None else medication.name


def _line_daily_required(line: PatientMedication) -> int:
    return (
        int(line.quantity_morning or 0)
        + int(line.quantity_lunchtime or 0)
        + int(line.quantity_evening or 0)
        + int(line.quantity_bedtime or 0)
    )


def _stock_unit_value(stock_item: StockItem) -> Decimal | None:
    if stock_item.unit_price is not None:
        return stock_item.unit_price

    product = stock_item.medication.catalogue_product
    if stock_item.pack_price is not None and product is not None and product.pack_size:
        return stock_item.pack_price / Decimal(product.pack_size)

    return None


def _expiry_bucket_for(days_to_expiry: int) -> tuple[str, str]:
    for key, label, minimum, maximum in EXPIRY_BUCKETS:
        if minimum is not None and days_to_expiry < minimum:
            continue
        if maximum is not None and days_to_expiry > maximum:
            continue
        return key, label
    return "d90_plus", "90+ days"


def _decimal_string(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


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


def _cycle_overlap_days(cycle: DosetteCycle, *, start: date, end: date) -> int:
    overlap_start = max(cycle.start_date, start)
    overlap_end = min(cycle.end_date, end)
    if overlap_end < overlap_start:
        return 0
    return (overlap_end - overlap_start).days + 1


def mds_demand_signal_for(
    user,
    *,
    pharmacy_id=None,
    horizon_days: int = DEFAULT_MDS_DEMAND_HORIZON_DAYS,
    today=None,
) -> dict:
    today = today or timezone.now().date()
    generated_at = timezone.now()
    horizon_end = today + timedelta(days=horizon_days - 1)

    cycles = (
        DosetteCycle.scoped.for_user(user)
        .filter(
            status__in=MDS_DEMAND_STATUSES,
            stock_deducted=False,
            start_date__lte=horizon_end,
            end_date__gte=today,
        )
        .select_related("patient", "patient__pharmacy")
        .order_by("start_date", "id")
    )
    if pharmacy_id is not None:
        cycles = cycles.filter(patient__pharmacy_id=pharmacy_id)

    cycles = list(cycles)
    patient_ids = {cycle.patient_id for cycle in cycles}
    lines_by_patient: dict[int, list[PatientMedication]] = {
        patient_id: [] for patient_id in patient_ids
    }
    if patient_ids:
        lines = (
            PatientMedication.scoped.for_user(user)
            .filter(patient_id__in=patient_ids, is_active=True)
            .select_related(
                "patient",
                "patient__pharmacy",
                "medication",
                "medication__catalogue_product",
                "medication__group",
            )
            .order_by("patient_id", "medication__name", "id")
        )
        for line in lines:
            if _line_daily_required(line) <= 0:
                continue
            lines_by_patient.setdefault(line.patient_id, []).append(line)

    stock_items = StockItem.scoped.for_user(user).filter(is_active=True)
    if pharmacy_id is not None:
        stock_items = stock_items.filter(pharmacy_id=pharmacy_id)
    stock_items = stock_items.select_related(
        "pharmacy",
        "medication",
        "medication__catalogue_product",
        "medication__group",
    )

    rows_by_key: dict[tuple[str, int, int], dict] = {}
    all_cycle_ids: set[int] = set()
    all_patient_ids: set[int] = set()

    for cycle in cycles:
        overlap_days = _cycle_overlap_days(cycle, start=today, end=horizon_end)
        if overlap_days <= 0:
            continue

        for line in lines_by_patient.get(cycle.patient_id, []):
            daily_required = _line_daily_required(line)
            required_units = daily_required * overlap_days
            if required_units <= 0:
                continue

            stock_item = stock_item_for_medication_line(
                stock_items=stock_items,
                pharmacy=cycle.patient.pharmacy,
                line=line,
            )
            if stock_item is None:
                key = ("medication", line.medication_id, cycle.patient.pharmacy_id)
                mapping_status = "mapping_needed"
                stock_item_id = None
                medication_id = line.medication_id
                medication_name = _safe_medication_label(line.medication)
            else:
                key = ("stock", stock_item.id, stock_item.pharmacy_id)
                mapping_status = "mapped"
                stock_item_id = stock_item.id
                medication_id = stock_item.medication_id
                medication_name = _safe_medication_label(stock_item.medication)

            row = rows_by_key.setdefault(
                key,
                {
                    "stock_item_id": stock_item_id,
                    "medication_id": medication_id,
                    "medication_name": medication_name,
                    "pharmacy_id": cycle.patient.pharmacy_id,
                    "pharmacy_name": cycle.patient.pharmacy.name,
                    "required_units": 0,
                    "available_units": 0,
                    "shortfall_units": 0,
                    "cycles": set(),
                    "patients": set(),
                    "mapping_status": mapping_status,
                    "review_message": "Review before action.",
                },
            )
            row["required_units"] += required_units
            row["cycles"].add(cycle.id)
            row["patients"].add(cycle.patient_id)
            all_cycle_ids.add(cycle.id)
            all_patient_ids.add(cycle.patient_id)

    stock_item_ids = [
        row["stock_item_id"]
        for row in rows_by_key.values()
        if row["stock_item_id"] is not None
    ]
    available_by_stock_item = {
        row["stock_item_id"]: row["available_units"]
        for row in (
            StockBatch.scoped.for_user(user)
            .filter(
                stock_item_id__in=stock_item_ids,
                is_active=True,
                quantity__gt=0,
                expiry_date__gte=today,
            )
            .values("stock_item_id")
            .annotate(
                available_units=Coalesce(
                    Sum("quantity"),
                    Value(0),
                    output_field=IntegerField(),
                )
            )
        )
    }

    items = []
    for row in rows_by_key.values():
        available_units = (
            available_by_stock_item.get(row["stock_item_id"], 0)
            if row["stock_item_id"] is not None
            else 0
        )
        shortfall_units = max(int(row["required_units"]) - int(available_units), 0)
        items.append(
            {
                "stock_item_id": row["stock_item_id"],
                "medication_id": row["medication_id"],
                "medication_name": row["medication_name"],
                "pharmacy_id": row["pharmacy_id"],
                "pharmacy_name": row["pharmacy_name"],
                "required_units": int(row["required_units"]),
                "available_units": int(available_units),
                "shortfall_units": shortfall_units,
                "cycles_affected": len(row["cycles"]),
                "patients_affected": len(row["patients"]),
                "mapping_status": row["mapping_status"],
                "review_message": row["review_message"],
            }
        )

    items.sort(
        key=lambda item: (
            -item["shortfall_units"],
            item["mapping_status"] != "mapping_needed",
            -item["required_units"],
            item["medication_name"],
        )
    )

    return {
        "generated_at": generated_at,
        "horizon_days": horizon_days,
        "summary": {
            "total_required_units": sum(item["required_units"] for item in items),
            "total_available_units": sum(item["available_units"] for item in items),
            "total_shortfall_units": sum(item["shortfall_units"] for item in items),
            "items_with_shortfall": sum(
                1 for item in items if item["shortfall_units"] > 0
            ),
            "mapping_needed": sum(
                1 for item in items if item["mapping_status"] == "mapping_needed"
            ),
            "cycles_affected": len(all_cycle_ids),
            "patients_affected": len(all_patient_ids),
        },
        "items": items,
    }


def expiry_risk_for(user, *, pharmacy_id=None, today=None) -> dict:
    today = today or timezone.now().date()
    generated_at = timezone.now()
    bucket_totals: dict[str, ExpiryBucketAccumulator] = {
        key: {
            "key": key,
            "label": label,
            "units": 0,
            "estimated_value": Decimal("0"),
            "unpriced_units": 0,
            "batch_count": 0,
            "product_ids": set(),
        }
        for key, label, _minimum, _maximum in EXPIRY_BUCKETS
    }
    items = []

    batches = (
        StockBatch.scoped.for_user(user)
        .filter(is_active=True, quantity__gt=0)
        .select_related(
            "stock_item",
            "stock_item__pharmacy",
            "stock_item__medication",
            "stock_item__medication__catalogue_product",
        )
        .order_by("expiry_date", "stock_item__medication__name", "id")
    )
    if pharmacy_id is not None:
        batches = batches.filter(stock_item__pharmacy_id=pharmacy_id)

    risk_stock_item_ids: set[int] = set()
    for batch in batches:
        days_to_expiry = (batch.expiry_date - today).days
        bucket_key, bucket_label = _expiry_bucket_for(days_to_expiry)
        unit_value = _stock_unit_value(batch.stock_item)
        estimated_value = (
            Decimal(batch.quantity) * unit_value
            if unit_value is not None
            else Decimal("0")
        )
        unpriced_units = batch.quantity if unit_value is None else 0

        bucket = bucket_totals[bucket_key]
        bucket["units"] += batch.quantity
        bucket["estimated_value"] += estimated_value
        bucket["unpriced_units"] += unpriced_units
        bucket["batch_count"] += 1
        bucket["product_ids"].add(batch.stock_item_id)

        is_within_30_days = days_to_expiry <= 30
        if is_within_30_days:
            risk_stock_item_ids.add(batch.stock_item_id)

        items.append(
            {
                "stock_item_id": batch.stock_item_id,
                "medication_id": batch.stock_item.medication_id,
                "medication_name": _safe_medication_label(batch.stock_item.medication),
                "pharmacy_id": batch.stock_item.pharmacy_id,
                "pharmacy_name": batch.stock_item.pharmacy.name,
                "batch_number": batch.batch_number,
                "expiry_date": batch.expiry_date,
                "days_to_expiry": days_to_expiry,
                "quantity": batch.quantity,
                "bucket": bucket_key,
                "bucket_label": bucket_label,
                "estimated_value": _decimal_string(estimated_value),
                "unpriced_units": unpriced_units,
                "review_message": "Expiry risk. Review before action.",
            }
        )

    buckets = []
    for key, label, _minimum, _maximum in EXPIRY_BUCKETS:
        bucket = bucket_totals[key]
        buckets.append(
            {
                "key": key,
                "label": label,
                "units": bucket["units"],
                "estimated_value": _decimal_string(bucket["estimated_value"]),
                "unpriced_units": bucket["unpriced_units"],
                "batch_count": bucket["batch_count"],
                "product_count": len(bucket["product_ids"]),
            }
        )

    at_risk_keys = {"expired", "d0_7", "d8_30"}
    value_at_risk = sum(
        (bucket_totals[key]["estimated_value"] for key in at_risk_keys),
        Decimal("0"),
    )
    expiring_within_30_days_units = sum(
        bucket_totals[key]["units"] for key in at_risk_keys
    )
    unpriced_risk_units = sum(
        bucket_totals[key]["unpriced_units"] for key in at_risk_keys
    )

    return {
        "generated_at": generated_at,
        "summary": {
            "expiring_within_30_days_units": expiring_within_30_days_units,
            "value_at_risk": _decimal_string(value_at_risk),
            "unpriced_risk_units": unpriced_risk_units,
            "products_affected": len(risk_stock_item_ids),
        },
        "buckets": buckets,
        "items": items,
    }


def _review_item(
    queue: dict[tuple[str, int, int], dict],
    *,
    key: tuple[str, int, int],
    stock_item_id,
    medication_id,
    medication_name,
    pharmacy_id,
    pharmacy_name="",
) -> dict:
    return queue.setdefault(
        key,
        {
            "stock_item_id": stock_item_id,
            "medication_id": medication_id,
            "medication_name": medication_name,
            "pharmacy_id": pharmacy_id,
            "pharmacy_name": pharmacy_name,
            "score": 0,
            "reason_chips": [],
            "signals": [],
            "required_units": 0,
            "available_units": 0,
            "shortfall_units": 0,
            "forecast_confidence": None,
            "forecast_confidence_label": None,
            "review_message": "Review before action. Human review required.",
        },
    )


def _add_review_reason(item: dict, reason: str, score: int, signal: str) -> None:
    if reason not in item["reason_chips"]:
        item["reason_chips"].append(reason)
        item["score"] += score
    if signal not in item["signals"]:
        item["signals"].append(signal)


def _confidence_label(confidence: Decimal | str | None) -> str | None:
    if confidence is None:
        return None
    value = Decimal(str(confidence))
    if value >= Decimal("0.75"):
        return "High confidence"
    if value >= Decimal("0.50"):
        return "Medium confidence"
    if value >= Decimal("0.35"):
        return "Low confidence"
    return "Limited history"


def stock_review_queue_for(
    user,
    *,
    pharmacy_id=None,
    horizon_days: int = DEFAULT_MDS_DEMAND_HORIZON_DAYS,
    today=None,
) -> dict:
    today = today or timezone.now().date()
    generated_at = timezone.now()
    overview = stock_overview_for(user, pharmacy_id=pharmacy_id, today=today)
    mds_demand = mds_demand_signal_for(
        user,
        pharmacy_id=pharmacy_id,
        horizon_days=horizon_days,
        today=today,
    )
    expiry_risk = expiry_risk_for(user, pharmacy_id=pharmacy_id, today=today)
    queue: dict[tuple[str, int, int], dict] = {}

    for row in overview["items"]:
        key = ("stock", row["stock_item_id"], row["pharmacy_id"])
        item = _review_item(
            queue,
            key=key,
            stock_item_id=row["stock_item_id"],
            medication_id=row["medication_id"],
            medication_name=row["medication_name"],
            pharmacy_id=row["pharmacy_id"],
        )
        item["available_units"] = max(item["available_units"], row["quantity_on_hand"])
        if row["flags"]["stockout"] or row["flags"]["low_stock"]:
            _add_review_reason(item, "Low stock", 45, "Stock risk")
        if row["flags"]["near_expiry"]:
            _add_review_reason(item, "Expiry risk", 25, "Expiry risk")
        if row["flags"]["slow_moving"] or row["flags"]["dead_stock"]:
            _add_review_reason(item, "Slow moving", 15, "Stock risk")
        if (
            row["flags"]["dead_stock"]
            and row["reorder_level"] > 0
            and row["quantity_on_hand"] >= row["reorder_level"] * 3
        ):
            _add_review_reason(item, "Overstock", 20, "Stock risk")

    for row in mds_demand["items"]:
        key = (
            "stock" if row["stock_item_id"] is not None else "mds",
            row["stock_item_id"] or row["medication_id"],
            row["pharmacy_id"],
        )
        item = _review_item(
            queue,
            key=key,
            stock_item_id=row["stock_item_id"],
            medication_id=row["medication_id"],
            medication_name=row["medication_name"],
            pharmacy_id=row["pharmacy_id"],
            pharmacy_name=row["pharmacy_name"],
        )
        item["required_units"] += row["required_units"]
        item["available_units"] = max(item["available_units"], row["available_units"])
        item["shortfall_units"] += row["shortfall_units"]
        if row["mapping_status"] == "mapping_needed":
            _add_review_reason(item, "Mapping needed", 60, "MDS demand signal")
        if row["shortfall_units"] > 0:
            _add_review_reason(item, "MDS shortfall", 70, "MDS demand signal")

    for row in expiry_risk["items"]:
        if row["days_to_expiry"] > 90:
            continue
        key = ("stock", row["stock_item_id"], row["pharmacy_id"])
        item = _review_item(
            queue,
            key=key,
            stock_item_id=row["stock_item_id"],
            medication_id=row["medication_id"],
            medication_name=row["medication_name"],
            pharmacy_id=row["pharmacy_id"],
            pharmacy_name=row["pharmacy_name"],
        )
        if row["days_to_expiry"] <= 7:
            score = 35
        elif row["days_to_expiry"] <= 30:
            score = 25
        else:
            score = 10
        _add_review_reason(item, "Expiry risk", score, "Expiry risk")

    latest_runs = (
        ForecastRun.objects.filter(status=ForecastRun.Status.COMPLETED)
        .select_related("pharmacy")
        .prefetch_related("items", "items__stock_item")
        .order_by("pharmacy_id", "-created_at", "-id")
    )
    if pharmacy_id is not None:
        latest_runs = latest_runs.filter(pharmacy_id=pharmacy_id)
    latest_by_pharmacy = {}
    for run in latest_runs:
        if run.pharmacy_id in latest_by_pharmacy:
            continue
        if not can(user, Action.FORECAST_VIEW, target=run.pharmacy):
            continue
        latest_by_pharmacy[run.pharmacy_id] = run

    for run in latest_by_pharmacy.values():
        for forecast_item in run.items.all():
            stock_item = forecast_item.stock_item
            key = ("stock", stock_item.id, stock_item.pharmacy_id)
            item = _review_item(
                queue,
                key=key,
                stock_item_id=stock_item.id,
                medication_id=stock_item.medication_id,
                medication_name=forecast_item.medication_label,
                pharmacy_id=stock_item.pharmacy_id,
                pharmacy_name=run.pharmacy.name,
            )
            item["forecast_confidence"] = str(forecast_item.confidence)
            item["forecast_confidence_label"] = _confidence_label(
                forecast_item.confidence
            )
            if forecast_item.suggested_reorder_units > 0:
                _add_review_reason(item, "Order review", 30, "Stock risk")
            if forecast_item.confidence < Decimal("0.50"):
                _add_review_reason(item, "Low confidence", 10, "Forecast confidence")

    items = []
    for item in queue.values():
        if not item["reason_chips"]:
            continue
        score = min(item["score"], 100)
        risk_level = "high" if score >= 70 else "medium" if score >= 35 else "low"
        item = {**item, "score": score, "risk_level": risk_level}
        items.append(item)

    items.sort(key=lambda item: (-item["score"], item["medication_name"]))

    return {
        "generated_at": generated_at,
        "horizon_days": horizon_days,
        "summary": {
            "total_items": len(items),
            "high_risk": sum(1 for item in items if item["risk_level"] == "high"),
            "medium_risk": sum(1 for item in items if item["risk_level"] == "medium"),
            "low_risk": sum(1 for item in items if item["risk_level"] == "low"),
            "mds_shortfall": sum(
                1 for item in items if "MDS shortfall" in item["reason_chips"]
            ),
            "expiry_risk": sum(
                1 for item in items if "Expiry risk" in item["reason_chips"]
            ),
            "low_confidence": sum(
                1 for item in items if "Low confidence" in item["reason_chips"]
            ),
        },
        "items": items,
    }


def _decimal_packs(units: int, pack_size: int | None) -> Decimal | None:
    if not pack_size:
        return None
    return (Decimal(units) / Decimal(pack_size)).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def _confidence_for(history_points_count: int) -> Decimal:
    if history_points_count == 0:
        return Decimal("0.10")
    if history_points_count < 3:
        return Decimal("0.35")
    if history_points_count < 8:
        return Decimal("0.60")
    return Decimal("0.80")


def _movement_history(stock_item: StockItem, *, window_start):
    return list(
        StockMovement.objects.filter(
            stock_item=stock_item,
            created_at__gte=window_start,
            quantity_delta__lt=0,
        ).order_by("created_at", "id")
    )


def _forecast_values_for_stock_item(
    stock_item,
    *,
    horizon_days: int,
    lookback_days: int,
    generated_at,
) -> dict:
    movements = _movement_history(
        stock_item,
        window_start=generated_at - timedelta(days=lookback_days),
    )
    consumed_units = sum(abs(movement.quantity_delta) for movement in movements)
    history_points_count = len(movements)
    average_daily_usage = Decimal(consumed_units) / Decimal(lookback_days)
    predicted_usage_units = int(
        (average_daily_usage * Decimal(horizon_days)).quantize(
            Decimal("1"),
            rounding=ROUND_HALF_UP,
        )
    )
    current_stock_units = int(stock_item.quantity_on_hand or 0)
    safety_stock_units = (
        stock_item.reorder_level
        if stock_item.reorder_level > 0
        else int(ceil(predicted_usage_units * DEFAULT_SAFETY_BUFFER_RATIO))
    )
    needed_units = predicted_usage_units + safety_stock_units - current_stock_units
    suggested_reorder_units = max(0, needed_units)
    confidence = _confidence_for(history_points_count)

    product = stock_item.medication.catalogue_product
    pack_size = product.pack_size if product and product.pack_size else None
    pack_unit = (product.pack_unit if product else "") or stock_item.medication.form
    suggested_reorder_packs = (
        int(ceil(suggested_reorder_units / pack_size)) if pack_size else None
    )

    explanation = (
        f"Based on {history_points_count} outbound stock movement"
        f"{'' if history_points_count == 1 else 's'} over the last "
        f"{lookback_days} days, average usage is "
        f"{average_daily_usage.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)} "
        f"units/day. For the next {horizon_days} days, predicted usage is "
        f"{predicted_usage_units} units. Current stock is {current_stock_units} "
        f"units and safety stock is {safety_stock_units} units, so suggested "
        f"reorder is {suggested_reorder_units} units."
    )
    if pack_size:
        explanation = (
            f"{explanation} Pack size is {pack_size} {pack_unit}, so this is "
            f"approximately {suggested_reorder_packs} pack"
            f"{'' if suggested_reorder_packs == 1 else 's'}."
        )
    explanation = (
        f"{explanation} Forecast suggestion only. Review before action. "
        "Human review required."
    )

    return {
        "stock_item": stock_item,
        "catalogue_product": product,
        "medication_label": (
            product.full_label if product is not None else stock_item.medication.name
        ),
        "predicted_usage_units": max(predicted_usage_units, 0),
        "predicted_usage_packs": _decimal_packs(predicted_usage_units, pack_size),
        "current_stock_units": current_stock_units,
        "current_stock_packs": _decimal_packs(current_stock_units, pack_size),
        "safety_stock_units": safety_stock_units,
        "suggested_reorder_units": suggested_reorder_units,
        "suggested_reorder_packs": suggested_reorder_packs,
        "confidence": confidence,
        "explanation": explanation,
        "history_points_count": history_points_count,
        "window_days": lookback_days,
    }


def generate_stock_forecast(
    user,
    *,
    pharmacy: Pharmacy,
    horizon_days: int = DEFAULT_FORECAST_HORIZON_DAYS,
    lookback_days: int = DEFAULT_FORECAST_LOOKBACK_DAYS,
) -> ForecastRun:
    if not can(user, Action.FORECAST_RUN, target=pharmacy):
        raise serializers.ValidationError(
            {"pharmacy": ["This pharmacy is outside your forecasting scope."]}
        )

    generated_at = timezone.now()
    stock_items = list(
        stock_items_for(user)
        .filter(pharmacy=pharmacy, is_active=True)
        .select_related("medication__catalogue_product", "pharmacy")
    )

    with transaction.atomic():
        run = ForecastRun.objects.create(
            pharmacy=pharmacy,
            group=pharmacy.group,
            horizon_days=horizon_days,
            lookback_days=lookback_days,
            model_version=FORECAST_MODEL_VERSION,
            generated_by=user,
            status=ForecastRun.Status.COMPLETED,
        )
        ForecastItem.objects.bulk_create(
            [
                ForecastItem(
                    run=run,
                    **_forecast_values_for_stock_item(
                        stock_item,
                        horizon_days=horizon_days,
                        lookback_days=lookback_days,
                        generated_at=generated_at,
                    ),
                )
                for stock_item in stock_items
            ]
        )

    return (
        ForecastRun.objects.select_related("pharmacy", "group", "generated_by")
        .prefetch_related(
            "items",
            "items__stock_item",
            "items__catalogue_product",
        )
        .get(pk=run.pk)
    )


def latest_stock_forecast_for(user, *, pharmacy: Pharmacy) -> ForecastRun | None:
    if not can(user, Action.FORECAST_VIEW, target=pharmacy):
        raise serializers.ValidationError(
            {"pharmacy": ["This pharmacy is outside your forecasting scope."]}
        )

    return (
        ForecastRun.objects.select_related("pharmacy", "group", "generated_by")
        .prefetch_related("items", "items__stock_item", "items__catalogue_product")
        .filter(pharmacy=pharmacy)
        .first()
    )


def _active_group_stock_items(user, group: Group, *, today):
    return list(
        stock_items_for(user)
        .filter(
            pharmacy__group=group,
            is_active=True,
            medication__catalogue_product__isnull=False,
        )
        .select_related("pharmacy", "medication__catalogue_product")
        .annotate(
            unexpired_stock_units=Coalesce(
                Sum(
                    "batches__quantity",
                    filter=Q(
                        batches__is_active=True,
                        batches__quantity__gt=0,
                        batches__expiry_date__gte=today,
                    ),
                ),
                Value(0),
                output_field=IntegerField(),
            )
        )
    )


def _recent_usage_by_stock_item(stock_items: list[StockItem], *, window_start):
    stock_item_ids = [stock_item.id for stock_item in stock_items]
    if not stock_item_ids:
        return {}

    return {
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
                    Sum("quantity_delta"),
                    Value(0),
                    output_field=IntegerField(),
                )
            )
        )
    }


def _pack_count(units: int, pack_size: int | None) -> int | None:
    if not pack_size:
        return None
    return int(ceil(units / pack_size))


def _transfer_confidence(destination_usage_units: int, suggested_units: int) -> Decimal:
    if destination_usage_units >= suggested_units * 2:
        return Decimal("0.75")
    if destination_usage_units >= suggested_units:
        return Decimal("0.65")
    return Decimal("0.55")


def generate_transfer_suggestions(
    user,
    *,
    group: Group,
    dead_days: int = DEFAULT_TRANSFER_DEAD_DAYS,
) -> list[TransferSuggestion]:
    if not can(user, Action.TRANSFER_SUGGESTION_GENERATE, target=group):
        raise serializers.ValidationError(
            {"group": ["This group is outside your transfer suggestion scope."]}
        )

    today = timezone.now().date()
    window_start = timezone.now() - timedelta(days=dead_days)
    stock_items = _active_group_stock_items(user, group, today=today)
    usage_by_stock_item = _recent_usage_by_stock_item(
        stock_items,
        window_start=window_start,
    )

    stock_items_by_product: dict[int, list[StockItem]] = {}
    for stock_item in stock_items:
        product_id = stock_item.medication.catalogue_product_id
        if product_id is None:
            continue
        stock_items_by_product.setdefault(product_id, []).append(stock_item)

    suggestions = []
    for source in stock_items:
        product = source.medication.catalogue_product
        if product is None:
            continue

        source_stock_units = int(source.unexpired_stock_units or 0)
        source_recent_usage = usage_by_stock_item.get(source.id, 0)
        if source_stock_units <= 0 or source_recent_usage > 0:
            continue

        destinations = [
            stock_item
            for stock_item in stock_items_by_product.get(product.id, [])
            if stock_item.pharmacy_id != source.pharmacy_id
            and usage_by_stock_item.get(stock_item.id, 0) > 0
        ]
        if not destinations:
            continue

        destination = max(
            destinations,
            key=lambda stock_item: usage_by_stock_item.get(stock_item.id, 0),
        )
        destination_usage_units = usage_by_stock_item[destination.id]
        source_buffer_units = int(
            (Decimal(source_stock_units) * SOURCE_BUFFER_RATIO).to_integral_value(
                rounding=ROUND_HALF_UP
            )
        )
        source_buffer_units = max(source_buffer_units, 1)
        transferable_units = max(0, source_stock_units - source_buffer_units)
        suggested_units = min(transferable_units, destination_usage_units)
        if suggested_units <= 0:
            continue

        suggested_packs = _pack_count(suggested_units, product.pack_size)
        reason = (
            f"{source.pharmacy.name} has {source_stock_units} units with no outbound "
            f"usage for {dead_days} days. {destination.pharmacy.name} used "
            f"{destination_usage_units} units in the last {dead_days} days. "
            "Human review required before transfer."
        )
        if product.pack_size:
            reason = (
                f"{reason} Pack size is {product.pack_size}, so the suggested "
                f"quantity is approximately {suggested_packs} pack"
                f"{'' if suggested_packs == 1 else 's'}."
            )

        suggestions.append(
            TransferSuggestion(
                group=group,
                catalogue_product=product,
                medication_label=product.full_label,
                source_pharmacy=source.pharmacy,
                destination_pharmacy=destination.pharmacy,
                source_stock_item=source,
                destination_stock_item=destination,
                suggested_quantity_units=suggested_units,
                suggested_quantity_packs=suggested_packs,
                current_source_stock_units=source_stock_units,
                destination_recent_usage_units=destination_usage_units,
                dead_days=dead_days,
                confidence=_transfer_confidence(
                    destination_usage_units, suggested_units
                ),
                reason=reason,
                status=TransferSuggestion.Status.OPEN,
                model_version=TRANSFER_SUGGESTION_MODEL_VERSION,
                generated_by=user,
            )
        )

    with transaction.atomic():
        TransferSuggestion.objects.filter(
            group=group,
            model_version=TRANSFER_SUGGESTION_MODEL_VERSION,
            status=TransferSuggestion.Status.OPEN,
        ).update(status=TransferSuggestion.Status.DISMISSED)
        created = TransferSuggestion.objects.bulk_create(suggestions)

    return list_transfer_suggestions(user, group=group) if created else []


def list_transfer_suggestions(user, *, group: Group) -> list[TransferSuggestion]:
    if not can(user, Action.TRANSFER_SUGGESTION_VIEW, target=group):
        raise serializers.ValidationError(
            {"group": ["This group is outside your transfer suggestion scope."]}
        )

    return list(
        TransferSuggestion.objects.select_related(
            "group",
            "catalogue_product",
            "source_pharmacy",
            "destination_pharmacy",
            "source_stock_item",
            "destination_stock_item",
            "generated_by",
        )
        .filter(
            group=group,
            model_version=TRANSFER_SUGGESTION_MODEL_VERSION,
            status=TransferSuggestion.Status.OPEN,
        )
        .order_by("-created_at", "-suggested_quantity_units", "medication_label")
    )


def dismiss_transfer_suggestion(user, *, suggestion: TransferSuggestion):
    if not can(user, Action.TRANSFER_SUGGESTION_DISMISS, target=suggestion.group):
        raise serializers.ValidationError(
            {"group": ["This group is outside your transfer suggestion scope."]}
        )

    if suggestion.status != TransferSuggestion.Status.DISMISSED:
        suggestion.status = TransferSuggestion.Status.DISMISSED
        suggestion.save(update_fields=["status", "updated_at"])
    return suggestion
