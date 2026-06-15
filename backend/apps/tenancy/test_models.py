import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.accounts.models import User

from .models import Group, Membership, Pharmacy, Role


@pytest.fixture
def user_factory():
    counter = 0

    def create_user(email: str | None = None) -> User:
        nonlocal counter
        counter += 1
        return User.objects.create_user(
            email or f"user{counter}@example.com",
            "test-password",
        )

    return create_user


@pytest.fixture
def group_factory():
    counter = 0

    def create_group(slug: str | None = None) -> Group:
        nonlocal counter
        counter += 1
        value = slug or f"group-{counter}"
        return Group.objects.create(name=f"Group {counter}", slug=value)

    return create_group


@pytest.fixture
def pharmacy_factory(group_factory):
    counter = 0

    def create_pharmacy(
        group: Group | None = None,
        code: str | None = None,
    ) -> Pharmacy:
        nonlocal counter
        counter += 1
        return Pharmacy.objects.create(
            group=group or group_factory(),
            name=f"Pharmacy {counter}",
            code=code or f"PH{counter}",
        )

    return create_pharmacy


@pytest.mark.django_db
def test_group_slug_must_be_unique(group_factory):
    group_factory(slug="shared")

    with pytest.raises(IntegrityError), transaction.atomic():
        group_factory(slug="shared")


@pytest.mark.django_db
def test_pharmacy_code_can_repeat_across_groups(group_factory, pharmacy_factory):
    pharmacy_factory(group=group_factory(), code="ABC")
    pharmacy = pharmacy_factory(group=group_factory(), code="ABC")

    assert pharmacy.code == "ABC"


@pytest.mark.django_db
def test_pharmacy_code_must_be_unique_within_group(group_factory, pharmacy_factory):
    group = group_factory()
    pharmacy_factory(group=group, code="ABC")

    with pytest.raises(IntegrityError), transaction.atomic():
        pharmacy_factory(group=group, code="ABC")


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("role", "scope"),
    [
        (Role.ADMIN, "none"),
        (Role.SUPERINTENDENT, "group"),
        (Role.STOCK_EMPLOYEE, "group"),
        (Role.PHARMACIST, "pharmacy"),
        (Role.DISPENSER, "pharmacy"),
    ],
)
def test_valid_memberships_pass_validation_and_save(
    user_factory,
    group_factory,
    pharmacy_factory,
    role,
    scope,
):
    group = group_factory()
    pharmacy = pharmacy_factory(group=group)
    membership = Membership(user=user_factory(), role=role)

    if scope == "group":
        membership.group = group
    elif scope == "pharmacy":
        membership.pharmacy = pharmacy

    membership.full_clean()
    membership.save()

    assert membership.pk is not None


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("role", "scope"),
    [
        (Role.ADMIN, "group"),
        (Role.SUPERINTENDENT, "pharmacy"),
        (Role.SUPERINTENDENT, "none"),
        (Role.STOCK_EMPLOYEE, "none"),
        (Role.PHARMACIST, "none"),
        (Role.PHARMACIST, "group"),
        (Role.DISPENSER, "group"),
    ],
)
def test_invalid_memberships_fail_model_validation(
    user_factory,
    group_factory,
    pharmacy_factory,
    role,
    scope,
):
    group = group_factory()
    pharmacy = pharmacy_factory(group=group)
    membership = Membership(user=user_factory(), role=role)

    if scope == "group":
        membership.group = group
    elif scope == "pharmacy":
        membership.pharmacy = pharmacy

    with pytest.raises(ValidationError):
        membership.full_clean()


@pytest.mark.django_db
def test_second_active_membership_for_same_user_is_blocked(
    user_factory,
    group_factory,
):
    user = user_factory()
    Membership.objects.create(
        user=user, role=Role.SUPERINTENDENT, group=group_factory()
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        Membership.objects.create(
            user=user,
            role=Role.SUPERINTENDENT,
            group=group_factory(),
        )


@pytest.mark.django_db
def test_second_inactive_membership_for_same_user_is_allowed(
    user_factory,
    group_factory,
):
    user = user_factory()
    Membership.objects.create(
        user=user,
        role=Role.SUPERINTENDENT,
        group=group_factory(),
        is_active=False,
    )
    second = Membership.objects.create(
        user=user,
        role=Role.SUPERINTENDENT,
        group=group_factory(),
        is_active=False,
    )

    assert second.pk is not None


@pytest.mark.django_db
def test_invalid_role_scope_is_blocked_by_database_constraint(
    user_factory,
    group_factory,
):
    with pytest.raises(IntegrityError), transaction.atomic():
        Membership.objects.create(
            user=user_factory(), role=Role.ADMIN, group=group_factory()
        )


@pytest.mark.django_db
def test_stock_employee_can_add_same_group_pharmacy(
    user_factory,
    group_factory,
    pharmacy_factory,
):
    group = group_factory()
    pharmacy = pharmacy_factory(group=group)
    membership = Membership.objects.create(
        user=user_factory(),
        role=Role.STOCK_EMPLOYEE,
        group=group,
    )

    membership.pharmacies.add(pharmacy)

    assert list(membership.pharmacies.all()) == [pharmacy]


@pytest.mark.django_db
def test_stock_employee_cannot_add_different_group_pharmacy(
    user_factory,
    group_factory,
    pharmacy_factory,
):
    membership = Membership.objects.create(
        user=user_factory(),
        role=Role.STOCK_EMPLOYEE,
        group=group_factory(),
    )
    other_pharmacy = pharmacy_factory(group=group_factory())

    with pytest.raises(ValidationError):
        membership.pharmacies.add(other_pharmacy)


@pytest.mark.django_db
def test_non_stock_employee_cannot_add_selected_pharmacies(
    user_factory,
    pharmacy_factory,
):
    pharmacy = pharmacy_factory()
    membership = Membership.objects.create(
        user=user_factory(),
        role=Role.PHARMACIST,
        pharmacy=pharmacy,
    )

    with pytest.raises(ValidationError):
        membership.pharmacies.add(pharmacy)
