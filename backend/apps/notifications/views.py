"""Prototype in-app operational alert views.

These read-only views expose deterministic operational alerts only. They do not
perform clinical decision-making, do not integrate with the NHS, and make no
compliance claim. Stock alerts contain no patient data.
"""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenancy.permissions import IsActiveMember

from .serializers import AlertsResponseSerializer
from .services import alerts_for


def _parse_pharmacy(request) -> int | None:
    value = request.query_params.get("pharmacy")
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        raise serializers.ValidationError(
            {"pharmacy": ["Pharmacy filter must be an integer."]}
        ) from None


class AlertsView(APIView):
    permission_classes = [IsActiveMember]

    def get(self, request):
        report = alerts_for(request.user, pharmacy_id=_parse_pharmacy(request))
        return Response(
            AlertsResponseSerializer(report).data,
            status=status.HTTP_200_OK,
        )
