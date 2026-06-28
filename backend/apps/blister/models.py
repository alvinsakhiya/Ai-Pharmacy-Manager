"""Prototype Dosette/MDS medication records for fictional data only.

This module makes no clinical, NHS, GDPR, or production-readiness compliance
claim.
"""

from datetime import timedelta

from django.conf import settings
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
    DRAFT = "DRAFT", "Needs preparation"
    NEEDS_CHANGES = "NEEDS_CHANGES", "Needs changes"
    PREPARED = "PREPARED", "Prepared"
    CHECKED = "CHECKED", "Checked"
    COLLECTED = "COLLECTED", "Collected"
    DELIVERED = "DELIVERED", "Delivered"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class DosettePeriodStatus(models.TextChoices):
    SUBMITTED = "SUBMITTED", "Submitted"
    COLLECTED = "COLLECTED", "Collected"
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
    # Free-text appearance for the printed pack label. Filled by the dispenser
    # so staff can visually verify tablets against the label.
    colour = models.CharField(max_length=64, blank=True, default="")
    shape = models.CharField(max_length=64, blank=True, default="")

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


class DosettePeriod(TimeStampedModel):
    tenant_pharmacy_id_field = "patient__pharmacy"

    patient = models.ForeignKey(
        "patients.Patient",
        on_delete=models.PROTECT,
        related_name="dosette_periods",
    )
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=16,
        choices=DosettePeriodStatus.choices,
        default=DosettePeriodStatus.SUBMITTED,
    )
    submitted_at = models.DateTimeField()
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="submitted_dosette_periods",
    )
    collected_on = models.DateField(null=True, blank=True)
    collected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="collected_dosette_periods",
    )

    objects = models.Manager()
    scoped = TenantScopedManager()

    class Meta:
        ordering = ["-start_date", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_date__gte=F("start_date")),
                name="dosette_period_end_after_start",
            ),
            models.UniqueConstraint(
                fields=["patient"],
                condition=Q(status=DosettePeriodStatus.SUBMITTED),
                name="unique_submitted_dosette_period_per_patient",
            ),
        ]

    @property
    def next_due_date(self):
        if self.collected_on is None:
            return None
        return self.collected_on + timedelta(days=28)

    @property
    def reminder_date(self):
        next_due_date = self.next_due_date
        if next_due_date is None:
            return None
        return next_due_date - timedelta(days=7)

    def __str__(self) -> str:
        return f"{self.patient_id}:{self.start_date:%Y-%m-%d}"


class DosetteCycle(TimeStampedModel):
    tenant_pharmacy_id_field = "patient__pharmacy"

    patient = models.ForeignKey(
        "patients.Patient",
        on_delete=models.PROTECT,
        related_name="dosette_cycles",
    )
    period = models.ForeignKey(
        DosettePeriod,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="cycles",
    )
    week_number = models.PositiveSmallIntegerField(null=True, blank=True)
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
    # Pack accountability: who made (prepared) and who checked the pack, and when.
    prepared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="prepared_dosette_cycles",
    )
    prepared_at = models.DateTimeField(null=True, blank=True)
    checked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="checked_dosette_cycles",
    )
    checked_at = models.DateTimeField(null=True, blank=True)

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
            models.UniqueConstraint(
                fields=["period", "week_number"],
                condition=Q(period__isnull=False),
                name="unique_dosette_cycle_week_per_period",
            ),
            models.CheckConstraint(
                condition=(
                    Q(week_number__isnull=True)
                    | (Q(week_number__gte=1) & Q(week_number__lte=4))
                ),
                name="dosette_cycle_week_number_1_to_4",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.patient_id}:{self.reference}"
