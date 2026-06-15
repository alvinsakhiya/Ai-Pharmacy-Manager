from types import SimpleNamespace

import pytest

from apps.accounts.models import User

from .models import Group, Membership, Pharmacy, Role


@pytest.fixture
def scoped_tenant_data():
    group_one = Group.objects.create(name="Group One", slug="scoped-group-one")
    group_two = Group.objects.create(name="Group Two", slug="scoped-group-two")
    p1 = Pharmacy.objects.create(group=group_one, name="Pharmacy 1", code="P1")
    p2 = Pharmacy.objects.create(group=group_one, name="Pharmacy 2", code="P2")
    p3 = Pharmacy.objects.create(group=group_one, name="Pharmacy 3", code="P3")
    p4 = Pharmacy.objects.create(group=group_two, name="Pharmacy 4", code="P4")

    admin = User.objects.create_user("admin-scope@example.com", "test-password")
    superintendent = User.objects.create_user(
        "superintendent-scope@example.com",
        "test-password",
    )
    stock_employee = User.objects.create_user(
        "stock-scope@example.com",
        "test-password",
    )
    pharmacist = User.objects.create_user(
        "pharmacist-scope@example.com", "test-password"
    )
    dispenser = User.objects.create_user("dispenser-scope@example.com", "test-password")
    no_membership = User.objects.create_user(
        "no-membership-scope@example.com",
        "test-password",
    )

    Membership.objects.create(user=admin, role=Role.ADMIN)
    Membership.objects.create(
        user=superintendent,
        role=Role.SUPERINTENDENT,
        group=group_one,
    )
    stock_membership = Membership.objects.create(
        user=stock_employee,
        role=Role.STOCK_EMPLOYEE,
        group=group_one,
    )
    stock_membership.pharmacies.add(p1, p2)
    Membership.objects.create(user=pharmacist, role=Role.PHARMACIST, pharmacy=p1)
    Membership.objects.create(user=dispenser, role=Role.DISPENSER, pharmacy=p3)

    return SimpleNamespace(
        group_one=group_one,
        group_two=group_two,
        p1=p1,
        p2=p2,
        p3=p3,
        p4=p4,
        admin=admin,
        superintendent=superintendent,
        stock_employee=stock_employee,
        pharmacist=pharmacist,
        dispenser=dispenser,
        no_membership=no_membership,
    )


def pharmacy_ids_for(user):
    return set(Pharmacy.scoped.for_user(user).values_list("id", flat=True))


def group_ids_for(user):
    return set(Group.scoped.for_user(user).values_list("id", flat=True))


@pytest.mark.django_db
def test_pharmacy_scoping(scoped_tenant_data):
    data = scoped_tenant_data

    assert pharmacy_ids_for(data.admin) == {
        data.p1.id,
        data.p2.id,
        data.p3.id,
        data.p4.id,
    }
    assert pharmacy_ids_for(data.superintendent) == {
        data.p1.id,
        data.p2.id,
        data.p3.id,
    }
    assert pharmacy_ids_for(data.stock_employee) == {data.p1.id, data.p2.id}
    assert data.p3.id not in pharmacy_ids_for(data.stock_employee)
    assert pharmacy_ids_for(data.pharmacist) == {data.p1.id}
    assert pharmacy_ids_for(data.dispenser) == {data.p3.id}
    assert pharmacy_ids_for(data.no_membership) == set()


@pytest.mark.django_db
def test_group_scoping(scoped_tenant_data):
    data = scoped_tenant_data

    assert group_ids_for(data.admin) == {data.group_one.id, data.group_two.id}
    assert group_ids_for(data.superintendent) == {data.group_one.id}
    assert group_ids_for(data.stock_employee) == set()
    assert group_ids_for(data.pharmacist) == set()
    assert group_ids_for(data.dispenser) == set()
    assert group_ids_for(data.no_membership) == set()
