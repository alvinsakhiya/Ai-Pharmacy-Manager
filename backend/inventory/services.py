from django.db import transaction
from django.utils import timezone

from auditlog.models import AuditEvent
from auditlog.services import log_audit_event

from .models import StockBatch, StockMovement


class StockMovementError(ValueError):
    """Raised when a stock change would violate ledger safety rules."""


DECREASE_ONLY_TYPES = {
    StockMovement.MovementType.PICKING_ALLOCATION,
    StockMovement.MovementType.WASTE_QUARANTINE,
}


def _authenticated_actor(request=None, actor=None):
    candidate = actor or getattr(request, "user", None)

    if candidate is not None and getattr(candidate, "is_authenticated", False):
        return candidate

    return None


def _validate_movement(movement_type, quantity_change, reason):
    valid_types = {choice for choice, _ in StockMovement.MovementType.choices}

    if movement_type not in valid_types:
        raise StockMovementError("Select a valid stock movement type.")

    if quantity_change == 0:
        raise StockMovementError("Quantity change must not be zero.")

    if not str(reason or "").strip():
        raise StockMovementError("A stock adjustment reason is required.")

    if (
        movement_type == StockMovement.MovementType.RECEIVED
        and quantity_change < 0
    ):
        raise StockMovementError("Received stock must increase quantity.")

    if movement_type in DECREASE_ONLY_TYPES and quantity_change > 0:
        raise StockMovementError(
            f"{StockMovement.MovementType(movement_type).label} must reduce quantity."
        )


def _create_movement(
    *,
    batch,
    movement_type,
    quantity_change,
    quantity_before,
    quantity_after,
    reason,
    request=None,
    actor=None,
):
    authenticated_actor = _authenticated_actor(request=request, actor=actor)

    return StockMovement.objects.create(
        stock_batch=batch,
        stock_batch_identifier=str(batch.pk),
        medication_identifier=str(batch.medication_id),
        medication_name=str(batch.medication),
        batch_number=batch.batch_number,
        movement_type=movement_type,
        quantity_change=quantity_change,
        quantity_before=quantity_before,
        quantity_after=quantity_after,
        reason=str(reason).strip()[:300],
        actor=authenticated_actor,
        actor_username=(
            authenticated_actor.get_username()
            if authenticated_actor is not None
            else ""
        ),
    )


def record_initial_stock_receipt(batch, request=None, actor=None):
    if batch.quantity <= 0:
        return None

    return _create_movement(
        batch=batch,
        movement_type=StockMovement.MovementType.RECEIVED,
        quantity_change=batch.quantity,
        quantity_before=0,
        quantity_after=batch.quantity,
        reason="Initial stock batch receipt.",
        request=request,
        actor=actor,
    )


@transaction.atomic
def adjust_stock_batch(
    *,
    batch_id,
    movement_type,
    quantity_change,
    reason,
    request=None,
    actor=None,
):
    reason = str(reason or "").strip()
    _validate_movement(movement_type, quantity_change, reason)

    batch = (
        StockBatch.objects.select_for_update()
        .select_related("medication")
        .get(pk=batch_id)
    )
    quantity_before = batch.quantity
    quantity_after = quantity_before + quantity_change

    if quantity_after < 0:
        raise StockMovementError(
            "Quantity change cannot reduce the batch below zero."
        )

    if (
        movement_type == StockMovement.MovementType.PICKING_ALLOCATION
        and batch.expiry_date < timezone.now().date()
    ):
        raise StockMovementError(
            "Expired stock cannot be recorded as a picking allocation."
        )

    batch.quantity = quantity_after
    batch.save(update_fields=["quantity", "updated_at"])

    movement = _create_movement(
        batch=batch,
        movement_type=movement_type,
        quantity_change=quantity_change,
        quantity_before=quantity_before,
        quantity_after=quantity_after,
        reason=reason,
        request=request,
        actor=actor,
    )

    log_audit_event(
        action=AuditEvent.Action.UPDATE,
        entity_type="StockBatch",
        entity_identifier=batch.pk,
        summary=(
            "Updated StockBatch quantity through a controlled "
            f"{movement.get_movement_type_display().lower()} movement."
        ),
        request=request,
        actor=actor,
    )

    return movement
