from datetime import date

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditAction, AuditEvent
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from .crypto import decrypt_str
from .models import Patient, PatientNote

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
def patient_note_data():
    group_one = Group.objects.create(name="Group One", slug="patient-notes-one")
    group_two = Group.objects.create(name="Group Two", slug="patient-notes-two")
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

    admin = make_user("notes-admin@example.com")
    superintendent = make_user("notes-superintendent@example.com")
    stock_employee = make_user("notes-stock@example.com")
    pharmacist = make_user("notes-pharmacist@example.com")
    dispenser = make_user("notes-dispenser@example.com")

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


def notes_url(patient: Patient) -> str:
    return f"/api/patients/{patient.id}/notes/"


def create_note(patient: Patient, author: User, body: str = "Private note"):
    return PatientNote.objects.create(
        patient=patient,
        body=body,
        author=author,
        author_email=author.email,
    )


@pytest.mark.django_db
def test_patient_note_body_is_encrypted_in_raw_database(patient_note_data):
    note = create_note(
        patient_note_data["patient_one"],
        patient_note_data["admin"],
        "Sensitive note body",
    )

    with connection.cursor() as cursor:
        cursor.execute(
            f"SELECT body FROM {PatientNote._meta.db_table} WHERE id = %s",
            [note.id],
        )
        (raw_body,) = cursor.fetchone()

    assert raw_body != "Sensitive note body"
    assert "Sensitive note body" not in raw_body
    assert decrypt_str(raw_body) == "Sensitive note body"


@pytest.mark.django_db
def test_patient_notes_are_append_only(patient_note_data):
    note = create_note(patient_note_data["patient_one"], patient_note_data["admin"])

    note.body = "Updated note"
    with pytest.raises(
        ValueError,
        match="Patient notes are append-only and cannot be updated.",
    ):
        note.save()

    with pytest.raises(
        ValueError,
        match="Patient notes are append-only and cannot be deleted.",
    ):
        note.delete()


@pytest.mark.django_db
def test_admin_can_create_and_list_patient_notes(client, patient_note_data):
    authenticate(client, patient_note_data["admin"])
    patient = patient_note_data["patient_one"]

    create_response = client.post(
        notes_url(patient),
        {"body": "Admin note body"},
        format="json",
    )
    list_response = client.get(notes_url(patient))

    assert create_response.status_code == 201
    assert create_response.json()["body"] == "Admin note body"
    assert create_response.json()["author"] == patient_note_data["admin"].id
    assert create_response.json()["author_email"] == patient_note_data["admin"].email
    assert list_response.status_code == 200
    assert list_response.json()[0]["body"] == "Admin note body"
    assert list_response.json()[0]["author"] == patient_note_data["admin"].id
    assert list_response.json()[0]["author_email"] == patient_note_data["admin"].email


@pytest.mark.django_db
def test_blank_patient_note_body_is_rejected(client, patient_note_data):
    authenticate(client, patient_note_data["admin"])

    response = client.post(
        notes_url(patient_note_data["patient_one"]),
        {"body": "   "},
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {"body": ["Note body is required."]}


@pytest.mark.django_db
def test_pharmacist_can_create_and_list_own_pharmacy_patient_notes(
    client,
    patient_note_data,
):
    authenticate(client, patient_note_data["pharmacist"])
    patient = patient_note_data["patient_one"]

    create_response = client.post(
        notes_url(patient),
        {"body": "Pharmacist note"},
        format="json",
    )
    list_response = client.get(notes_url(patient))

    assert create_response.status_code == 201
    assert list_response.status_code == 200
    assert list_response.json()[0]["body"] == "Pharmacist note"


@pytest.mark.django_db
def test_dispenser_can_list_but_not_create_patient_notes(client, patient_note_data):
    authenticate(client, patient_note_data["dispenser"])
    patient = patient_note_data["patient_one"]
    create_note(patient, patient_note_data["admin"], "Existing note")

    list_response = client.get(notes_url(patient))
    create_response = client.post(
        notes_url(patient),
        {"body": "Dispenser note"},
        format="json",
    )

    assert list_response.status_code == 200
    assert list_response.json()[0]["body"] == "Existing note"
    assert create_response.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["superintendent", "stock_employee"])
def test_group_level_roles_cannot_access_patient_notes(
    client,
    patient_note_data,
    actor_key,
):
    authenticate(client, patient_note_data[actor_key])
    patient = patient_note_data["patient_one"]

    list_response = client.get(notes_url(patient))
    create_response = client.post(
        notes_url(patient),
        {"body": "Group role note"},
        format="json",
    )

    assert list_response.status_code == 403
    assert create_response.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["get", "post"])
def test_cross_pharmacy_patient_notes_return_not_found(
    client,
    patient_note_data,
    method,
):
    authenticate(client, patient_note_data["pharmacist"])
    request = getattr(client, method)

    if method == "post":
        response = request(
            notes_url(patient_note_data["patient_two"]),
            {"body": "Out of scope note"},
            format="json",
        )
    else:
        response = request(notes_url(patient_note_data["patient_two"]))

    assert response.status_code == 404


@pytest.mark.django_db
def test_patient_notes_are_listed_newest_first(client, patient_note_data):
    authenticate(client, patient_note_data["admin"])
    patient = patient_note_data["patient_one"]
    client.post(notes_url(patient), {"body": "Older note"}, format="json")
    client.post(notes_url(patient), {"body": "Newer note"}, format="json")

    response = client.get(notes_url(patient))

    assert response.status_code == 200
    assert [note["body"] for note in response.json()] == ["Newer note", "Older note"]


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["put", "patch", "delete"])
def test_patient_notes_do_not_support_update_or_delete_methods(
    client,
    patient_note_data,
    method,
):
    authenticate(client, patient_note_data["admin"])

    response = getattr(client, method)(notes_url(patient_note_data["patient_one"]))

    assert response.status_code == 405


@pytest.mark.django_db
def test_patient_note_create_writes_safe_audit_event(client, patient_note_data):
    authenticate(client, patient_note_data["admin"])
    patient = patient_note_data["patient_one"]

    response = client.post(
        notes_url(patient),
        {"body": "Sensitive note audit text"},
        format="json",
    )
    note = PatientNote.objects.get(pk=response.json()["id"])
    with connection.cursor() as cursor:
        cursor.execute(
            f"SELECT body FROM {PatientNote._meta.db_table} WHERE id = %s",
            [note.id],
        )
        (raw_body,) = cursor.fetchone()

    event = AuditEvent.objects.get(action=AuditAction.PATIENT_NOTE_ADDED)
    metadata_text = str(event.metadata)

    assert response.status_code == 201
    assert event.metadata == {
        "pharmacy_id": patient.pharmacy_id,
        "patient_id": patient.id,
        "patient_reference": patient.patient_reference,
        "note_id": note.id,
    }
    assert event.pharmacy == patient.pharmacy
    assert "Sensitive note audit text" not in metadata_text
    assert patient.first_name not in metadata_text
    assert patient.last_name not in metadata_text
    assert str(patient.date_of_birth) not in metadata_text
    assert patient.address not in metadata_text
    assert patient.phone not in metadata_text
    assert raw_body not in metadata_text
    assert patient.last_name_index not in metadata_text


@pytest.mark.django_db
def test_patient_note_create_rolls_back_when_audit_recording_fails(
    client,
    patient_note_data,
    monkeypatch,
):
    authenticate(client, patient_note_data["admin"])
    patient = patient_note_data["patient_one"]

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.patients.views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.post(
            notes_url(patient),
            {"body": "Rollback note"},
            format="json",
        )

    assert not PatientNote.objects.filter(patient=patient).exists()
