import pytest
from rest_framework.test import APIClient

from apps.audit.models import AuditAction, AuditEvent
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from .models import User

PASSWORD = "Initial-pass-123!"


@pytest.fixture
def client():
    return APIClient()


def make_user(email: str) -> User:
    return User.objects.create_user(email=email, password=PASSWORD)


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
def membership_api_data():
    g1 = Group.objects.create(name="Group One", slug="membership-group-one")
    g2 = Group.objects.create(name="Group Two", slug="membership-group-two")
    p1 = Pharmacy.objects.create(group=g1, name="Pharmacy One", code="M-P1")
    p2 = Pharmacy.objects.create(group=g1, name="Pharmacy Two", code="M-P2")
    p3 = Pharmacy.objects.create(group=g2, name="Pharmacy Three", code="M-P3")

    admin = make_user("membership-admin@example.com")
    pharmacist_p1 = make_user("membership-pharmacist-p1@example.com")
    pharmacist_p2 = make_user("membership-pharmacist-p2@example.com")
    dispenser_p1 = make_user("membership-dispenser-p1@example.com")
    dispenser_p2 = make_user("membership-dispenser-p2@example.com")
    superintendent = make_user("membership-superintendent@example.com")
    stock_employee = make_user("membership-stock@example.com")
    target_p1 = make_user("membership-target-p1@example.com")
    target_p2 = make_user("membership-target-p2@example.com")

    add_membership(admin, Role.ADMIN)
    add_membership(pharmacist_p1, Role.PHARMACIST, pharmacy=p1)
    add_membership(pharmacist_p2, Role.PHARMACIST, pharmacy=p2)
    add_membership(dispenser_p1, Role.DISPENSER, pharmacy=p1)
    add_membership(dispenser_p2, Role.DISPENSER, pharmacy=p2)
    add_membership(superintendent, Role.SUPERINTENDENT, group=g1)
    add_membership(stock_employee, Role.STOCK_EMPLOYEE, group=g1, pharmacies=(p1, p2))
    add_membership(target_p1, Role.DISPENSER, pharmacy=p1)
    add_membership(target_p2, Role.DISPENSER, pharmacy=p2)

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
        "dispenser_p2": dispenser_p2,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
        "target_p1": target_p1,
        "target_p2": target_p2,
    }


def authenticate(client, user):
    client.force_login(user)


def assign_membership(client, user, payload):
    return client.post(
        f"/api/users/{user.id}/assign-membership/",
        payload,
        format="json",
    )


def active_memberships(user):
    return list(user.memberships.filter(is_active=True))


def inactive_memberships(user):
    return list(user.memberships.filter(is_active=False))


def assert_one_active_membership(user, role):
    memberships = active_memberships(user)
    assert len(memberships) == 1
    assert memberships[0].role == role
    return memberships[0]


def assert_audit_has_no_sensitive_data(event):
    assert "password" not in str(event.metadata).lower()
    assert "patient" not in str(event.metadata).lower()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("target_key", "payload", "expected_role"),
    [
        (
            "target_p1",
            {"role": Role.PHARMACIST, "pharmacy_id": "p1"},
            Role.PHARMACIST,
        ),
        (
            "pharmacist_p1",
            {"role": Role.SUPERINTENDENT, "group_id": "g1"},
            Role.SUPERINTENDENT,
        ),
        (
            "target_p1",
            {
                "role": Role.STOCK_EMPLOYEE,
                "group_id": "g1",
                "pharmacy_ids": ["p1", "p2"],
            },
            Role.STOCK_EMPLOYEE,
        ),
        ("target_p1", {"role": Role.ADMIN}, Role.ADMIN),
        ("target_p1", {"role": Role.DISPENSER, "pharmacy_id": "p1"}, Role.DISPENSER),
    ],
)
def test_admin_can_reassign_membership(
    client,
    membership_api_data,
    target_key,
    payload,
    expected_role,
):
    authenticate(client, membership_api_data["admin"])
    target = membership_api_data[target_key]
    resolved_payload = {
        key: membership_api_data[value].id if key.endswith("_id") else value
        for key, value in payload.items()
        if key != "pharmacy_ids"
    }
    if "pharmacy_ids" in payload:
        resolved_payload["pharmacy_ids"] = [
            membership_api_data[value].id for value in payload["pharmacy_ids"]
        ]

    response = assign_membership(client, target, resolved_payload)

    assert response.status_code == 200
    assert response.json()["role"] == expected_role
    new_membership = assert_one_active_membership(target, expected_role)
    assert len(inactive_memberships(target)) == 1
    if expected_role == Role.STOCK_EMPLOYEE:
        assert set(new_membership.pharmacies.values_list("id", flat=True)) == {
            membership_api_data["p1"].id,
            membership_api_data["p2"].id,
        }
    event = AuditEvent.objects.get(action=AuditAction.ROLE_ASSIGNED)
    assert event.metadata["new_role"] == expected_role
    assert "old_role" in event.metadata
    assert "new_pharmacy_ids" in event.metadata
    assert_audit_has_no_sensitive_data(event)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload",
    [
        {"role": Role.SUPERINTENDENT},
        {"role": Role.PHARMACIST},
        {"role": Role.ADMIN, "pharmacy_id": "p1"},
        {"role": Role.STOCK_EMPLOYEE, "group_id": "g1", "pharmacy_ids": ["p3"]},
    ],
)
def test_invalid_admin_reassignment_returns_400_and_preserves_membership(
    client,
    membership_api_data,
    payload,
):
    authenticate(client, membership_api_data["admin"])
    target = membership_api_data["target_p1"]
    old_active = target.memberships.get(is_active=True)
    resolved_payload = {
        key: membership_api_data[value].id if key.endswith("_id") else value
        for key, value in payload.items()
        if key != "pharmacy_ids"
    }
    if "pharmacy_ids" in payload:
        resolved_payload["pharmacy_ids"] = [
            membership_api_data[value].id for value in payload["pharmacy_ids"]
        ]

    response = assign_membership(client, target, resolved_payload)

    assert response.status_code == 400
    assert active_memberships(target) == [old_active]
    assert not AuditEvent.objects.filter(action=AuditAction.ROLE_ASSIGNED).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.PHARMACIST, Role.DISPENSER])
def test_pharmacist_can_reassign_own_pharmacy_user(
    client,
    membership_api_data,
    role,
):
    authenticate(client, membership_api_data["pharmacist_p1"])
    target = membership_api_data["target_p1"]

    response = assign_membership(
        client,
        target,
        {"role": role, "pharmacy_id": membership_api_data["p1"].id},
    )

    assert response.status_code == 200
    membership = assert_one_active_membership(target, role)
    assert membership.pharmacy == membership_api_data["p1"]
    assert AuditEvent.objects.filter(action=AuditAction.ROLE_ASSIGNED).exists()


@pytest.mark.django_db
def test_pharmacist_cross_pharmacy_target_returns_404(client, membership_api_data):
    authenticate(client, membership_api_data["pharmacist_p1"])

    response = assign_membership(
        client,
        membership_api_data["target_p2"],
        {"role": Role.DISPENSER, "pharmacy_id": membership_api_data["p1"].id},
    )

    assert response.status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload",
    [
        {"role": Role.ADMIN},
        {"role": Role.SUPERINTENDENT, "group_id": "g1"},
        {"role": Role.STOCK_EMPLOYEE, "group_id": "g1", "pharmacy_ids": ["p1"]},
        {"role": Role.DISPENSER, "pharmacy_id": "p2"},
    ],
)
def test_pharmacist_escalation_and_other_pharmacy_assignment_are_blocked(
    client,
    membership_api_data,
    payload,
):
    authenticate(client, membership_api_data["pharmacist_p1"])
    resolved_payload = {
        key: membership_api_data[value].id if key.endswith("_id") else value
        for key, value in payload.items()
        if key != "pharmacy_ids"
    }
    if "pharmacy_ids" in payload:
        resolved_payload["pharmacy_ids"] = [
            membership_api_data[value].id for value in payload["pharmacy_ids"]
        ]

    response = assign_membership(
        client,
        membership_api_data["target_p1"],
        resolved_payload,
    )

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize(
    "actor_key", ["superintendent", "stock_employee", "dispenser_p1"]
)
def test_other_roles_are_denied(client, membership_api_data, actor_key):
    authenticate(client, membership_api_data[actor_key])

    response = assign_membership(
        client,
        membership_api_data["target_p1"],
        {"role": Role.DISPENSER, "pharmacy_id": membership_api_data["p1"].id},
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_self_reassignment_is_blocked(client, membership_api_data):
    authenticate(client, membership_api_data["admin"])

    response = assign_membership(
        client, membership_api_data["admin"], {"role": Role.ADMIN}
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_404_vs_403_semantics(client, membership_api_data):
    authenticate(client, membership_api_data["pharmacist_p1"])
    out_of_scope = assign_membership(
        client,
        membership_api_data["target_p2"],
        {"role": Role.DISPENSER, "pharmacy_id": membership_api_data["p1"].id},
    )
    assert out_of_scope.status_code == 404

    authenticate(client, membership_api_data["superintendent"])
    missing_capability = assign_membership(
        client,
        membership_api_data["target_p1"],
        {"role": Role.DISPENSER, "pharmacy_id": membership_api_data["p1"].id},
    )
    assert missing_capability.status_code == 403


@pytest.mark.django_db
def test_failed_reassignment_rolls_back_old_membership(
    client, membership_api_data, monkeypatch
):
    authenticate(client, membership_api_data["admin"])
    target = membership_api_data["target_p1"]
    old_active = target.memberships.get(is_active=True)

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.accounts.services.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        assign_membership(
            client,
            target,
            {"role": Role.PHARMACIST, "pharmacy_id": membership_api_data["p1"].id},
        )

    old_active.refresh_from_db()
    assert old_active.is_active is True
    assert active_memberships(target) == [old_active]
    assert not AuditEvent.objects.filter(action=AuditAction.ROLE_ASSIGNED).exists()
