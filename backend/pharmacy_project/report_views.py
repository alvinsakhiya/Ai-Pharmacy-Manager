import csv
from datetime import date, datetime
from decimal import Decimal

from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import (
    AuditLogRolePermission,
    ExpiryAlertRolePermission,
    ForecastRolePermission,
    InventoryRolePermission,
    NotificationReportRolePermission,
    PickingListRolePermission,
)
from accounts.roles import PharmacyRole, get_user_roles
from auditlog.models import AuditEvent
from auditlog.services import log_audit_event
from dosette.utils import InvalidDoseValue, generate_patient_picking_list
from inventory.forecasting import generate_medication_forecast
from inventory.models import StockBatch
from inventory.utils import get_expiry_alerts
from notifications.models import Notification
from patients.models import Patient


def _format_cell(value):
    if value is None:
        return ""
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, str) and value.lstrip().startswith(
        ("=", "+", "-", "@", "\t", "\r")
    ):
        return f"'{value}"
    return value


def _csv_response(filename, headers, rows):
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response["Cache-Control"] = "no-store"

    writer = csv.writer(response)
    writer.writerow(headers)
    for row in rows:
        writer.writerow([_format_cell(value) for value in row])

    return response


def _log_report_export(request, report_key, row_count):
    log_audit_event(
        action=AuditEvent.Action.GENERATE,
        entity_type="ReportExport",
        entity_identifier=report_key,
        summary=f"Generated {report_key} CSV containing {row_count} rows.",
        request=request,
    )


def _allocation_summary(fefo_allocation):
    allocations = fefo_allocation["allocated"]
    if not allocations:
        return "No stock allocated"

    return "; ".join(
        (
            f"{allocation['batch'].batch_number}: "
            f"{allocation['quantity']} units "
            f"(exp {allocation['expiry_date']})"
        )
        for allocation in allocations
    )


@api_view(["GET"])
@permission_classes([PickingListRolePermission])
def picking_list_report_csv(request, patient_id):
    patient = get_object_or_404(Patient, pk=patient_id)

    try:
        picking_list = generate_patient_picking_list(patient)
    except InvalidDoseValue as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    rows = []
    for item in picking_list:
        fefo = item["fefo_allocation"]
        rows.append(
            [
                str(patient),
                str(item["medication"]),
                item["morning_dose"],
                item["afternoon_dose"],
                item["evening_dose"],
                item["bedtime_dose"],
                item["weekly_quantity"],
                item["instructions"],
                fefo["shortfall"],
                _allocation_summary(fefo),
            ]
        )

    _log_report_export(request, "picking-list", len(rows))

    return _csv_response(
        f"picking-list-patient-{patient.pk}.csv",
        [
            "Patient",
            "Medication",
            "Morning Dose",
            "Afternoon Dose",
            "Evening Dose",
            "Bedtime Dose",
            "Weekly Quantity",
            "Instructions",
            "Shortfall",
            "FEFO Allocation Summary",
        ],
        rows,
    )


@api_view(["GET"])
@permission_classes([InventoryRolePermission])
def stock_report_csv(request):
    batches = StockBatch.objects.select_related(
        "medication",
        "medication__preferred_supplier",
    ).order_by("medication__name", "medication__strength", "expiry_date")

    rows = [
        [
            batch.medication.name,
            batch.medication.strength,
            batch.medication.form,
            batch.batch_number,
            batch.quantity,
            batch.expiry_date,
            batch.received_date,
            batch.supplier,
            (
                batch.medication.preferred_supplier.name
                if batch.medication.preferred_supplier
                else ""
            ),
            batch.medication.minimum_stock_level,
            batch.medication.reorder_threshold,
            batch.medication.target_weeks_of_cover,
        ]
        for batch in batches
    ]

    _log_report_export(request, "stock-report", len(rows))

    return _csv_response(
        "stock-report.csv",
        [
            "Medication",
            "Strength",
            "Form",
            "Batch Number",
            "Quantity",
            "Expiry Date",
            "Received Date",
            "Supplier",
            "Preferred Supplier",
            "Minimum Stock Level",
            "Reorder Threshold",
            "Target Weeks Cover",
        ],
        rows,
    )


@api_view(["GET"])
@permission_classes([ExpiryAlertRolePermission])
def expiry_report_csv(request):
    alerts = get_expiry_alerts()
    labels = {
        "expired": "Expired",
        "one_month": "Expires within 1 month",
        "three_months": "Expires within 3 months",
        "six_months": "Expires within 6 months",
    }
    rows = []

    for category, batches in alerts.items():
        for batch in batches.select_related("medication"):
            rows.append(
                [
                    labels[category],
                    str(batch.medication),
                    batch.batch_number,
                    batch.quantity,
                    batch.expiry_date,
                    batch.supplier,
                ]
            )

    _log_report_export(request, "expiry-report", len(rows))

    return _csv_response(
        "expiry-report.csv",
        [
            "Alert Category",
            "Medication",
            "Batch Number",
            "Quantity",
            "Expiry Date",
            "Supplier",
        ],
        rows,
    )


@api_view(["GET"])
@permission_classes([ForecastRolePermission])
def forecast_report_csv(request):
    try:
        forecasts = generate_medication_forecast()
    except InvalidDoseValue as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    rows = [
        [
            item["medication"],
            item["current_stock"],
            item["predicted_weekly_demand"],
            item["weeks_of_cover"],
            item["risk_level"],
            item["stock_status_label"],
            item["recommendation"],
            item["minimum_stock_level"],
            item["reorder_threshold"],
            item["target_weeks_of_cover"],
            item["target_stock"],
            item["recommended_order_quantity"],
            item["excess_quantity"],
            item["preferred_supplier_name"],
        ]
        for item in forecasts
    ]

    _log_report_export(request, "forecast-report", len(rows))

    return _csv_response(
        "forecast-report.csv",
        [
            "Medication",
            "Current Stock",
            "Predicted Weekly Demand",
            "Weeks Of Cover",
            "Risk Level",
            "Stock Status",
            "Recommendation",
            "Minimum Stock Level",
            "Reorder Threshold",
            "Target Weeks Cover",
            "Target Stock",
            "Recommended Order Quantity",
            "Excess Quantity",
            "Preferred Supplier",
        ],
        rows,
    )


@api_view(["GET"])
@permission_classes([AuditLogRolePermission])
def audit_report_csv(request):
    events = list(
        AuditEvent.objects.select_related("actor").order_by(
            "-timestamp",
            "-id",
        )[:1000]
    )
    rows = [
        [
            event.timestamp,
            event.actor_username or "System",
            event.action,
            event.entity_type,
            event.entity_identifier,
            event.summary,
            event.request_path,
        ]
        for event in events
    ]

    _log_report_export(request, "audit-report", len(rows))

    return _csv_response(
        "audit-report.csv",
        [
            "Timestamp",
            "Actor",
            "Action",
            "Entity Type",
            "Entity Identifier",
            "Safe Summary",
            "Request Path",
        ],
        rows,
    )


def _visible_notifications_for_user(user):
    queryset = Notification.objects.select_related("assigned_user")
    roles = set(get_user_roles(user))

    if PharmacyRole.MANAGER in roles:
        return queryset

    return queryset.filter(
        Q(assigned_user=user)
        | Q(
            assigned_user__isnull=True,
            assigned_username="",
        )
    )


@api_view(["GET"])
@permission_classes([NotificationReportRolePermission])
def notification_report_csv(request):
    notifications = _visible_notifications_for_user(request.user).order_by(
        "-created_at",
        "-id",
    )
    rows = [
        [
            notification.title,
            notification.priority,
            notification.status,
            notification.assigned_username or "Unassigned",
            notification.due_date,
            notification.expiry_date,
            notification.created_at,
            notification.acknowledged_at,
            notification.resolved_at,
            notification.related_entity_type,
            notification.related_entity_id,
        ]
        for notification in notifications
    ]

    _log_report_export(request, "notification-report", len(rows))

    return _csv_response(
        "notification-report.csv",
        [
            "Title",
            "Priority",
            "Status",
            "Assigned To",
            "Due Date",
            "Expiry Date",
            "Created At",
            "Acknowledged At",
            "Resolved At",
            "Related Entity Type",
            "Related Entity ID",
        ],
        rows,
    )
