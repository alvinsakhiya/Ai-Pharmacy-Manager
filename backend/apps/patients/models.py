"""Patient records — pseudo-anonymised, simulated data only.

There is deliberately NO national health identifier. Patients are keyed by a
neutral internal `patient_id` (e.g. PT-10428). No external system integration.
"""
from django.db import models

from apps.core.models import TimeStampedModel


class Patient(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"

    patient_id = models.CharField(max_length=20, unique=True, db_index=True)  # neutral, e.g. PT-10428
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80)
    date_of_birth = models.DateField()
    address_line = models.CharField(max_length=160, blank=True)
    postcode = models.CharField(max_length=10, blank=True)
    phone = models.CharField(max_length=20, blank=True)

    # Simulated GP/prescriber information (not linked to any real system).
    gp_practice = models.CharField(max_length=160, blank=True)
    gp_name = models.CharField(max_length=120, blank=True)

    allergies = models.TextField(blank=True, help_text="Free-text allergy notes.")
    special_instructions = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)

    # Dosette/compliance-pack enrolment
    is_dosette = models.BooleanField("On compliance pack", default=False)

    class Meta:
        ordering = ["last_name", "first_name"]
        indexes = [models.Index(fields=["status", "is_dosette"])]

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def __str__(self):
        return f"{self.full_name} ({self.patient_id})"


class PatientNote(TimeStampedModel):
    """Time-stamped patient history entries (interactions, reviews, changes)."""

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL)
    category = models.CharField(max_length=40, default="general")
    text = models.TextField()

    def __str__(self):
        return f"Note on {self.patient.patient_id} ({self.category})"
