"""Prototype operational pharmacist review workflow.

This module supports an operational review workflow only. It does not perform
clinical decision-making, diagnosis, automated recommendations, NHS
integration, or make any compliance claim.
"""

from django.conf import settings
from django.db import models
from django.db.models import F

from apps.core.models import TenantScopedManager, TimeStampedModel
from apps.patients.fields import EncryptedTextField


class ReviewStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    IN_REVIEW = "IN_REVIEW", "In review"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class ReviewPriority(models.TextChoices):
    ROUTINE = "ROUTINE", "Routine"
    ATTENTION = "ATTENTION", "Attention"
    URGENT = "URGENT", "Urgent"


class ReviewRecord(TimeStampedModel):
    tenant_pharmacy_id_field = "patient__pharmacy"

    patient = models.ForeignKey(
        "patients.Patient",
        on_delete=models.PROTECT,
        related_name="reviews",
    )
    dosette_cycle = models.ForeignKey(
        "blister.DosetteCycle",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="reviews",
    )
    status = models.CharField(
        max_length=20,
        choices=ReviewStatus.choices,
        default=ReviewStatus.PENDING,
    )
    priority = models.CharField(
        max_length=20,
        choices=ReviewPriority.choices,
        default=ReviewPriority.ROUTINE,
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_reviews",
    )
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = EncryptedTextField(blank=True)

    objects = models.Manager()
    scoped = TenantScopedManager()

    class Meta:
        ordering = [F("due_date").asc(nulls_last=True), "-created_at", "-id"]
        indexes = [
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["status", "due_date"]),
            models.Index(fields=["assigned_to", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.patient_id}:{self.status}:{self.priority}"
