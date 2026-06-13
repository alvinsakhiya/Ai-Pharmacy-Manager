from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from patients.models import Patient
from inventory.models import Medication


class DosetteRecord(models.Model):
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="dosette_records"
    )

    medication = models.ForeignKey(
        Medication,
        on_delete=models.CASCADE,
        related_name="dosette_records"
    )

    morning_dose = models.CharField(max_length=50, blank=True)
    afternoon_dose = models.CharField(max_length=50, blank=True)
    evening_dose = models.CharField(max_length=50, blank=True)
    bedtime_dose = models.CharField(max_length=50, blank=True)

    instructions = models.TextField(blank=True)

    is_active = models.BooleanField(default=True)

    cycle_start_date = models.DateField(null=True, blank=True, db_index=True)

    cycle_length_weeks = models.PositiveSmallIntegerField(
        default=4,
        validators=[
            MinValueValidator(1),
            MaxValueValidator(52),
        ],
    )

    review_date = models.DateField(null=True, blank=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["patient", "medication"]

    def __str__(self):
        return f"{self.patient} - {self.medication}"


class ImmutableDosetteChangeQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ValidationError("Dosette change history is immutable.")

    def delete(self):
        raise ValidationError("Dosette change history cannot be deleted.")


class DosetteChangeManager(
    models.Manager.from_queryset(ImmutableDosetteChangeQuerySet)
):
    def bulk_update(self, objs, fields, batch_size=None):
        raise ValidationError("Dosette change history is immutable.")


class DosetteMedicationChange(models.Model):
    class ChangeType(models.TextChoices):
        CREATED = "CREATED", "Created"
        UPDATED = "UPDATED", "Updated"
        ACTIVATED = "ACTIVATED", "Activated"
        DEACTIVATED = "DEACTIVATED", "Deactivated"
        DELETED = "DELETED", "Deleted"

    dosette_record_identifier = models.PositiveBigIntegerField(db_index=True)
    patient_identifier = models.PositiveBigIntegerField(db_index=True)
    patient_name = models.CharField(max_length=250)
    medication_identifier = models.PositiveBigIntegerField(db_index=True)
    medication_name = models.CharField(max_length=250)
    change_type = models.CharField(
        max_length=20,
        choices=ChangeType.choices,
        db_index=True,
    )
    changed_fields = models.JSONField(default=list)
    morning_dose = models.CharField(max_length=50, blank=True)
    afternoon_dose = models.CharField(max_length=50, blank=True)
    evening_dose = models.CharField(max_length=50, blank=True)
    bedtime_dose = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField()
    cycle_start_date = models.DateField(null=True, blank=True)
    cycle_length_weeks = models.PositiveSmallIntegerField()
    review_date = models.DateField(null=True, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="dosette_medication_changes",
    )
    actor_username = models.CharField(max_length=150, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    objects = DosetteChangeManager()

    class Meta:
        ordering = ["-timestamp", "-id"]
        indexes = [
            models.Index(
                fields=["patient_identifier", "-timestamp"],
                name="dosette_change_patient_time",
            ),
            models.Index(
                fields=["dosette_record_identifier", "-timestamp"],
                name="dosette_change_record_time",
            ),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("Dosette change history is immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Dosette change history cannot be deleted.")

    def __str__(self):
        return (
            f"{self.get_change_type_display()} {self.medication_name} "
            f"for {self.patient_name}"
        )
