from django.db import models

from apps.core.models import SoftDeleteModel, TenantScopedManager, TimeStampedModel

# These fictional demo fields are stored as plaintext in Module 7A.
# Field-level encryption is planned for Module 7B; never store real patient data.
SENSITIVE_PATIENT_FIELDS = (
    "first_name",
    "last_name",
    "date_of_birth",
    "address",
    "postcode",
    "phone",
    "notes",
)


class Patient(TimeStampedModel, SoftDeleteModel):
    tenant_pharmacy_id_field = "pharmacy"

    pharmacy = models.ForeignKey(
        "tenancy.Pharmacy",
        on_delete=models.PROTECT,
        related_name="patients",
    )
    patient_reference = models.CharField(max_length=64)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    date_of_birth = models.DateField()
    address = models.TextField(blank=True)
    postcode = models.CharField(max_length=20, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    notes = models.TextField(blank=True)

    objects = models.Manager()
    scoped = TenantScopedManager()

    class Meta:
        ordering = ["last_name", "first_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["pharmacy", "patient_reference"],
                name="unique_patient_reference_per_pharmacy",
            )
        ]

    def __str__(self) -> str:
        return f"{self.pharmacy_id}:{self.patient_reference}"
