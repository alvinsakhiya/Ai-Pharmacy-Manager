from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from .models import AuditAction, AuditEvent

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


def make_event(action, *, group=None, pharmacy=None, created_at=None) -> AuditEvent:
    event = AuditEvent.objects.create(
        action=action,
        actor_email=f"{action.lower()}@example.com",
        actor_role=Role.ADMIN,
        group=group,
        pharmacy=pharmacy,
        target_type="test",
        target_id=str(pharmacy.pk if pharmacy is not None else group.pk),
        metadata={"action": action},
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    if created_at is not None:
        AuditEvent.objects.filter(pk=event.pk).update(created_at=created_at)
        event.created_at = created_at
    return event


@pytest.fixture
def audit_api_data():
    group_one = Group.objects.create(name="Audit Group One", slug="audit-group-one")
    group_two = Group.objects.create(name="Audit Group Two", slug="audit-group-two")
    pharmacy_one = Pharmacy.objects.create(
        group=group_one,
        name="Audit Pharmacy One",
        code="AP1",
    )
    pharmacy_two = Pharmacy.objects.create(
        group=group_two,
        name="Audit Pharmacy Two",
        code="AP2",
    )

    admin = make_user("audit-admin@example.com")
    pharmacist = make_user("audit-pharmacist@example.com")
    superintendent = make_user("audit-superintendent@example.com")
    stock_employee = make_user("audit-stock@example.com")
    dispenser = make_user("audit-dispenser@example.com")

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

    now = timezone.now()
    oldest_group_event = make_event(
        AuditAction.GROUP_UPDATED,
        group=group_one,
        created_at=now - timedelta(minutes=4),
    )
    other_pharmacy_event = make_event(
        AuditAction.PHARMACY_CREATED,
        group=group_two,
        pharmacy=pharmacy_two,
        created_at=now - timedelta(minutes=3),
    )
    own_old_event = make_event(
        AuditAction.USER_CREATED,
        group=group_one,
        pharmacy=pharmacy_one,
        created_at=now - timedelta(minutes=2),
    )
    own_new_event = make_event(
        AuditAction.PASSWORD_RESET,
        group=group_one,
        pharmacy=pharmacy_one,
        created_at=now - timedelta(minutes=1),
    )

    return {
        "admin": admin,
        "pharmacist": pharmacist,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
        "dispenser": dispenser,
        "oldest_group_event": oldest_group_event,
        "other_pharmacy_event": other_pharmacy_event,
        "own_old_event": own_old_event,
        "own_new_event": own_new_event,
    }


def authenticate(client, user):
    client.force_authenticate(user=user)


def result_ids(response):
    return [item["id"] for item in response.json()["results"]]


@pytest.mark.django_db
def test_admin_can_list_all_audit_events(client, audit_api_data):
    authenticate(client, audit_api_data["admin"])

    response = client.get("/api/audit/")

    assert response.status_code == 200
    assert set(result_ids(response)) == {
        audit_api_data["oldest_group_event"].id,
        audit_api_data["other_pharmacy_event"].id,
        audit_api_data["own_old_event"].id,
        audit_api_data["own_new_event"].id,
    }


@pytest.mark.django_db
def test_pharmacist_sees_only_own_pharmacy_audit_events(client, audit_api_data):
    authenticate(client, audit_api_data["pharmacist"])

    response = client.get("/api/audit/")

    assert response.status_code == 200
    assert set(result_ids(response)) == {
        audit_api_data["own_old_event"].id,
        audit_api_data["own_new_event"].id,
    }
    assert audit_api_data["other_pharmacy_event"].id not in result_ids(response)


@pytest.mark.django_db
def test_superintendent_gets_empty_audit_results(client, audit_api_data):
    authenticate(client, audit_api_data["superintendent"])

    response = client.get("/api/audit/")

    assert response.status_code == 200
    assert response.json()["count"] == 0
    assert response.json()["results"] == []


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["stock_employee", "dispenser"])
def test_roles_without_audit_view_are_denied(client, audit_api_data, actor_key):
    authenticate(client, audit_api_data[actor_key])

    response = client.get("/api/audit/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_unauthenticated_user_is_denied(client):
    response = client.get("/api/audit/")

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_audit_endpoint_is_read_only(client, audit_api_data, method):
    authenticate(client, audit_api_data["admin"])

    response = getattr(client, method)("/api/audit/", {}, format="json")

    assert response.status_code == 405


@pytest.mark.django_db
def test_audit_list_is_paginated_and_newest_first(client, audit_api_data):
    authenticate(client, audit_api_data["admin"])

    response = client.get("/api/audit/?page_size=2")

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"count", "next", "previous", "results"}
    assert payload["count"] == 4
    assert len(payload["results"]) == 2
    assert result_ids(response) == [
        audit_api_data["own_new_event"].id,
        audit_api_data["own_old_event"].id,
    ]


@pytest.mark.django_db
def test_audit_list_can_filter_by_valid_action(client, audit_api_data):
    authenticate(client, audit_api_data["admin"])

    response = client.get(f"/api/audit/?action={AuditAction.USER_CREATED}")

    assert response.status_code == 200
    assert result_ids(response) == [audit_api_data["own_old_event"].id]


@pytest.mark.django_db
def test_invalid_action_filter_is_ignored(client, audit_api_data):
    authenticate(client, audit_api_data["admin"])

    response = client.get("/api/audit/?action=NOT_A_REAL_ACTION")

    assert response.status_code == 200
    assert response.json()["count"] == 4
