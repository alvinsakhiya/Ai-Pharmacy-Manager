import pytest
from rest_framework.test import APIClient

from apps.audit.models import AuditAction, AuditEvent
from apps.tenancy.models import Group, Membership, Pharmacy, Role
from apps.tenancy.permissions import Action

from .models import User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def tenant_data():
    group = Group.objects.create(name="Auth Group", slug="auth-group")
    other_group = Group.objects.create(name="Other Group", slug="other-auth-group")
    pharmacy = Pharmacy.objects.create(group=group, name="Auth Pharmacy", code="AUTH")
    second_pharmacy = Pharmacy.objects.create(
        group=group,
        name="Second Pharmacy",
        code="AUTH2",
    )
    other_pharmacy = Pharmacy.objects.create(
        group=other_group,
        name="Other Pharmacy",
        code="OTHER",
    )
    return {
        "group": group,
        "other_group": other_group,
        "pharmacy": pharmacy,
        "second_pharmacy": second_pharmacy,
        "other_pharmacy": other_pharmacy,
    }


def create_user(
    email: str = "auth-user@example.com",
    password: str = "Initial-pass-123!",
    *,
    full_name: str = "Auth User",
    is_active: bool = True,
    must_change_password: bool = True,
) -> User:
    return User.objects.create_user(
        email=email,
        password=password,
        full_name=full_name,
        is_active=is_active,
        must_change_password=must_change_password,
    )


def create_membership(user, role, tenant_data):
    if role == Role.ADMIN:
        return Membership.objects.create(user=user, role=role)
    if role in {Role.SUPERINTENDENT, Role.STOCK_EMPLOYEE}:
        membership = Membership.objects.create(
            user=user,
            role=role,
            group=tenant_data["group"],
        )
        if role == Role.STOCK_EMPLOYEE:
            membership.pharmacies.add(tenant_data["pharmacy"])
        return membership
    return Membership.objects.create(
        user=user,
        role=role,
        pharmacy=tenant_data["pharmacy"],
    )


def login(client, email: str, password: str):
    return client.post(
        "/api/auth/login/",
        {"email": email, "password": password},
        format="json",
    )


def force_session(client, user):
    client.force_login(user)


def assert_password_not_stored(event, password: str):
    stored_values = [
        str(event.metadata),
        event.actor_email,
        event.actor_role,
        event.target_type,
        event.target_id,
        event.user_agent,
    ]
    assert all(password not in value for value in stored_values)
    assert "password" not in str(event.metadata)


@pytest.mark.django_db
def test_csrf_endpoint_sets_cookie(api_client):
    response = api_client.get("/api/auth/csrf/")

    assert response.status_code == 200
    assert response.json() == {"detail": "CSRF cookie set"}
    assert "csrftoken" in response.cookies


@pytest.mark.django_db
def test_login_success_returns_me_payload_and_writes_audit(api_client, tenant_data):
    password = "Initial-pass-123!"
    user = create_user(password=password)
    create_membership(user, Role.PHARMACIST, tenant_data)

    response = login(api_client, user.email, password)

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == user.id
    assert payload["email"] == user.email
    assert payload["full_name"] == user.full_name
    assert payload["must_change_password"] is True
    assert payload["role"] == Role.PHARMACIST
    assert payload["scope"]["is_global"] is False
    assert payload["scope"]["pharmacy_ids"] == [tenant_data["pharmacy"].id]
    assert payload["pharmacies"] == [
        {"id": tenant_data["pharmacy"].id, "name": tenant_data["pharmacy"].name}
    ]
    assert payload["permissions"][Action.PATIENT_VIEW.value] is True
    assert payload["permissions"][Action.USER_DELETE.value] is False
    assert "_auth_user_id" in api_client.session

    event = AuditEvent.objects.get(action=AuditAction.LOGIN)
    assert event.actor == user


@pytest.mark.django_db
def test_login_failure_is_generic_and_writes_safe_audit(api_client):
    password = "Initial-pass-123!"
    user = create_user(password=password)
    wrong_password = "secret-wrong-password"

    response = login(api_client, user.email, wrong_password)

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid credentials."}
    assert "_auth_user_id" not in api_client.session

    event = AuditEvent.objects.get(action=AuditAction.LOGIN_FAILED)
    assert event.metadata == {"email": user.email}
    assert_password_not_stored(event, wrong_password)


@pytest.mark.django_db
def test_inactive_user_cannot_log_in(api_client):
    password = "Initial-pass-123!"
    user = create_user(password=password, is_active=False)

    response = login(api_client, user.email, password)

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid credentials."}
    assert "_auth_user_id" not in api_client.session


@pytest.mark.django_db
def test_logout_clears_session_and_writes_audit(api_client, tenant_data):
    password = "Initial-pass-123!"
    user = create_user(password=password)
    create_membership(user, Role.ADMIN, tenant_data)
    force_session(api_client, user)

    response = api_client.post("/api/auth/logout/")

    assert response.status_code == 200
    assert response.json() == {"detail": "Logged out."}
    assert AuditEvent.objects.filter(action=AuditAction.LOGOUT).exists()
    assert "_auth_user_id" not in api_client.session
    assert api_client.get("/api/auth/me/").status_code in {403, 401}


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("role", "patient_view", "user_delete"),
    [
        (Role.ADMIN, True, True),
        (Role.SUPERINTENDENT, False, False),
        (Role.PHARMACIST, True, False),
        (Role.DISPENSER, True, False),
    ],
)
def test_me_payload_role_permissions(
    api_client,
    tenant_data,
    role,
    patient_view,
    user_delete,
):
    password = "Initial-pass-123!"
    user = create_user(email=f"{role.lower()}@example.com", password=password)
    create_membership(user, role, tenant_data)
    force_session(api_client, user)

    response = api_client.get("/api/auth/me/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["role"] == role
    assert payload["permissions"][Action.PATIENT_VIEW.value] is patient_view
    assert payload["permissions"][Action.USER_DELETE.value] is user_delete


@pytest.mark.django_db
def test_membershipless_user_can_log_in_with_empty_scope(api_client):
    password = "Initial-pass-123!"
    user = create_user(password=password)

    response = login(api_client, user.email, password)

    assert response.status_code == 200
    payload = response.json()
    assert payload["role"] is None
    assert payload["scope"] == {
        "is_global": False,
        "group_ids": [],
        "pharmacy_ids": [],
    }
    assert payload["pharmacies"] == []
    assert all(value is False for value in payload["permissions"].values())


@pytest.mark.django_db
def test_unauthenticated_me_is_denied(api_client):
    assert api_client.get("/api/auth/me/").status_code in {403, 401}


@pytest.mark.django_db
def test_password_change_success_keeps_session_and_writes_audit(
    api_client, tenant_data
):
    old_password = "Initial-pass-123!"
    new_password = "New-strong-pass-123!"
    user = create_user(password=old_password, must_change_password=True)
    create_membership(user, Role.PHARMACIST, tenant_data)
    force_session(api_client, user)

    response = api_client.post(
        "/api/auth/password/change/",
        {"old_password": old_password, "new_password": new_password},
        format="json",
    )

    assert response.status_code == 200
    assert response.json() == {"detail": "Password changed."}
    user.refresh_from_db()
    assert user.check_password(old_password) is False
    assert user.check_password(new_password) is True
    assert user.must_change_password is False
    event = AuditEvent.objects.get(action=AuditAction.PASSWORD_CHANGED)
    assert event.actor == user
    assert event.metadata == {}
    assert_password_not_stored(event, old_password)
    assert_password_not_stored(event, new_password)
    assert api_client.get("/api/auth/me/").status_code == 200


@pytest.mark.django_db
def test_password_change_wrong_old_password_does_not_change_password(
    api_client,
    tenant_data,
):
    old_password = "Initial-pass-123!"
    user = create_user(password=old_password, must_change_password=True)
    create_membership(user, Role.PHARMACIST, tenant_data)
    force_session(api_client, user)

    response = api_client.post(
        "/api/auth/password/change/",
        {"old_password": "wrong-password", "new_password": "New-strong-pass-123!"},
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Current password is incorrect."}
    user.refresh_from_db()
    assert user.check_password(old_password) is True
    assert user.must_change_password is True
    assert not AuditEvent.objects.filter(action=AuditAction.PASSWORD_CHANGED).exists()


@pytest.mark.django_db
def test_password_change_weak_new_password_does_not_change_password(
    api_client,
    tenant_data,
):
    old_password = "Initial-pass-123!"
    user = create_user(password=old_password)
    create_membership(user, Role.PHARMACIST, tenant_data)
    force_session(api_client, user)

    response = api_client.post(
        "/api/auth/password/change/",
        {"old_password": old_password, "new_password": "short"},
        format="json",
    )

    assert response.status_code == 400
    user.refresh_from_db()
    assert user.check_password(old_password) is True
    assert not AuditEvent.objects.filter(action=AuditAction.PASSWORD_CHANGED).exists()


@pytest.mark.django_db
def test_password_change_enforces_csrf(tenant_data):
    client = APIClient(enforce_csrf_checks=True)
    old_password = "Initial-pass-123!"
    new_password = "New-strong-pass-123!"
    user = create_user(password=old_password)
    create_membership(user, Role.PHARMACIST, tenant_data)
    csrf_response = client.get("/api/auth/csrf/")
    csrf_token = csrf_response.cookies["csrftoken"].value
    assert client.login(username=user.email, password=old_password) is True

    missing_token_response = client.post(
        "/api/auth/password/change/",
        {"old_password": old_password, "new_password": new_password},
        format="json",
    )
    assert missing_token_response.status_code == 403

    success_response = client.post(
        "/api/auth/password/change/",
        {"old_password": old_password, "new_password": new_password},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )
    assert success_response.status_code == 200
