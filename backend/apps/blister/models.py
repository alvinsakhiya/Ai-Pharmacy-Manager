"""Prototype Dosette/MDS medication records for fictional data only.

This module makes no clinical, NHS, GDPR, or production-readiness compliance
claim.
"""

from django.db import models
from django.db.models import Q

from apps.core.models import SoftDeleteModel, TenantScopedManager, TimeStampedModel
from apps.patients.fields import EncryptedTextField


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
