from datetime import date

import pytest
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditAction, AuditEvent
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


def make_patient(
    pharmacy: Pharmacy,
    reference: str,
    *,
    first_name: str = "Alice",
    last_name: str = "Sutton",
) -> Patient:
    return Patient.objects.create(
        pharmacy=pharmacy,
        patient_reference=reference,
        first_name=first_name,
        last_name=last_name,
        date_of_birth=date(1980, 1, 1),
        address=f"{reference} Private Street",
        postcode="TE1 1ST",
        phone="020 0000 0101",
        notes="Private patient note",
    )


def make_cycle(patient: Patient, reference: str, **overrides) -> DosetteCycle:
    data = {
        "patient": patient,
        "reference": reference,
        "frequency": CycleFrequency.WEEKLY,
        "start_date": date(2026, 6, 1),
        "end_date": date(2026, 6, 7),
        "status": CycleStatus.DRAFT,
    }
    data.update(overrides)
    return DosetteCycle.objects.create(**data)


@pytest.fixture
def cycle_api_data():
    group_one = Group.objects.create(name="Group One", slug="cycle-api-one")
    group_two = Group.objects.create(name="Group Two", slug="cycle-api-two")
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
    patient_one = make_patient(pharmacy_one, "P1-CYCLE-001")
    patient_two = make_patient(
        pharmacy_two,
        "P2-CYCLE-001",
        first_name="Bob",
        last_name="Croydon",
    )
    cycle_one = make_cycle(patient_one, "CYCLE-001")
    cycle_two = make_cycle(patient_two, "CYCLE-002")

    admin = make_user("cycle-admin@example.com")
    pharmacist = make_user("cycle-pharmacist@example.com")
    dispenser = make_user("cycle-dispenser@example.com")
    superintendent = make_user("cycle-superintendent@example.com")
    stock_employee = make_user("cycle-stock@example.com")

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

    medication = Medication.objects.create(
        group=group_one,
        name="Private Dose Medication",
        form=MedicationForm.TABLET,
        strength="5 mg",
    )
    private_line = PatientMedication.objects.create(
        patient=patient_one,
        medication=medication,
        dose_instructions="Private medication dose",
    )

    return {
        "group_one": group_one,
        "group_two": group_two,
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "patient_one": patient_one,
        "patient_two": patient_two,
        "cycle_one": cycle_one,
        "cycle_two": cycle_two,
        "private_line": private_line,
        "admin": admin,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
    }


def authenticate(client, user):
    client.force_login(user)


def list_url(patient: Patient) -> str:
    return f"/api/patients/{patient.id}/cycles/"


def detail_url(patient: Patient, cycle: DosetteCycle) -> str:
    return f"{list_url(patient)}{cycle.id}/"


def prepare_url(patient: Patient, cycle: DosetteCycle) -> str:
    return f"{detail_url(patient, cycle)}prepare/"


def cancel_url(patient: Patient, cycle: DosetteCycle) -> str:
    return f"{detail_url(patient, cycle)}cancel/"


def cycle_payload(reference: str = "NEW-CYCLE", **overrides):
    data = {
        "reference": reference,
        "frequency": CycleFrequency.FOUR_WEEKLY,
        "start_date": "2026-07-01",
        "end_date": "2026-07-28",
    }
    data.update(overrides)
    return data


def ids_from_response(response):
    return {item["id"] for item in response.json()}


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["admin", "pharmacist", "dispenser"])
def test_blister_view_roles_can_list_and_detail(client, cycle_api_data, actor_key):
    authenticate(client, cycle_api_data[actor_key])
    patient = cycle_api_data["patient_one"]
    cycle = cycle_api_data["cycle_one"]

    list_response = client.get(list_url(patient))
    detail_response = client.get(detail_url(patient, cycle))

    assert list_response.status_code == 200
    assert cycle.id in ids_from_response(list_response)
    assert detail_response.status_code == 200
    assert detail_response.json()["reference"] == "CYCLE-001"


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["superintendent", "stock_employee"])
def test_roles_without_blister_view_are_denied(client, cycle_api_data, actor_key):
    authenticate(client, cycle_api_data[actor_key])
    patient = cycle_api_data["patient_one"]
    cycle = cycle_api_data["cycle_one"]

    assert client.get(list_url(patient)).status_code == 403
    assert client.get(detail_url(patient, cycle)).status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["admin", "pharmacist"])
def test_manage_roles_can_create_and_update(client, cycle_api_data, actor_key):
    authenticate(client, cycle_api_data[actor_key])
    patient = cycle_api_data["patient_one"]

    create_response = client.post(
        list_url(patient),
        cycle_payload(f"{actor_key}-CYCLE"),
        format="json",
    )
    assert create_response.status_code == 201
    cycle = DosetteCycle.objects.get(pk=create_response.json()["id"])

    update_response = client.patch(
        detail_url(patient, cycle),
        {"reference": f"{actor_key}-UPDATED", "frequency": CycleFrequency.MONTHLY},
        format="json",
    )

    assert update_response.status_code == 200
    assert update_response.json()["reference"] == f"{actor_key}-UPDATED"
    assert update_response.json()["frequency"] == CycleFrequency.MONTHLY


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["dispenser", "superintendent", "stock_employee"])
def test_roles_without_blister_manage_are_denied_writes(
    client,
    cycle_api_data,
    actor_key,
):
    authenticate(client, cycle_api_data[actor_key])
    patient = cycle_api_data["patient_one"]
    cycle = cycle_api_data["cycle_one"]

    assert (
        client.post(
            list_url(patient), cycle_payload(actor_key), format="json"
        ).status_code
        == 403
    )
    assert (
        client.patch(
            detail_url(patient, cycle),
            {"reference": "DENIED"},
            format="json",
        ).status_code
        == 403
    )


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["admin", "pharmacist"])
def test_roles_with_mark_prepared_can_prepare(client, cycle_api_data, actor_key):
    authenticate(client, cycle_api_data[actor_key])
    patient = cycle_api_data["patient_one"]
    cycle = cycle_api_data["cycle_one"]

    response = client.post(prepare_url(patient, cycle))

    cycle.refresh_from_db()
    assert response.status_code == 200
    assert response.json()["status"] == CycleStatus.PREPARED
    assert cycle.status == CycleStatus.PREPARED


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["dispenser", "superintendent", "stock_employee"])
def test_roles_without_mark_prepared_are_denied_prepare(
    client,
    cycle_api_data,
    actor_key,
):
    authenticate(client, cycle_api_data[actor_key])

    response = client.post(
        prepare_url(cycle_api_data["patient_one"], cycle_api_data["cycle_one"])
    )

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["admin", "pharmacist"])
def test_manage_roles_can_cancel(client, cycle_api_data, actor_key):
    authenticate(client, cycle_api_data[actor_key])

    response = client.post(
        cancel_url(cycle_api_data["patient_one"], cycle_api_data["cycle_one"])
    )

    assert response.status_code == 200
    assert response.json()["status"] == CycleStatus.CANCELLED


@pytest.mark.django_db
def test_deducted_prepared_cycle_cannot_be_cancelled(client, cycle_api_data):
    authenticate(client, cycle_api_data["pharmacist"])
    patient = cycle_api_data["patient_one"]
    cycle = make_cycle(
        patient,
        "DEDUCTED-CANCEL-BLOCKED",
        status=CycleStatus.PREPARED,
        stock_deducted=True,
        deducted_at=timezone.now(),
    )

    response = client.post(cancel_url(patient, cycle))

    assert response.status_code == 400
    assert response.json() == {
        "detail": ["Cannot cancel a cycle after stock has been deducted."]
    }
    cycle.refresh_from_db()
    assert cycle.status == CycleStatus.PREPARED
    assert cycle.stock_deducted is True
    assert cycle.deducted_at is not None
    assert not AuditEvent.objects.filter(
        action=AuditAction.BLISTER_CYCLE_CANCELLED,
        target_id=str(cycle.id),
    ).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("cycle_status", [CycleStatus.DRAFT, CycleStatus.PREPARED])
def test_non_deducted_draft_and_prepared_cycles_still_cancel(
    client,
    cycle_api_data,
    cycle_status,
):
    authenticate(client, cycle_api_data["pharmacist"])
    patient = cycle_api_data["patient_one"]
    cycle = make_cycle(
        patient,
        f"NON-DEDUCTED-{cycle_status}-CANCEL",
        status=cycle_status,
        stock_deducted=False,
    )

    response = client.post(cancel_url(patient, cycle))

    cycle.refresh_from_db()
    assert response.status_code == 200
    assert response.json()["status"] == CycleStatus.CANCELLED
    assert cycle.status == CycleStatus.CANCELLED
    assert cycle.stock_deducted is False


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["dispenser", "superintendent", "stock_employee"])
def test_roles_without_manage_are_denied_cancel(client, cycle_api_data, actor_key):
    authenticate(client, cycle_api_data[actor_key])

    response = client.post(
        cancel_url(cycle_api_data["patient_one"], cycle_api_data["cycle_one"])
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_scoping_limits_pharmacist_to_own_patient_cycles(client, cycle_api_data):
    authenticate(client, cycle_api_data["pharmacist"])

    own_response = client.get(list_url(cycle_api_data["patient_one"]))
    cross_patient_response = client.get(list_url(cycle_api_data["patient_two"]))
    cross_cycle_response = client.get(
        detail_url(cycle_api_data["patient_one"], cycle_api_data["cycle_two"])
    )

    assert own_response.status_code == 200
    assert ids_from_response(own_response) == {cycle_api_data["cycle_one"].id}
    assert cross_patient_response.status_code == 404
    assert cross_cycle_response.status_code == 404


@pytest.mark.django_db
def test_cycle_validation_errors_are_clean(client, cycle_api_data):
    authenticate(client, cycle_api_data["admin"])
    patient = cycle_api_data["patient_one"]
    cycle = cycle_api_data["cycle_one"]

    duplicate = client.post(
        list_url(patient),
        cycle_payload("CYCLE-001"),
        format="json",
    )
    bad_create_dates = client.post(
        list_url(patient),
        cycle_payload("BAD-DATES", start_date="2026-08-10", end_date="2026-08-01"),
        format="json",
    )
    bad_update_dates = client.patch(
        detail_url(patient, cycle),
        {"start_date": "2026-08-10", "end_date": "2026-08-01"},
        format="json",
    )
    status_update = client.patch(
        detail_url(patient, cycle),
        {"status": CycleStatus.CANCELLED},
        format="json",
    )

    cycle.refresh_from_db()
    assert duplicate.status_code == 400
    assert duplicate.json() == {
        "reference": ["A cycle with this reference already exists for this patient."]
    }
    assert bad_create_dates.status_code == 400
    assert bad_create_dates.json() == {
        "end_date": ["End date cannot be before the start date."]
    }
    assert bad_update_dates.status_code == 400
    assert bad_update_dates.json() == {
        "end_date": ["End date cannot be before the start date."]
    }
    assert status_update.status_code == 200
    assert status_update.json()["status"] == CycleStatus.DRAFT
    assert cycle.status == CycleStatus.DRAFT


@pytest.mark.django_db
def test_status_filter(client, cycle_api_data):
    authenticate(client, cycle_api_data["admin"])
    patient = cycle_api_data["patient_one"]
    prepared = make_cycle(
        patient,
        "PREPARED-CYCLE",
        status=CycleStatus.PREPARED,
    )

    default_response = client.get(list_url(patient))
    draft_response = client.get(list_url(patient), {"status": CycleStatus.DRAFT})
    invalid_response = client.get(list_url(patient), {"status": "NOT-A-STATUS"})

    assert ids_from_response(default_response) == {
        cycle_api_data["cycle_one"].id,
        prepared.id,
    }
    assert ids_from_response(draft_response) == {cycle_api_data["cycle_one"].id}
    assert ids_from_response(invalid_response) == {
        cycle_api_data["cycle_one"].id,
        prepared.id,
    }


@pytest.mark.django_db
def test_status_transition_guards(client, cycle_api_data):
    authenticate(client, cycle_api_data["admin"])
    patient = cycle_api_data["patient_one"]
    draft_for_prepare = cycle_api_data["cycle_one"]
    prepared_for_prepare = make_cycle(
        patient,
        "PREPARE-BLOCKED",
        status=CycleStatus.PREPARED,
    )
    draft_for_cancel = make_cycle(patient, "CANCEL-DRAFT")
    prepared_for_cancel = make_cycle(
        patient,
        "CANCEL-PREPARED",
        status=CycleStatus.PREPARED,
    )
    cancelled_for_cancel = make_cycle(
        patient,
        "CANCEL-CANCELLED",
        status=CycleStatus.CANCELLED,
    )
    completed_for_cancel = make_cycle(
        patient,
        "CANCEL-COMPLETED",
        status=CycleStatus.COMPLETED,
    )

    assert client.post(prepare_url(patient, draft_for_prepare)).status_code == 200
    prepare_blocked = client.post(prepare_url(patient, prepared_for_prepare))
    assert prepare_blocked.status_code == 400
    assert prepare_blocked.json() == {"detail": ["Only draft cycles can be prepared."]}
    assert client.post(cancel_url(patient, draft_for_cancel)).status_code == 200
    assert client.post(cancel_url(patient, prepared_for_cancel)).status_code == 200
    cancelled_blocked = client.post(cancel_url(patient, cancelled_for_cancel))
    completed_blocked = client.post(cancel_url(patient, completed_for_cancel))
    assert cancelled_blocked.status_code == 400
    assert completed_blocked.status_code == 400
    assert cancelled_blocked.json() == {
        "detail": ["Only draft or prepared cycles can be cancelled."]
    }
    assert completed_blocked.json() == {
        "detail": ["Only draft or prepared cycles can be cancelled."]
    }


@pytest.mark.django_db
def test_delete_cycle_is_not_allowed(client, cycle_api_data):
    authenticate(client, cycle_api_data["admin"])

    response = client.delete(
        detail_url(cycle_api_data["patient_one"], cycle_api_data["cycle_one"])
    )

    assert response.status_code == 405


@pytest.mark.django_db
def test_cycle_audit_events_are_written_with_safe_metadata(client, cycle_api_data):
    authenticate(client, cycle_api_data["admin"])
    patient = cycle_api_data["patient_one"]
    create_response = client.post(
        list_url(patient),
        cycle_payload("AUD-CYCLE"),
        format="json",
    )
    cycle = DosetteCycle.objects.get(pk=create_response.json()["id"])
    client.patch(
        detail_url(patient, cycle),
        {"reference": "AUD-CYCLE-UPDATED", "frequency": CycleFrequency.MONTHLY},
        format="json",
    )
    client.post(prepare_url(patient, cycle))
    client.post(cancel_url(patient, cycle))

    cycle.refresh_from_db()
    created = AuditEvent.objects.get(action=AuditAction.BLISTER_CYCLE_CREATED)
    updated = AuditEvent.objects.get(action=AuditAction.BLISTER_CYCLE_UPDATED)
    prepared = AuditEvent.objects.get(action=AuditAction.BLISTER_CYCLE_PREPARED)
    cancelled = AuditEvent.objects.get(action=AuditAction.BLISTER_CYCLE_CANCELLED)
    expected_base = {
        "pharmacy_id": patient.pharmacy_id,
        "patient_id": patient.id,
        "patient_reference": patient.patient_reference,
        "dosette_cycle_id": cycle.id,
        "cycle_reference": "AUD-CYCLE-UPDATED",
        "status": CycleStatus.CANCELLED,
    }

    assert created.metadata == {
        **expected_base,
        "cycle_reference": "AUD-CYCLE",
        "status": CycleStatus.DRAFT,
    }
    assert updated.metadata == {
        **expected_base,
        "changed_fields": ["frequency", "reference"],
        "status": CycleStatus.DRAFT,
    }
    assert prepared.metadata == {**expected_base, "status": CycleStatus.PREPARED}
    assert cancelled.metadata == expected_base

    private_line = cycle_api_data["private_line"]
    with connection.cursor() as cursor:
        cursor.execute(
            (
                f"SELECT dose_instructions FROM {PatientMedication._meta.db_table} "
                "WHERE id = %s"
            ),
            [private_line.id],
        )
        (raw_dose_instructions,) = cursor.fetchone()

    forbidden_values = [
        patient.first_name,
        patient.last_name,
        str(patient.date_of_birth),
        patient.address,
        patient.phone,
        patient.last_name_index,
        private_line.dose_instructions,
        raw_dose_instructions,
    ]
    for event in (created, updated, prepared, cancelled):
        metadata_text = str(event.metadata)
        for forbidden_value in forbidden_values:
            assert forbidden_value not in metadata_text


@pytest.mark.django_db
def test_create_rolls_back_when_audit_fails(client, cycle_api_data, monkeypatch):
    authenticate(client, cycle_api_data["admin"])

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.blister.views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.post(
            list_url(cycle_api_data["patient_one"]),
            cycle_payload("ROLLBACK-CREATE"),
            format="json",
        )

    assert not DosetteCycle.objects.filter(reference="ROLLBACK-CREATE").exists()


@pytest.mark.django_db
def test_update_rolls_back_when_audit_fails(client, cycle_api_data, monkeypatch):
    authenticate(client, cycle_api_data["admin"])
    cycle = cycle_api_data["cycle_one"]

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.blister.views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.patch(
            detail_url(cycle_api_data["patient_one"], cycle),
            {"reference": "ROLLBACK-UPDATE"},
            format="json",
        )

    cycle.refresh_from_db()
    assert cycle.reference == "CYCLE-001"


@pytest.mark.django_db
def test_prepare_rolls_back_when_audit_fails(client, cycle_api_data, monkeypatch):
    authenticate(client, cycle_api_data["admin"])
    cycle = cycle_api_data["cycle_one"]

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.blister.views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.post(prepare_url(cycle_api_data["patient_one"], cycle))

    cycle.refresh_from_db()
    assert cycle.status == CycleStatus.DRAFT


@pytest.mark.django_db
def test_cancel_rolls_back_when_audit_fails(client, cycle_api_data, monkeypatch):
    authenticate(client, cycle_api_data["admin"])
    cycle = cycle_api_data["cycle_one"]
    cycle.status = CycleStatus.PREPARED
    cycle.save(update_fields=["status", "updated_at"])

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.blister.views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.post(cancel_url(cycle_api_data["patient_one"], cycle))

    cycle.refresh_from_db()
    assert cycle.status == CycleStatus.PREPARED
