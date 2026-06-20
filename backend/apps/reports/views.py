"""Prototype operational stock report views.

These read-only endpoints expose stock reports only. They do not return patient
data, do not support clinical decision-making, and make no compliance claim.
"""

from django.http import HttpResponse
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenancy.permissions import Action, require

from .csv import stock_attention_report_csv
from .serializers import StockAttentionReportSerializer
from .services import InvalidStockAttentionFlag, stock_attention_report


def _parse_bool(value: str | None) -> bool:
    return value in {"true", "1", "yes"}


def _parse_query_params(request) -> dict:
    pharmacy_id = request.query_params.get("pharmacy")
    if pharmacy_id is not None:
        try:
            pharmacy_id = int(pharmacy_id)
        except ValueError:
            raise serializers.ValidationError(
                {"pharmacy": ["Pharmacy filter must be an integer."]}
            ) from None

    return {
        "pharmacy_id": pharmacy_id,
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
