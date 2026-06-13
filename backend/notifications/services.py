from django.db import transaction
from django.utils import timezone

from .models import Notification


class NotificationTransitionError(ValueError):
    """Raised when a notification lifecycle transition is not valid."""


@transaction.atomic
def mark_notification_read(notification_id):
    notification = Notification.objects.select_for_update().get(
        pk=notification_id
    )

    if notification.status == Notification.Status.NEW:
        notification.status = Notification.Status.READ
        notification.save(update_fields=["status"])
        return notification, True

    if notification.status == Notification.Status.RESOLVED:
        raise NotificationTransitionError(
            "Resolved notifications cannot return to read status."
        )

    return notification, False


@transaction.atomic
def acknowledge_notification(notification_id):
    notification = Notification.objects.select_for_update().get(
        pk=notification_id
    )

    if notification.status in {
        Notification.Status.NEW,
        Notification.Status.READ,
    }:
        notification.status = Notification.Status.ACKNOWLEDGED
        notification.acknowledged_at = timezone.now()
        notification.save(
            update_fields=["status", "acknowledged_at"]
        )
        return notification, True

    if notification.status == Notification.Status.RESOLVED:
        raise NotificationTransitionError(
            "Resolved notifications cannot be acknowledged again."
        )

    return notification, False


@transaction.atomic
def resolve_notification(notification_id, resolution_reason):
    notification = Notification.objects.select_for_update().get(
        pk=notification_id
    )
    resolution_reason = str(resolution_reason or "").strip()

    if notification.status != Notification.Status.ACKNOWLEDGED:
        raise NotificationTransitionError(
            "A notification must be acknowledged before it can be resolved."
        )

    if not resolution_reason:
        raise NotificationTransitionError("A resolution reason is required.")

    notification.status = Notification.Status.RESOLVED
    notification.resolved_at = timezone.now()
    notification.resolution_reason = resolution_reason[:500]
    notification.save(
        update_fields=[
            "status",
            "resolved_at",
            "resolution_reason",
        ]
    )
    return notification
