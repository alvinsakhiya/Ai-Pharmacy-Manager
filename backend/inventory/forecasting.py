from django.db.models import Sum

from inventory.models import Medication
from dosette.models import DosetteRecord
from dosette.utils import calculate_weekly_quantity
from inventory.utils import get_usable_stock_batches_for_medication


def get_total_stock_for_medication(medication):
    result = get_usable_stock_batches_for_medication(medication).aggregate(
        total=Sum("quantity")
    )
    return result["total"] or 0


def calculate_weekly_demand_from_dosette(medication):
    active_records = DosetteRecord.objects.filter(
        medication=medication,
        is_active=True
    )

    total_weekly_demand = 0

    for record in active_records:
        total_weekly_demand += calculate_weekly_quantity(record)

    return total_weekly_demand


def generate_medication_forecast():
    forecasts = []

    for medication in Medication.objects.all():
        current_stock = get_total_stock_for_medication(medication)
        predicted_weekly_demand = calculate_weekly_demand_from_dosette(medication)

        if predicted_weekly_demand == 0:
            weeks_of_cover = None
        else:
            weeks_of_cover = round(current_stock / predicted_weekly_demand, 1)

        if predicted_weekly_demand == 0:
            recommendation = "No active dosette demand"
            risk_level = "Low"
        elif current_stock < predicted_weekly_demand:
            recommendation = "Urgent reorder required"
            risk_level = "High"
        elif weeks_of_cover <= 2:
            recommendation = "Reorder soon"
            risk_level = "Medium"
        else:
            recommendation = "Stock level adequate"
            risk_level = "Low"

        forecasts.append({
            "medication": str(medication),
            "current_stock": current_stock,
            "predicted_weekly_demand": predicted_weekly_demand,
            "weeks_of_cover": weeks_of_cover,
            "recommendation": recommendation,
            "risk_level": risk_level,
        })

    return forecasts
