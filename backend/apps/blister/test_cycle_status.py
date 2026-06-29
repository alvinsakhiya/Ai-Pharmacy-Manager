import pytest
from django.utils import timezone
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
def test_needs_changes_clears_pack_accountability_and_can_be_prepared_again(
    client,
    workflow_data,
):
    patient = workflow_data["patient"]
    cycle = make_cycle(patient, "NEEDS-1", status=CycleStatus.PREPARED)
    authenticate(client, workflow_data["pharmacist"])

    checked = client.post(
        status_url(patient, cycle),
        {"status": "CHECKED"},
        format="json",
    )
    assert checked.status_code == 200
    assert checked.json()["checked_by_email"] == "bw-pharmacist@example.com"

    authenticate(client, workflow_data["dispenser"])
    needs_changes = client.post(
        status_url(patient, cycle),
        {"status": "NEEDS_CHANGES"},
        format="json",
    )

    assert needs_changes.status_code == 200
    body = needs_changes.json()
    assert body["status"] == CycleStatus.NEEDS_CHANGES
    assert body["prepared_by_email"] is None
    assert body["prepared_at"] is None
    assert body["checked_by_email"] is None
    assert body["checked_at"] is None

    authenticate(client, workflow_data["pharmacist"])
    prepared_again = client.post(prepare_url(patient, cycle))

    assert prepared_again.status_code == 200
    body = prepared_again.json()
    assert body["status"] == CycleStatus.PREPARED
    assert body["prepared_by_email"] == "bw-pharmacist@example.com"
    assert body["prepared_at"] is not None


@pytest.mark.django_db
def test_prepared_cycle_without_stock_deduction_can_move_to_needs_changes(
    client,
    workflow_data,
):
    patient = workflow_data["patient"]
    cycle = make_cycle(patient, "NEEDS-PREPARED", status=CycleStatus.PREPARED)
    authenticate(client, workflow_data["dispenser"])

    response = client.post(
        status_url(patient, cycle),
        {"status": "NEEDS_CHANGES"},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["status"] == CycleStatus.NEEDS_CHANGES


@pytest.mark.django_db
@pytest.mark.parametrize("cycle_status", [CycleStatus.PREPARED, CycleStatus.CHECKED])
def test_stock_deducted_cycle_cannot_move_to_needs_changes(
    client,
    workflow_data,
    cycle_status,
):
    patient = workflow_data["patient"]
    cycle = make_cycle(
        patient,
        f"NEEDS-BLOCKED-{cycle_status}",
        status=cycle_status,
    )
    cycle.stock_deducted = True
    cycle.deducted_at = timezone.now()
    cycle.save(update_fields=["stock_deducted", "deducted_at", "updated_at"])
    authenticate(client, workflow_data["dispenser"])

    response = client.post(
        status_url(patient, cycle),
        {"status": "NEEDS_CHANGES"},
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": [
            "Stock has already been deducted for this cycle, so it cannot be "
            "marked as needs changes."
        ]
    }
    cycle.refresh_from_db()
    assert cycle.status == cycle_status
    assert cycle.stock_deducted is True
    assert cycle.deducted_at is not None


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
