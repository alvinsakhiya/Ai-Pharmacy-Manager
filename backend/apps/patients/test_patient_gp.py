from datetime import date

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.tenancy.models import Group, Pharmacy, Role

from .crypto import decrypt_str
from .models import Patient
from .test_patient_notes import add_membership, make_user


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def gp_data():
    group = Group.objects.create(name="GP Group", slug="gp-group")
    pharmacy = Pharmacy.objects.create(group=group, name="GP Pharmacy", code="GPP")
    other_group = Group.objects.create(name="GP Other", slug="gp-other")
    other_pharmacy = Pharmacy.objects.create(
        group=other_group, name="GP Other Pharmacy", code="GPO"
    )

    patient = Patient.objects.create(
        pharmacy=pharmacy,
        patient_reference="GP-001",
        title="Mrs",
        first_name="Margaret",
        last_name="Hayes",
        date_of_birth=date(1951, 4, 2),
        gender="Female",
        address="3 Elm Road",
        postcode="EL1 2RD",
        phone="020 0000 0202",
        email="margaret@example.com",
    )
    other_patient = Patient.objects.create(
        pharmacy=other_pharmacy,
        patient_reference="GPO-001",
        first_name="Outside",
        last_name="Patient",
        date_of_birth=date(1970, 1, 1),
    )

    pharmacist = make_user("gp-pharmacist@example.com")
    dispenser = make_user("gp-dispenser@example.com")
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy)
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy)

    return {
        "patient": patient,
        "other_patient": other_patient,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
    }


def gp_url(patient: Patient) -> str:
    return f"/api/patients/{patient.id}/gp/"


@pytest.mark.django_db
def test_new_patient_fields_round_trip_and_are_encrypted(gp_data):
    patient = gp_data["patient"]
    patient.refresh_from_db()
    assert patient.title == "Mrs"
    assert patient.gender == "Female"
    assert patient.email == "margaret@example.com"

    with connection.cursor() as cursor:
        cursor.execute(
            f"SELECT title, gender, email FROM {Patient._meta.db_table} WHERE id = %s",
            [patient.id],
        )
        raw_title, raw_gender, raw_email = cursor.fetchone()

    assert raw_title != "Mrs"
    assert decrypt_str(raw_title) == "Mrs"
    assert decrypt_str(raw_gender) == "Female"
    assert decrypt_str(raw_email) == "margaret@example.com"


@pytest.mark.django_db
def test_patient_detail_exposes_new_fields_and_gp(client, gp_data):
    client.force_login(gp_data["pharmacist"])
    response = client.get(f"/api/patients/{gp_data['patient'].id}/")
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Mrs"
    assert body["gender"] == "Female"
    assert body["email"] == "margaret@example.com"
    # No GP record yet -> gp is null.
    assert body["gp"] is None


@pytest.mark.django_db
def test_gp_get_returns_empty_defaults(client, gp_data):
    client.force_login(gp_data["dispenser"])
    response = client.get(gp_url(gp_data["patient"]))
    assert response.status_code == 200
    assert response.json()["doctor_name"] == ""


@pytest.mark.django_db
def test_pharmacist_can_update_gp(client, gp_data):
    client.force_login(gp_data["pharmacist"])
    response = client.put(
        gp_url(gp_data["patient"]),
        {
            "doctor_name": "Dr A Khan",
            "practice_name": "Elm Surgery",
            "practice_postcode": "EL1 3SG",
            "practice_phone": "020 0000 0303",
        },
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["doctor_name"] == "Dr A Khan"

    # Persisted and exposed on the patient detail.
    detail = client.get(f"/api/patients/{gp_data['patient'].id}/").json()
    assert detail["gp"]["practice_name"] == "Elm Surgery"


@pytest.mark.django_db
def test_dispenser_cannot_update_gp(client, gp_data):
    client.force_login(gp_data["dispenser"])
    response = client.put(
        gp_url(gp_data["patient"]),
        {"doctor_name": "Dr Nope"},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_cross_pharmacy_gp_access_returns_not_found(client, gp_data):
    client.force_login(gp_data["pharmacist"])
    response = client.get(gp_url(gp_data["other_patient"]))
    assert response.status_code == 404


@pytest.mark.django_db
def test_unauthenticated_gp_access_is_denied(client, gp_data):
    response = client.get(gp_url(gp_data["patient"]))
    assert response.status_code in (401, 403)
