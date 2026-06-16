import pytest
from rest_framework.test import APIClient

from apps.audit.models import AuditAction, AuditEvent
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from .models import User

PASSWORD = "Initial-pass-123!"
NEW_PASSWORD = "New-strong-pass-123!"


@pytest.fixture
def client():
    return APIClient()


def make_user(email: str, *, full_name: str | None = None) -> User:
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        full_name=full_name or email.split("@")[0],
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


@pytest.fixture
def user_api_data():
    g1 = Group.objects.create(name="Group One", slug="users-group-one")
    g2 = Group.objects.create(name="Group Two", slug="users-group-two")
    p1 = Pharmacy.objects.create(group=g1, name="Pharmacy One", code="P1")
    p2 = Pharmacy.objects.create(group=g1, name="Pharmacy Two", code="P2")
    p3 = Pharmacy.objects.create(group=g2, name="Pharmacy Three", code="P3")

    admin = make_user("admin-users@example.com")
    pharmacist_p1 = make_user("pharmacist-p1@example.com")
    pharmacist_p2 = make_user("pharmacist-p2@example.com")
    dispenser_p1 = make_user("dispenser-p1@example.com")
    superintendent = make_user("superintendent-users@example.com")
    stock_employee = make_user("stock-users@example.com")
    user_p1 = make_user("ordinary-p1@example.com")
    user_p2 = make_user("ordinary-p2@example.com")
    user_p3 = make_user("ordinary-p3@example.com")

    add_membership(admin, Role.ADMIN)
    add_membership(pharmacist_p1, Role.PHARMACIST, pharmacy=p1)
    add_membership(pharmacist_p2, Role.PHARMACIST, pharmacy=p2)
    add_membership(dispenser_p1, Role.DISPENSER, pharmacy=p1)
    add_membership(superintendent, Role.SUPERINTENDENT, group=g1)
    add_membership(stock_employee, Role.STOCK_EMPLOYEE, group=g1, pharmacies=(p1, p2))
    add_membership(user_p1, Role.DISPENSER, pharmacy=p1)
    add_membership(user_p2, Role.DISPENSER, pharmacy=p2)
    add_membership(user_p3, Role.DISPENSER, pharmacy=p3)

    return {
        "g1": g1,
        "g2": g2,
        "p1": p1,
        "p2": p2,
        "p3": p3,
        "admin": admin,
        "pharmacist_p1": pharmacist_p1,
        "pharmacist_p2": pharmacist_p2,
        "dispenser_p1": dispenser_p1,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
        "user_p1": user_p1,
        "user_p2": user_p2,
        "user_p3": user_p3,
    }


def authenticate(client, user):
    client.force_login(user)


def response_text(response) -> str:
    return response.content.decode()


def assert_password_not_exposed(response, password: str):
    assert password not in response_text(response)


def assert_password_not_audited(event, password: str):
    values = [
        str(event.metadata),
        event.actor_email,
        event.actor_role,
        event.target_type,
        event.target_id,
        event.user_agent,
    ]
    assert all(password not in value for value in values)
    assert "password" not in str(event.metadata)


def ids_from_response(response):
    return {item["id"] for item in response.json()}


@pytest.mark.django_db
def test_admin_can_list_all_users(client, user_api_data):
    authenticate(client, user_api_data["admin"])

    response = client.get("/api/users/")

    assert response.status_code == 200
    assert ids_from_response(response) == {
        user_api_data["admin"].id,
        user_api_data["pharmacist_p1"].id,
        user_api_data["pharmacist_p2"].id,
        user_api_data["dispenser_p1"].id,
        user_api_data["superintendent"].id,
        user_api_data["stock_employee"].id,
        user_api_data["user_p1"].id,
        user_api_data["user_p2"].id,
        user_api_data["user_p3"].id,
    }


@pytest.mark.django_db
def test_admin_can_get_patch_deactivate_reset_and_delete_users(client, user_api_data):
    authenticate(client, user_api_data["admin"])
    target = user_api_data["user_p3"]

    detail = client.get(f"/api/users/{target.id}/")
    assert detail.status_code == 200
    assert detail.json()["email"] == target.email

    patch = client.patch(
        f"/api/users/{target.id}/",
        {"full_name": "Updated User"},
        format="json",
    )
    assert patch.status_code == 200
    target.refresh_from_db()
    assert target.full_name == "Updated User"

    reset = client.post(
        f"/api/users/{target.id}/reset-password/",
        {"new_password": NEW_PASSWORD},
        format="json",
    )
    assert reset.status_code == 200
    target.refresh_from_db()
    assert target.check_password(NEW_PASSWORD)

    deactivate = client.post(f"/api/users/{target.id}/deactivate/")
    assert deactivate.status_code == 200
    target.refresh_from_db()
    assert target.is_active is False

    delete_target = make_user("delete-target@example.com")
    add_membership(delete_target, Role.DISPENSER, pharmacy=user_api_data["p3"])
    delete = client.delete(f"/api/users/{delete_target.id}/")
    assert delete.status_code == 204
    assert not User.objects.filter(pk=delete_target.pk).exists()

    assert AuditEvent.objects.filter(action=AuditAction.PASSWORD_RESET).exists()
    assert AuditEvent.objects.filter(action=AuditAction.USER_DEACTIVATED).exists()
    assert AuditEvent.objects.filter(action=AuditAction.USER_DELETED).exists()


@pytest.mark.django_db
def test_admin_can_create_user_in_any_pharmacy(client, user_api_data):
    authenticate(client, user_api_data["admin"])

    response = client.post(
        "/api/users/",
        {
            "email": "created-admin@example.com",
            "full_name": "Created Admin",
            "password": NEW_PASSWORD,
            "role": Role.DISPENSER,
            "pharmacy_id": user_api_data["p3"].id,
        },
        format="json",
    )

    assert response.status_code == 201
    assert_password_not_exposed(response, NEW_PASSWORD)
    user = User.objects.get(email="created-admin@example.com")
    membership = user.memberships.get(is_active=True)
    assert membership.role == Role.DISPENSER
    assert membership.pharmacy == user_api_data["p3"]
    event = AuditEvent.objects.get(action=AuditAction.USER_CREATED)
    assert event.metadata == {
        "role": Role.DISPENSER,
        "pharmacy_id": user_api_data["p3"].id,
    }
    assert_password_not_audited(event, NEW_PASSWORD)


@pytest.mark.django_db
def test_duplicate_email_create_returns_validation_error(client, user_api_data):
    authenticate(client, user_api_data["admin"])
    existing_user = user_api_data["user_p1"]
    user_count = User.objects.count()
    membership_count = Membership.objects.count()

    response = client.post(
        "/api/users/",
        {
            "email": existing_user.email,
            "full_name": "Duplicate User",
            "password": NEW_PASSWORD,
            "role": Role.DISPENSER,
            "pharmacy_id": user_api_data["p1"].id,
        },
        format="json",
    )

    assert response.status_code == 400
    assert "email" in response.json()
    assert User.objects.count() == user_count
    assert Membership.objects.count() == membership_count
    assert not AuditEvent.objects.filter(action=AuditAction.USER_CREATED).exists()


@pytest.mark.django_db
def test_pharmacist_lists_only_own_pharmacy_users(client, user_api_data):
    authenticate(client, user_api_data["pharmacist_p1"])

    response = client.get("/api/users/")

    assert response.status_code == 200
    assert ids_from_response(response) == {
        user_api_data["pharmacist_p1"].id,
        user_api_data["dispenser_p1"].id,
        user_api_data["user_p1"].id,
    }


@pytest.mark.django_db
def test_pharmacist_can_manage_own_pharmacy_user(client, user_api_data):
    authenticate(client, user_api_data["pharmacist_p1"])
    target = user_api_data["user_p1"]

    assert client.get(f"/api/users/{target.id}/").status_code == 200
    patch = client.patch(
        f"/api/users/{target.id}/",
        {"full_name": "Own Pharmacy User"},
        format="json",
    )
    assert patch.status_code == 200
    target.refresh_from_db()
    assert target.full_name == "Own Pharmacy User"

    reset = client.post(
        f"/api/users/{target.id}/reset-password/",
        {"new_password": NEW_PASSWORD},
        format="json",
    )
    assert reset.status_code == 200
    target.refresh_from_db()
    assert target.check_password(NEW_PASSWORD)

    deactivate = client.post(f"/api/users/{target.id}/deactivate/")
    assert deactivate.status_code == 200
    target.refresh_from_db()
    assert target.is_active is False
    assert AuditEvent.objects.filter(action=AuditAction.PASSWORD_RESET).exists()
    assert AuditEvent.objects.filter(action=AuditAction.USER_DEACTIVATED).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.DISPENSER, Role.PHARMACIST])
def test_pharmacist_can_create_pharmacy_user(client, user_api_data, role):
    authenticate(client, user_api_data["pharmacist_p1"])

    response = client.post(
        "/api/users/",
        {
            "email": f"created-{role.lower()}@example.com",
            "full_name": "Created User",
            "password": NEW_PASSWORD,
            "role": role,
            "pharmacy_id": user_api_data["p1"].id,
        },
        format="json",
    )

    assert response.status_code == 201
    assert_password_not_exposed(response, NEW_PASSWORD)
    created = User.objects.get(email=f"created-{role.lower()}@example.com")
    memberships = list(created.memberships.filter(is_active=True))
    assert len(memberships) == 1
    assert memberships[0].role == role
    assert memberships[0].pharmacy == user_api_data["p1"]
    assert AuditEvent.objects.filter(action=AuditAction.USER_CREATED).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("method", "path_template"),
    [
        ("get", "/api/users/{id}/"),
        ("patch", "/api/users/{id}/"),
        ("post", "/api/users/{id}/deactivate/"),
        ("post", "/api/users/{id}/reset-password/"),
    ],
)
def test_pharmacist_cross_pharmacy_object_access_returns_404(
    client,
    user_api_data,
    method,
    path_template,
):
    authenticate(client, user_api_data["pharmacist_p1"])
    path = path_template.format(id=user_api_data["user_p2"].id)
    payload = {"full_name": "Nope"} if method == "patch" else {}
    if "reset-password" in path:
        payload = {"new_password": NEW_PASSWORD}

    response = getattr(client, method)(path, payload, format="json")

    assert response.status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload",
    [
        {"role": Role.DISPENSER, "pharmacy_key": "p2"},
        {"role": Role.ADMIN, "pharmacy_key": "p1"},
        {"role": Role.SUPERINTENDENT, "pharmacy_key": "p1"},
        {"role": Role.STOCK_EMPLOYEE, "pharmacy_key": "p1"},
    ],
)
def test_pharmacist_create_denials_return_403(client, user_api_data, payload):
    authenticate(client, user_api_data["pharmacist_p1"])

    response = client.post(
        "/api/users/",
        {
            "email": (
                f"denied-{payload['role'].lower()}-{payload['pharmacy_key']}@x.com"
            ),
            "full_name": "Denied User",
            "password": NEW_PASSWORD,
            "role": payload["role"],
            "pharmacy_id": user_api_data[payload["pharmacy_key"]].id,
        },
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_pharmacist_delete_any_user_returns_403(client, user_api_data):
    authenticate(client, user_api_data["pharmacist_p1"])

    response = client.delete(f"/api/users/{user_api_data['user_p1'].id}/")

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize(
    "actor_key", ["superintendent", "stock_employee", "dispenser_p1"]
)
@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("get", "/api/users/", None),
        ("post", "/api/users/", {"email": "x@example.com"}),
        ("get", "/api/users/{id}/", None),
        ("patch", "/api/users/{id}/", {"full_name": "Nope"}),
        ("post", "/api/users/{id}/deactivate/", None),
        ("post", "/api/users/{id}/reset-password/", {"new_password": NEW_PASSWORD}),
        ("delete", "/api/users/{id}/", None),
    ],
)
def test_non_user_management_roles_are_denied(
    client,
    user_api_data,
    actor_key,
    method,
    path,
    payload,
):
    authenticate(client, user_api_data[actor_key])
    path = path.format(id=user_api_data["user_p1"].id)

    response = getattr(client, method)(path, payload or {}, format="json")

    assert response.status_code == 403


@pytest.mark.django_db
def test_404_vs_403_semantics(client, user_api_data):
    authenticate(client, user_api_data["pharmacist_p1"])
    out_of_scope = client.get(f"/api/users/{user_api_data['user_p2'].id}/")
    assert out_of_scope.status_code == 404

    authenticate(client, user_api_data["superintendent"])
    missing_capability = client.get(f"/api/users/{user_api_data['user_p1'].id}/")
    assert missing_capability.status_code == 403


@pytest.mark.django_db
def test_reset_password_never_exposes_or_audits_password(client, user_api_data):
    authenticate(client, user_api_data["pharmacist_p1"])

    response = client.post(
        f"/api/users/{user_api_data['user_p1'].id}/reset-password/",
        {"new_password": NEW_PASSWORD},
        format="json",
    )

    assert response.status_code == 200
    assert_password_not_exposed(response, NEW_PASSWORD)
    event = AuditEvent.objects.get(action=AuditAction.PASSWORD_RESET)
    assert_password_not_audited(event, NEW_PASSWORD)


@pytest.mark.django_db
def test_self_deactivate_and_self_delete_are_blocked(client, user_api_data):
    authenticate(client, user_api_data["admin"])

    deactivate = client.post(f"/api/users/{user_api_data['admin'].id}/deactivate/")
    delete = client.delete(f"/api/users/{user_api_data['admin'].id}/")

    assert deactivate.status_code == 400
    assert delete.status_code == 400


@pytest.mark.django_db
def test_mutation_and_audit_roll_back_together(client, user_api_data, monkeypatch):
    authenticate(client, user_api_data["pharmacist_p1"])
    target = user_api_data["user_p1"]

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.accounts.user_views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.post(f"/api/users/{target.id}/deactivate/")

    target.refresh_from_db()
    assert target.is_active is True
    assert not AuditEvent.objects.filter(action=AuditAction.USER_DEACTIVATED).exists()
