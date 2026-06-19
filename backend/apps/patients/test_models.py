from datetime import date

import pytest
from django.db import IntegrityError

from apps.tenancy.models import Group, Pharmacy

from .models import Patient


def make_pharmacy(code: str = "P1") -> Pharmacy:
    group = Group.objects.create(name=f"Group {code}", slug=f"group-{code.lower()}")
    return Pharmacy.objects.create(group=group, name=f"Pharmacy {code}", code=code)


def make_patient(pharmacy: Pharmacy, reference: str = "P-1") -> Patient:
    return Patient.objects.create(
        pharmacy=pharmacy,
        patient_reference=reference,
        first_name="Demo",
        last_name="Patient",
        date_of_birth=date(1980, 1, 1),
    )


@pytest.mark.django_db
def test_can_create_patient():
    pharmacy = make_pharmacy()

    patient = make_patient(pharmacy)

    assert patient.pharmacy == pharmacy
    assert patient.patient_reference == "P-1"
    assert patient.is_active is True


@pytest.mark.django_db
def test_patient_reference_is_unique_per_pharmacy():
    pharmacy = make_pharmacy()
    make_patient(pharmacy, "DUP-1")

    with pytest.raises(IntegrityError):
        make_patient(pharmacy, "DUP-1")


@pytest.mark.django_db
def test_same_patient_reference_is_allowed_in_different_pharmacies():
    pharmacy_one = make_pharmacy("P1")
    pharmacy_two = make_pharmacy("P2")

    make_patient(pharmacy_one, "SHARED-1")
    patient = make_patient(pharmacy_two, "SHARED-1")

    assert patient.pharmacy == pharmacy_two


@pytest.mark.django_db
def test_soft_delete_marks_patient_inactive():
    patient = make_patient(make_pharmacy())

    patient.soft_delete()

    patient.refresh_from_db()
    assert patient.is_active is False
    assert patient.deleted_at is not None
