from datetime import date

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalogue.models import Medication, MedicationForm
from apps.inventory.models import StockMovement
from apps.patients.models import Patient
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from . import services
from .models import (
    CycleFrequency,
    CycleStatus,
    DosetteCycle,
    DosettePeriod,
    DosettePeriodStatus,
    PatientMedication,
)

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


def authenticate(client, user) -> None:
    client.force_login(user)


def make_patient(
    pharmacy: Pharmacy,
    reference: str,
    *,
    first_name: str = "PrivateFirst",
    last_name: str = "PrivateLast",
) -> Patient:
    return Patient.objects.create(
        pharmacy=pharmacy,
        patient_reference=reference,
        first_name=first_name,
        last_name=last_name,
        date_of_birth=date(1981, 1, 1),
        address=f"{reference} Hidden Address",
        postcode="TE1 1ST",
        phone="020 0000 1111",
        email=f"{reference.lower()}@private.example",
        notes=f"{reference} private patient note",
    )


def make_medication(group: Group, name: str = "Period Medicine") -> Medication:
    return Medication.objects.create(
        group=group,
        name=name,
        form=MedicationForm.TABLET,
        strength="5 mg",
    )


def make_active_line(patient: Patient, medication: Medication) -> PatientMedication:
    return PatientMedication.objects.create(
        patient=patient,
        medication=medication,
        quantity_morning=1,
    )


def period_url(patient: Patient) -> str:
    return f"/api/patients/{patient.id}/dosette-periods/"


def collected_url(patient: Patient, period: DosettePeriod) -> str:
    return f"{period_url(patient)}{period.id}/collected/"


def mark_period_cycles_ready(period: DosettePeriod) -> None:
    DosetteCycle.objects.filter(period=period).update(
        status=CycleStatus.CHECKED,
        stock_deducted=True,
        deducted_at=timezone.now(),
        checked_at=timezone.now(),
    )


@pytest.fixture
def period_data():
    group = Group.objects.create(name="Period Group", slug="period-group")
    pharmacy = Pharmacy.objects.create(group=group, name="Period Pharmacy", code="PER")
    other_group = Group.objects.create(name="Other Group", slug="period-other")
    other_pharmacy = Pharmacy.objects.create(
        group=other_group,
        name="Other Pharmacy",
        code="OP",
    )
    patient = make_patient(pharmacy, "P1-PERIOD-001")
    other_patient = make_patient(other_pharmacy, "OP-PERIOD-001")
    make_active_line(patient, make_medication(group))
    make_active_line(other_patient, make_medication(other_group, "Other Medicine"))

    admin = make_user("period-admin@example.com")
    pharmacist = make_user("period-pharmacist@example.com")
    stock_employee = make_user("period-stock@example.com")
    outsider = make_user("period-outsider@example.com")

    add_membership(admin, Role.ADMIN)
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy)
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group,
        pharmacies=(pharmacy,),
    )
    add_membership(outsider, Role.PHARMACIST, pharmacy=other_pharmacy)

    return {
        "admin": admin,
        "group": group,
        "other_patient": other_patient,
        "outsider": outsider,
        "patient": patient,
        "pharmacist": pharmacist,
        "pharmacy": pharmacy,
        "stock_employee": stock_employee,
    }


@pytest.mark.django_db
def test_submit_dosette_period_creates_four_weekly_cycles(period_data):
    patient = period_data["patient"]
    actor = period_data["pharmacist"]

    period = services.submit_dosette_period(
        actor=actor,
        patient=patient,
        start_date=date(2026, 6, 29),
    )

    assert period.status == DosettePeriodStatus.SUBMITTED
    assert period.start_date == date(2026, 6, 29)
    assert period.end_date == date(2026, 7, 26)
    assert period.submitted_by == actor
    cycles = list(period.cycles.order_by("week_number"))
    assert [cycle.week_number for cycle in cycles] == [1, 2, 3, 4]
    assert [(cycle.start_date, cycle.end_date) for cycle in cycles] == [
        (date(2026, 6, 29), date(2026, 7, 5)),
        (date(2026, 7, 6), date(2026, 7, 12)),
        (date(2026, 7, 13), date(2026, 7, 19)),
        (date(2026, 7, 20), date(2026, 7, 26)),
    ]
    assert {cycle.frequency for cycle in cycles} == {CycleFrequency.WEEKLY}
    assert {cycle.status for cycle in cycles} == {CycleStatus.DRAFT}
    assert {cycle.stock_deducted for cycle in cycles} == {False}
    assert all(
        cycle.prepared_at is None and cycle.checked_at is None for cycle in cycles
    )
    assert StockMovement.objects.count() == 0


@pytest.mark.django_db
def test_period_week_number_constraints(period_data):
    period = services.submit_dosette_period(
        actor=period_data["pharmacist"],
        patient=period_data["patient"],
        start_date=date(2026, 6, 29),
    )
    first_cycle = period.cycles.get(week_number=1)

    with pytest.raises(IntegrityError), transaction.atomic():
        DosetteCycle.objects.create(
            patient=period_data["patient"],
            period=period,
            week_number=1,
            reference="DUPLICATE-WEEK",
            frequency=CycleFrequency.WEEKLY,
            start_date=date(2026, 7, 27),
            end_date=date(2026, 8, 2),
        )

    with pytest.raises(IntegrityError), transaction.atomic():
        first_cycle.week_number = 5
        first_cycle.save(update_fields=["week_number", "updated_at"])


@pytest.mark.django_db
def test_submit_rolls_back_if_cycle_creation_fails(period_data, monkeypatch):
    def fail_cycle_creation(period):
        raise RuntimeError("cycle failure")

    monkeypatch.setattr(services, "_create_period_cycles", fail_cycle_creation)

    with pytest.raises(RuntimeError, match="cycle failure"):
        services.submit_dosette_period(
            actor=period_data["pharmacist"],
            patient=period_data["patient"],
            start_date=date(2026, 6, 29),
        )

    assert DosettePeriod.objects.count() == 0
    assert DosetteCycle.objects.count() == 0


@pytest.mark.django_db
def test_submit_requires_active_medication(period_data):
    patient = make_patient(period_data["pharmacy"], "P1-PERIOD-EMPTY")

    with pytest.raises(services.DosettePeriodValidationError) as exc_info:
        services.submit_dosette_period(
            actor=period_data["pharmacist"],
            patient=patient,
            start_date=date(2026, 6, 29),
        )

    assert exc_info.value.detail == {
        "detail": ["Add at least one active medication before submitting."]
    }


@pytest.mark.django_db
def test_submit_rejects_duplicate_open_period(period_data):
    services.submit_dosette_period(
        actor=period_data["pharmacist"],
        patient=period_data["patient"],
        start_date=date(2026, 6, 29),
    )

    with pytest.raises(services.DosettePeriodValidationError) as exc_info:
        services.submit_dosette_period(
            actor=period_data["pharmacist"],
            patient=period_data["patient"],
            start_date=date(2026, 7, 27),
        )

    assert exc_info.value.detail == {
        "detail": ["Patient already has an open dosette period."]
    }


@pytest.mark.django_db
def test_submit_period_endpoint_returns_safe_payload(client, period_data):
    authenticate(client, period_data["pharmacist"])

    response = client.post(
        period_url(period_data["patient"]),
        {"start_date": "2026-06-29"},
        format="json",
    )

    assert response.status_code == 201
    data = response.json()
    assert data["patient_reference"] == "P1-PERIOD-001"
    assert data["start_date"] == "2026-06-29"
    assert data["end_date"] == "2026-07-26"
    assert data["status"] == DosettePeriodStatus.SUBMITTED
    assert data["collected_on"] is None
    assert data["next_due_date"] is None
    assert data["reminder_date"] is None
    assert [cycle["week_number"] for cycle in data["cycles"]] == [1, 2, 3, 4]
    assert DosetteCycle.objects.filter(period_id=data["id"]).count() == 4

    payload_text = str(data)
    for forbidden in [
        period_data["patient"].first_name,
        period_data["patient"].last_name,
        str(period_data["patient"].date_of_birth),
        period_data["patient"].address,
        period_data["patient"].postcode,
        period_data["patient"].phone,
        period_data["patient"].email,
        period_data["patient"].notes,
    ]:
        assert forbidden not in payload_text


@pytest.mark.django_db
def test_period_endpoints_enforce_scope_and_manage_permission(client, period_data):
    patient = period_data["patient"]

    authenticate(client, period_data["stock_employee"])
    denied = client.post(period_url(patient), {"start_date": "2026-06-29"})
    assert denied.status_code == 403

    client.logout()
    authenticate(client, period_data["outsider"])
    hidden = client.post(period_url(patient), {"start_date": "2026-06-29"})
    assert hidden.status_code == 404


@pytest.mark.django_db
def test_collected_endpoint_records_actor_date_and_due_dates(client, period_data):
    patient = period_data["patient"]
    actor = period_data["pharmacist"]
    period = services.submit_dosette_period(
        actor=actor,
        patient=patient,
        start_date=date(2026, 6, 29),
    )
    mark_period_cycles_ready(period)
    authenticate(client, actor)

    response = client.post(
        collected_url(patient, period),
        {"collected_on": "2026-06-28"},
        format="json",
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == DosettePeriodStatus.COLLECTED
    assert data["collected_on"] == "2026-06-28"
    assert data["next_due_date"] == "2026-07-26"
    assert data["reminder_date"] == "2026-07-19"
    period.refresh_from_db()
    assert period.collected_by == actor
    assert period.collected_on == date(2026, 6, 28)
    assert set(period.cycles.values_list("status", flat=True)) == {CycleStatus.CHECKED}


@pytest.mark.django_db
def test_collected_endpoint_rejects_future_and_ineligible_periods(
    client,
    period_data,
    monkeypatch,
):
    monkeypatch.setattr(services.timezone, "localdate", lambda: date(2026, 6, 28))
    patient = period_data["patient"]
    actor = period_data["pharmacist"]
    period = services.submit_dosette_period(
        actor=actor,
        patient=patient,
        start_date=date(2026, 6, 29),
    )
    authenticate(client, actor)

    future = client.post(
        collected_url(patient, period),
        {"collected_on": "2026-06-29"},
        format="json",
    )
    ineligible = client.post(
        collected_url(patient, period),
        {"collected_on": "2026-06-28"},
        format="json",
    )
    period.status = DosettePeriodStatus.CANCELLED
    period.save(update_fields=["status", "updated_at"])
    cancelled = client.post(
        collected_url(patient, period),
        {"collected_on": "2026-06-28"},
        format="json",
    )

    assert future.status_code == 400
    assert future.json() == {
        "collected_on": ["Collection date cannot be in the future."]
    }
    assert ineligible.status_code == 400
    assert ineligible.json() == {
        "detail": [
            "All four cycles must be checked and stock deducted before collection can "
            "be recorded."
        ]
    }
    assert cancelled.status_code == 400
    assert cancelled.json() == {
        "detail": ["Cannot collect a cancelled dosette period."]
    }
