"""Prototype stock analytics views.

These read-only endpoints expose inventory analytics only. They do not return
patient data, do not support clinical decision-making, and make no compliance
claim.
"""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenancy.permissions import Action, require

from .serializers import StockOverviewSerializer
from .services import stock_overview_for


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
