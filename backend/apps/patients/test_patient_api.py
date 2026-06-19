from datetime import date

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditAction, AuditEvent
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from .models import Patient

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
    first_name: str = "Demo",
    last_name: str = "Patient",
) -> Patient:
    return Patient.objects.create(
        pharmacy=pharmacy,
        patient_reference=reference,
        first_name=first_name,
        last_name=last_name,
        date_of_birth=date(1980, 1, 1),
        address=f"{reference} Test Street",
        postcode="TE1 1ST",
        phone="020 0000 0101",
        notes=f"{reference} private note",
    )


@pytest.fixture
def patient_api_data():
    group_one = Group.objects.create(name="Group One", slug="patient-api-one")
    group_two = Group.objects.create(name="Group Two", slug="patient-api-two")
    pharmacy_one = Pharmacy.objects.create(
        group=group_one,
        name="Pharmacy One",
        code="P1",
    )
    pharmacy_two = Pharmacy.objects.create(
        group=group_one,
        name="Pharmacy Two",
        code="P2",
    )
    pharmacy_other = Pharmacy.objects.create(
        group=group_two,
        name="Other Pharmacy",
        code="OP",
    )

    patient_one = make_patient(
        pharmacy_one,
        "P1-001",
        first_name="Alice",
        last_name="Sutton",
    )
    patient_two = make_patient(
        pharmacy_two,
        "P2-001",
        first_name="Bob",
        last_name="Croydon",
    )
    patient_other = make_patient(
        pharmacy_other,
        "OP-001",
        first_name="Carol",
        last_name="Outside",
    )

    admin = make_user("patient-admin@example.com")
    superintendent = make_user("patient-superintendent@example.com")
    stock_employee = make_user("patient-stock@example.com")
    pharmacist = make_user("patient-pharmacist@example.com")
    dispenser = make_user("patient-dispenser@example.com")

    add_membership(admin, Role.ADMIN)
    add_membership(superintendent, Role.SUPERINTENDENT, group=group_one)
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group_one,
        pharmacies=(pharmacy_one, pharmacy_two),
    )
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy_one)
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy_one)

    return {
        "group_one": group_one,
        "group_two": group_two,
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "pharmacy_other": pharmacy_other,
        "patient_one": patient_one,
        "patient_two": patient_two,
        "patient_other": patient_other,
        "admin": admin,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
    }


def authenticate(client, user):
    client.force_login(user)


def patient_payload(pharmacy: Pharmacy, reference: str = "NEW-001") -> dict[str, str]:
    return {
        "pharmacy": pharmacy.id,
        "patient_reference": reference,
        "first_name": "Fictional",
        "last_name": "Tester",
        "date_of_birth": "1988-04-02",
        "address": "99 Demo Lane",
        "postcode": "DM1 1AA",
        "phone": "020 0000 0999",
        "notes": "Fictional test note",
    }


def ids_from_response(response):
    return {item["id"] for item in response.json()}


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["admin", "pharmacist", "dispenser"])
def test_patient_view_roles_can_list_patients(client, patient_api_data, actor_key):
    authenticate(client, patient_api_data[actor_key])

    response = client.get("/api/patients/")

    assert response.status_code == 200
    assert response.json()


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["superintendent", "stock_employee"])
def test_non_patient_roles_cannot_list_patients(client, patient_api_data, actor_key):
    authenticate(client, patient_api_data[actor_key])

    response = client.get("/api/patients/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_can_list_all_patients(client, patient_api_data):
    authenticate(client, patient_api_data["admin"])

    response = client.get("/api/patients/")

    assert response.status_code == 200
    assert ids_from_response(response) == {
        patient_api_data["patient_one"].id,
        patient_api_data["patient_two"].id,
        patient_api_data["patient_other"].id,
    }


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["pharmacist", "dispenser"])
def test_pharmacy_roles_see_only_own_pharmacy(client, patient_api_data, actor_key):
    authenticate(client, patient_api_data[actor_key])

    response = client.get("/api/patients/")

    assert response.status_code == 200
    assert ids_from_response(response) == {patient_api_data["patient_one"].id}


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["pharmacist", "dispenser"])
def test_cross_pharmacy_detail_returns_not_found(client, patient_api_data, actor_key):
    authenticate(client, patient_api_data[actor_key])

    response = client.get(f"/api/patients/{patient_api_data['patient_two'].id}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_pharmacy_filter_narrows_after_scoping(client, patient_api_data):
    authenticate(client, patient_api_data["admin"])

    response = client.get(
        "/api/patients/",
        {"pharmacy": patient_api_data["pharmacy_two"].id},
    )

    assert response.status_code == 200
    assert ids_from_response(response) == {patient_api_data["patient_two"].id}


@pytest.mark.django_db
def test_out_of_scope_pharmacy_filter_returns_empty(client, patient_api_data):
    authenticate(client, patient_api_data["pharmacist"])

    response = client.get(
        "/api/patients/",
        {"pharmacy": patient_api_data["pharmacy_two"].id},
    )

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
def test_invalid_pharmacy_filter_returns_empty(client, patient_api_data):
    authenticate(client, patient_api_data["admin"])

    response = client.get("/api/patients/", {"pharmacy": "not-an-id"})

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
@pytest.mark.parametrize("term", ["alice", "SUTTON", "P1-001"])
def test_search_filters_within_scoped_queryset(client, patient_api_data, term):
    authenticate(client, patient_api_data["pharmacist"])

    response = client.get("/api/patients/", {"search": term})

    assert response.status_code == 200
    assert ids_from_response(response) == {patient_api_data["patient_one"].id}


@pytest.mark.django_db
def test_search_does_not_leak_cross_pharmacy_patients(client, patient_api_data):
    authenticate(client, patient_api_data["pharmacist"])

    response = client.get("/api/patients/", {"search": "Croydon"})

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["admin", "pharmacist"])
def test_manage_roles_can_create_update_and_deactivate(
    client,
    patient_api_data,
    actor_key,
):
    authenticate(client, patient_api_data[actor_key])

    response = client.post(
        "/api/patients/",
        patient_payload(patient_api_data["pharmacy_one"], f"{actor_key}-001"),
        format="json",
    )
    assert response.status_code == 201
    patient_id = response.json()["id"]

    update_response = client.patch(
        f"/api/patients/{patient_id}/",
        {"phone": "020 0000 0111"},
        format="json",
    )
    assert update_response.status_code == 200
    assert update_response.json()["phone"] == "020 0000 0111"

    deactivate_response = client.post(f"/api/patients/{patient_id}/deactivate/")
    assert deactivate_response.status_code == 200
    assert deactivate_response.json()["is_active"] is False
    assert Patient.objects.get(pk=patient_id).deleted_at is not None


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["superintendent", "stock_employee"])
def test_non_patient_roles_cannot_create_update_or_deactivate(
    client,
    patient_api_data,
    actor_key,
):
    authenticate(client, patient_api_data[actor_key])
    patient = patient_api_data["patient_one"]

    assert (
        client.post(
            "/api/patients/",
            patient_payload(patient_api_data["pharmacy_one"], f"{actor_key}-001"),
            format="json",
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/patients/{patient.id}/",
            {"phone": "020 0000 0222"},
            format="json",
        ).status_code
        == 403
    )
    assert client.post(f"/api/patients/{patient.id}/deactivate/").status_code == 403


@pytest.mark.django_db
def test_dispenser_can_read_detail_but_cannot_mutate(client, patient_api_data):
    authenticate(client, patient_api_data["dispenser"])
    patient = patient_api_data["patient_one"]

    detail_response = client.get(f"/api/patients/{patient.id}/")
    create_response = client.post(
        "/api/patients/",
        patient_payload(patient_api_data["pharmacy_one"], "DISP-001"),
        format="json",
    )
    update_response = client.patch(
        f"/api/patients/{patient.id}/",
        {"phone": "020 0000 0333"},
        format="json",
    )
    deactivate_response = client.post(f"/api/patients/{patient.id}/deactivate/")

    assert detail_response.status_code == 200
    assert create_response.status_code == 403
    assert update_response.status_code == 403
    assert deactivate_response.status_code == 403


@pytest.mark.django_db
def test_duplicate_patient_reference_returns_clean_validation_error(
    client,
    patient_api_data,
):
    authenticate(client, patient_api_data["admin"])

    response = client.post(
        "/api/patients/",
        patient_payload(patient_api_data["pharmacy_one"], "P1-001"),
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {
        "patient_reference": [
            "A patient with this reference already exists in this pharmacy."
        ]
    }


@pytest.mark.django_db
def test_patient_pharmacy_cannot_be_changed(client, patient_api_data):
    authenticate(client, patient_api_data["admin"])

    response = client.patch(
        f"/api/patients/{patient_api_data['patient_one'].id}/",
        {"pharmacy": patient_api_data["pharmacy_two"].id},
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {"pharmacy": ["Patient pharmacy cannot be changed."]}


@pytest.mark.django_db
def test_create_outside_scope_returns_validation_error(client, patient_api_data):
    authenticate(client, patient_api_data["pharmacist"])

    response = client.post(
        "/api/patients/",
        patient_payload(patient_api_data["pharmacy_two"], "OUT-001"),
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {
        "pharmacy": ["This pharmacy is outside your patient scope."]
    }


@pytest.mark.django_db
def test_delete_patient_is_not_allowed(client, patient_api_data):
    authenticate(client, patient_api_data["admin"])

    response = client.delete(f"/api/patients/{patient_api_data['patient_one'].id}/")

    assert response.status_code == 405


@pytest.mark.django_db
def test_patient_create_update_and_deactivate_write_safe_audit_events(
    client,
    patient_api_data,
):
    authenticate(client, patient_api_data["admin"])

    create_response = client.post(
        "/api/patients/",
        patient_payload(patient_api_data["pharmacy_one"], "AUD-001"),
        format="json",
    )
    patient_id = create_response.json()["id"]
    client.patch(
        f"/api/patients/{patient_id}/",
        {"first_name": "PrivateName", "phone": "020 0000 0444"},
        format="json",
    )
    client.post(f"/api/patients/{patient_id}/deactivate/")

    created = AuditEvent.objects.get(action=AuditAction.PATIENT_CREATED)
    updated = AuditEvent.objects.get(action=AuditAction.PATIENT_UPDATED)
    deactivated = AuditEvent.objects.get(action=AuditAction.PATIENT_DEACTIVATED)
    expected_base_metadata = {
        "pharmacy_id": patient_api_data["pharmacy_one"].id,
        "patient_id": patient_id,
        "patient_reference": "AUD-001",
    }

    assert created.metadata == expected_base_metadata
    assert updated.metadata == {
        **expected_base_metadata,
        "changed_fields": ["first_name", "phone"],
    }
    assert deactivated.metadata == expected_base_metadata
    assert created.pharmacy == patient_api_data["pharmacy_one"]
    assert updated.pharmacy == patient_api_data["pharmacy_one"]
    assert deactivated.pharmacy == patient_api_data["pharmacy_one"]

    for event in (created, updated, deactivated):
        metadata_text = str(event.metadata)
        assert "PrivateName" not in metadata_text
        assert "020 0000 0444" not in metadata_text
        assert "99 Demo Lane" not in metadata_text


@pytest.mark.django_db
def test_create_rolls_back_when_audit_recording_fails(
    client,
    patient_api_data,
    monkeypatch,
):
    authenticate(client, patient_api_data["admin"])

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.patients.views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.post(
            "/api/patients/",
            patient_payload(patient_api_data["pharmacy_one"], "ROLLBACK-CREATE"),
            format="json",
        )

    assert not Patient.objects.filter(patient_reference="ROLLBACK-CREATE").exists()


@pytest.mark.django_db
def test_update_rolls_back_when_audit_recording_fails(
    client,
    patient_api_data,
    monkeypatch,
):
    authenticate(client, patient_api_data["admin"])
    patient = patient_api_data["patient_one"]

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.patients.views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.patch(
            f"/api/patients/{patient.id}/",
            {"last_name": "Rollback"},
            format="json",
        )

    patient.refresh_from_db()
    assert patient.last_name == "Sutton"


@pytest.mark.django_db
def test_deactivate_rolls_back_when_audit_recording_fails(
    client,
    patient_api_data,
    monkeypatch,
):
    authenticate(client, patient_api_data["admin"])
    patient = patient_api_data["patient_one"]

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.patients.views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.post(f"/api/patients/{patient.id}/deactivate/")

    patient.refresh_from_db()
    assert patient.is_active is True
    assert patient.deleted_at is None
