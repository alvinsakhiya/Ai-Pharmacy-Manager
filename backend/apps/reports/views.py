"""Prototype operational stock report views.

These read-only endpoints expose stock reports only. They do not return patient
data, do not support clinical decision-making, and make no compliance claim.
"""

from django.http import HttpResponse
from django.utils.dateparse import parse_date
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenancy.permissions import Action, IsActiveMember, require

from .csv import (
    dead_stock_report_csv,
    expiry_report_csv,
    forecast_reorder_report_csv,
    mds_workload_report_csv,
    stock_attention_report_csv,
    stock_movements_report_csv,
    stock_valuation_report_csv,
    transfer_suggestions_report_csv,
)
from .serializers import (
    DeadStockReportSerializer,
    ExpiryReportSerializer,
    ForecastReorderReportSerializer,
    MdsWorkloadReportSerializer,
    ReportDashboardSerializer,
    StockAttentionReportSerializer,
    StockMovementsReportSerializer,
    StockValuationReportSerializer,
    TransferSuggestionsReportSerializer,
)
from .services import (
    InvalidMovementType,
    InvalidReportWindow,
    InvalidStockAttentionFlag,
    InvalidTransferStatus,
    dead_stock_report,
    expiry_report,
    forecast_reorder_report,
    mds_workload_report,
    reports_dashboard,
    stock_attention_report,
    stock_movements_report,
    stock_valuation_report,
    transfer_suggestions_report,
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


def _parse_window_days(request, *, default: int = 30) -> int:
    value = request.query_params.get("days", request.query_params.get("window"))
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        raise serializers.ValidationError(
            {"days": ["Window must be an integer."]}
        ) from None


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


def _build_expiry_report(request) -> dict:
    try:
        return expiry_report(
            request.user,
            pharmacy_id=_parse_int_query(request, "pharmacy", "Pharmacy filter"),
            window_days=_parse_window_days(request),
        )
    except InvalidReportWindow as exc:
        raise serializers.ValidationError(
            {"days": [f"Unsupported report window: {exc.window_days}."]}
        ) from None


def _build_dead_stock_report(request) -> dict:
    try:
        return dead_stock_report(
            request.user,
            pharmacy_id=_parse_int_query(request, "pharmacy", "Pharmacy filter"),
            window_days=_parse_window_days(request, default=90),
        )
    except InvalidReportWindow as exc:
        raise serializers.ValidationError(
            {"days": [f"Unsupported report window: {exc.window_days}."]}
        ) from None


def _build_forecast_reorder_report(request) -> dict:
    return forecast_reorder_report(
        request.user,
        pharmacy_id=_parse_int_query(request, "pharmacy", "Pharmacy filter"),
    )


def _build_transfer_suggestions_report(request) -> dict:
    try:
        return transfer_suggestions_report(
            request.user,
            group_id=_parse_int_query(request, "group", "Group filter"),
            status_filter=request.query_params.get("status"),
        )
    except InvalidTransferStatus as exc:
        raise serializers.ValidationError(
            {"status": [f"Unsupported transfer suggestion status: {exc.status}."]}
        ) from None


def _build_mds_workload_report(request) -> dict:
    try:
        return mds_workload_report(
            request.user,
            pharmacy_id=_parse_int_query(request, "pharmacy", "Pharmacy filter"),
            window_days=_parse_window_days(request),
        )
    except InvalidReportWindow as exc:
        raise serializers.ValidationError(
            {"days": [f"Unsupported report window: {exc.window_days}."]}
        ) from None


def _csv_response(content: str, filename: str) -> HttpResponse:
    response = HttpResponse(content, content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


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
        return _csv_response(
            stock_attention_report_csv(report),
            "stock-attention-report.csv",
        )


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
        return _csv_response(
            stock_movements_report_csv(report),
            "stock-movements-report.csv",
        )


class ReportsDashboardView(APIView):
    permission_classes = [IsActiveMember]

    def get(self, request):
        report = reports_dashboard(
            request.user,
            pharmacy_id=_parse_int_query(request, "pharmacy", "Pharmacy filter"),
            group_id=_parse_int_query(request, "group", "Group filter"),
        )
        return Response(
            ReportDashboardSerializer(report).data,
            status=status.HTTP_200_OK,
        )


class ExpiryReportView(APIView):
    permission_classes = [require(Action.STOCK_VIEW)]

    def get(self, request):
        report = _build_expiry_report(request)
        return Response(ExpiryReportSerializer(report).data, status=status.HTTP_200_OK)


class ExpiryReportCsvView(APIView):
    permission_classes = [require(Action.STOCK_VIEW)]

    def get(self, request):
        report = _build_expiry_report(request)
        return _csv_response(expiry_report_csv(report), "expiry-report.csv")


class DeadStockReportView(APIView):
    permission_classes = [require(Action.STOCK_VIEW)]

    def get(self, request):
        report = _build_dead_stock_report(request)
        return Response(
            DeadStockReportSerializer(report).data,
            status=status.HTTP_200_OK,
        )


class DeadStockReportCsvView(APIView):
    permission_classes = [require(Action.STOCK_VIEW)]

    def get(self, request):
        report = _build_dead_stock_report(request)
        return _csv_response(dead_stock_report_csv(report), "dead-stock-report.csv")


class ForecastReorderReportView(APIView):
    permission_classes = [require(Action.FORECAST_VIEW)]

    def get(self, request):
        report = _build_forecast_reorder_report(request)
        return Response(
            ForecastReorderReportSerializer(report).data,
            status=status.HTTP_200_OK,
        )


class ForecastReorderReportCsvView(APIView):
    permission_classes = [require(Action.FORECAST_VIEW)]

    def get(self, request):
        report = _build_forecast_reorder_report(request)
        return _csv_response(
            forecast_reorder_report_csv(report),
            "forecast-reorder-report.csv",
        )


class TransferSuggestionsReportView(APIView):
    permission_classes = [require(Action.TRANSFER_SUGGESTION_VIEW)]

    def get(self, request):
        report = _build_transfer_suggestions_report(request)
        return Response(
            TransferSuggestionsReportSerializer(report).data,
            status=status.HTTP_200_OK,
        )


class TransferSuggestionsReportCsvView(APIView):
    permission_classes = [require(Action.TRANSFER_SUGGESTION_VIEW)]

    def get(self, request):
        report = _build_transfer_suggestions_report(request)
        return _csv_response(
            transfer_suggestions_report_csv(report),
            "transfer-suggestions-report.csv",
        )


class StockValuationReportView(APIView):
    permission_classes = [require(Action.STOCK_VIEW)]

    def get(self, request):
        report = stock_valuation_report(
            request.user,
            pharmacy_id=_parse_int_query(request, "pharmacy", "Pharmacy filter"),
        )
        return Response(
            StockValuationReportSerializer(report).data,
            status=status.HTTP_200_OK,
        )


class StockValuationReportCsvView(APIView):
    permission_classes = [require(Action.STOCK_VIEW)]

    def get(self, request):
        report = stock_valuation_report(
            request.user,
            pharmacy_id=_parse_int_query(request, "pharmacy", "Pharmacy filter"),
        )
        return _csv_response(
            stock_valuation_report_csv(report),
            "stock-valuation-report.csv",
        )


class MdsWorkloadReportView(APIView):
    permission_classes = [require(Action.BLISTER_VIEW)]

    def get(self, request):
        report = _build_mds_workload_report(request)
        return Response(
            MdsWorkloadReportSerializer(report).data,
            status=status.HTTP_200_OK,
        )


class MdsWorkloadReportCsvView(APIView):
    permission_classes = [require(Action.BLISTER_VIEW)]

    def get(self, request):
        report = _build_mds_workload_report(request)
        return _csv_response(mds_workload_report_csv(report), "mds-workload-report.csv")
