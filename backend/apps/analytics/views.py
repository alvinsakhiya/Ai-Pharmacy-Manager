"""Prototype stock analytics views.

These read-only endpoints expose inventory analytics only. They do not return
patient data, do not support clinical decision-making, and make no compliance
claim.
"""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenancy.models import Group, Pharmacy
from apps.tenancy.permissions import Action, can, require

from .models import ForecastRun, TransferSuggestion
from .serializers import (
    ForecastGenerateSerializer,
    ForecastRunSerializer,
    StockOverviewSerializer,
    TransferSuggestionGenerateSerializer,
    TransferSuggestionSerializer,
)
from .services import (
    dismiss_transfer_suggestion,
    generate_stock_forecast,
    generate_transfer_suggestions,
    latest_stock_forecast_for,
    list_transfer_suggestions,
    stock_overview_for,
)


class StockOverviewView(APIView):
    permission_classes = [require(Action.STOCK_VIEW)]

    def get(self, request):
        pharmacy_id = request.query_params.get("pharmacy")
        if pharmacy_id is not None:
            try:
                pharmacy_id = int(pharmacy_id)
            except ValueError:
                raise serializers.ValidationError(
                    {"pharmacy": ["Pharmacy filter must be an integer."]}
                ) from None

        overview = stock_overview_for(request.user, pharmacy_id=pharmacy_id)
        return Response(
            StockOverviewSerializer(overview).data,
            status=status.HTTP_200_OK,
        )


def _pharmacy_from_id(pharmacy_id):
    try:
        return Pharmacy.objects.get(pk=pharmacy_id, is_active=True)
    except Pharmacy.DoesNotExist as exc:
        raise serializers.ValidationError(
            {"pharmacy": ["Pharmacy is invalid."]}
        ) from exc


def _group_from_id(group_id):
    try:
        return Group.objects.get(pk=group_id, is_active=True)
    except Group.DoesNotExist as exc:
        raise serializers.ValidationError({"group": ["Group is invalid."]}) from exc


class ForecastGenerateView(APIView):
    permission_classes = [require(Action.FORECAST_RUN)]

    def post(self, request):
        serializer = ForecastGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pharmacy = _pharmacy_from_id(serializer.validated_data["pharmacy"])
        run = generate_stock_forecast(
            request.user,
            pharmacy=pharmacy,
            horizon_days=int(serializer.validated_data["horizon_days"]),
        )
        return Response(ForecastRunSerializer(run).data, status=status.HTTP_201_CREATED)


class ForecastLatestView(APIView):
    permission_classes = [require(Action.FORECAST_VIEW)]

    def get(self, request):
        pharmacy_id = request.query_params.get("pharmacy")
        if pharmacy_id is None:
            raise serializers.ValidationError(
                {"pharmacy": ["Pharmacy query parameter is required."]}
            )
        try:
            pharmacy = _pharmacy_from_id(int(pharmacy_id))
        except ValueError:
            raise serializers.ValidationError(
                {"pharmacy": ["Pharmacy filter must be an integer."]}
            ) from None

        run = latest_stock_forecast_for(request.user, pharmacy=pharmacy)
        if run is None:
            return Response({"detail": "No forecast generated yet."})
        return Response(ForecastRunSerializer(run).data, status=status.HTTP_200_OK)


class TransferSuggestionListCreateView(APIView):
    def get_permissions(self):
        action = (
            Action.TRANSFER_SUGGESTION_GENERATE
            if self.request.method == "POST"
            else Action.TRANSFER_SUGGESTION_VIEW
        )
        return [require(action)()]

    def get(self, request):
        group_id = request.query_params.get("group")
        if group_id is None:
            raise serializers.ValidationError(
                {"group": ["Group query parameter is required."]}
            )
        try:
            group = _group_from_id(int(group_id))
        except ValueError:
            raise serializers.ValidationError(
                {"group": ["Group filter must be an integer."]}
            ) from None

        suggestions = list_transfer_suggestions(request.user, group=group)
        return Response(
            TransferSuggestionSerializer(suggestions, many=True).data,
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = TransferSuggestionGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = _group_from_id(serializer.validated_data["group"])
        suggestions = generate_transfer_suggestions(
            request.user,
            group=group,
            dead_days=serializer.validated_data["dead_days"],
        )
        return Response(
            TransferSuggestionSerializer(suggestions, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class TransferSuggestionDismissView(APIView):
    permission_classes = [require(Action.TRANSFER_SUGGESTION_DISMISS)]

    def post(self, request, pk):
        try:
            suggestion = TransferSuggestion.objects.select_related(
                "group",
                "catalogue_product",
                "source_pharmacy",
                "destination_pharmacy",
                "source_stock_item",
                "destination_stock_item",
                "generated_by",
            ).get(pk=pk)
        except TransferSuggestion.DoesNotExist as exc:
            raise serializers.ValidationError(
                {"suggestion": ["Transfer suggestion is invalid."]}
            ) from exc

        suggestion = dismiss_transfer_suggestion(request.user, suggestion=suggestion)
        return Response(
            TransferSuggestionSerializer(suggestion).data,
            status=status.HTTP_200_OK,
        )


class ForecastDetailView(APIView):
    permission_classes = [require(Action.FORECAST_VIEW)]

    def get(self, request, pk):
        try:
            run = (
                ForecastRun.objects.select_related("pharmacy", "group", "generated_by")
                .prefetch_related(
                    "items",
                    "items__stock_item",
                    "items__catalogue_product",
                )
                .get(pk=pk)
            )
        except ForecastRun.DoesNotExist as exc:
            raise serializers.ValidationError(
                {"forecast": ["Forecast run is invalid."]}
            ) from exc

        if not can(request.user, Action.FORECAST_VIEW, target=run.pharmacy):
            raise serializers.ValidationError(
                {"pharmacy": ["This pharmacy is outside your forecasting scope."]}
            )

        return Response(ForecastRunSerializer(run).data, status=status.HTTP_200_OK)
