import pytest
from rest_framework.test import APIClient

from apps.catalogue.models import Medication, MedicationForm
from apps.tenancy.models import Group, Pharmacy, Role

from .models import CycleStatus, PatientMedication
from .test_cycle_api import (
    add_membership,
    authenticate,
    detail_url,
    make_cycle,
    make_patient,
    make_user,
    prepare_url,
)


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def workflow_data():
    group = Group.objects.create(name="BW Group", slug="bw-group")
    pharmacy = Pharmacy.objects.create(group=group, name="BW Pharmacy", code="BWP")
    patient = make_patient(pharmacy, "BW-001")

    pharmacist = make_user("bw-pharmacist@example.com")
    dispenser = make_user("bw-dispenser@example.com")
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy)
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy)

    medication = Medication.objects.create(
        group=group,
        name="Amlodipine",
        form=MedicationForm.TABLET,
        strength="5 mg",
    )
    line = PatientMedication.objects.create(
        patient=patient,
        medication=medication,
        dose_instructions="One in the morning",
        quantity_morning=1,
    )

    return {
        "patient": patient,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
        "line": line,
    }


def status_url(patient, cycle) -> str:
    return f"{detail_url(patient, cycle)}status/"


def appearance_url(patient, line) -> str:
    return f"/api/patients/{patient.id}/medications/{line.id}/appearance/"


@pytest.mark.django_db
def test_prepare_records_accountability(client, workflow_data):
    patient = workflow_data["patient"]
    cycle = make_cycle(patient, "BW-CYCLE-1")
    authenticate(client, workflow_data["pharmacist"])

    response = client.post(prepare_url(patient, cycle))
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == CycleStatus.PREPARED
    assert body["prepared_by_email"] == "bw-pharmacist@example.com"
    assert body["prepared_at"] is not None


@pytest.mark.django_db
def test_checked_is_pharmacist_only_and_records_checker(client, workflow_data):
    patient = workflow_data["patient"]
    cycle = make_cycle(patient, "CHK-1", status=CycleStatus.PREPARED)

    # Dispenser cannot mark checked.
    authenticate(client, workflow_data["dispenser"])
    denied = client.post(
        status_url(patient, cycle), {"status": "CHECKED"}, format="json"
    )
    assert denied.status_code == 403

    # Pharmacist can, and is recorded as the checker.
    authenticate(client, workflow_data["pharmacist"])
    ok = client.post(status_url(patient, cycle), {"status": "CHECKED"}, format="json")
    assert ok.status_code == 200
    body = ok.json()
    assert body["status"] == CycleStatus.CHECKED
    assert body["checked_by_email"] == "bw-pharmacist@example.com"
    assert body["checked_at"] is not None


@pytest.mark.django_db
def test_dispenser_can_mark_collected_and_delivered(client, workflow_data):
    patient = workflow_data["patient"]
    cycle = make_cycle(patient, "DEL-1", status=CycleStatus.CHECKED)
    authenticate(client, workflow_data["dispenser"])

    collected = client.post(
        status_url(patient, cycle), {"status": "COLLECTED"}, format="json"
    )
    assert collected.status_code == 200
    assert collected.json()["status"] == CycleStatus.COLLECTED

    delivered = client.post(
        status_url(patient, cycle), {"status": "DELIVERED"}, format="json"
    )
    assert delivered.status_code == 200
    assert delivered.json()["status"] == CycleStatus.DELIVERED


@pytest.mark.django_db
def test_invalid_transition_is_rejected(client, workflow_data):
    patient = workflow_data["patient"]
    cycle = make_cycle(patient, "BAD-1", status=CycleStatus.DRAFT)
    authenticate(client, workflow_data["pharmacist"])

    # Cannot deliver a draft pack.
    response = client.post(
        status_url(patient, cycle), {"status": "DELIVERED"}, format="json"
    )
    assert response.status_code == 400

    # Unsupported status string.
    bad = client.post(status_url(patient, cycle), {"status": "WAT"}, format="json")
    assert bad.status_code == 400


@pytest.mark.django_db
def test_dispenser_can_edit_label_appearance(client, workflow_data):
    patient = workflow_data["patient"]
    line = workflow_data["line"]
    authenticate(client, workflow_data["dispenser"])

    response = client.patch(
        appearance_url(patient, line),
        {"colour": "White", "shape": "Round"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["colour"] == "White"
    assert response.json()["shape"] == "Round"

    line.refresh_from_db()
    assert line.colour == "White"
    assert line.shape == "Round"


@pytest.mark.django_db
def test_appearance_endpoint_does_not_change_clinical_fields(client, workflow_data):
    patient = workflow_data["patient"]
    line = workflow_data["line"]
    authenticate(client, workflow_data["dispenser"])

    client.patch(
        appearance_url(patient, line),
        {"colour": "Blue", "quantity_morning": 99},
        format="json",
    )
    line.refresh_from_db()
    assert line.colour == "Blue"
    # The dispenser appearance endpoint never touches dosing.
    assert line.quantity_morning == 1
