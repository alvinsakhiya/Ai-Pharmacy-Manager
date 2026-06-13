from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.stock.models import Medicine

from .engine import forecast_medicine


class ForecastQuerySerializer(serializers.Serializer):
    horizon = serializers.IntegerField(required=False, default=4, min_value=1, max_value=12)


def validated_horizon(request):
    serializer = ForecastQuerySerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data["horizon"]


class MedicineForecastView(APIView):
    """GET /api/forecast/medicine/<id>/?horizon=4 -> full explainable forecast."""

    permission_classes = [IsAuthenticated]

    def get(self, request, medicine_id):
        medicine = get_object_or_404(Medicine, pk=medicine_id)
        horizon = validated_horizon(request)
        result = forecast_medicine(medicine, horizon)
        data = result.as_dict()
        data["medicine_label"] = medicine.label
        return Response(data)


class ShortageForecastView(APIView):
    """GET /api/forecast/shortages/ -> medicines predicted to need reordering."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        horizon = validated_horizon(request)
        rows = []
        for medicine in Medicine.objects.filter(is_active=True).select_related("default_supplier"):
            result = forecast_medicine(medicine, horizon)
            if not result.points:
                continue
            reorder = result.reorder
            if reorder.get("should_order"):
                rows.append({
                    "medicine_id": medicine.id,
                    "medicine_label": medicine.label,
                    "method": result.method,
                    "avg_weekly_demand": round(result.avg_weekly_demand, 1),
                    "trend_per_week": round(result.trend_per_week, 2),
                    "on_hand": reorder["on_hand"],
                    "projected_lead_time_demand": reorder["projected_lead_time_demand"],
                    "suggested_order_units": reorder["suggested_order_units"],
                    "supplier": medicine.default_supplier.name if medicine.default_supplier else None,
                })
        rows.sort(key=lambda r: r["suggested_order_units"], reverse=True)
        return Response({"count": len(rows), "results": rows})


class ForecastSummaryView(APIView):
    """GET /api/forecast/summary/ -> headline numbers for the dashboard."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        total = predicted_shortages = rising = 0
        for medicine in Medicine.objects.filter(is_active=True):
            result = forecast_medicine(medicine, 4)
            if not result.points:
                continue
            total += 1
            if result.reorder.get("should_order"):
                predicted_shortages += 1
            if result.trend_per_week > 0.5:
                rising += 1
        return Response({
            "medicines_forecast": total,
            "predicted_shortages": predicted_shortages,
            "rising_demand": rising,
        })
