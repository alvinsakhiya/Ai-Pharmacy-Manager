import io
from datetime import date

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from apps.accounts.models import User
from apps.audit.models import AuditEvent
from apps.blister.models import (
    DosetteCycle,
    DosettePeriod,
    DosettePeriodStatus,
    PatientMedication,
)
from apps.catalogue.models import Medication, MedicationForm
from apps.inventory.models import StockBatch, StockItem
from apps.patients.models import Patient
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


def run_reset_demo(**options) -> str:
    stdout = io.StringIO()
    call_command("reset_demo_data", stdout=stdout, **options)
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

    sutton = Pharmacy.objects.get(group=group, code="SUT")
    croydon = Pharmacy.objects.get(group=group, code="CRO")
    wimbledon = Pharmacy.objects.get(group=group, code="WIM")
    assert StockItem.objects.filter(pharmacy=sutton).count() == 5
    assert StockItem.objects.filter(pharmacy=croydon).count() == 5
    assert StockItem.objects.filter(pharmacy=wimbledon).count() == 5
    assert StockBatch.objects.filter(stock_item__pharmacy=sutton).count() == 5
    assert StockBatch.objects.filter(stock_item__pharmacy=croydon).count() == 5
    assert StockBatch.objects.filter(stock_item__pharmacy=wimbledon).count() == 5
    assert Patient.objects.filter(pharmacy=sutton).count() == 4
    assert Patient.objects.filter(pharmacy=croydon).count() == 3
    assert Patient.objects.filter(pharmacy=wimbledon).count() == 3
    assert set(Patient.objects.values_list("patient_reference", flat=True)) == {
        "SUT-P1",
        "SUT-P2",
        "SUT-P3",
        "SUT-P4",
        "CRO-P1",
        "CRO-P2",
        "CRO-P3",
        "WIM-P1",
        "WIM-P2",
        "WIM-P3",
    }
    assert set(Patient.objects.values_list("collection_method", flat=True)) == {
        Patient.CollectionMethod.IN_STORE,
        Patient.CollectionMethod.DELIVERY,
    }

    assert "local demo credentials only" in output
    assert "Patients:" in output
    assert "Dosette/MDS:" in output
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
    for email in DEMO_EMAILS:
        user = get_demo_user(email)
        user.set_password("ChangedPass!2026")
        user.must_change_password = True
        user.is_active = False
        user.save()

    first_counts = {
        "groups": Group.objects.filter(slug="jmw-pharmacy-group").count(),
        "pharmacies": Pharmacy.objects.filter(group=get_demo_group()).count(),
        "medications": Medication.objects.filter(group=get_demo_group()).count(),
        "stock_items": StockItem.objects.filter(
            pharmacy__group=get_demo_group(),
        ).count(),
        "stock_batches": StockBatch.objects.filter(
            stock_item__pharmacy__group=get_demo_group(),
        ).count(),
        "patients": Patient.objects.filter(pharmacy__group=get_demo_group()).count(),
        "patient_medications": PatientMedication.objects.filter(
            patient__pharmacy__group=get_demo_group(),
        ).count(),
        "dosette_cycles": DosetteCycle.objects.filter(
            patient__pharmacy__group=get_demo_group(),
        ).count(),
        "dosette_periods": DosettePeriod.objects.filter(
            patient__pharmacy__group=get_demo_group(),
        ).count(),
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
    assert (
        StockItem.objects.filter(pharmacy__group=get_demo_group()).count()
        == first_counts["stock_items"]
    )
    assert (
        StockBatch.objects.filter(
            stock_item__pharmacy__group=get_demo_group(),
        ).count()
        == first_counts["stock_batches"]
    )
    assert (
        Patient.objects.filter(pharmacy__group=get_demo_group()).count()
        == first_counts["patients"]
    )
    assert (
        PatientMedication.objects.filter(
            patient__pharmacy__group=get_demo_group(),
        ).count()
        == first_counts["patient_medications"]
    )
    assert (
        DosetteCycle.objects.filter(patient__pharmacy__group=get_demo_group()).count()
        == first_counts["dosette_cycles"]
    )
    assert (
        DosettePeriod.objects.filter(patient__pharmacy__group=get_demo_group()).count()
        == first_counts["dosette_periods"]
    )
    assert User.objects.filter(email__in=DEMO_EMAILS).count() == first_counts["users"]
    assert (
        Membership.objects.filter(user__email__in=DEMO_EMAILS, is_active=True).count()
        == first_counts["memberships"]
    )
    for email in DEMO_EMAILS:
        user = get_demo_user(email)
        user.refresh_from_db()
        assert user.check_password(DEMO_PASSWORD) is True
        assert user.must_change_password is False
        assert user.is_active is True
    assert AuditEvent.objects.count() == 0


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_seed_demo_creates_fictional_dosette_data():
    run_seed_demo()

    assert PatientMedication.objects.count() > 0
    assert Patient.objects.count() == 10
    assert DosettePeriod.objects.count() == 10
    assert DosetteCycle.objects.count() > 0
    assert DosetteCycle.objects.count() == 40
    assert all(
        patient.dosette_periods.count() == 1 and patient.dosette_cycles.count() == 4
        for patient in Patient.objects.all()
    )
    assert StockItem.objects.count() == 15
    assert PatientMedication.objects.filter(
        is_active=True,
        quantity_morning=0,
        quantity_lunchtime=0,
        quantity_evening=0,
        quantity_bedtime=0,
    ).exists()
    assert PatientMedication.objects.filter(is_active=False).exists()
    assert (
        PatientMedication.objects.filter(
            is_active=True,
        )
        .exclude(
            quantity_morning=0,
            quantity_lunchtime=0,
            quantity_evening=0,
            quantity_bedtime=0,
        )
        .exists()
    )
    assert AuditEvent.objects.count() == 0


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_seed_demo_dosette_data_is_idempotent():
    run_seed_demo()
    patient_medication_count = PatientMedication.objects.count()
    dosette_period_count = DosettePeriod.objects.count()
    dosette_cycle_count = DosetteCycle.objects.count()

    run_seed_demo()

    assert PatientMedication.objects.count() == patient_medication_count
    assert DosettePeriod.objects.count() == dosette_period_count
    assert DosetteCycle.objects.count() == dosette_cycle_count
    assert AuditEvent.objects.count() == 0


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_seed_demo_reuses_existing_submitted_period_when_dates_drift():
    run_seed_demo()
    patient = Patient.objects.get(patient_reference="SUT-P1")
    period = patient.dosette_periods.get(status=DosettePeriodStatus.SUBMITTED)
    cycle = period.cycles.get(week_number=1)
    period.start_date = date(2026, 6, 28)
    period.end_date = date(2026, 7, 25)
    period.save(update_fields=["start_date", "end_date", "updated_at"])
    cycle.reference = "MDS-PERIOD-1-W1"
    cycle.start_date = date(2026, 6, 28)
    cycle.end_date = date(2026, 7, 4)
    cycle.save(update_fields=["reference", "start_date", "end_date", "updated_at"])
    period_count = DosettePeriod.objects.count()
    cycle_count = DosetteCycle.objects.count()

    run_seed_demo()

    period.refresh_from_db()
    cycle.refresh_from_db()
    assert DosettePeriod.objects.count() == period_count
    assert DosetteCycle.objects.count() == cycle_count
    assert (
        patient.dosette_periods.filter(status=DosettePeriodStatus.SUBMITTED).count()
        == 1
    )
    assert period.start_date == date(2026, 6, 1)
    assert period.end_date == date(2026, 6, 28)
    assert cycle.reference == "SUT-P1-MDS-2026-W01"
    assert cycle.start_date == date(2026, 6, 1)
    assert cycle.end_date == date(2026, 6, 7)
    assert AuditEvent.objects.count() == 0


@pytest.mark.django_db
def test_seed_demo_is_dev_gated_unless_forced():
    with override_settings(DEBUG=False), pytest.raises(CommandError):
        run_seed_demo()

    with override_settings(DEBUG=False):
        run_seed_demo(force=True)

    assert Group.objects.filter(slug="jmw-pharmacy-group").exists()


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_reset_demo_data_requires_confirmation():
    with pytest.raises(CommandError):
        run_reset_demo()


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_reset_demo_data_replaces_demo_records_with_clean_seed():
    run_seed_demo()
    group = get_demo_group()
    sutton = Pharmacy.objects.get(group=group, code="SUT")
    Patient.objects.create(
        pharmacy=sutton,
        patient_reference="SUT-OLD",
        first_name="Old",
        last_name="Demo",
        date_of_birth="1980-01-01",
        address="Old demo address",
        postcode="SM1 1ZZ",
        phone="020 0000 0099",
        notes="Old fictional demo patient.",
    )

    output = run_reset_demo(confirm="RESET_DEMO_DATA")

    assert "Reset and reseeded local demo data." in output
    group = get_demo_group()
    assert Patient.objects.filter(pharmacy__group=group).count() == 10
    assert not Patient.objects.filter(patient_reference="SUT-OLD").exists()
    assert DosettePeriod.objects.filter(patient__pharmacy__group=group).count() == 10
    assert DosetteCycle.objects.filter(patient__pharmacy__group=group).count() == 40
    assert StockItem.objects.filter(pharmacy__group=group).count() == 15


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_reset_demo_data_is_repeatable_for_demo_use():
    run_reset_demo(confirm="RESET_DEMO_DATA")
    first_counts = {
        "patients": Patient.objects.count(),
        "periods": DosettePeriod.objects.count(),
        "cycles": DosetteCycle.objects.count(),
        "stock_items": StockItem.objects.count(),
    }

    run_reset_demo(confirm="RESET_DEMO_DATA")

    assert Patient.objects.count() == first_counts["patients"] == 10
    assert DosettePeriod.objects.count() == first_counts["periods"] == 10
    assert DosetteCycle.objects.count() == first_counts["cycles"] == 40
    assert StockItem.objects.count() == first_counts["stock_items"] == 15
