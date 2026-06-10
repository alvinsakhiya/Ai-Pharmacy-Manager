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

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["patient", "medication"]

    def __str__(self):
        return f"{self.patient} - {self.medication}"