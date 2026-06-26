from datetime import date

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditAction, AuditEvent
from apps.catalogue.models import CatalogueProduct, Medication, MedicationForm
from apps.patients.crypto import decrypt_str
from apps.patients.models import Patient
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from .models import PatientMedication

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


def make_medication(group: Group, name: str) -> Medication:
    return Medication.objects.create(
        group=group,
        name=name,
        form=MedicationForm.TABLET,
        strength="500 mg",
    )


def make_catalogue_product(
    display_name: str,
    *,
    strength: str = "500 mg",
    dose_form: str = "tablets",
    is_active: bool = True,
) -> CatalogueProduct:
    return CatalogueProduct.objects.create(
        dmd_code=f"SEED-{display_name.upper().replace(' ', '-')}",
        display_name=display_name,
        ingredient=display_name.split()[0],
        strength=strength,
        dose_form=dose_form,
        pack_size=28,
        pack_unit="tablets",
        manufacturer="Seed Pharma",
        is_active=is_active,
    )


@pytest.fixture
def blister_api_data():
    group_one = Group.objects.create(name="Group One", slug="blister-api-one")
    group_two = Group.objects.create(name="Group Two", slug="blister-api-two")
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
    patient_one = make_patient(pharmacy_one, "P1-BLIST-001")
    patient_two = make_patient(
        pharmacy_two,
        "P2-BLIST-001",
        first_name="Bob",
        last_name="Croydon",
    )
    medication_one = make_medication(group_one, "Paracetamol")
    medication_alt = make_medication(group_one, "Amlodipine")
    medication_two = make_medication(group_two, "Ibuprofen")
    catalogue_product = make_catalogue_product(
        "Metformin MR 500mg tablets",
        strength="500mg",
    )
    inactive_catalogue_product = make_catalogue_product(
        "Inactive 10mg tablets",
        strength="10mg",
        is_active=False,
    )
    line_one = PatientMedication.objects.create(
        patient=patient_one,
        medication=medication_one,
        dose_instructions="One tablet each morning",
        quantity_morning=1,
    )
    line_two = PatientMedication.objects.create(
        patient=patient_two,
        medication=medication_two,
        dose_instructions="Other pharmacy line",
        quantity_evening=1,
    )

    admin = make_user("blister-admin@example.com")
    pharmacist = make_user("blister-pharmacist@example.com")
    dispenser = make_user("blister-dispenser@example.com")
    superintendent = make_user("blister-superintendent@example.com")
    stock_employee = make_user("blister-stock@example.com")

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
        "group_one": group_one,
        "group_two": group_two,
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "patient_one": patient_one,
        "patient_two": patient_two,
        "medication_one": medication_one,
        "medication_alt": medication_alt,
        "medication_two": medication_two,
        "catalogue_product": catalogue_product,
        "inactive_catalogue_product": inactive_catalogue_product,
        "line_one": line_one,
        "line_two": line_two,
        "admin": admin,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
    }


def authenticate(client, user):
    client.force_login(user)


def list_url(patient: Patient) -> str:
    return f"/api/patients/{patient.id}/medications/"


def detail_url(patient: Patient, line: PatientMedication) -> str:
    return f"{list_url(patient)}{line.id}/"


def discontinue_url(patient: Patient, line: PatientMedication) -> str:
    return f"{detail_url(patient, line)}discontinue/"


def payload(medication: Medication, **overrides):
    data = {
        "medication": medication.id,
        "dose_instructions": "Take with breakfast",
        "quantity_morning": 1,
        "quantity_lunchtime": 0,
        "quantity_evening": 0,
        "quantity_bedtime": 0,
        "start_date": "2026-06-19",
    }
    data.update(overrides)
    return data


def ids_from_response(response):
    return {item["id"] for item in response.json()}


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["admin", "pharmacist", "dispenser"])
def test_blister_view_roles_can_list_and_detail(
    client,
    blister_api_data,
    actor_key,
):
    authenticate(client, blister_api_data[actor_key])
    patient = blister_api_data["patient_one"]
    line = blister_api_data["line_one"]

    list_response = client.get(list_url(patient))
    detail_response = client.get(detail_url(patient, line))

    assert list_response.status_code == 200
    assert line.id in ids_from_response(list_response)
    assert detail_response.status_code == 200
    assert detail_response.json()["dose_instructions"] == "One tablet each morning"
    assert detail_response.json()["medication_name"] == "Paracetamol"
    assert detail_response.json()["strength"] == "500 mg"
    assert detail_response.json()["form"] == MedicationForm.TABLET


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["superintendent", "stock_employee"])
def test_roles_without_blister_view_are_denied(
    client,
    blister_api_data,
    actor_key,
):
    authenticate(client, blister_api_data[actor_key])
    patient = blister_api_data["patient_one"]
    line = blister_api_data["line_one"]

    assert client.get(list_url(patient)).status_code == 403
    assert client.get(detail_url(patient, line)).status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["admin", "pharmacist"])
def test_manage_roles_can_create_update_and_discontinue(
    client,
    blister_api_data,
    actor_key,
):
    authenticate(client, blister_api_data[actor_key])
    patient = blister_api_data["patient_one"]

    create_response = client.post(
        list_url(patient),
        payload(blister_api_data["medication_alt"]),
        format="json",
    )
    assert create_response.status_code == 201
    line_id = create_response.json()["id"]
    line = PatientMedication.objects.get(pk=line_id)

    update_response = client.patch(
        detail_url(patient, line),
        {"quantity_evening": 2, "dose_instructions": "Updated private dose"},
        format="json",
    )
    discontinue_response = client.post(discontinue_url(patient, line))

    assert update_response.status_code == 200
    assert update_response.json()["quantity_evening"] == 2
    assert discontinue_response.status_code == 200
    assert discontinue_response.json()["is_active"] is False
    line.refresh_from_db()
    assert line.deleted_at is not None


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["dispenser", "superintendent", "stock_employee"])
def test_roles_without_blister_manage_are_denied_mutations(
    client,
    blister_api_data,
    actor_key,
):
    authenticate(client, blister_api_data[actor_key])
    patient = blister_api_data["patient_one"]
    line = blister_api_data["line_one"]

    create_response = client.post(
        list_url(patient),
        payload(blister_api_data["medication_alt"]),
        format="json",
    )
    update_response = client.patch(
        detail_url(patient, line),
        {"quantity_morning": 2},
        format="json",
    )
    discontinue_response = client.post(discontinue_url(patient, line))

    assert create_response.status_code == 403
    assert update_response.status_code == 403
    assert discontinue_response.status_code == 403


@pytest.mark.django_db
def test_create_with_catalogue_product_materialises_medication(
    client,
    blister_api_data,
):
    authenticate(client, blister_api_data["pharmacist"])
    patient = blister_api_data["patient_one"]
    product = blister_api_data["catalogue_product"]

    response = client.post(
        list_url(patient),
        {
            "catalogue_product": product.id,
            "dose_instructions": "Take with evening meal",
            "quantity_morning": 0,
            "quantity_lunchtime": 0,
            "quantity_evening": 1,
            "quantity_bedtime": 0,
            "start_date": "2026-06-19",
        },
        format="json",
    )

    assert response.status_code == 201
    medication = Medication.objects.get(
        group=blister_api_data["group_one"],
        catalogue_product=product,
    )
    line = PatientMedication.objects.get(pk=response.json()["id"])

    assert line.medication == medication
    assert response.json()["medication"] == medication.id
    assert response.json()["medication_name"] == "Metformin MR 500mg tablets"
    assert response.json()["strength"] == "500mg"
    assert response.json()["form"] == MedicationForm.TABLET
    assert not Medication.objects.filter(
        group=blister_api_data["group_two"],
        catalogue_product=product,
    ).exists()


@pytest.mark.django_db
def test_catalogue_product_materialisation_is_idempotent(client, blister_api_data):
    authenticate(client, blister_api_data["admin"])
    patient = blister_api_data["patient_one"]
    other_patient = make_patient(blister_api_data["pharmacy_one"], "P1-BLIST-002")
    product = blister_api_data["catalogue_product"]
    body = {
        "catalogue_product": product.id,
        "dose_instructions": "Take daily",
        "quantity_morning": 1,
        "quantity_lunchtime": 0,
        "quantity_evening": 0,
        "quantity_bedtime": 0,
        "start_date": "2026-06-19",
    }

    first_response = client.post(list_url(patient), body, format="json")
    second_response = client.post(list_url(other_patient), body, format="json")

    assert first_response.status_code == 201
    assert second_response.status_code == 201
    assert (
        Medication.objects.filter(
            group=blister_api_data["group_one"],
            catalogue_product=product,
        ).count()
        == 1
    )
    assert first_response.json()["medication"] == second_response.json()["medication"]


@pytest.mark.django_db
def test_create_rejects_inactive_catalogue_product(client, blister_api_data):
    authenticate(client, blister_api_data["admin"])
    product = blister_api_data["inactive_catalogue_product"]

    response = client.post(
        list_url(blister_api_data["patient_one"]),
        {
            "catalogue_product": product.id,
            "dose_instructions": "Take daily",
            "quantity_morning": 1,
            "quantity_lunchtime": 0,
            "quantity_evening": 0,
            "quantity_bedtime": 0,
            "start_date": "2026-06-19",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "catalogue_product" in response.json()
    assert not Medication.objects.filter(catalogue_product=product).exists()


@pytest.mark.django_db
def test_dispenser_cannot_create_with_catalogue_product(client, blister_api_data):
    authenticate(client, blister_api_data["dispenser"])

    response = client.post(
        list_url(blister_api_data["patient_one"]),
        {
            "catalogue_product": blister_api_data["catalogue_product"].id,
            "dose_instructions": "Take daily",
            "quantity_morning": 1,
            "quantity_lunchtime": 0,
            "quantity_evening": 0,
            "quantity_bedtime": 0,
            "start_date": "2026-06-19",
        },
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_scoping_limits_pharmacist_to_own_patient_lines(client, blister_api_data):
    authenticate(client, blister_api_data["pharmacist"])

    own_response = client.get(list_url(blister_api_data["patient_one"]))
    cross_patient_response = client.get(list_url(blister_api_data["patient_two"]))
    cross_line_response = client.get(
        detail_url(blister_api_data["patient_one"], blister_api_data["line_two"]),
    )

    assert own_response.status_code == 200
    assert ids_from_response(own_response) == {blister_api_data["line_one"].id}
    assert cross_patient_response.status_code == 404
    assert cross_line_response.status_code == 404


@pytest.mark.django_db
def test_validation_errors_are_clean(client, blister_api_data):
    authenticate(client, blister_api_data["admin"])
    patient = blister_api_data["patient_one"]
    line = blister_api_data["line_one"]

    out_of_group = client.post(
        list_url(patient),
        payload(blister_api_data["medication_two"]),
        format="json",
    )
    medication_change = client.patch(
        detail_url(patient, line),
        {"medication": blister_api_data["medication_alt"].id},
        format="json",
    )
    negative_quantity = client.patch(
        detail_url(patient, line),
        {"quantity_morning": -1},
        format="json",
    )
    duplicate = client.post(
        list_url(patient),
        payload(blister_api_data["medication_one"]),
        format="json",
    )

    assert out_of_group.status_code == 400
    assert out_of_group.json() == {
        "medication": [
            "This medication is not available for this patient's pharmacy group."
        ]
    }
    assert medication_change.status_code == 400
    assert medication_change.json() == {
        "medication": ["Medication cannot be changed; discontinue and add a new line."]
    }
    assert negative_quantity.status_code == 400
    assert "quantity_morning" in negative_quantity.json()
    assert duplicate.status_code == 400
    assert duplicate.json() == {
        "medication": [
            "An active medication line for this medication already exists for this "
            "patient."
        ]
    }


@pytest.mark.django_db
def test_discontinued_line_allows_recreate_same_medication(client, blister_api_data):
    authenticate(client, blister_api_data["admin"])
    patient = blister_api_data["patient_one"]
    line = blister_api_data["line_one"]

    discontinue_response = client.post(discontinue_url(patient, line))
    recreate_response = client.post(
        list_url(patient),
        payload(blister_api_data["medication_one"]),
        format="json",
    )

    assert discontinue_response.status_code == 200
    assert recreate_response.status_code == 201


@pytest.mark.django_db
def test_is_active_filter(client, blister_api_data):
    authenticate(client, blister_api_data["admin"])
    inactive = blister_api_data["line_one"]
    inactive.soft_delete()
    active = PatientMedication.objects.create(
        patient=blister_api_data["patient_one"],
        medication=blister_api_data["medication_alt"],
    )

    default_response = client.get(list_url(blister_api_data["patient_one"]))
    active_response = client.get(
        list_url(blister_api_data["patient_one"]),
        {"is_active": "true"},
    )
    inactive_response = client.get(
        list_url(blister_api_data["patient_one"]),
        {"is_active": "false"},
    )

    assert default_response.status_code == 200
    assert ids_from_response(default_response) == {inactive.id, active.id}
    assert ids_from_response(active_response) == {active.id}
    assert ids_from_response(inactive_response) == {inactive.id}


@pytest.mark.django_db
def test_discontinue_is_soft_delete_and_hard_delete_is_not_allowed(
    client,
    blister_api_data,
):
    authenticate(client, blister_api_data["admin"])
    patient = blister_api_data["patient_one"]
    line = blister_api_data["line_one"]

    response = client.post(discontinue_url(patient, line))
    second_response = client.post(discontinue_url(patient, line))
    delete_response = client.delete(detail_url(patient, line))

    line.refresh_from_db()
    assert response.status_code == 200
    assert response.json()["is_active"] is False
    assert line.is_active is False
    assert line.deleted_at is not None
    assert second_response.status_code == 400
    assert second_response.json() == {
        "detail": ["This medication line is already discontinued."]
    }
    assert delete_response.status_code == 405


@pytest.mark.django_db
def test_audit_events_are_written_with_safe_metadata(client, blister_api_data):
    authenticate(client, blister_api_data["admin"])
    patient = blister_api_data["patient_one"]
    private_dose = "Private dose instructions"
    create_response = client.post(
        list_url(patient),
        payload(
            blister_api_data["medication_alt"],
            dose_instructions=private_dose,
        ),
        format="json",
    )
    line = PatientMedication.objects.get(pk=create_response.json()["id"])
    client.patch(
        detail_url(patient, line),
        {
            "dose_instructions": "Updated private instructions",
            "quantity_bedtime": 1,
        },
        format="json",
    )
    client.post(discontinue_url(patient, line))

    created = AuditEvent.objects.get(action=AuditAction.BLISTER_MEDICATION_ADDED)
    updated = AuditEvent.objects.get(action=AuditAction.BLISTER_MEDICATION_UPDATED)
    discontinued = AuditEvent.objects.get(
        action=AuditAction.BLISTER_MEDICATION_DISCONTINUED
    )
    expected_base = {
        "pharmacy_id": patient.pharmacy_id,
        "patient_id": patient.id,
        "patient_reference": patient.patient_reference,
        "patient_medication_id": line.id,
        "medication_id": blister_api_data["medication_alt"].id,
        "medication_name": "Amlodipine",
    }

    assert created.metadata == expected_base
    assert updated.metadata == {
        **expected_base,
        "changed_fields": ["dose_instructions", "quantity_bedtime"],
    }
    assert discontinued.metadata == expected_base

    with connection.cursor() as cursor:
        cursor.execute(
            (
                f"SELECT dose_instructions FROM {PatientMedication._meta.db_table} "
                "WHERE id = %s"
            ),
            [line.id],
        )
        (raw_dose_instructions,) = cursor.fetchone()

    forbidden_values = [
        private_dose,
        "Updated private instructions",
        patient.first_name,
        patient.last_name,
        str(patient.date_of_birth),
        patient.address,
        patient.phone,
        raw_dose_instructions,
        patient.last_name_index,
    ]
    for event in (created, updated, discontinued):
        metadata_text = str(event.metadata)
        for forbidden_value in forbidden_values:
            assert forbidden_value not in metadata_text


@pytest.mark.django_db
def test_create_rolls_back_when_audit_fails(client, blister_api_data, monkeypatch):
    authenticate(client, blister_api_data["admin"])

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.blister.views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.post(
            list_url(blister_api_data["patient_one"]),
            payload(blister_api_data["medication_alt"]),
            format="json",
        )

    assert not PatientMedication.objects.filter(
        patient=blister_api_data["patient_one"],
        medication=blister_api_data["medication_alt"],
    ).exists()


@pytest.mark.django_db
def test_update_rolls_back_when_audit_fails(client, blister_api_data, monkeypatch):
    authenticate(client, blister_api_data["admin"])
    line = blister_api_data["line_one"]

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.blister.views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.patch(
            detail_url(blister_api_data["patient_one"], line),
            {"quantity_morning": 4},
            format="json",
        )

    line.refresh_from_db()
    assert line.quantity_morning == 1


@pytest.mark.django_db
def test_discontinue_rolls_back_when_audit_fails(
    client,
    blister_api_data,
    monkeypatch,
):
    authenticate(client, blister_api_data["admin"])
    line = blister_api_data["line_one"]

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.blister.views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.post(discontinue_url(blister_api_data["patient_one"], line))

    line.refresh_from_db()
    assert line.is_active is True
    assert line.deleted_at is None


@pytest.mark.django_db
def test_dose_instructions_are_plaintext_in_api_and_encrypted_at_rest(
    client,
    blister_api_data,
):
    authenticate(client, blister_api_data["admin"])
    plaintext = "Take one tablet with fictional breakfast"

    response = client.post(
        list_url(blister_api_data["patient_one"]),
        payload(
            blister_api_data["medication_alt"],
            dose_instructions=plaintext,
        ),
        format="json",
    )
    line_id = response.json()["id"]

    with connection.cursor() as cursor:
        cursor.execute(
            (
                f"SELECT dose_instructions FROM {PatientMedication._meta.db_table} "
                "WHERE id = %s"
            ),
            [line_id],
        )
        (raw_dose_instructions,) = cursor.fetchone()

    assert response.status_code == 201
    assert response.json()["dose_instructions"] == plaintext
    assert raw_dose_instructions != plaintext
    assert plaintext not in raw_dose_instructions
    assert decrypt_str(raw_dose_instructions) == plaintext
