from django.db import transaction
from django.utils import timezone

from .models import LocalDelivery, OperationalTask


class TaskTransitionError(ValueError):
    """Raised when an operational task transition is not valid."""


@transaction.atomic
def claim_task(task_id, user):
    task = OperationalTask.objects.select_for_update().get(pk=task_id)

    if task.status != OperationalTask.Status.TODO:
        raise TaskTransitionError("Only to-do tasks can be claimed.")

    if task.assigned_user_id or task.assigned_username:
        raise TaskTransitionError("This task is already assigned.")

    task.assigned_user = user
    task.assigned_username = user.get_username()
    task.save(
        update_fields=[
            "assigned_user",
            "assigned_username",
            "updated_at",
        ]
    )
    return task


@transaction.atomic
def start_task(task_id):
    task = OperationalTask.objects.select_for_update().get(pk=task_id)

    if not task.assigned_user_id:
        raise TaskTransitionError("Assign or claim the task before starting it.")

    if task.status != OperationalTask.Status.TODO:
        raise TaskTransitionError("Only to-do tasks can be started.")

    task.status = OperationalTask.Status.IN_PROGRESS
    task.save(update_fields=["status", "updated_at"])
    return task


@transaction.atomic
def complete_task(task_id):
    task = OperationalTask.objects.select_for_update().get(pk=task_id)

    if task.status != OperationalTask.Status.IN_PROGRESS:
        raise TaskTransitionError(
            "A task must be in progress before it can be completed."
        )

    task.status = OperationalTask.Status.COMPLETED
    task.completed_at = timezone.now()
    task.save(update_fields=["status", "completed_at", "updated_at"])
    return task


@transaction.atomic
def cancel_task(task_id, reason):
    task = OperationalTask.objects.select_for_update().get(pk=task_id)
    reason = str(reason or "").strip()

    if task.status == OperationalTask.Status.COMPLETED:
        raise TaskTransitionError("Completed tasks cannot be cancelled.")

    if task.status == OperationalTask.Status.CANCELLED:
        raise TaskTransitionError("This task is already cancelled.")

    if not reason:
        raise TaskTransitionError("A cancellation reason is required.")

    task.status = OperationalTask.Status.CANCELLED
    task.cancellation_reason = reason[:500]
    task.save(
        update_fields=[
            "status",
            "cancellation_reason",
            "updated_at",
        ]
    )
    return task


class DeliveryTransitionError(ValueError):
    """Raised when a local delivery transition is not valid."""


@transaction.atomic
def claim_delivery(delivery_id, user):
    delivery = LocalDelivery.objects.select_for_update().get(pk=delivery_id)

    if delivery.status not in {
        LocalDelivery.Status.PLANNED,
        LocalDelivery.Status.READY,
    }:
        raise DeliveryTransitionError(
            "Only planned or ready deliveries can be claimed."
        )

    if delivery.assigned_user_id or delivery.assigned_username:
        raise DeliveryTransitionError(
            "This delivery is already assigned."
        )

    delivery.assigned_user = user
    delivery.assigned_username = user.get_username()
    delivery.save(
        update_fields=[
            "assigned_user",
            "assigned_username",
            "updated_at",
        ]
    )
    return delivery


@transaction.atomic
def ready_delivery(delivery_id):
    delivery = LocalDelivery.objects.select_for_update().get(pk=delivery_id)

    if delivery.status != LocalDelivery.Status.PLANNED:
        raise DeliveryTransitionError(
            "Only planned deliveries can be marked ready."
        )

    delivery.status = LocalDelivery.Status.READY
    delivery.save(update_fields=["status", "updated_at"])
    return delivery


@transaction.atomic
def dispatch_delivery(delivery_id):
    delivery = LocalDelivery.objects.select_for_update().get(pk=delivery_id)

    if delivery.status != LocalDelivery.Status.READY:
        raise DeliveryTransitionError(
            "Only ready deliveries can be dispatched."
        )

    if not delivery.assigned_user_id:
        raise DeliveryTransitionError(
            "Assign or claim the delivery before dispatch."
        )

    delivery.status = LocalDelivery.Status.OUT_FOR_DELIVERY
    delivery.save(update_fields=["status", "updated_at"])
    return delivery


@transaction.atomic
def complete_delivery(delivery_id):
    delivery = LocalDelivery.objects.select_for_update().get(pk=delivery_id)

    if delivery.status != LocalDelivery.Status.OUT_FOR_DELIVERY:
        raise DeliveryTransitionError(
            "A delivery must be out for delivery before completion."
        )

    delivery.status = LocalDelivery.Status.DELIVERED
    delivery.delivered_at = timezone.now()
    delivery.save(
        update_fields=["status", "delivered_at", "updated_at"]
    )
    return delivery


@transaction.atomic
def fail_delivery(delivery_id, reason):
    delivery = LocalDelivery.objects.select_for_update().get(pk=delivery_id)
    reason = str(reason or "").strip()

    if delivery.status != LocalDelivery.Status.OUT_FOR_DELIVERY:
        raise DeliveryTransitionError(
            "Only a dispatched delivery can be marked failed."
        )

    if not reason:
        raise DeliveryTransitionError("A failure reason is required.")

    delivery.status = LocalDelivery.Status.FAILED
    delivery.outcome_notes = reason[:1000]
    delivery.save(
        update_fields=["status", "outcome_notes", "updated_at"]
    )
    return delivery


@transaction.atomic
def cancel_delivery(delivery_id, reason):
    delivery = LocalDelivery.objects.select_for_update().get(pk=delivery_id)
    reason = str(reason or "").strip()

    if delivery.status in {
        LocalDelivery.Status.DELIVERED,
        LocalDelivery.Status.FAILED,
        LocalDelivery.Status.CANCELLED,
    }:
        raise DeliveryTransitionError(
            "Finished deliveries cannot be cancelled."
        )

    if not reason:
        raise DeliveryTransitionError("A cancellation reason is required.")

    delivery.status = LocalDelivery.Status.CANCELLED
    delivery.outcome_notes = reason[:1000]
    delivery.save(
        update_fields=["status", "outcome_notes", "updated_at"]
    )
    return delivery
