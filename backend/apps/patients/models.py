from django.db import models

from apps.core.models import SoftDeleteModel, TenantScopedManager, TimeStampedModel

from .fields import EncryptedDateField, EncryptedTextField

# These fictional demo fields use prototype application-level encryption at rest.
# This does not make compliance claims; never store real patient data.
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
    first_name = EncryptedTextField(max_length=100)
    last_name = EncryptedTextField(max_length=100)
    last_name_index = models.CharField(
        max_length=64,
        db_index=True,
        blank=True,
        default="",
    )
    date_of_birth = EncryptedDateField()
    address = EncryptedTextField(blank=True)
    postcode = EncryptedTextField(max_length=20, blank=True)
    phone = EncryptedTextField(max_length=32, blank=True)
    notes = EncryptedTextField(blank=True)

    objects = models.Manager()
    scoped = TenantScopedManager()

    class Meta:
        ordering = ["patient_reference"]
        constraints = [
            models.UniqueConstraint(
                fields=["pharmacy", "patient_reference"],
                name="unique_patient_reference_per_pharmacy",
            )
        ]

    def __str__(self) -> str:
        return f"{self.pharmacy_id}:{self.patient_reference}"

    def save(self, *args, **kwargs) -> None:
        from .crypto import blind_index

        self.last_name_index = blind_index(self.last_name)

        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "last_name" in update_fields:
            kwargs["update_fields"] = set(update_fields) | {"last_name_index"}

        super().save(*args, **kwargs)
