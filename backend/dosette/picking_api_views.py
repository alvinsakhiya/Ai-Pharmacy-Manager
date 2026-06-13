from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status

from auditlog.models import AuditEvent
from auditlog.services import log_audit_event
from accounts.permissions import PickingListRolePermission
from patients.models import Patient
from dosette.utils import InvalidDoseValue, generate_patient_picking_list


@api_view(["GET"])
@permission_classes([PickingListRolePermission])
def patient_picking_list(request, patient_id):
    patient = Patient.objects.get(id=patient_id)

    try:
        picking_list = generate_patient_picking_list(patient)
    except InvalidDoseValue as exc:
        return Response(
            {"detail": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    data = []

    for item in picking_list:
        fefo = item["fefo_allocation"]

        data.append({
            "patient": f"{patient.first_name} {patient.last_name}",
            "medication": str(item["medication"]),
            "morning_dose": item["morning_dose"],
            "afternoon_dose": item["afternoon_dose"],
            "evening_dose": item["evening_dose"],
            "bedtime_dose": item["bedtime_dose"],
            "weekly_quantity": item["weekly_quantity"],
            "instructions": item["instructions"],
            "shortfall": fefo["shortfall"],
            "allocations": [
                {
                    "batch_number": allocation["batch"].batch_number,
                    "quantity": allocation["quantity"],
                    "expiry_date": allocation["expiry_date"],
                }
                for allocation in fefo["allocated"]
            ],
        })

    log_audit_event(
        action=AuditEvent.Action.GENERATE,
        entity_type="PatientPickingList",
        entity_identifier=patient.id,
        summary=f"Generated picking list containing {len(data)} medication lines.",
        request=request,
    )

    return Response(data)
