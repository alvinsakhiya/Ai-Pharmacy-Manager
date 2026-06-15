import pytest
from django.contrib.auth.models import AnonymousUser
from django.db import transaction
from django.test import RequestFactory

from apps.accounts.models import User
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from .models import AuditAction, AuditEvent
from .services import record


@pytest.fixture
def user() -> User:
    return User.objects.create_user("audit-user@example.com", "test-password")


@pytest.fixture
def group() -> Group:
    return Group.objects.create(name="Audit Group", slug="audit-group")


@pytest.fixture
def pharmacy(group) -> Pharmacy:
    return Pharmacy.objects.create(group=group, name="Audit Pharmacy", code="AUD")


@pytest.mark.django_db
def test_record_creates_audit_event():
    event = record(action=AuditAction.LOGIN)

    assert event.pk is not None
    assert event.action == AuditAction.LOGIN


@pytest.mark.django_db
def test_record_snapshots_actor_email_and_role(user, group):
    Membership.objects.create(user=user, role=Role.SUPERINTENDENT, group=group)

    event = record(action=AuditAction.LOGIN, actor=user)

    assert event.actor == user
    assert event.actor_email == user.email
    assert event.actor_role == Role.SUPERINTENDENT


@pytest.mark.django_db
def test_record_stores_explicit_group_and_pharmacy(user, group, pharmacy):
    Membership.objects.create(user=user, role=Role.ADMIN)

    event = record(
        action=AuditAction.USER_CREATED,
        actor=user,
        group=group,
        pharmacy=pharmacy,
    )

    assert event.group == group
    assert event.pharmacy == pharmacy


@pytest.mark.django_db
def test_record_derives_group_from_active_membership(user, group):
    Membership.objects.create(user=user, role=Role.SUPERINTENDENT, group=group)

    event = record(action=AuditAction.LOGIN, actor=user)

    assert event.group == group
    assert event.pharmacy is None


@pytest.mark.django_db
def test_record_derives_pharmacy_from_active_membership(user, pharmacy):
    Membership.objects.create(user=user, role=Role.PHARMACIST, pharmacy=pharmacy)

    event = record(action=AuditAction.LOGIN, actor=user)

    assert event.group is None
    assert event.pharmacy == pharmacy


@pytest.mark.django_db
@pytest.mark.parametrize("actor", [None, AnonymousUser()])
def test_record_with_anonymous_or_none_actor(actor):
    event = record(action=AuditAction.LOGIN_FAILED, actor=actor)

    assert event.actor is None
    assert event.actor_email == ""
    assert event.actor_role == ""


@pytest.mark.django_db
def test_record_with_inactive_actor_has_no_actor_snapshot():
    inactive_user = User.objects.create_user(
        "inactive-audit@example.com",
        "test-password",
        is_active=False,
    )

    event = record(action=AuditAction.LOGIN, actor=inactive_user)

    assert event.actor is None
    assert event.actor_email == ""
    assert event.actor_role == ""


@pytest.mark.django_db
def test_record_target_snapshot(user):
    event = record(action=AuditAction.USER_DEACTIVATED, target=user)

    assert event.target_type == "User"
    assert event.target_id == str(user.pk)


@pytest.mark.django_db
def test_record_stores_metadata():
    event = record(
        action=AuditAction.LOGIN_FAILED,
        metadata={"email": "person@example.com"},
    )

    assert event.metadata == {"email": "person@example.com"}


@pytest.mark.django_db
def test_record_metadata_defaults_to_empty_dict():
    event = record(action=AuditAction.LOGIN)

    assert event.metadata == {}


@pytest.mark.django_db
def test_record_captures_request_ip_and_user_agent():
    request = RequestFactory().get(
        "/",
        REMOTE_ADDR="127.0.0.1",
        HTTP_USER_AGENT="Audit test browser",
    )

    event = record(action=AuditAction.LOGIN_FAILED, request=request)

    assert event.ip_address == "127.0.0.1"
    assert event.user_agent == "Audit test browser"


@pytest.mark.django_db
def test_record_participates_in_caller_transaction():
    with pytest.raises(RuntimeError, match="rollback"):
        with transaction.atomic():
            record(action=AuditAction.LOGIN)
            raise RuntimeError("rollback")

    assert AuditEvent.objects.count() == 0
