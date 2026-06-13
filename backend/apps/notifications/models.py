"""Notification centre — surfaces operational alerts across the platform."""
from django.db import models

from apps.core.models import TimeStampedModel


class Notification(TimeStampedModel):
    class Level(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        DANGER = "danger", "Critical"
        SUCCESS = "success", "Success"

    class Category(models.TextChoices):
        LOW_STOCK = "low_stock", "Low stock"
        EXPIRY = "expiry", "Approaching expiry"
        SHORTAGE = "shortage", "Predicted shortage"
        REVIEW = "review", "Overdue review"
        ANNOUNCEMENT = "announcement", "System announcement"

    level = models.CharField(max_length=10, choices=Level.choices, default=Level.INFO)
    category = models.CharField(max_length=20, choices=Category.choices)
    title = models.CharField(max_length=160)
    message = models.TextField(blank=True)
    link = models.CharField(max_length=200, blank=True)  # frontend route
    dedupe_key = models.CharField(max_length=120, blank=True, db_index=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["category", "is_read"])]

    def __str__(self):
        return f"[{self.level}] {self.title}"
