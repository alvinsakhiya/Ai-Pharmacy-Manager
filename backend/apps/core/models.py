"""Shared base models and the system-wide audit log."""
from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base giving every domain record created/updated timestamps."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]


class AuditLog(models.Model):
    """Immutable record of significant actions for full traceability.

    Written by signals (see apps.core.audit) and by explicit service calls in
    safety-critical workflows (dispensing, final check, stock adjustments).
    """

    class Action(models.TextChoices):
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"
        LOGIN = "login", "Login"
        DISPENSE = "dispense", "Dispense"
        CHECK = "check", "Accuracy/Final check"
        ADJUST = "adjust", "Stock adjustment"
        WASTE = "waste", "Wastage"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_entries",
    )
    actor_label = models.CharField(max_length=150, blank=True)  # snapshot, survives user deletion
    action = models.CharField(max_length=20, choices=Action.choices)
    entity = models.CharField(max_length=100)  # e.g. "stock.StockBatch"
    entity_id = models.CharField(max_length=64, blank=True)
    summary = models.CharField(max_length=255)
    detail = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [models.Index(fields=["entity", "entity_id"])]

    def __str__(self):
        return f"{self.timestamp:%Y-%m-%d %H:%M} {self.actor_label} {self.action} {self.entity}"
