from datetime import date

import pytest
from django.db import IntegrityError, connection, transaction
from django.db.models.deletion import ProtectedError

from apps.accounts.models import User
from apps.catalogue.models import Medication, MedicationForm
from apps.patients.crypto import decrypt_str
from apps.patients.models import Patient
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from .models import PatientMedication


def make_group(slug: str = "blister-group") -> Group:
    return Group.objects.create(name=f"Group {slug}", slug=slug)


def make_pharmacy(group: Group, code: str = "P1") -> Pharmacy:
    return Pharmacy.objects.create(
        group=group,
        name=f"Pharmacy {code}",
        code=code,
    )


def make_patient(pharmacy: Pharmacy, reference: str = "PAT-1") -> Patient:
    return Patient.objects.create(
        pharmacy=pharmacy,
        patient_reference=reference,
        first_name="Demo",
        last_name="Patient",
        date_of_birth=date(1980, 1, 1),
    )


def make_medication(group: Group, name: str = "Paracetamol") -> Medication:
    return Medication.objects.create(
        group=group,
        name=name,
        form=MedicationForm.TABLET,
        strength="500 mg",
    )


def make_line(
    patient: Patient,
    medication: Medication,
    dose_instructions: str = "",
) -> PatientMedication:
    return PatientMedication.objects.create(
        patient=patient,
        medication=medication,
        dose_instructions=dose_instructions,
    )


@pytest.mark.django_db
def test_patient_medication_can_be_created_with_defaults():
    group = make_group()
    pharmacy = make_pharmacy(group)
    patient = make_patient(pharmacy)
    medication = make_medication(group)

    line = make_line(patient, medication)

    assert line.is_active is True
    assert line.quantity_morning == 0
    assert line.quantity_lunchtime == 0
    assert line.quantity_evening == 0
    assert line.quantity_bedtime == 0
    assert line.start_date is None
    assert str(line) == f"{patient.id}:{medication.id}"


@pytest.mark.django_db
def test_scoped_manager_filters_by_patient_pharmacy():
    group = make_group()
    pharmacy_one = make_pharmacy(group, "P1")
    pharmacy_two = make_pharmacy(group, "P2")
    medication_one = make_medication(group, "Medication One")
    medication_two = make_medication(group, "Medication Two")
    in_scope = make_line(make_patient(pharmacy_one, "P1-PAT"), medication_one)
    out_of_scope = make_line(make_patient(pharmacy_two, "P2-PAT"), medication_two)
    user = User.objects.create_user("pharmacist-blister@example.com", "test-password")
    Membership.objects.create(user=user, role=Role.PHARMACIST, pharmacy=pharmacy_one)

    scoped_lines = set(PatientMedication.scoped.for_user(user))

    assert scoped_lines == {in_scope}
    assert out_of_scope not in scoped_lines


@pytest.mark.django_db
def test_active_patient_medication_is_unique_per_patient_and_medication():
    group = make_group()
    pharmacy = make_pharmacy(group)
    patient = make_patient(pharmacy)
    medication = make_medication(group)
    first = make_line(patient, medication)

    with pytest.raises(IntegrityError), transaction.atomic():
        make_line(patient, medication)

    first.soft_delete()
    replacement = make_line(patient, medication)

    assert replacement.pk != first.pk
    assert replacement.is_active is True


@pytest.mark.django_db
def test_soft_delete_marks_patient_medication_inactive():
    group = make_group()
    pharmacy = make_pharmacy(group)
    line = make_line(make_patient(pharmacy), make_medication(group))

    line.soft_delete()

    line.refresh_from_db()
    assert line.is_active is False
    assert line.deleted_at is not None


@pytest.mark.django_db
def test_dose_instructions_are_encrypted_at_rest():
    group = make_group()
    pharmacy = make_pharmacy(group)
    plaintext = "Take after breakfast with water."
    line = make_line(
        make_patient(pharmacy),
        make_medication(group),
        dose_instructions=plaintext,
    )

    refetched = PatientMedication.objects.get(pk=line.pk)

    assert refetched.dose_instructions == plaintext

    with connection.cursor() as cursor:
        cursor.execute(
            (
                f"SELECT dose_instructions FROM {PatientMedication._meta.db_table} "
                "WHERE id = %s"
            ),
            [line.pk],
        )
        (raw_dose_instructions,) = cursor.fetchone()

    assert raw_dose_instructions != plaintext
    assert plaintext not in raw_dose_instructions
    assert decrypt_str(raw_dose_instructions) == plaintext


@pytest.mark.django_db
def test_patient_medication_protects_linked_patient_and_medication():
    group = make_group()
    pharmacy = make_pharmacy(group)
    patient = make_patient(pharmacy)
    medication = make_medication(group)
    make_line(patient, medication)

    with pytest.raises(ProtectedError):
        patient.delete()

    with pytest.raises(ProtectedError):
        medication.delete()
