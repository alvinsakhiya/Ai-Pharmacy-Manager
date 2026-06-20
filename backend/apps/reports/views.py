"""Prototype operational stock report views.

These read-only endpoints expose stock reports only. They do not return patient
data, do not support clinical decision-making, and make no compliance claim.
"""

from django.http import HttpResponse
from django.utils.dateparse import parse_date
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenancy.permissions import Action, require

from .csv import stock_attention_report_csv, stock_movements_report_csv
from .serializers import StockAttentionReportSerializer, StockMovementsReportSerializer
from .services import (
    InvalidMovementType,
    InvalidStockAttentionFlag,
    stock_attention_report,
    stock_movements_report,
)


def _parse_bool(value: str | None) -> bool:
    return value in {"true", "1", "yes"}


def _parse_int_query(request, key: str, error_label: str) -> int | None:
    value = request.query_params.get(key)
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        raise serializers.ValidationError(
            {key: [f"{error_label} must be an integer."]}
        ) from None


def _parse_date_query(request, key: str):
    value = request.query_params.get(key)
    if value is None:
        return None
    parsed = parse_date(value)
    if parsed is None:
        raise serializers.ValidationError({key: ["Date must be in ISO format."]})
    return parsed


def _parse_query_params(request) -> dict:
    return {
        "pharmacy_id": _parse_int_query(request, "pharmacy", "Pharmacy filter"),
        "flag": request.query_params.get("flag"),
        "needs_attention": _parse_bool(request.query_params.get("needs_attention")),
    }


def _build_report(request) -> dict:
    try:
        return stock_attention_report(request.user, **_parse_query_params(request))
    except InvalidStockAttentionFlag as exc:
        raise serializers.ValidationError(
            {"flag": [f"Unsupported stock attention flag: {exc.flag}."]}
        ) from None


def _parse_limit(request) -> int | None:
    limit = request.query_params.get("limit")
    if limit is None:
        return None
    try:
        parsed = int(limit)
    except ValueError:
        raise serializers.ValidationError(
            {"limit": ["Limit must be an integer."]}
        ) from None
    if parsed < 1:
        raise serializers.ValidationError({"limit": ["Limit must be at least 1."]})
    return parsed


def _parse_movement_query_params(request) -> dict:
    params = {
        "pharmacy_id": _parse_int_query(request, "pharmacy", "Pharmacy filter"),
        "medication_id": _parse_int_query(request, "medication", "Medication filter"),
        "stock_item_id": _parse_int_query(request, "stock_item", "Stock item filter"),
        "movement_type": request.query_params.get("movement_type"),
        "date_from": _parse_date_query(request, "date_from"),
        "date_to": _parse_date_query(request, "date_to"),
    }
    limit = _parse_limit(request)
    if limit is not None:
        params["limit"] = limit
    return params


def _build_movements_report(request) -> dict:
    try:
        return stock_movements_report(
            request.user,
            **_parse_movement_query_params(request),
        )
    except InvalidMovementType as exc:
        raise serializers.ValidationError(
            {"movement_type": [f"Unsupported movement type: {exc.movement_type}."]}
        ) from None


class StockAttentionReportView(APIView):
    permission_classes = [require(Action.STOCK_VIEW)]

    def get(self, request):
        report = _build_report(request)
        return Response(
            StockAttentionReportSerializer(report).data,
            status=status.HTTP_200_OK,
        )


class StockAttentionReportCsvView(APIView):
    permission_classes = [require(Action.STOCK_VIEW)]

    def get(self, request):
        report = _build_report(request)
        response = HttpResponse(
            stock_attention_report_csv(report),
            content_type="text/csv",
        )
        response["Content-Disposition"] = (
            'attachment; filename="stock-attention-report.csv"'
        )
        return response


class StockMovementsReportView(APIView):
    permission_classes = [require(Action.STOCK_VIEW)]

    def get(self, request):
        report = _build_movements_report(request)
        return Response(
            StockMovementsReportSerializer(report).data,
            status=status.HTTP_200_OK,
        )


class StockMovementsReportCsvView(APIView):
    permission_classes = [require(Action.STOCK_VIEW)]

    def get(self, request):
        report = _build_movements_report(request)
        response = HttpResponse(
            stock_movements_report_csv(report),
            content_type="text/csv",
        )
        response["Content-Disposition"] = (
            'attachment; filename="stock-movements-report.csv"'
        )
        return response
