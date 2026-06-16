import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditAction, AuditEvent

from .models import Group, Membership, Pharmacy, Role
from .permissions import ROLE_CAPABILITIES, Action

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


@pytest.fixture
def tenancy_api_data():
    group_one = Group.objects.create(name="Group One", slug="tenancy-group-one")
    group_two = Group.objects.create(name="Group Two", slug="tenancy-group-two")
    pharmacy_one = Pharmacy.objects.create(
        group=group_one,
        name="Pharmacy One",
        code="P1",
        address="1 Test Street",
        postcode="TE1 1ST",
    )
    pharmacy_two = Pharmacy.objects.create(
        group=group_two,
        name="Pharmacy Two",
        code="P2",
    )

    admin = make_user("tenancy-admin@example.com")
    pharmacist = make_user("tenancy-pharmacist@example.com")
    superintendent = make_user("tenancy-superintendent@example.com")
    stock_employee = make_user("tenancy-stock@example.com")
    dispenser = make_user("tenancy-dispenser@example.com")

    add_membership(admin, Role.ADMIN)
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy_one)
    add_membership(superintendent, Role.SUPERINTENDENT, group=group_one)
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group_one,
        pharmacies=(pharmacy_one,),
    )
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy_one)

    return {
        "group_one": group_one,
        "group_two": group_two,
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "admin": admin,
        "pharmacist": pharmacist,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
        "dispenser": dispenser,
    }


def authenticate(client, user):
    client.force_login(user)


def ids_from_response(response):
    return {item["id"] for item in response.json()}


def assert_metadata_is_safe(event):
    serialized_metadata = str(event.metadata).lower()
    assert "password" not in serialized_metadata
    assert "patient" not in serialized_metadata


@pytest.mark.django_db
def test_admin_can_list_create_retrieve_and_update_groups(client, tenancy_api_data):
    authenticate(client, tenancy_api_data["admin"])

    list_response = client.get("/api/tenancy/groups/")
    assert list_response.status_code == 200
    assert ids_from_response(list_response) == {
        tenancy_api_data["group_one"].id,
        tenancy_api_data["group_two"].id,
    }

    create_response = client.post(
        "/api/tenancy/groups/",
        {"name": "Created Group", "slug": "created-group"},
        format="json",
    )
    assert create_response.status_code == 201
    created = Group.objects.get(slug="created-group")
    assert create_response.json()["id"] == created.id

    detail_response = client.get(f"/api/tenancy/groups/{created.id}/")
    assert detail_response.status_code == 200
    assert detail_response.json()["slug"] == "created-group"

    update_response = client.patch(
        f"/api/tenancy/groups/{created.id}/",
        {"name": "Updated Group", "is_active": False},
        format="json",
    )
    assert update_response.status_code == 200
    created.refresh_from_db()
    assert created.name == "Updated Group"
    assert created.is_active is False

    created_event = AuditEvent.objects.get(action=AuditAction.GROUP_CREATED)
    updated_event = AuditEvent.objects.get(action=AuditAction.GROUP_UPDATED)
    assert created_event.metadata == {
        "name": "Created Group",
        "slug": "created-group",
    }
    assert updated_event.metadata == {
        "name": "Updated Group",
        "slug": "created-group",
        "is_active": False,
    }
    assert_metadata_is_safe(created_event)
    assert_metadata_is_safe(updated_event)


@pytest.mark.django_db
def test_admin_can_list_create_retrieve_and_update_pharmacies(client, tenancy_api_data):
    authenticate(client, tenancy_api_data["admin"])
    group = tenancy_api_data["group_one"]

    list_response = client.get("/api/tenancy/pharmacies/")
    assert list_response.status_code == 200
    assert ids_from_response(list_response) == {
        tenancy_api_data["pharmacy_one"].id,
        tenancy_api_data["pharmacy_two"].id,
    }

    create_response = client.post(
        "/api/tenancy/pharmacies/",
        {
            "group": group.id,
            "name": "Created Pharmacy",
            "code": "CP1",
            "address": "2 Test Street",
            "postcode": "TE2 2ST",
        },
        format="json",
    )
    assert create_response.status_code == 201
    created = Pharmacy.objects.get(group=group, code="CP1")
    assert create_response.json()["id"] == created.id

    detail_response = client.get(f"/api/tenancy/pharmacies/{created.id}/")
    assert detail_response.status_code == 200
    assert detail_response.json()["code"] == "CP1"

    update_response = client.patch(
        f"/api/tenancy/pharmacies/{created.id}/",
        {"name": "Updated Pharmacy", "is_active": False},
        format="json",
    )
    assert update_response.status_code == 200
    created.refresh_from_db()
    assert created.name == "Updated Pharmacy"
    assert created.is_active is False

    created_event = AuditEvent.objects.get(action=AuditAction.PHARMACY_CREATED)
    updated_event = AuditEvent.objects.get(action=AuditAction.PHARMACY_UPDATED)
    assert created_event.metadata == {
        "group_id": group.id,
        "name": "Created Pharmacy",
        "code": "CP1",
    }
    assert updated_event.metadata == {
        "group_id": group.id,
        "name": "Updated Pharmacy",
        "code": "CP1",
        "is_active": False,
    }
    assert_metadata_is_safe(created_event)
    assert_metadata_is_safe(updated_event)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "actor_key",
    ["pharmacist", "superintendent", "stock_employee", "dispenser"],
)
@pytest.mark.parametrize(
    ("method", "path_template", "payload"),
    [
        ("get", "/api/tenancy/groups/", None),
        ("post", "/api/tenancy/groups/", {"name": "Denied", "slug": "denied"}),
        ("get", "/api/tenancy/groups/{group_id}/", None),
        ("patch", "/api/tenancy/groups/{group_id}/", {"name": "Denied"}),
        ("get", "/api/tenancy/pharmacies/", None),
        (
            "post",
            "/api/tenancy/pharmacies/",
            {"group": "group_id", "name": "Denied", "code": "DENIED"},
        ),
        ("get", "/api/tenancy/pharmacies/{pharmacy_id}/", None),
        ("patch", "/api/tenancy/pharmacies/{pharmacy_id}/", {"name": "Denied"}),
    ],
)
def test_non_admin_roles_are_denied_tenancy_management(
    client,
    tenancy_api_data,
    actor_key,
    method,
    path_template,
    payload,
):
    authenticate(client, tenancy_api_data[actor_key])
    group_id = tenancy_api_data["group_one"].id
    pharmacy_id = tenancy_api_data["pharmacy_one"].id
    path = path_template.format(group_id=group_id, pharmacy_id=pharmacy_id)
    request_payload = payload or {}
    if request_payload.get("group") == "group_id":
        request_payload = {**request_payload, "group": group_id}

    response = getattr(client, method)(path, request_payload, format="json")

    assert response.status_code == 403


@pytest.mark.django_db
def test_group_and_pharmacy_validation_errors_are_clean(client, tenancy_api_data):
    authenticate(client, tenancy_api_data["admin"])
    group = tenancy_api_data["group_one"]
    pharmacy = tenancy_api_data["pharmacy_one"]

    missing_group = client.post(
        "/api/tenancy/pharmacies/",
        {"name": "Missing Group", "code": "MG"},
        format="json",
    )
    duplicate_slug = client.post(
        "/api/tenancy/groups/",
        {"name": "Duplicate Slug", "slug": group.slug},
        format="json",
    )
    invalid_group = client.post(
        "/api/tenancy/pharmacies/",
        {"group": 999999, "name": "Invalid Group", "code": "IG"},
        format="json",
    )
    duplicate_code = client.post(
        "/api/tenancy/pharmacies/",
        {"group": group.id, "name": "Duplicate Code", "code": pharmacy.code},
        format="json",
    )

    assert missing_group.status_code == 400
    assert "group" in missing_group.json()
    assert duplicate_slug.status_code == 400
    assert "slug" in duplicate_slug.json()
    assert invalid_group.status_code == 400
    assert "group" in invalid_group.json()
    assert duplicate_code.status_code == 400
    assert "code" in duplicate_code.json()


@pytest.mark.django_db
def test_group_create_rolls_back_when_audit_recording_fails(
    client,
    tenancy_api_data,
    monkeypatch,
):
    authenticate(client, tenancy_api_data["admin"])

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.tenancy.views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.post(
            "/api/tenancy/groups/",
            {"name": "Rollback Group", "slug": "rollback-group"},
            format="json",
        )

    assert not Group.objects.filter(slug="rollback-group").exists()
    assert not AuditEvent.objects.filter(action=AuditAction.GROUP_CREATED).exists()


@pytest.mark.django_db
def test_pharmacy_create_rolls_back_when_audit_recording_fails(
    client,
    tenancy_api_data,
    monkeypatch,
):
    authenticate(client, tenancy_api_data["admin"])
    group = tenancy_api_data["group_one"]

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.tenancy.views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.post(
            "/api/tenancy/pharmacies/",
            {"group": group.id, "name": "Rollback Pharmacy", "code": "ROLLBACK"},
            format="json",
        )

    assert not Pharmacy.objects.filter(group=group, code="ROLLBACK").exists()
    assert not AuditEvent.objects.filter(action=AuditAction.PHARMACY_CREATED).exists()


def test_tenancy_management_capabilities_do_not_leak_to_non_admin_roles():
    tenancy_management_actions = {
        Action.GROUP_MANAGE,
        Action.PHARMACY_MANAGE,
    }

    for role in [
        Role.PHARMACIST,
        Role.SUPERINTENDENT,
        Role.STOCK_EMPLOYEE,
        Role.DISPENSER,
    ]:
        assert ROLE_CAPABILITIES[role] & tenancy_management_actions == frozenset()
