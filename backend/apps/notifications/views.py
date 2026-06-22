"""Prototype in-app operational alert views.

These read-only views expose deterministic operational alerts only. They do not
perform clinical decision-making, do not integrate with the NHS, and make no
compliance claim. Stock alerts contain no patient data.
"""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenancy.permissions import IsActiveMember

from .serializers import (
    AlertClearResponseSerializer,
    AlertClearSerializer,
    AlertDismissResponseSerializer,
    AlertDismissSerializer,
    AlertsResponseSerializer,
)
from .services import AlertNotVisible, alerts_for, clear_alerts, dismiss_alert


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


class AlertDismissView(APIView):
    permission_classes = [IsActiveMember]

    def post(self, request):
        serializer = AlertDismissSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = dismiss_alert(
                request.user,
                fingerprint=serializer.validated_data["fingerprint"],
            )
        except AlertNotVisible as exc:
            raise serializers.ValidationError(
                {"fingerprint": ["Alert is not visible in your current scope."]}
            ) from exc

        return Response(
            AlertDismissResponseSerializer(result).data,
            status=status.HTTP_200_OK,
        )


class AlertClearView(APIView):
    permission_classes = [IsActiveMember]

    def post(self, request):
        serializer = AlertClearSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = clear_alerts(
                request.user,
                fingerprints=serializer.validated_data.get("fingerprints"),
            )
        except AlertNotVisible as exc:
            raise serializers.ValidationError(
                {"fingerprints": ["One or more alerts are outside your current scope."]}
            ) from exc

        return Response(
            AlertClearResponseSerializer(result).data,
            status=status.HTTP_200_OK,
        )
