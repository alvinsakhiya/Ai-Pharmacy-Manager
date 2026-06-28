from datetime import date, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.blister.models import (
    CycleFrequency,
    DosetteCycle,
    DosettePeriod,
    DosettePeriodStatus,
)
from apps.catalogue.models import Medication, MedicationForm
from apps.inventory.models import StockBatch, StockItem, StockMovement
from apps.notifications import work_queue
from apps.notifications.models import NotificationDismissal
from apps.patients.models import Patient
from apps.reviews.models import ReviewPriority, ReviewRecord, ReviewStatus
from apps.tenancy.models import Group, Membership, Pharmacy, Role

PASSWORD = "Initial-pass-123!"
DRAFT = "DRAFT"
NEEDS_CHANGES = "NEEDS_CHANGES"
PREPARED = "PREPARED"
CHECKED = "CHECKED"
COMPLETED = "COMPLETED"
CANCELLED = "CANCELLED"


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


def make_cycle(
    patient: Patient,
    reference: str,
    *,
    status: str = DRAFT,
    start_date: date = date(2026, 6, 28),
    end_date: date = date(2026, 7, 25),
    stock_deducted: bool = False,
) -> DosetteCycle:
    return DosetteCycle.objects.create(
        patient=patient,
        reference=reference,
        frequency=CycleFrequency.FOUR_WEEKLY,
        start_date=start_date,
        end_date=end_date,
        status=status,
        stock_deducted=stock_deducted,
        deducted_at=timezone.now() if stock_deducted else None,
    )


def make_period(
    patient: Patient,
    *,
    collected_on: date,
    start_date: date = date(2026, 5, 1),
) -> DosettePeriod:
    return DosettePeriod.objects.create(
        patient=patient,
        start_date=start_date,
        end_date=start_date + timedelta(days=27),
        status=DosettePeriodStatus.COLLECTED,
        submitted_at=timezone.now(),
        collected_on=collected_on,
    )


def make_review(patient: Patient, **overrides) -> ReviewRecord:
    data = {
        "patient": patient,
        "status": ReviewStatus.PENDING,
        "priority": ReviewPriority.ATTENTION,
        "due_date": date(2026, 6, 27),
        "notes": "Private review note",
    }
    data.update(overrides)
    return ReviewRecord.objects.create(**data)


def make_medication(group: Group, name: str) -> Medication:
    return Medication.objects.create(
        group=group,
        name=name,
        form=MedicationForm.TABLET,
        strength="5 mg",
    )


def make_stockout(pharmacy: Pharmacy, medication: Medication) -> StockItem:
    stock_item = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=medication,
        reorder_level=10,
    )
    StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=f"WQ-{stock_item.id}",
        expiry_date=timezone.now().date() + timedelta(days=120),
        quantity=0,
        quantity_received=0,
        received_at=timezone.now().date(),
    )
    return stock_item


@pytest.fixture
def work_queue_data(monkeypatch):
    monkeypatch.setattr(
        work_queue.timezone,
        "localdate",
        lambda: date(2026, 6, 26),
    )

    group_one = Group.objects.create(name="Group One", slug="work-queue-one")
    group_two = Group.objects.create(name="Group Two", slug="work-queue-two")
    pharmacy_one = Pharmacy.objects.create(
        group=group_one,
        name="Pharmacy One",
        code="P1",
    )
    pharmacy_two = Pharmacy.objects.create(
        group=group_one,
        name="Pharmacy Two",
        code="P2",
    )
    pharmacy_other = Pharmacy.objects.create(
        group=group_two,
        name="Other Pharmacy",
        code="OP",
    )

    patient_one = make_patient(pharmacy_one, "P1-WQ-001")
    patient_two = make_patient(
        pharmacy_two,
        "P2-WQ-001",
        first_name="OtherScopedFirst",
        last_name="OtherScopedLast",
    )
    patient_other = make_patient(
        pharmacy_other,
        "OP-WQ-001",
        first_name="OtherTenantFirst",
        last_name="OtherTenantLast",
    )

    due_soon_cycle = make_cycle(patient_one, "MDS-WQ-DUE-SOON")
    overdue_cycle = make_cycle(
        patient_one,
        "MDS-WQ-OVERDUE",
        status=NEEDS_CHANGES,
        start_date=date(2026, 5, 25),
        end_date=date(2026, 6, 20),
    )
    prepared_cycle = make_cycle(
        patient_one,
        "MDS-WQ-PREPARED",
        status=PREPARED,
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 28),
    )
    checked_cycle = make_cycle(
        patient_one,
        "MDS-WQ-CHECKED",
        status=CHECKED,
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 28),
    )
    deducted_cycle = make_cycle(
        patient_one,
        "MDS-WQ-DEDUCTED",
        status=CHECKED,
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 28),
        stock_deducted=True,
    )
    cancelled_cycle = make_cycle(
        patient_one,
        "MDS-WQ-CANCELLED",
        status=CANCELLED,
    )
    completed_cycle = make_cycle(
        patient_one,
        "MDS-WQ-COMPLETED",
        status=COMPLETED,
    )
    pharmacy_two_cycle = make_cycle(patient_two, "MDS-WQ-P2-DUE-SOON")
    cross_tenant_cycle = make_cycle(patient_other, "MDS-WQ-OTHER-DUE-SOON")

    pending_review = make_review(patient_one)
    make_review(patient_one, status=ReviewStatus.COMPLETED)
    make_review(patient_other, due_date=date(2026, 6, 20))

    stockout_one = make_stockout(
        pharmacy_one,
        make_medication(group_one, "Queue Stockout One"),
    )
    stockout_two = make_stockout(
        pharmacy_two,
        make_medication(group_one, "Queue Stockout Two"),
    )
    cross_tenant_stockout = make_stockout(
        pharmacy_other,
        make_medication(group_two, "Queue Other Tenant Stockout"),
    )

    pharmacist = make_user("work-queue-pharmacist@example.com")
    dispenser = make_user("work-queue-dispenser@example.com")
    stock_employee = make_user("work-queue-stock@example.com")
    superintendent = make_user("work-queue-superintendent@example.com")
    admin = make_user("work-queue-admin@example.com")
    outsider = make_user("work-queue-outsider@example.com")

    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy_one)
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy_one)
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group_one,
        pharmacies=(pharmacy_one, pharmacy_two),
    )
    add_membership(superintendent, Role.SUPERINTENDENT, group=group_one)
    add_membership(admin, Role.ADMIN)
    add_membership(outsider, Role.PHARMACIST, pharmacy=pharmacy_other)

    return {
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "pharmacy_other": pharmacy_other,
        "patient_one": patient_one,
        "patient_two": patient_two,
        "patient_other": patient_other,
        "due_soon_cycle": due_soon_cycle,
        "overdue_cycle": overdue_cycle,
        "prepared_cycle": prepared_cycle,
        "checked_cycle": checked_cycle,
        "deducted_cycle": deducted_cycle,
        "cancelled_cycle": cancelled_cycle,
        "completed_cycle": completed_cycle,
        "pharmacy_two_cycle": pharmacy_two_cycle,
        "cross_tenant_cycle": cross_tenant_cycle,
        "pending_review": pending_review,
        "stockout_one": stockout_one,
        "stockout_two": stockout_two,
        "cross_tenant_stockout": cross_tenant_stockout,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
        "stock_employee": stock_employee,
        "superintendent": superintendent,
        "admin": admin,
        "outsider": outsider,
    }


def work_queue_url() -> str:
    return "/api/notifications/work-queue/"


def queue_items(response) -> list[dict]:
    return response.json()["items"]


def queue_types(response) -> list[str]:
    return [item["type"] for item in queue_items(response)]


@pytest.mark.django_db
def test_pharmacist_gets_scoped_patient_review_and_stock_tasks(
    client,
    work_queue_data,
):
    authenticate(client, work_queue_data["pharmacist"])

    response = client.get(work_queue_url())

    assert response.status_code == 200
    types = queue_types(response)
    assert {
        "MDS_OVERDUE",
        "MDS_DUE_SOON",
        "MDS_WAITING_CHECK",
        "MDS_STOCK_DEDUCTION",
        "REVIEW_PENDING",
        "STOCK_STOCKOUT",
    }.issubset(types)
    assert response.json()["summary"]["total"] == len(queue_items(response))
    assert response.json()["summary"]["urgent"] >= 1
    assert response.json()["summary"]["due_soon"] >= 1
    assert response.json()["summary"]["waiting_check"] == 1
    assert response.json()["summary"]["reviews"] == 1

    assert all(
        item["pharmacy_id"] == work_queue_data["pharmacy_one"].id
        for item in queue_items(response)
    )
    due_soon = next(
        item for item in queue_items(response) if item["type"] == "MDS_DUE_SOON"
    )
    assert due_soon["patient_reference"] == "P1-WQ-001"
    assert due_soon["action_href"] == (
        f"/patients/{work_queue_data['patient_one'].id}/dosette"
    )
    assert due_soon["reason"] == "Suggested preparation window: due within 3 days."
    assert "P2-WQ-001" not in str(response.json())
    assert "OP-WQ-001" not in str(response.json())


@pytest.mark.django_db
def test_stock_employee_only_gets_stock_tasks_without_patient_identifiers(
    client,
    work_queue_data,
):
    authenticate(client, work_queue_data["stock_employee"])

    response = client.get(work_queue_url())

    assert response.status_code == 200
    items = queue_items(response)
    assert items
    assert {item["type"] for item in items} == {"STOCK_STOCKOUT"}
    assert {item["pharmacy_name"] for item in items} == {
        "Pharmacy One",
        "Pharmacy Two",
    }
    for item in items:
        assert item["patient_reference"] == ""
        assert item["cycle_id"] is None
        assert item["cycle_reference"] == ""
        assert item["cycle_display_label"] == ""
        assert item["action_href"].startswith("/inventory/")
    payload_text = str(response.json())
    for forbidden in ["P1-WQ-001", "P2-WQ-001", "OP-WQ-001", "MDS-WQ"]:
        assert forbidden not in payload_text


@pytest.mark.django_db
def test_superintendent_gets_group_stock_queue_only(client, work_queue_data):
    authenticate(client, work_queue_data["superintendent"])

    response = client.get(work_queue_url())

    assert response.status_code == 200
    assert {item["pharmacy_id"] for item in queue_items(response)} == {
        work_queue_data["pharmacy_one"].id,
        work_queue_data["pharmacy_two"].id,
    }
    assert all(item["group"] == "stock_action" for item in queue_items(response))
    assert "Queue Other Tenant Stockout" not in str(response.json())


@pytest.mark.django_db
def test_dispenser_gets_safe_read_only_mds_actions(client, work_queue_data):
    authenticate(client, work_queue_data["dispenser"])

    response = client.get(work_queue_url())

    assert response.status_code == 200
    types = queue_types(response)
    assert "MDS_DUE_SOON" in types
    assert "MDS_WAITING_CHECK" in types
    assert "MDS_STOCK_DEDUCTION" in types
    mds_items = [
        item for item in queue_items(response) if item["type"].startswith("MDS_")
    ]
    assert mds_items
    assert {item["action_label"] for item in mds_items} == {"Open record"}
    assert "Deduct stock" not in str(response.json())


@pytest.mark.django_db
def test_pharmacy_filter_respects_scope(client, work_queue_data):
    authenticate(client, work_queue_data["pharmacist"])

    hidden = client.get(
        work_queue_url(),
        {"pharmacy": work_queue_data["pharmacy_two"].id},
    )
    invalid = client.get(work_queue_url(), {"pharmacy": "not-an-id"})
    client.logout()
    authenticate(client, work_queue_data["admin"])
    filtered = client.get(
        work_queue_url(),
        {"pharmacy": work_queue_data["pharmacy_two"].id},
    )

    assert hidden.status_code == 200
    assert hidden.json()["items"] == []
    assert hidden.json()["summary"]["total"] == 0
    assert invalid.status_code == 400
    assert invalid.json() == {"pharmacy": ["Pharmacy filter must be an integer."]}
    assert filtered.status_code == 200
    payload_text = str(filtered.json())
    assert "P2-WQ-001" in payload_text
    assert "P1-WQ-001" not in payload_text
    assert all(
        item["pharmacy_id"] == work_queue_data["pharmacy_two"].id
        for item in queue_items(filtered)
    )


@pytest.mark.django_db
def test_closed_cancelled_and_completed_records_are_excluded(client, work_queue_data):
    authenticate(client, work_queue_data["pharmacist"])

    response = client.get(work_queue_url())

    assert response.status_code == 200
    payload_text = str(response.json())
    assert "MDS-WQ-CANCELLED" not in payload_text
    assert "MDS-WQ-COMPLETED" not in payload_text
    assert "MDS-WQ-DEDUCTED" not in payload_text
    assert queue_types(response).count("REVIEW_PENDING") == 1


@pytest.mark.django_db
def test_patient_pii_is_absent_from_work_queue_response(client, work_queue_data):
    authenticate(client, work_queue_data["pharmacist"])

    response = client.get(work_queue_url())

    assert response.status_code == 200
    payload_text = str(response.json())
    for forbidden in [
        "PrivateFirst",
        "PrivateLast",
        "OtherScopedFirst",
        "OtherScopedLast",
        "date_of_birth",
        "Hidden Address",
        "TE1 1ST",
        "020 0000 1111",
        "private.example",
        "private patient note",
        "Private review note",
    ]:
        assert forbidden not in payload_text
    assert "P1-WQ-001" in payload_text


@pytest.mark.django_db
def test_collected_period_reminder_appears_from_reminder_date(
    client,
    work_queue_data,
):
    make_period(
        work_queue_data["patient_one"],
        collected_on=date(2026, 6, 5),
    )
    make_period(
        work_queue_data["patient_one"],
        collected_on=date(2026, 6, 6),
        start_date=date(2026, 6, 1),
    )
    authenticate(client, work_queue_data["pharmacist"])

    response = client.get(work_queue_url())

    assert response.status_code == 200
    period_items = [
        item for item in queue_items(response) if item["type"] == "MDS_PERIOD_DUE"
    ]
    assert len(period_items) == 1
    item = period_items[0]
    assert item["group"] == "due_soon"
    assert item["priority"] == "high"
    assert item["status"] == "DUE_SOON"
    assert item["patient_reference"] == "P1-WQ-001"
    assert item["cycle_id"] is None
    assert item["cycle_reference"] == ""
    assert item["due_date"] == "2026-07-03"
    assert (
        item["action_href"] == f"/patients/{work_queue_data['patient_one'].id}/dosette"
    )
    assert item["reason"] == (
        "Patient ID P1-WQ-001 collected their dosette on 05 Jun 2026. "
        "Next dosette is due in 7 days. Prepare the next dosette."
    )


@pytest.mark.django_db
def test_collected_period_overdue_reminder_uses_patient_reference_only(
    client,
    work_queue_data,
):
    make_period(
        work_queue_data["patient_one"],
        collected_on=date(2026, 5, 20),
    )
    authenticate(client, work_queue_data["pharmacist"])

    response = client.get(work_queue_url())

    assert response.status_code == 200
    item = next(
        item for item in queue_items(response) if item["type"] == "MDS_PERIOD_DUE"
    )
    assert item["group"] == "urgent"
    assert item["priority"] == "urgent"
    assert item["status"] == "OVERDUE"
    assert item["due_date"] == "2026-06-17"
    assert item["reason"] == (
        "Patient ID P1-WQ-001 collected their dosette on 20 May 2026. "
        "Next dosette is 9 days overdue. Prepare the next dosette."
    )

    payload_text = str(response.json())
    for forbidden in [
        "PrivateFirst",
        "PrivateLast",
        "date_of_birth",
        "Hidden Address",
        "TE1 1ST",
        "020 0000 1111",
        "private.example",
        "private patient note",
    ]:
        assert forbidden not in payload_text
    assert "P1-WQ-001" in payload_text


@pytest.mark.django_db
def test_work_queue_endpoint_is_read_only(client, work_queue_data):
    authenticate(client, work_queue_data["pharmacist"])
    cycle_snapshot = list(
        DosetteCycle.objects.order_by("id").values(
            "id",
            "status",
            "stock_deducted",
            "deducted_at",
            "prepared_at",
            "checked_at",
        )
    )
    review_snapshot = list(
        ReviewRecord.objects.order_by("id").values(
            "id",
            "status",
            "completed_at",
            "assigned_to_id",
        )
    )
    movement_count = StockMovement.objects.count()
    dismissal_count = NotificationDismissal.objects.count()

    first = client.get(work_queue_url())
    second = client.get(work_queue_url())

    assert first.status_code == 200
    assert second.status_code == 200
    assert (
        list(
            DosetteCycle.objects.order_by("id").values(
                "id",
                "status",
                "stock_deducted",
                "deducted_at",
                "prepared_at",
                "checked_at",
            )
        )
        == cycle_snapshot
    )
    assert (
        list(
            ReviewRecord.objects.order_by("id").values(
                "id",
                "status",
                "completed_at",
                "assigned_to_id",
            )
        )
        == review_snapshot
    )
    assert StockMovement.objects.count() == movement_count
    assert NotificationDismissal.objects.count() == dismissal_count
