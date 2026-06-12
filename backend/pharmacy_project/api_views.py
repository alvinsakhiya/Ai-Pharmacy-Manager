from rest_framework.decorators import api_view
from rest_framework.response import Response

from patients.models import Patient
from inventory.models import Medication, StockBatch
from dosette.models import DosetteRecord
from inventory.utils import get_expiry_alerts


@api_view(["GET"])
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

    return Response({
        "expired": [serialize_batch(batch) for batch in alerts["expired"]],
        "one_month": [serialize_batch(batch) for batch in alerts["one_month"]],
        "three_months": [serialize_batch(batch) for batch in alerts["three_months"]],
        "six_months": [serialize_batch(batch) for batch in alerts["six_months"]],
    })