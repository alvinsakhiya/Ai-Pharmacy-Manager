from django.db import models

from apps.core.models import TimeStampedModel


class MedicationForm(models.TextChoices):
    TABLET = "TABLET", "Tablet"
    CAPSULE = "CAPSULE", "Capsule"
    LIQUID = "LIQUID", "Liquid"
    CREAM = "CREAM", "Cream"
    INHALER = "INHALER", "Inhaler"
    INJECTION = "INJECTION", "Injection"
    OTHER = "OTHER", "Other"


class Medication(TimeStampedModel):
    tenant_group_id_field = "group"

    group = models.ForeignKey(
        "tenancy.Group",
        on_delete=models.PROTECT,
        related_name="medications",
    )
    name = models.CharField(max_length=255)
    form = models.CharField(max_length=32, choices=MedicationForm.choices)
    strength = models.CharField(max_length=64)
    manufacturer = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    objects = models.Manager()

    class Meta:
        ordering = ["name", "strength"]
        constraints = [
            models.UniqueConstraint(
                fields=["group", "name", "form", "strength"],
                name="unique_medication_per_group",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} {self.strength}"
