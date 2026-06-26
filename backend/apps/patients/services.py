import re

from django.db import IntegrityError, transaction

from apps.tenancy.models import Pharmacy

from .models import Patient

AUTO_GENERATED_PATIENT_ID_MESSAGE = "Patient ID is generated automatically."
GENERATED_REFERENCE_ATTEMPTS = 20
REFERENCE_PREFIX_MAX_LENGTH = 24

_UNSAFE_REFERENCE_PREFIX_CHARS = re.compile(r"[^A-Z0-9]+")


class PatientReferenceGenerationError(Exception):
    """Raised when a unique generated patient reference cannot be allocated."""


def patient_reference_prefix(pharmacy: Pharmacy) -> str:
    prefix = _UNSAFE_REFERENCE_PREFIX_CHARS.sub("", pharmacy.code.upper())
    if not prefix:
        prefix = f"PH{pharmacy.pk}"
    return prefix[:REFERENCE_PREFIX_MAX_LENGTH]


def next_patient_reference(pharmacy: Pharmacy) -> str:
    stem = f"{patient_reference_prefix(pharmacy)}-P"
    highest_sequence = 0

    references = (
        Patient.objects.select_for_update()
        .filter(pharmacy=pharmacy, patient_reference__startswith=stem)
        .values_list("patient_reference", flat=True)
    )
    for reference in references:
        suffix = reference.removeprefix(stem)
        if suffix.isdigit():
            highest_sequence = max(highest_sequence, int(suffix))

    return f"{stem}{highest_sequence + 1:04d}"


def create_patient_with_generated_reference(validated_data) -> Patient:
    pharmacy = validated_data["pharmacy"]

    for _attempt in range(GENERATED_REFERENCE_ATTEMPTS):
        try:
            with transaction.atomic():
                patient_reference = next_patient_reference(pharmacy)
                return Patient.objects.create(
                    **validated_data,
                    patient_reference=patient_reference,
                )
        except IntegrityError:
            continue

    raise PatientReferenceGenerationError()
