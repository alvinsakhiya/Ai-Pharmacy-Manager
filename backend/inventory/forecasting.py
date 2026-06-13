from datetime import timedelta
from math import ceil

from django.db.models import Prefetch, Sum
from django.utils import timezone

from inventory.models import Medication, StockBatch
from dosette.models import DosetteRecord
from dosette.utils import calculate_weekly_quantity
from inventory.utils import get_usable_stock_batches_for_medication


STOCK_STATUS_LABELS = {
    "NO_DEMAND": "No active demand",
    "INACTIVE": "Inactive stock",
    "DEAD_STOCK": "Dead stock review",
    "OUT_OF_STOCK": "Out of stock",
    "CRITICAL_SHORTAGE": "Critical shortage",
    "BELOW_MINIMUM": "Below minimum level",
    "REORDER_THRESHOLD": "Reorder threshold reached",
    "LOW_COVER": "Low stock cover",
    "BELOW_TARGET": "Below target cover",
    "ADEQUATE": "Stock level adequate",
    "EXCESS_STOCK": "Excess stock review",
}

LOW_STOCK_STATUSES = {
    "OUT_OF_STOCK",
    "CRITICAL_SHORTAGE",
    "BELOW_MINIMUM",
    "REORDER_THRESHOLD",
    "LOW_COVER",
    "BELOW_TARGET",
}

DEAD_STOCK_DAYS = 180


def get_total_stock_for_medication(medication):
    prefetched_batches = getattr(medication, "_usable_stock_batches", None)
    if prefetched_batches is not None:
        return sum(batch.quantity for batch in prefetched_batches)

    result = get_usable_stock_batches_for_medication(medication).aggregate(
        total=Sum("quantity")
    )
    return result["total"] or 0


def calculate_weekly_demand_from_dosette(medication):
    active_records = getattr(medication, "_active_dosette_records", None)
    if active_records is None:
        active_records = DosetteRecord.objects.filter(
            medication=medication,
            is_active=True
        )

    total_weekly_demand = 0

    for record in active_records:
        total_weekly_demand += calculate_weekly_quantity(record)

    return total_weekly_demand


def _latest_usable_received_date(medication):
    batches = getattr(medication, "_usable_stock_batches", None)
    if batches is None:
        return (
            get_usable_stock_batches_for_medication(medication)
            .order_by("-received_date")
            .values_list("received_date", flat=True)
            .first()
        )

    return max((batch.received_date for batch in batches), default=None)


def _stock_assessment(
    *,
    medication,
    current_stock,
    predicted_weekly_demand,
    weeks_of_cover,
):
    minimum_stock_level = medication.minimum_stock_level
    reorder_threshold = medication.reorder_threshold
    target_weeks_of_cover = medication.target_weeks_of_cover
    latest_received = _latest_usable_received_date(medication)

    if predicted_weekly_demand == 0:
        if current_stock == 0:
            stock_status = "NO_DEMAND"
            recommendation = "No active dosette demand"
            analytics_group = "NO_DEMAND"
        elif (
            latest_received
            and latest_received
            <= timezone.localdate() - timedelta(days=DEAD_STOCK_DAYS)
        ):
            stock_status = "DEAD_STOCK"
            recommendation = "Review dead stock with no active dosette demand"
            analytics_group = "DEAD_STOCK"
        else:
            stock_status = "INACTIVE"
            recommendation = "Review inactive stock with no active dosette demand"
            analytics_group = "INACTIVE"

        return {
            "risk_level": "Low",
            "recommendation": recommendation,
            "stock_status": stock_status,
            "stock_status_label": STOCK_STATUS_LABELS[stock_status],
            "analytics_group": analytics_group,
            "target_stock": 0,
            "recommended_order_quantity": 0,
            "excess_quantity": 0,
            "latest_stock_received": (
                latest_received.isoformat() if latest_received else None
            ),
        }

    demand_target = ceil(
        predicted_weekly_demand * target_weeks_of_cover
    )
    target_stock = max(
        minimum_stock_level,
        reorder_threshold,
        demand_target,
    )
    recommended_order_quantity = max(target_stock - current_stock, 0)
    excess_threshold = max(
        target_stock,
        ceil(predicted_weekly_demand * target_weeks_of_cover * 2),
    )

    if current_stock == 0:
        stock_status = "OUT_OF_STOCK"
        risk_level = "High"
        recommendation = "Urgent reorder required"
    elif current_stock < predicted_weekly_demand:
        stock_status = "CRITICAL_SHORTAGE"
        risk_level = "High"
        recommendation = "Urgent reorder required"
    elif current_stock < minimum_stock_level:
        stock_status = "BELOW_MINIMUM"
        risk_level = "High"
        recommendation = (
            f"Reorder {recommended_order_quantity} units to restore target stock"
        )
    elif reorder_threshold and current_stock <= reorder_threshold:
        stock_status = "REORDER_THRESHOLD"
        risk_level = "Medium"
        recommendation = (
            f"Reorder {recommended_order_quantity} units; threshold reached"
        )
    elif weeks_of_cover <= 2:
        stock_status = "LOW_COVER"
        risk_level = "Medium"
        recommendation = "Reorder soon"
    elif current_stock < target_stock:
        stock_status = "BELOW_TARGET"
        risk_level = "Medium"
        recommendation = (
            f"Reorder {recommended_order_quantity} units to reach "
            f"{target_weeks_of_cover:g} weeks of cover"
        )
    elif current_stock > excess_threshold:
        stock_status = "EXCESS_STOCK"
        risk_level = "Low"
        recommendation = "Review excess stock against current dosette demand"
    else:
        stock_status = "ADEQUATE"
        risk_level = "Low"
        recommendation = "Stock level adequate"

    return {
        "risk_level": risk_level,
        "recommendation": recommendation,
        "stock_status": stock_status,
        "stock_status_label": STOCK_STATUS_LABELS[stock_status],
        "analytics_group": (
            "LOW_STOCK"
            if stock_status in LOW_STOCK_STATUSES
            else "EXCESS"
            if stock_status == "EXCESS_STOCK"
            else "ADEQUATE"
        ),
        "target_stock": target_stock,
        "recommended_order_quantity": recommended_order_quantity,
        "excess_quantity": (
            current_stock - target_stock
            if stock_status == "EXCESS_STOCK"
            else 0
        ),
        "latest_stock_received": (
            latest_received.isoformat() if latest_received else None
        ),
    }


def generate_medication_forecast():
    forecasts = []
    today = timezone.localdate()
    medications = Medication.objects.prefetch_related(
        Prefetch(
            "dosette_records",
            queryset=DosetteRecord.objects.filter(is_active=True),
            to_attr="_active_dosette_records",
        ),
        Prefetch(
            "stock_batches",
            queryset=StockBatch.objects.filter(
                quantity__gt=0,
                expiry_date__gte=today,
            ),
            to_attr="_usable_stock_batches",
        ),
    )

    for medication in medications:
        current_stock = get_total_stock_for_medication(medication)
        predicted_weekly_demand = calculate_weekly_demand_from_dosette(medication)

        if predicted_weekly_demand == 0:
            weeks_of_cover = None
        else:
            weeks_of_cover = round(current_stock / predicted_weekly_demand, 1)

        assessment = _stock_assessment(
            medication=medication,
            current_stock=current_stock,
            predicted_weekly_demand=predicted_weekly_demand,
            weeks_of_cover=weeks_of_cover,
        )

        forecasts.append({
            "medication_id": medication.pk,
            "medication": str(medication),
            "current_stock": current_stock,
            "predicted_weekly_demand": predicted_weekly_demand,
            "weeks_of_cover": weeks_of_cover,
            "recommendation": assessment["recommendation"],
            "risk_level": assessment["risk_level"],
            "minimum_stock_level": medication.minimum_stock_level,
            "reorder_threshold": medication.reorder_threshold,
            "target_weeks_of_cover": float(
                medication.target_weeks_of_cover
            ),
            **{
                key: value
                for key, value in assessment.items()
                if key not in {"recommendation", "risk_level"}
            },
        })

    return forecasts


def generate_stock_intelligence():
    items = generate_medication_forecast()

    return {
        "summary": {
            "total_medications": len(items),
            "low_stock": sum(
                item["analytics_group"] == "LOW_STOCK" for item in items
            ),
            "excess_stock": sum(
                item["analytics_group"] == "EXCESS" for item in items
            ),
            "inactive_stock": sum(
                item["analytics_group"] == "INACTIVE" for item in items
            ),
            "dead_stock": sum(
                item["analytics_group"] == "DEAD_STOCK" for item in items
            ),
            "no_active_demand": sum(
                item["analytics_group"] == "NO_DEMAND" for item in items
            ),
            "adequate_stock": sum(
                item["analytics_group"] == "ADEQUATE" for item in items
            ),
            "recommended_order_units": sum(
                item["recommended_order_quantity"] for item in items
            ),
        },
        "items": items,
    }
