from datetime import time

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class BackupRunStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    RUNNING = "RUNNING", "Running"
    SUCCESS = "SUCCESS", "Success"
    FAILED = "FAILED", "Failed"
    RESTORED = "RESTORED", "Restored"


class BackupRunTrigger(models.TextChoices):
    MANUAL = "MANUAL", "Manual"
    SCHEDULED = "SCHEDULED", "Scheduled"
    PRE_RESTORE = "PRE_RESTORE", "Pre-restore"


class BackupSchedule(TimeStampedModel):
    group = models.OneToOneField(
        "tenancy.Group",
        on_delete=models.CASCADE,
        related_name="backup_schedule",
    )
    enabled = models.BooleanField(default=False)
    daily_time = models.TimeField(default=time(hour=2))
    retention_count = models.PositiveSmallIntegerField(default=3)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_backup_schedules",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="updated_backup_schedules",
    )

    class Meta:
        ordering = ["group__name"]

    def __str__(self) -> str:
        return f"{self.group_id}:{self.daily_time}"


class BackupRun(TimeStampedModel):
    group = models.ForeignKey(
        "tenancy.Group",
        on_delete=models.CASCADE,
        related_name="backup_runs",
    )
    status = models.CharField(
        max_length=16,
        choices=BackupRunStatus.choices,
        default=BackupRunStatus.PENDING,
    )
    trigger = models.CharField(
        max_length=16,
        choices=BackupRunTrigger.choices,
        default=BackupRunTrigger.MANUAL,
    )
    file = models.CharField(max_length=500, blank=True)
    file_size = models.BigIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_backup_runs",
    )
    error_message = models.TextField(blank=True)
    checksum = models.CharField(max_length=64, blank=True)
    encrypted = models.BooleanField(default=False)

    class Meta:
        ordering = ["-completed_at", "-started_at", "-id"]
        indexes = [
            models.Index(fields=["group", "status", "-completed_at"]),
            models.Index(fields=["group", "trigger", "started_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.group_id}:{self.status}:{self.trigger}"
