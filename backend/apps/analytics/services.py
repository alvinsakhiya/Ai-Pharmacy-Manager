"""Prototype stock analytics only.

This module derives explainable stock signals from inventory records. It does
not query or return patient data, does not perform clinical decision-making, and
makes no compliance claim.
"""

from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from math import ceil

from django.db import transaction
from django.db.models import IntegerField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import serializers

from apps.inventory.models import StockItem, StockMovement
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
        f"{explanation} Forecast suggestion only; human review required before "
        "ordering."
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
