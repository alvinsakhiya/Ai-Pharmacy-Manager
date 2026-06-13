"""Patient access, search and audit tests."""
from datetime import date

import pytest

from apps.patients.models import Patient


@pytest.fixture
def searchable_patient(db):
    return Patient.objects.create(
        patient_id="PT-SEARCH",
        first_name="Alex",
        last_name="Morgan",
        date_of_birth=date(1960, 5, 12),
        postcode="LE1 2AB",
        gp_practice="Central Medical Centre",
    )


@pytest.mark.django_db
def test_only_admin_can_list_all_patients(auth, searchable_patient):
    assert auth("dispenser").get("/api/patients/").status_code == 403
    assert auth("pharmacist").get("/api/patients/").status_code == 403
    assert auth("administrator").get("/api/patients/").status_code == 200


@pytest.mark.django_db
def test_all_roles_can_use_limited_patient_search(auth, searchable_patient):
    for role in ("dispenser", "pharmacist", "administrator"):
        response = auth(role).get("/api/patients/search/?q=Morgan")
        assert response.status_code == 200
        assert response.data[0]["patient_id"] == searchable_patient.patient_id
        assert "phone" not in response.data[0]
        assert "address_line" not in response.data[0]


@pytest.mark.django_db
def test_patient_search_requires_meaningful_query(auth, searchable_patient):
    response = auth("dispenser").get("/api/patients/search/?q=A")
    assert response.status_code == 400


@pytest.mark.django_db
def test_patient_records_cannot_be_deleted_through_api(auth, searchable_patient):
    response = auth("administrator").delete(
        f"/api/patients/{searchable_patient.id}/"
    )
    assert response.status_code == 405
    assert Patient.objects.filter(pk=searchable_patient.pk).exists()
