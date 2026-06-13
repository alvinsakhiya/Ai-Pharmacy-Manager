from django.db import transaction
from django.utils import timezone

from .models import OperationalTask


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
