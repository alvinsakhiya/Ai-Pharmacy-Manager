from datetime import date, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.analytics.services import DEAD_STOCK_DAYS, stock_overview_for
from apps.catalogue.models import Medication, MedicationForm
from apps.inventory.models import MovementType, StockBatch, StockItem, StockMovement
from apps.patients.models import Patient
from apps.tenancy.models import Group, Membership, Pharmacy, Role

PASSWORD = "Initial-pass-123!"
TODAY = date(2026, 6, 20)


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


def authenticate(client, user):
    client.force_login(user)


def make_medication(group: Group, name: str) -> Medication:
    return Medication.objects.create(
        group=group,
        name=name,
        form=MedicationForm.TABLET,
        strength="5 mg",
    )


def make_stock_item(
    pharmacy: Pharmacy,
    medication: Medication,
    *,
    reorder_level: int = 0,
) -> StockItem:
    return StockItem.objects.create(
        pharmacy=pharmacy,
        medication=medication,
        reorder_level=reorder_level,
    )


def make_batch(
    stock_item: StockItem,
    batch_number: str,
    *,
    quantity: int,
    expiry_date: date,
    is_active: bool = True,
) -> StockBatch:
    return StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=batch_number,
        expiry_date=expiry_date,
        quantity=quantity,
        quantity_received=quantity,
        received_at=TODAY,
        is_active=is_active,
    )


def make_outbound_movement(
    stock_item: StockItem,
    batch: StockBatch,
    *,
    quantity: int,
    created_at=None,
) -> StockMovement:
    movement = StockMovement.objects.create(
        stock_item=stock_item,
        batch=batch,
        movement_type=MovementType.ADJUSTMENT,
        quantity_delta=-quantity,
        balance_after=batch.quantity,
        reference="analytics-test",
    )
    if created_at is not None:
        StockMovement.objects.filter(pk=movement.pk).update(created_at=created_at)
        movement.refresh_from_db()
    return movement


@pytest.fixture
def analytics_data():
    group_one = Group.objects.create(name="Group One", slug="analytics-one")
    group_two = Group.objects.create(name="Group Two", slug="analytics-two")
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
    pharmacy_three = Pharmacy.objects.create(
        group=group_one,
        name="Pharmacy Three",
        code="P3",
    )
    pharmacy_other = Pharmacy.objects.create(
        group=group_two,
        name="Other Pharmacy",
        code="OP",
    )

    admin = make_user("analytics-admin@example.com")
    pharmacist = make_user("analytics-pharmacist@example.com")
    dispenser = make_user("analytics-dispenser@example.com")
    stock_employee = make_user("analytics-stock@example.com")
    outsider = make_user("analytics-outsider@example.com")

    add_membership(admin, Role.ADMIN)
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy_one)
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy_two)
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group_one,
        pharmacies=(pharmacy_one, pharmacy_two),
    )

    return {
        "group_one": group_one,
        "group_two": group_two,
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "pharmacy_three": pharmacy_three,
        "pharmacy_other": pharmacy_other,
        "admin": admin,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
        "stock_employee": stock_employee,
        "outsider": outsider,
    }


def overview_items_by_name(user, today=TODAY):
    overview = stock_overview_for(user, today=today)
    return {item["medication_name"]: item for item in overview["items"]}


@pytest.mark.django_db
def test_near_expiry_flags_only_items_inside_threshold(analytics_data):
    near_stock = make_stock_item(
        analytics_data["pharmacy_one"],
        make_medication(analytics_data["group_one"], "Near Expiry Medicine"),
    )
    far_stock = make_stock_item(
        analytics_data["pharmacy_one"],
        make_medication(analytics_data["group_one"], "Far Expiry Medicine"),
    )
    make_batch(
        near_stock,
        "NEAR-001",
        quantity=10,
        expiry_date=TODAY + timedelta(days=11),
    )
    make_batch(
        far_stock,
        "FAR-001",
        quantity=10,
        expiry_date=TODAY + timedelta(days=120),
    )

    items = overview_items_by_name(analytics_data["pharmacist"])

    assert items["Near Expiry Medicine"]["flags"]["near_expiry"] is True
    assert items["Near Expiry Medicine"]["days_to_expiry"] == 11
    assert items["Far Expiry Medicine"]["flags"]["near_expiry"] is False


@pytest.mark.django_db
def test_stockout_low_stock_and_reorder_suggestion(analytics_data):
    stockout = make_stock_item(
        analytics_data["pharmacy_one"],
        make_medication(analytics_data["group_one"], "A Stockout Medicine"),
        reorder_level=20,
    )
    low_stock = make_stock_item(
        analytics_data["pharmacy_one"],
        make_medication(analytics_data["group_one"], "Low Stock Medicine"),
        reorder_level=20,
    )
    zero_reorder = make_stock_item(
        analytics_data["pharmacy_one"],
        make_medication(analytics_data["group_one"], "Zero Reorder Medicine"),
        reorder_level=0,
    )
    make_batch(stockout, "OUT-001", quantity=0, expiry_date=TODAY + timedelta(days=10))
    make_batch(
        low_stock, "LOW-001", quantity=3, expiry_date=TODAY + timedelta(days=120)
    )
    make_batch(
        zero_reorder,
        "ZERO-001",
        quantity=3,
        expiry_date=TODAY + timedelta(days=120),
    )

    items = overview_items_by_name(analytics_data["pharmacist"])

    assert items["A Stockout Medicine"]["flags"]["stockout"] is True
    assert items["A Stockout Medicine"]["suggested_reorder_quantity"] == 20
    assert "Stockout: 0 units on hand" in items["A Stockout Medicine"]["reasons"]
    assert items["Low Stock Medicine"]["flags"]["low_stock"] is True
    assert items["Low Stock Medicine"]["suggested_reorder_quantity"] == 17
    assert any(
        reason.startswith("Low stock: 3 on hand")
        for reason in items["Low Stock Medicine"]["reasons"]
    )
    assert items["Zero Reorder Medicine"]["flags"]["low_stock"] is False
    assert items["Zero Reorder Medicine"]["suggested_reorder_quantity"] == 0


@pytest.mark.django_db
def test_dead_stock_and_slow_moving_use_recent_outbound_consumption(analytics_data):
    now = timezone.now()
    dead_stock = make_stock_item(
        analytics_data["pharmacy_one"],
        make_medication(analytics_data["group_one"], "Dead Stock Medicine"),
    )
    slow_stock = make_stock_item(
        analytics_data["pharmacy_one"],
        make_medication(analytics_data["group_one"], "Slow Moving Medicine"),
    )
    active_stock = make_stock_item(
        analytics_data["pharmacy_one"],
        make_medication(analytics_data["group_one"], "Active Moving Medicine"),
    )
    dead_batch = make_batch(
        dead_stock,
        "DEAD-001",
        quantity=10,
        expiry_date=TODAY + timedelta(days=120),
    )
    slow_batch = make_batch(
        slow_stock,
        "SLOW-001",
        quantity=10,
        expiry_date=TODAY + timedelta(days=120),
    )
    active_batch = make_batch(
        active_stock,
        "ACTIVE-001",
        quantity=10,
        expiry_date=TODAY + timedelta(days=120),
    )
    make_outbound_movement(
        dead_stock,
        dead_batch,
        quantity=10,
        created_at=now - timedelta(days=DEAD_STOCK_DAYS + 1),
    )
    make_outbound_movement(slow_stock, slow_batch, quantity=2, created_at=now)
    make_outbound_movement(active_stock, active_batch, quantity=8, created_at=now)

    items = overview_items_by_name(analytics_data["pharmacist"])

    assert items["Dead Stock Medicine"]["consumption_window"] == 0
    assert items["Dead Stock Medicine"]["flags"]["dead_stock"] is True
    assert any(
        reason.startswith("Dead stock: no outbound movement")
        for reason in items["Dead Stock Medicine"]["reasons"]
    )
    assert items["Slow Moving Medicine"]["consumption_window"] == 2
    assert items["Slow Moving Medicine"]["flags"]["slow_moving"] is True
    assert any(
        reason.startswith("Slow moving: only 2 units consumed")
        for reason in items["Slow Moving Medicine"]["reasons"]
    )
    assert items["Active Moving Medicine"]["consumption_window"] == 8
    assert items["Active Moving Medicine"]["flags"]["slow_moving"] is False
    assert items["Active Moving Medicine"]["flags"]["dead_stock"] is False


@pytest.mark.django_db
def test_attention_score_ordering_and_human_readable_reasons(analytics_data):
    high_attention = make_stock_item(
        analytics_data["pharmacy_one"],
        make_medication(analytics_data["group_one"], "Bravo Medicine"),
        reorder_level=20,
    )
    alpha_tie = make_stock_item(
        analytics_data["pharmacy_one"],
        make_medication(analytics_data["group_one"], "Alpha Medicine"),
    )
    zulu_tie = make_stock_item(
        analytics_data["pharmacy_one"],
        make_medication(analytics_data["group_one"], "Zulu Medicine"),
    )
    make_batch(
        high_attention,
        "HIGH-001",
        quantity=3,
        expiry_date=TODAY + timedelta(days=10),
    )
    make_batch(
        alpha_tie,
        "ALPHA-001",
        quantity=10,
        expiry_date=TODAY + timedelta(days=120),
    )
    make_batch(
        zulu_tie,
        "ZULU-001",
        quantity=10,
        expiry_date=TODAY + timedelta(days=120),
    )

    overview = stock_overview_for(analytics_data["pharmacist"], today=TODAY)
    names = [item["medication_name"] for item in overview["items"]]
    high_item = next(
        item
        for item in overview["items"]
        if item["medication_name"] == "Bravo Medicine"
    )

    assert names[:3] == ["Bravo Medicine", "Alpha Medicine", "Zulu Medicine"]
    assert high_item["attention_score"] == 60
    assert all(": " in reason for reason in high_item["reasons"])


@pytest.mark.django_db
def test_stock_overview_permissions_and_tenant_scoping(client, analytics_data):
    pharmacy_one_stock = make_stock_item(
        analytics_data["pharmacy_one"],
        make_medication(analytics_data["group_one"], "Pharmacy One Medicine"),
    )
    pharmacy_two_stock = make_stock_item(
        analytics_data["pharmacy_two"],
        make_medication(analytics_data["group_one"], "Pharmacy Two Medicine"),
    )
    pharmacy_three_stock = make_stock_item(
        analytics_data["pharmacy_three"],
        make_medication(analytics_data["group_one"], "Pharmacy Three Medicine"),
    )
    other_group_stock = make_stock_item(
        analytics_data["pharmacy_other"],
        make_medication(analytics_data["group_two"], "Other Group Medicine"),
    )
    for stock_item in [
        pharmacy_one_stock,
        pharmacy_two_stock,
        pharmacy_three_stock,
        other_group_stock,
    ]:
        make_batch(
            stock_item,
            f"BATCH-{stock_item.id}",
            quantity=10,
            expiry_date=TODAY + timedelta(days=120),
        )

    authenticate(client, analytics_data["stock_employee"])
    response = client.get("/api/analytics/stock/overview/")
    assert response.status_code == 200
    assert {item["stock_item_id"] for item in response.json()["items"]} == {
        pharmacy_one_stock.id,
        pharmacy_two_stock.id,
    }

    narrowed = client.get(
        "/api/analytics/stock/overview/",
        {"pharmacy": analytics_data["pharmacy_one"].id},
    )
    assert narrowed.status_code == 200
    assert [item["stock_item_id"] for item in narrowed.json()["items"]] == [
        pharmacy_one_stock.id
    ]

    out_of_scope = client.get(
        "/api/analytics/stock/overview/",
        {"pharmacy": analytics_data["pharmacy_three"].id},
    )
    assert out_of_scope.status_code == 200
    assert out_of_scope.json()["items"] == []

    invalid = client.get("/api/analytics/stock/overview/", {"pharmacy": "not-an-id"})
    assert invalid.status_code == 400
    assert invalid.json() == {"pharmacy": ["Pharmacy filter must be an integer."]}

    client.logout()
    authenticate(client, analytics_data["outsider"])
    denied = client.get("/api/analytics/stock/overview/")
    assert denied.status_code == 403


@pytest.mark.django_db
def test_empty_state_returns_zero_summary(client, analytics_data):
    authenticate(client, analytics_data["pharmacist"])

    response = client.get("/api/analytics/stock/overview/")

    assert response.status_code == 200
    assert response.json()["summary"] == {
        "total_items": 0,
        "stockout": 0,
        "low_stock": 0,
        "near_expiry": 0,
        "dead_stock": 0,
        "slow_moving": 0,
        "needs_attention": 0,
    }
    assert response.json()["items"] == []


@pytest.mark.django_db
def test_response_does_not_include_patient_data(client, analytics_data):
    medication = make_medication(analytics_data["group_one"], "Analytics Medicine")
    stock_item = make_stock_item(analytics_data["pharmacy_one"], medication)
    make_batch(
        stock_item,
        "ANALYTICS-001",
        quantity=10,
        expiry_date=TODAY + timedelta(days=120),
    )
    Patient.objects.create(
        pharmacy=analytics_data["pharmacy_one"],
        patient_reference="PRIVATE-PATIENT-REF",
        first_name="PrivateFirst",
        last_name="PrivateLast",
        date_of_birth=date(1980, 1, 1),
        address="Private Address",
        phone="020 0000 0000",
        notes="Private note body",
    )
    authenticate(client, analytics_data["pharmacist"])

    response = client.get("/api/analytics/stock/overview/")

    assert response.status_code == 200
    payload_text = str(response.json())
    for forbidden in [
        "patient_reference",
        "first_name",
        "last_name",
        "date_of_birth",
        "address",
        "phone",
        "dose_instructions",
        "note",
        "last_name_index",
        "PRIVATE-PATIENT-REF",
        "PrivateFirst",
        "PrivateLast",
        "Private Address",
        "020 0000 0000",
        "Private note body",
    ]:
        assert forbidden not in payload_text
