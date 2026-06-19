import io

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from apps.accounts.models import User
from apps.audit.models import AuditEvent
from apps.catalogue.models import Medication, MedicationForm
from apps.tenancy.models import Group, Membership, Pharmacy, Role

DEMO_PASSWORD = "DemoPass!2026"
DEMO_EMAILS = [
    "admin@demo.local",
    "superintendent@demo.local",
    "pharmacist@demo.local",
    "dispenser@demo.local",
    "stock@demo.local",
]


def run_seed_demo(**options) -> str:
    stdout = io.StringIO()
    call_command("seed_demo", stdout=stdout, **options)
    return stdout.getvalue()


def get_demo_group() -> Group:
    return Group.objects.get(slug="jmw-pharmacy-group")


def get_demo_user(email: str) -> User:
    return User.objects.get(email=email)


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_seed_demo_creates_expected_demo_data():
    output = run_seed_demo()

    group = get_demo_group()
    assert group.name == "JMW Pharmacy Group"
    assert group.is_active is True

    pharmacies = Pharmacy.objects.filter(group=group)
    assert pharmacies.count() == 3
    assert set(pharmacies.values_list("code", flat=True)) == {"SUT", "CRO", "WIM"}
    assert set(pharmacies.values_list("name", flat=True)) == {
        "JMW Sutton",
        "JMW Croydon",
        "JMW Wimbledon",
    }
    medications = Medication.objects.filter(group=group)
    assert medications.count() == 5
    assert set(medications.values_list("name", "form", "strength")) == {
        ("Paracetamol", MedicationForm.TABLET, "500 mg"),
        ("Ibuprofen", MedicationForm.TABLET, "200 mg"),
        ("Amlodipine", MedicationForm.TABLET, "5 mg"),
        ("Metformin", MedicationForm.TABLET, "500 mg"),
        ("Salbutamol", MedicationForm.INHALER, "100 micrograms/dose"),
    }

    demo_users = User.objects.filter(email__in=DEMO_EMAILS)
    assert demo_users.count() == 5
    assert (
        Membership.objects.filter(user__email__in=DEMO_EMAILS, is_active=True).count()
        == 5
    )
    assert "local demo credentials only" in output
    assert DEMO_PASSWORD in output
    assert AuditEvent.objects.count() == 0


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_seed_demo_sets_demo_user_credentials_and_statuses():
    run_seed_demo()

    for email in DEMO_EMAILS:
        user = get_demo_user(email)
        assert user.check_password(DEMO_PASSWORD) is True
        assert user.must_change_password is False
        assert user.is_active is True
        assert user.is_superuser is False


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_seed_demo_sets_correct_memberships_and_scopes():
    run_seed_demo()

    group = get_demo_group()
    sutton = Pharmacy.objects.get(group=group, code="SUT")
    croydon = Pharmacy.objects.get(group=group, code="CRO")

    admin_membership = get_demo_user("admin@demo.local").memberships.get(is_active=True)
    assert admin_membership.role == Role.ADMIN
    assert admin_membership.group is None
    assert admin_membership.pharmacy is None

    superintendent_membership = get_demo_user(
        "superintendent@demo.local"
    ).memberships.get(is_active=True)
    assert superintendent_membership.role == Role.SUPERINTENDENT
    assert superintendent_membership.group == group
    assert superintendent_membership.pharmacy is None

    pharmacist_membership = get_demo_user("pharmacist@demo.local").memberships.get(
        is_active=True
    )
    assert pharmacist_membership.role == Role.PHARMACIST
    assert pharmacist_membership.group is None
    assert pharmacist_membership.pharmacy == sutton

    dispenser_membership = get_demo_user("dispenser@demo.local").memberships.get(
        is_active=True
    )
    assert dispenser_membership.role == Role.DISPENSER
    assert dispenser_membership.group is None
    assert dispenser_membership.pharmacy == croydon

    stock_membership = get_demo_user("stock@demo.local").memberships.get(is_active=True)
    assert stock_membership.role == Role.STOCK_EMPLOYEE
    assert stock_membership.group == group
    assert stock_membership.pharmacy is None
    assert set(stock_membership.pharmacies.all()) == {sutton, croydon}
    assert all(
        pharmacy.group == group for pharmacy in stock_membership.pharmacies.all()
    )


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_seed_demo_is_idempotent_and_restores_known_credentials():
    run_seed_demo()
    admin = get_demo_user("admin@demo.local")
    admin.set_password("ChangedPass!2026")
    admin.must_change_password = True
    admin.is_active = False
    admin.save()

    first_counts = {
        "groups": Group.objects.filter(slug="jmw-pharmacy-group").count(),
        "pharmacies": Pharmacy.objects.filter(group=get_demo_group()).count(),
        "medications": Medication.objects.filter(group=get_demo_group()).count(),
        "users": User.objects.filter(email__in=DEMO_EMAILS).count(),
        "memberships": Membership.objects.filter(
            user__email__in=DEMO_EMAILS,
            is_active=True,
        ).count(),
    }

    run_seed_demo()

    assert (
        Group.objects.filter(slug="jmw-pharmacy-group").count()
        == first_counts["groups"]
    )
    assert (
        Pharmacy.objects.filter(group=get_demo_group()).count()
        == first_counts["pharmacies"]
    )
    assert (
        Medication.objects.filter(group=get_demo_group()).count()
        == first_counts["medications"]
    )
    assert User.objects.filter(email__in=DEMO_EMAILS).count() == first_counts["users"]
    assert (
        Membership.objects.filter(user__email__in=DEMO_EMAILS, is_active=True).count()
        == first_counts["memberships"]
    )
    admin.refresh_from_db()
    assert admin.check_password(DEMO_PASSWORD) is True
    assert admin.must_change_password is False
    assert admin.is_active is True


@pytest.mark.django_db
def test_seed_demo_is_dev_gated_unless_forced():
    with override_settings(DEBUG=False), pytest.raises(CommandError):
        run_seed_demo()

    with override_settings(DEBUG=False):
        run_seed_demo(force=True)

    assert Group.objects.filter(slug="jmw-pharmacy-group").exists()
