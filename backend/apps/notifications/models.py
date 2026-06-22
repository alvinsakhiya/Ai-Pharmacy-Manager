from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel


class NotificationDismissal(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_dismissals",
    )
    alert_fingerprint = models.CharField(max_length=255, db_index=True)
    dismissed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-dismissed_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "alert_fingerprint"],
                name="unique_notification_dismissal_per_user_alert",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.alert_fingerprint}"
