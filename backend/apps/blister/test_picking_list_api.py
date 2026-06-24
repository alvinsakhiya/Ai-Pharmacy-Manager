from datetime import date

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalogue.models import Medication, MedicationForm
from apps.patients.models import Patient
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from .models import CycleFrequency, CycleStatus, DosetteCycle, PatientMedication

PASSWORD = "Initial-pass-123!"


@pytest.fixture
def client():
    return APIClient()


def make_user(email: str) -> User:
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        full_name=email.split("@")[0],
    )


def add_membership(user, role, *, group=None, pharmacy=None, pharmacies=()):
    membership = Membership.objects.create(
        user=user,
        role=role,
        group=group,
        pharmacy=pharmacy,
    )
    if pharmacies:
        membership.pharmacies.add(*pharmacies)
    return membership


def make_patient(pharmacy: Pharmacy, reference: str) -> Patient:
    return Patient.objects.create(
        pharmacy=pharmacy,
        patient_reference=reference,
        first_name="Fictional",
        last_name="Person",
        date_of_birth=date(1980, 1, 1),
        address=f"{reference} Private Street",
        postcode="TE1 1ST",
        phone="020 0000 0101",
        notes="Fictional patient note",
    )


def make_cycle(patient: Patient, reference: str) -> DosetteCycle:
    return DosetteCycle.objects.create(
        patient=patient,
        reference=reference,
        frequency=CycleFrequency.WEEKLY,
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 7),
        status=CycleStatus.DRAFT,
    )


def make_medication(
    group: Group,
    name: str,
    strength: str = "5 mg",
    form=MedicationForm.TABLET,
) -> Medication:
    return Medication.objects.create(
        group=group,
        name=name,
        form=form,
        strength=strength,
    )


@pytest.fixture
def picking_list_data():
    group_one = Group.objects.create(name="Group One", slug="picking-list-one")
    group_two = Group.objects.create(name="Group Two", slug="picking-list-two")
    pharmacy_one = Pharmacy.objects.create(
        group=group_one,
        name="Pharmacy One",
        code="P1",
    )
    pharmacy_two = Pharmacy.objects.create(
        group=group_two,
        name="Pharmacy Two",
        code="P2",
    )
    patient_one = make_patient(pharmacy_one, "P1-PICK-001")
    patient_two = make_patient(pharmacy_two, "P2-PICK-001")
    cycle_one = make_cycle(patient_one, "PICK-CYCLE-001")
    cycle_two = make_cycle(patient_two, "PICK-CYCLE-002")

    amlodipine = make_medication(group_one, "Amlodipine", "5 mg")
    bisoprolol = make_medication(group_one, "Bisoprolol", "2.5 mg")
    cetirizine = make_medication(group_one, "Cetirizine", "10 mg")
    discontinued = make_medication(group_one, "Discontinued Secret", "1 mg")
    other_pharmacy_medication = make_medication(group_two, "Other Pharmacy Med", "1 mg")

    line_one = PatientMedication.objects.create(
        patient=patient_one,
        medication=amlodipine,
        dose_instructions="Private morning and bedtime directions",
        quantity_morning=1,
        quantity_lunchtime=2,
        quantity_evening=0,
        quantity_bedtime=1,
    )
    line_two = PatientMedication.objects.create(
        patient=patient_one,
        medication=bisoprolol,
        dose_instructions="Private lunch and evening directions",
        quantity_morning=0,
        quantity_lunchtime=1,
        quantity_evening=1,
        quantity_bedtime=0,
    )
    zero_line = PatientMedication.objects.create(
        patient=patient_one,
        medication=cetirizine,
        dose_instructions="Private zero quantity directions",
        quantity_morning=0,
        quantity_lunchtime=0,
        quantity_evening=0,
        quantity_bedtime=0,
    )
    inactive_line = PatientMedication.objects.create(
        patient=patient_one,
        medication=discontinued,
        dose_instructions="Private discontinued directions",
        quantity_morning=9,
        quantity_lunchtime=9,
        quantity_evening=9,
        quantity_bedtime=9,
    )
    inactive_line.soft_delete()
    other_pharmacy_line = PatientMedication.objects.create(
        patient=patient_two,
        medication=other_pharmacy_medication,
        dose_instructions="Other pharmacy directions",
        quantity_morning=4,
    )

    admin = make_user("picking-admin@example.com")
    pharmacist = make_user("picking-pharmacist@example.com")
    dispenser = make_user("picking-dispenser@example.com")
    superintendent = make_user("picking-superintendent@example.com")
    stock_employee = make_user("picking-stock@example.com")

    add_membership(admin, Role.ADMIN)
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy_one)
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy_one)
    add_membership(superintendent, Role.SUPERINTENDENT, group=group_one)
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group_one,
        pharmacies=(pharmacy_one,),
    )

    return {
        "patient_one": patient_one,
        "patient_two": patient_two,
        "cycle_one": cycle_one,
        "cycle_two": cycle_two,
        "line_one": line_one,
        "line_two": line_two,
        "zero_line": zero_line,
        "inactive_line": inactive_line,
        "other_pharmacy_line": other_pharmacy_line,
        "admin": admin,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
    }


def authenticate(client, user):
    client.force_login(user)


def picking_list_url(patient: Patient, cycle: DosetteCycle) -> str:
    return f"/api/patients/{patient.id}/cycles/{cycle.id}/picking-list/"


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["admin", "pharmacist", "dispenser"])
def test_blister_view_roles_can_get_picking_list(
    client,
    picking_list_data,
    actor_key,
):
    authenticate(client, picking_list_data[actor_key])

    response = client.get(
        picking_list_url(
            picking_list_data["patient_one"],
            picking_list_data["cycle_one"],
        )
    )

    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["superintendent", "stock_employee"])
def test_roles_without_blister_view_are_denied_picking_list(
    client,
    picking_list_data,
    actor_key,
):
    authenticate(client, picking_list_data[actor_key])

    response = client.get(
        picking_list_url(
            picking_list_data["patient_one"],
            picking_list_data["cycle_one"],
        )
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_picking_list_scoping_for_pharmacist(client, picking_list_data):
    authenticate(client, picking_list_data["pharmacist"])

    own_response = client.get(
        picking_list_url(
            picking_list_data["patient_one"],
            picking_list_data["cycle_one"],
        )
    )
    cross_patient_response = client.get(
        picking_list_url(
            picking_list_data["patient_two"],
            picking_list_data["cycle_two"],
        )
    )
    cross_cycle_response = client.get(
        picking_list_url(
            picking_list_data["patient_one"],
            picking_list_data["cycle_two"],
        )
    )

    assert own_response.status_code == 200
    assert cross_patient_response.status_code == 404
    assert cross_cycle_response.status_code == 404


@pytest.mark.django_db
def test_picking_list_contents_and_totals(client, picking_list_data):
    authenticate(client, picking_list_data["admin"])

    response = client.get(
        picking_list_url(
            picking_list_data["patient_one"],
            picking_list_data["cycle_one"],
        )
    )

    assert response.status_code == 200
    data = response.json()
    rows = data["medications"]

    assert data["cycle"] == {
        "id": picking_list_data["cycle_one"].id,
        "reference": "PICK-CYCLE-001",
        "frequency": CycleFrequency.WEEKLY,
        "start_date": "2026-07-01",
        "end_date": "2026-07-07",
        "status": CycleStatus.DRAFT,
    }
    assert data["patient_reference"] == "P1-PICK-001"
    assert [row["medication_name"] for row in rows] == [
        "Amlodipine",
        "Bisoprolol",
        "Cetirizine",
    ]
    assert rows == [
        {
            "medication_id": picking_list_data["line_one"].medication_id,
            "medication_name": "Amlodipine",
            "strength": "5 mg",
            "form": MedicationForm.TABLET,
            "quantity_morning": 1,
            "quantity_lunchtime": 2,
            "quantity_evening": 0,
            "quantity_bedtime": 1,
            "total_daily": 4,
            "colour": "",
            "shape": "",
        },
        {
            "medication_id": picking_list_data["line_two"].medication_id,
            "medication_name": "Bisoprolol",
            "strength": "2.5 mg",
            "form": MedicationForm.TABLET,
            "quantity_morning": 0,
            "quantity_lunchtime": 1,
            "quantity_evening": 1,
            "quantity_bedtime": 0,
            "total_daily": 2,
            "colour": "",
            "shape": "",
        },
        {
            "medication_id": picking_list_data["zero_line"].medication_id,
            "medication_name": "Cetirizine",
            "strength": "10 mg",
            "form": MedicationForm.TABLET,
            "quantity_morning": 0,
            "quantity_lunchtime": 0,
            "quantity_evening": 0,
            "quantity_bedtime": 0,
            "total_daily": 0,
            "colour": "",
            "shape": "",
        },
    ]
    assert data["totals"] == {
        "morning": 1,
        "lunchtime": 3,
        "evening": 1,
        "bedtime": 1,
        "total_daily": 6,
    }
    response_text = str(data)
    assert "dose_instructions" not in response_text
    assert "Private morning and bedtime directions" not in response_text
    assert "Private discontinued directions" not in response_text
    assert "Discontinued Secret" not in response_text
    assert picking_list_data["inactive_line"].medication_id not in {
        row["medication_id"] for row in rows
    }
    assert picking_list_data["other_pharmacy_line"].medication_id not in {
        row["medication_id"] for row in rows
    }
