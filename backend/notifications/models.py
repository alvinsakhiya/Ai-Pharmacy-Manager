from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        CRITICAL = "CRITICAL", "Critical"

    class Status(models.TextChoices):
        NEW = "NEW", "New"
        READ = "READ", "Read"
        ACKNOWLEDGED = "ACKNOWLEDGED", "Acknowledged"
        RESOLVED = "RESOLVED", "Resolved"

    title = models.CharField(max_length=200)
    message = models.TextField()
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NEW,
        db_index=True,
    )
    assigned_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="pharmacy_notifications",
    )
    assigned_username = models.CharField(max_length=150, blank=True)
    due_date = models.DateField(null=True, blank=True, db_index=True)
    expiry_date = models.DateField(null=True, blank=True, db_index=True)
    related_entity_type = models.CharField(max_length=100, blank=True)
    related_entity_id = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_reason = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(
                fields=["assigned_user", "status", "-created_at"],
                name="notify_user_status_time",
            ),
            models.Index(
                fields=["priority", "status"],
                name="notify_priority_status",
            ),
        ]

    @property
    def is_expired(self):
        return bool(
            self.expiry_date
            and self.expiry_date < timezone.localdate()
            and self.status != self.Status.RESOLVED
        )

    @property
    def is_overdue(self):
        return bool(
            self.due_date
            and self.due_date < timezone.localdate()
            and self.status != self.Status.RESOLVED
        )

    def __str__(self):
        return f"{self.get_priority_display()}: {self.title}"
