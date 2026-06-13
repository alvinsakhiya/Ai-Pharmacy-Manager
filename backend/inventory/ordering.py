from django.db import transaction
from django.db.models import Sum

from auditlog.models import AuditEvent
from auditlog.services import log_audit_event

from .forecasting import generate_medication_forecast
from .models import (
    DraftPurchaseOrder,
    DraftPurchaseOrderItem,
    Medication,
    Supplier,
)


OPEN_ORDER_STATUSES = {
    DraftPurchaseOrder.Status.DRAFT,
    DraftPurchaseOrder.Status.REVIEWED,
}


class OrderingWorkflowError(ValueError):
    """Raised when an internal draft order would be unsafe or ambiguous."""


def _open_order_quantities():
    return {
        row["medication_id"]: row["total"] or 0
        for row in DraftPurchaseOrderItem.objects.filter(
            purchase_order__status__in=OPEN_ORDER_STATUSES,
        )
        .values("medication_id")
        .annotate(total=Sum("quantity"))
    }


def generate_reorder_suggestions():
    open_quantities = _open_order_quantities()
    suggestions = []

    for forecast in generate_medication_forecast():
        recommended_quantity = forecast["recommended_order_quantity"]
        open_order_quantity = open_quantities.get(
            forecast["medication_id"],
            0,
        )
        outstanding_quantity = max(
            recommended_quantity - open_order_quantity,
            0,
        )

        if outstanding_quantity <= 0:
            continue

        supplier_id = forecast["preferred_supplier_id"]
        supplier_active = forecast["preferred_supplier_active"]

        if supplier_id is None:
            supplier_status = "SUPPLIER_REQUIRED"
            supplier_status_label = "Preferred supplier required"
        elif not supplier_active:
            supplier_status = "SUPPLIER_INACTIVE"
            supplier_status_label = "Preferred supplier inactive"
        else:
            supplier_status = "READY"
            supplier_status_label = "Ready for internal draft"

        suggestions.append(
            {
                "medication_id": forecast["medication_id"],
                "medication": forecast["medication"],
                "current_stock": forecast["current_stock"],
                "target_stock": forecast["target_stock"],
                "recommended_quantity": recommended_quantity,
                "open_order_quantity": open_order_quantity,
                "outstanding_quantity": outstanding_quantity,
                "recommendation": forecast["recommendation"],
                "risk_level": forecast["risk_level"],
                "stock_status": forecast["stock_status"],
                "stock_status_label": forecast["stock_status_label"],
                "preferred_supplier_id": supplier_id,
                "preferred_supplier_name": forecast[
                    "preferred_supplier_name"
                ],
                "supplier_status": supplier_status,
                "supplier_status_label": supplier_status_label,
            }
        )

    return {
        "summary": {
            "total_suggestions": len(suggestions),
            "ready_to_draft": sum(
                item["supplier_status"] == "READY"
                for item in suggestions
            ),
            "supplier_attention": sum(
                item["supplier_status"] != "READY"
                for item in suggestions
            ),
            "outstanding_units": sum(
                item["outstanding_quantity"] for item in suggestions
            ),
        },
        "items": suggestions,
    }


@transaction.atomic
def create_draft_purchase_order(
    *,
    supplier_id,
    medication_ids,
    notes="",
    request=None,
):
    medication_ids = list(dict.fromkeys(medication_ids))

    if not medication_ids:
        raise OrderingWorkflowError(
            "Select at least one reorder suggestion."
        )

    supplier = Supplier.objects.select_for_update().filter(
        pk=supplier_id
    ).first()
    if supplier is None:
        raise OrderingWorkflowError("Select a valid supplier.")
    if not supplier.is_active:
        raise OrderingWorkflowError(
            "Draft orders require an active supplier."
        )

    medications = {
        medication.pk: medication
        for medication in Medication.objects.select_for_update().filter(
            pk__in=medication_ids,
        )
    }
    if len(medications) != len(medication_ids):
        raise OrderingWorkflowError(
            "One or more selected medications no longer exist."
        )

    suggestion_map = {
        item["medication_id"]: item
        for item in generate_reorder_suggestions()["items"]
    }
    selected_suggestions = []

    for medication_id in medication_ids:
        suggestion = suggestion_map.get(medication_id)
        if suggestion is None:
            raise OrderingWorkflowError(
                "A selected medication no longer has an outstanding "
                "reorder recommendation."
            )
        if suggestion["preferred_supplier_id"] != supplier.pk:
            raise OrderingWorkflowError(
                "Every selected medication must use the chosen preferred "
                "supplier."
            )
        if suggestion["supplier_status"] != "READY":
            raise OrderingWorkflowError(
                "Every selected medication must have an active preferred "
                "supplier."
            )
        selected_suggestions.append(suggestion)

    actor = getattr(request, "user", None)
    if actor is not None and not actor.is_authenticated:
        actor = None

    purchase_order = DraftPurchaseOrder.objects.create(
        supplier=supplier,
        notes=str(notes or "").strip(),
        created_by=actor,
        created_by_username=actor.get_username() if actor else "",
    )
    DraftPurchaseOrderItem.objects.bulk_create(
        [
            DraftPurchaseOrderItem(
                purchase_order=purchase_order,
                medication=medications[suggestion["medication_id"]],
                medication_name=suggestion["medication"],
                quantity=suggestion["outstanding_quantity"],
                recommended_quantity=suggestion["recommended_quantity"],
                current_stock=suggestion["current_stock"],
                target_stock=suggestion["target_stock"],
                rationale=suggestion["recommendation"],
            )
            for suggestion in selected_suggestions
        ]
    )

    log_audit_event(
        action=AuditEvent.Action.CREATE,
        entity_type="DraftPurchaseOrder",
        entity_identifier=purchase_order.pk,
        summary=(
            "Created DraftPurchaseOrder containing "
            f"{len(selected_suggestions)} medication lines."
        ),
        request=request,
    )

    return purchase_order
