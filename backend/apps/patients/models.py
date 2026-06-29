from django.conf import settings
from django.db import models

from apps.core.models import SoftDeleteModel, TenantScopedManager, TimeStampedModel

from .fields import EncryptedDateField, EncryptedTextField

# These fictional demo fields use prototype application-level encryption at rest.
# This does not make compliance claims; never store real patient data.
SENSITIVE_PATIENT_FIELDS = (
    "title",
    "first_name",
    "last_name",
    "date_of_birth",
    "gender",
    "address",
    "postcode",
    "phone",
    "email",
    "notes",
)


class Patient(TimeStampedModel, SoftDeleteModel):
    tenant_pharmacy_id_field = "pharmacy"

    class CollectionMethod(models.TextChoices):
        IN_STORE = "IN_STORE", "In-store collection"
        DELIVERY = "DELIVERY", "Delivery"

    pharmacy = models.ForeignKey(
        "tenancy.Pharmacy",
        on_delete=models.PROTECT,
        related_name="patients",
    )
    patient_reference = models.CharField(max_length=64)
    # New columns are nullable so the migration leaves existing encrypted rows
    # untouched (a raw "" default would not be a valid Fernet token on read).
    title = EncryptedTextField(max_length=20, blank=True, null=True)
    first_name = EncryptedTextField(max_length=100)
    last_name = EncryptedTextField(max_length=100)
    last_name_index = models.CharField(
        max_length=64,
        db_index=True,
        blank=True,
        default="",
    )
    date_of_birth = EncryptedDateField()
    gender = EncryptedTextField(max_length=40, blank=True, null=True)
    address = EncryptedTextField(blank=True)
    postcode = EncryptedTextField(max_length=20, blank=True)
    phone = EncryptedTextField(max_length=32, blank=True)
    email = EncryptedTextField(max_length=254, blank=True, null=True)
    notes = EncryptedTextField(blank=True)
    collection_method = models.CharField(
        max_length=16,
        choices=CollectionMethod.choices,
        default=CollectionMethod.IN_STORE,
    )

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


class PatientNote(TimeStampedModel):
    """Append-only patient note with encrypted body.

    Body is encrypted at rest using the shared patient field encryption key.
    Immutability is enforced at the application layer through save/delete guards;
    bulk/raw SQL can still bypass this, as with other append-only records.
    Prototype only; no compliance claim.
    """

    tenant_pharmacy_id_field = "patient__pharmacy"

    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name="history_notes",
    )
    body = EncryptedTextField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="patient_notes",
    )
    author_email = models.CharField(max_length=254, blank=True)

    objects = models.Manager()
    scoped = TenantScopedManager()

    class Meta:
        ordering = ["-created_at", "-id"]

    def save(self, *args, **kwargs) -> None:
        if self.pk is not None:
            raise ValueError("Patient notes are append-only and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> tuple[int, dict[str, int]]:
        raise ValueError("Patient notes are append-only and cannot be deleted.")


class PatientGp(TimeStampedModel):
    """Doctor / GP surgery details for a patient.

    Practice contact information (not the patient's own identifying PII), so it
    is stored in plain columns. Edited only by users with PATIENT_MANAGE.
    """

    tenant_pharmacy_id_field = "patient__pharmacy"

    patient = models.OneToOneField(
        Patient,
        on_delete=models.CASCADE,
        related_name="gp",
    )
    doctor_name = models.CharField(max_length=120, blank=True, default="")
    practice_name = models.CharField(max_length=160, blank=True, default="")
    practice_address = models.CharField(max_length=255, blank=True, default="")
    practice_postcode = models.CharField(max_length=20, blank=True, default="")
    practice_phone = models.CharField(max_length=32, blank=True, default="")
    practice_email = models.CharField(max_length=254, blank=True, default="")

    objects = models.Manager()
    scoped = TenantScopedManager()

    def __str__(self) -> str:
        return f"GP for patient {self.patient_id}"
