from types import SimpleNamespace

import pytest
from django.contrib.auth.models import AnonymousUser

from apps.accounts.models import User

from .models import Group, Membership, Pharmacy, Role
from .permissions import (
    PATIENT_CLASS_ACTIONS,
    ROLE_CAPABILITIES,
    Action,
    IsActiveMember,
    can,
    require,
)
from .policy import AccessScope, get_active_membership, resolve_scope


@pytest.fixture
def user_factory():
    counter = 0

    def create_user(is_active: bool = True) -> User:
        nonlocal counter
        counter += 1
        return User.objects.create_user(
            f"policy-user-{counter}@example.com",
            "test-password",
            is_active=is_active,
        )

    return create_user


@pytest.fixture
def tenant_data():
    group_one = Group.objects.create(name="Group One", slug="group-one")
    group_two = Group.objects.create(name="Group Two", slug="group-two")
    p1 = Pharmacy.objects.create(group=group_one, name="Pharmacy 1", code="P1")
    p2 = Pharmacy.objects.create(group=group_one, name="Pharmacy 2", code="P2")
    p3 = Pharmacy.objects.create(group=group_one, name="Pharmacy 3", code="P3")
    p4 = Pharmacy.objects.create(group=group_two, name="Pharmacy 4", code="P4")
    return SimpleNamespace(
        group_one=group_one,
        group_two=group_two,
        p1=p1,
        p2=p2,
        p3=p3,
        p4=p4,
    )


def make_membership(user, role, *, group=None, pharmacy=None, pharmacies=()):
    membership = Membership.objects.create(
        user=user,
        role=role,
        group=group,
        pharmacy=pharmacy,
    )
    if pharmacies:
        membership.pharmacies.add(*pharmacies)
    return membership


@pytest.mark.django_db
def test_get_active_membership_returns_single_active_membership(
    user_factory,
    tenant_data,
):
    user = user_factory()
    membership = make_membership(user, Role.ADMIN)

    assert get_active_membership(user) == membership


@pytest.mark.django_db
def test_admin_scope_is_global(user_factory):
    user = user_factory()
    make_membership(user, Role.ADMIN)

    assert resolve_scope(user) == AccessScope(True, frozenset(), frozenset())


@pytest.mark.django_db
def test_superintendent_scope_includes_group_and_all_group_pharmacies(
    user_factory,
    tenant_data,
):
    user = user_factory()
    make_membership(user, Role.SUPERINTENDENT, group=tenant_data.group_one)

    scope = resolve_scope(user)

    assert scope.is_global is False
    assert scope.group_ids == frozenset({tenant_data.group_one.id})
    assert scope.pharmacy_ids == frozenset(
        {tenant_data.p1.id, tenant_data.p2.id, tenant_data.p3.id}
    )


@pytest.mark.django_db
def test_stock_employee_scope_includes_selected_pharmacies_only(
    user_factory,
    tenant_data,
):
    user = user_factory()
    make_membership(
        user,
        Role.STOCK_EMPLOYEE,
        group=tenant_data.group_one,
        pharmacies=(tenant_data.p1, tenant_data.p2),
    )

    scope = resolve_scope(user)

    assert scope.group_ids == frozenset()
    assert scope.pharmacy_ids == frozenset({tenant_data.p1.id, tenant_data.p2.id})
    assert tenant_data.p3.id not in scope.pharmacy_ids


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.PHARMACIST, Role.DISPENSER])
def test_pharmacy_scoped_roles_include_own_pharmacy_only(
    user_factory,
    tenant_data,
    role,
):
    user = user_factory()
    make_membership(user, role, pharmacy=tenant_data.p1)

    scope = resolve_scope(user)

    assert scope.group_ids == frozenset()
    assert scope.pharmacy_ids == frozenset({tenant_data.p1.id})


@pytest.mark.django_db
def test_denied_users_resolve_to_empty_scope(user_factory):
    inactive_user = user_factory(is_active=False)
    no_membership_user = user_factory()

    for user in [None, AnonymousUser(), inactive_user, no_membership_user]:
        assert resolve_scope(user) == AccessScope(False, frozenset(), frozenset())


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("role", "action", "expected"),
    [
        (Role.ADMIN, Action.USER_DELETE, True),
        (Role.SUPERINTENDENT, Action.PATIENT_VIEW, False),
        (Role.SUPERINTENDENT, Action.BLISTER_MARK_PREPARED, False),
        (Role.SUPERINTENDENT, Action.USER_CREATE, False),
        (Role.STOCK_EMPLOYEE, Action.PATIENT_VIEW, False),
        (Role.STOCK_EMPLOYEE, Action.BLISTER_MARK_PREPARED, False),
        (Role.STOCK_EMPLOYEE, Action.USER_CREATE, False),
        (Role.PHARMACIST, Action.BLISTER_MARK_PREPARED, True),
        (Role.PHARMACIST, Action.USER_DELETE, False),
        (Role.DISPENSER, Action.BLISTER_MARK_PREPARED, False),
        (Role.DISPENSER, Action.PATIENT_MANAGE, False),
        (Role.DISPENSER, Action.BLISTER_MANAGE, False),
    ],
)
def test_permission_matrix(user_factory, tenant_data, role, action, expected):
    user = user_factory()
    if role == Role.ADMIN:
        make_membership(user, role)
    elif role in {Role.SUPERINTENDENT, Role.STOCK_EMPLOYEE}:
        make_membership(user, role, group=tenant_data.group_one)
    else:
        make_membership(user, role, pharmacy=tenant_data.p1)

    assert can(user, action) is expected


def test_patient_class_actions_are_not_available_to_group_stock_roles():
    assert ROLE_CAPABILITIES[Role.SUPERINTENDENT] & PATIENT_CLASS_ACTIONS == frozenset()
    assert ROLE_CAPABILITIES[Role.STOCK_EMPLOYEE] & PATIENT_CLASS_ACTIONS == frozenset()


@pytest.mark.django_db
def test_can_denies_users_without_active_membership(user_factory):
    inactive_user = user_factory(is_active=False)
    no_membership_user = user_factory()

    for user in [AnonymousUser(), inactive_user, no_membership_user]:
        for action in Action:
            assert can(user, action) is False


@pytest.mark.django_db
def test_is_active_member_permission(user_factory):
    inactive_user = user_factory(is_active=False)
    active_user = user_factory()
    make_membership(active_user, Role.ADMIN)
    permission = IsActiveMember()

    assert permission.has_permission(SimpleNamespace(user=active_user), None) is True
    assert permission.has_permission(SimpleNamespace(user=inactive_user), None) is False
    assert (
        permission.has_permission(SimpleNamespace(user=AnonymousUser()), None) is False
    )


@pytest.mark.django_db
def test_require_permission_helper(user_factory, tenant_data):
    user = user_factory()
    make_membership(user, Role.STOCK_EMPLOYEE, group=tenant_data.group_one)
    permission = require(Action.STOCK_VIEW)()

    assert permission.has_permission(SimpleNamespace(user=user), None) is True


@pytest.mark.django_db
def test_require_permission_helper_checks_object_scope(user_factory, tenant_data):
    user = user_factory()
    make_membership(
        user,
        Role.STOCK_EMPLOYEE,
        group=tenant_data.group_one,
        pharmacies=(tenant_data.p1,),
    )
    permission = require(Action.STOCK_VIEW)()

    assert (
        permission.has_object_permission(
            SimpleNamespace(user=user), None, tenant_data.p1
        )
        is True
    )
    assert (
        permission.has_object_permission(
            SimpleNamespace(user=user), None, tenant_data.p3
        )
        is False
    )
