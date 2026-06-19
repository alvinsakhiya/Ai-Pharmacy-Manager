from datetime import date

import pytest
from django.db import IntegrityError, connection, transaction
from django.db.models.deletion import ProtectedError

from apps.accounts.models import User
from apps.catalogue.models import Medication, MedicationForm
from apps.patients.crypto import decrypt_str
from apps.patients.models import Patient
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from .models import CycleFrequency, CycleStatus, DosetteCycle, PatientMedication


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


def make_cycle(
    patient: Patient,
    reference: str = "CYCLE-1",
    *,
    frequency: str = "WEEKLY",
    start_date: date = date(2026, 1, 1),
    end_date: date = date(2026, 1, 7),
    status: str = "DRAFT",
) -> DosetteCycle:
    return DosetteCycle.objects.create(
        patient=patient,
        reference=reference,
        frequency=frequency,
        start_date=start_date,
        end_date=end_date,
        status=status,
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


@pytest.mark.django_db
def test_dosette_cycle_can_be_created_with_default_status_and_string():
    group = make_group()
    pharmacy = make_pharmacy(group)
    patient = make_patient(pharmacy)

    cycle = make_cycle(
        patient,
        "MDS-001",
        frequency="FOUR_WEEKLY",
        end_date=date(2026, 1, 28),
    )

    assert cycle.status == CycleStatus.DRAFT
    assert cycle.frequency == CycleFrequency.FOUR_WEEKLY
    assert str(cycle) == f"{patient.id}:MDS-001"


@pytest.mark.django_db
def test_dosette_cycle_scoped_manager_filters_by_patient_pharmacy():
    group = make_group()
    pharmacy_one = make_pharmacy(group, "P1")
    pharmacy_two = make_pharmacy(group, "P2")
    in_scope = make_cycle(make_patient(pharmacy_one, "P1-CYCLE"), "CYCLE-P1")
    out_of_scope = make_cycle(make_patient(pharmacy_two, "P2-CYCLE"), "CYCLE-P2")
    user = User.objects.create_user(
        "pharmacist-cycle@example.com",
        "test-password",
    )
    Membership.objects.create(user=user, role=Role.PHARMACIST, pharmacy=pharmacy_one)

    scoped_cycles = set(DosetteCycle.scoped.for_user(user))

    assert scoped_cycles == {in_scope}
    assert out_of_scope not in scoped_cycles


@pytest.mark.django_db
def test_dosette_cycle_reference_is_unique_per_patient():
    group = make_group()
    pharmacy = make_pharmacy(group)
    patient_one = make_patient(pharmacy, "PAT-CYCLE-1")
    patient_two = make_patient(pharmacy, "PAT-CYCLE-2")
    make_cycle(patient_one, "DUP-CYCLE")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_cycle(patient_one, "DUP-CYCLE")

    second_patient_cycle = make_cycle(patient_two, "DUP-CYCLE")

    assert second_patient_cycle.patient == patient_two


@pytest.mark.django_db
def test_dosette_cycle_end_date_must_not_be_before_start_date():
    group = make_group()
    pharmacy = make_pharmacy(group)
    patient = make_patient(pharmacy)

    with pytest.raises(IntegrityError), transaction.atomic():
        make_cycle(
            patient,
            "BAD-DATES",
            start_date=date(2026, 2, 1),
            end_date=date(2026, 1, 31),
        )


@pytest.mark.django_db
def test_dosette_cycle_protects_linked_patient():
    group = make_group()
    pharmacy = make_pharmacy(group)
    patient = make_patient(pharmacy)
    make_cycle(patient)

    with pytest.raises(ProtectedError):
        patient.delete()


@pytest.mark.django_db
@pytest.mark.parametrize("status", CycleStatus.values)
def test_dosette_cycle_can_be_saved_with_each_status(status):
    group = make_group()
    pharmacy = make_pharmacy(group)
    patient = make_patient(pharmacy)

    cycle = make_cycle(patient, f"CYCLE-{status}", status=status)

    assert cycle.status == status


@pytest.mark.django_db
def test_dosette_cycles_are_ordered_by_newest_start_date_then_id():
    group = make_group()
    pharmacy = make_pharmacy(group)
    patient = make_patient(pharmacy)
    older = make_cycle(
        patient,
        "OLDER",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 7),
    )
    newest_first = make_cycle(
        patient,
        "NEWEST-1",
        start_date=date(2026, 2, 1),
        end_date=date(2026, 2, 7),
    )
    newest_second = make_cycle(
        patient,
        "NEWEST-2",
        start_date=date(2026, 2, 1),
        end_date=date(2026, 2, 7),
    )

    assert list(DosetteCycle.objects.all()) == [
        newest_second,
        newest_first,
        older,
    ]
    assert newest_second.id > newest_first.id
