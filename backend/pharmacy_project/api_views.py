from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status

from auditlog.models import AuditEvent
from auditlog.services import log_audit_event
from accounts.permissions import (
    DashboardRolePermission,
    ExpiryAlertRolePermission,
    ForecastRolePermission,
)
from patients.models import Patient
from inventory.models import Medication, StockBatch
from dosette.models import DosetteRecord
from dosette.utils import InvalidDoseValue
from inventory.utils import get_expiry_alerts
from inventory.forecasting import generate_medication_forecast


@api_view(["GET"])
@permission_classes([ForecastRolePermission])
def medication_forecasts(request):
    try:
        forecasts = generate_medication_forecast()
    except InvalidDoseValue as exc:
        return Response(
            {"detail": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    log_audit_event(
        action=AuditEvent.Action.ACCESS,
        entity_type="MedicationForecast",
        summary=f"Viewed medication forecast containing {len(forecasts)} records.",
        request=request,
    )

    return Response(forecasts)

@api_view(["GET"])
@permission_classes([DashboardRolePermission])
def dashboard_stats(request):
    alerts = get_expiry_alerts()

    data = {
        "total_patients": Patient.objects.count(),
        "total_medications": Medication.objects.count(),
        "total_batches": StockBatch.objects.count(),
        "active_dosette_records": DosetteRecord.objects.filter(is_active=True).count(),
        "expiry_alerts": {
            "expired": alerts["expired"].count(),
            "one_month": alerts["one_month"].count(),
            "three_months": alerts["three_months"].count(),
            "six_months": alerts["six_months"].count(),
        },
    }

    return Response(data)

@api_view(["GET"])
@permission_classes([ExpiryAlertRolePermission])
def expiry_alerts(request):
    alerts = get_expiry_alerts()

    def serialize_batch(batch):
        return {
            "id": batch.id,
            "medication": str(batch.medication),
            "batch_number": batch.batch_number,
            "expiry_date": batch.expiry_date,
            "quantity": batch.quantity,
            "supplier": batch.supplier,
        }

    response_data = {
        "expired": [serialize_batch(batch) for batch in alerts["expired"]],
        "one_month": [serialize_batch(batch) for batch in alerts["one_month"]],
        "three_months": [serialize_batch(batch) for batch in alerts["three_months"]],
        "six_months": [serialize_batch(batch) for batch in alerts["six_months"]],
    }
    total_alerts = sum(len(items) for items in response_data.values())

    log_audit_event(
        action=AuditEvent.Action.ACCESS,
        entity_type="ExpiryAlert",
        summary=f"Viewed expiry alerts containing {total_alerts} stock batches.",
        request=request,
    )

    return Response(response_data)
