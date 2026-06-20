"""Prototype Dosette/MDS medication records for fictional data only.

This module makes no clinical, NHS, GDPR, or production-readiness compliance
claim.
"""

from django.db import models
from django.db.models import F, Q

from apps.core.models import SoftDeleteModel, TenantScopedManager, TimeStampedModel
from apps.patients.fields import EncryptedTextField


class CycleFrequency(models.TextChoices):
    WEEKLY = "WEEKLY", "Weekly"
    FORTNIGHTLY = "FORTNIGHTLY", "Fortnightly"
    FOUR_WEEKLY = "FOUR_WEEKLY", "Four-weekly"
    MONTHLY = "MONTHLY", "Monthly"


class CycleStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PREPARED = "PREPARED", "Prepared"
    CHECKED = "CHECKED", "Checked"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class PatientMedication(TimeStampedModel, SoftDeleteModel):
    tenant_pharmacy_id_field = "patient__pharmacy"

    patient = models.ForeignKey(
        "patients.Patient",
        on_delete=models.PROTECT,
        related_name="medication_lines",
    )
    medication = models.ForeignKey(
        "catalogue.Medication",
        on_delete=models.PROTECT,
        related_name="patient_medication_lines",
    )
    dose_instructions = EncryptedTextField(blank=True)
    quantity_morning = models.PositiveSmallIntegerField(default=0)
    quantity_lunchtime = models.PositiveSmallIntegerField(default=0)
    quantity_evening = models.PositiveSmallIntegerField(default=0)
    quantity_bedtime = models.PositiveSmallIntegerField(default=0)
    start_date = models.DateField(null=True, blank=True)

    objects = models.Manager()
    scoped = TenantScopedManager()

    class Meta:
        ordering = ["medication__name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["patient", "medication"],
                condition=Q(is_active=True),
                name="unique_active_medication_per_patient",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.patient_id}:{self.medication_id}"


class DosetteCycle(TimeStampedModel):
    tenant_pharmacy_id_field = "patient__pharmacy"

    patient = models.ForeignKey(
        "patients.Patient",
        on_delete=models.PROTECT,
        related_name="dosette_cycles",
    )
    reference = models.CharField(max_length=64)
    frequency = models.CharField(max_length=16, choices=CycleFrequency.choices)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=16,
        choices=CycleStatus.choices,
        default=CycleStatus.DRAFT,
    )
    stock_deducted = models.BooleanField(default=False)
    deducted_at = models.DateTimeField(null=True, blank=True)

    objects = models.Manager()
    scoped = TenantScopedManager()

    class Meta:
        ordering = ["-start_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["patient", "reference"],
                name="unique_cycle_reference_per_patient",
            ),
            models.CheckConstraint(
                condition=Q(end_date__gte=F("start_date")),
                name="dosette_cycle_end_after_start",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.patient_id}:{self.reference}"
