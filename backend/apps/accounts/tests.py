"""Auth, JWT and RBAC tests."""
from datetime import date

import pytest


@pytest.mark.django_db
def test_login_returns_tokens_and_user(api, users):
    res = api.post("/api/auth/login/", {"username": "pharm", "password": "Password123!"}, format="json")
    assert res.status_code == 200
    assert "access" in res.data and "refresh" in res.data
    assert res.data["user"]["role"] == "pharmacist"


@pytest.mark.django_db
def test_login_rejects_bad_password(api, users):
    res = api.post("/api/auth/login/", {"username": "pharm", "password": "wrong"}, format="json")
    assert res.status_code == 401


@pytest.mark.django_db
def test_protected_endpoint_requires_auth(api):
    assert api.get("/api/patients/").status_code == 401


@pytest.mark.django_db
def test_dispenser_cannot_create_medicine(auth):
    client = auth("dispenser")
    res = client.post("/api/medicines/", {"name": "X", "strength": "1mg", "form": "tablet"}, format="json")
    assert res.status_code == 403


@pytest.mark.django_db
def test_pharmacist_can_create_medicine(auth):
    client = auth("pharmacist")
    res = client.post("/api/medicines/", {"name": "X", "strength": "1mg", "form": "tablet"}, format="json")
    assert res.status_code == 201


@pytest.mark.django_db
def test_only_admin_lists_users(auth):
    assert auth("dispenser").get("/api/users/").status_code == 403
    assert auth("administrator").get("/api/users/").status_code == 200


@pytest.mark.django_db
def test_login_writes_audit_entry(api, users):
    from apps.core.models import AuditLog
    api.post("/api/auth/login/", {"username": "admin", "password": "Password123!"}, format="json")
    assert AuditLog.objects.filter(action="login").exists()


@pytest.mark.django_db
def test_patient_audit_entry_attributes_jwt_actor(auth, users):
    from apps.core.models import AuditLog

    response = auth("pharmacist").post(
        "/api/patients/",
        {
            "patient_id": "PT-AUDIT",
            "first_name": "Audit",
            "last_name": "Test",
            "date_of_birth": date(1950, 1, 1),
        },
        format="json",
    )

    assert response.status_code == 201
    entry = AuditLog.objects.get(
        action="create",
        entity="patients.Patient",
        entity_id=str(response.data["id"]),
    )
    assert entry.actor == users["pharmacist"]
    assert entry.actor_label == users["pharmacist"].username
