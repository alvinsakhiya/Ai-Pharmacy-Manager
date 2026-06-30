from datetime import date, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.analytics.models import ForecastItem, ForecastRun
from apps.analytics.services import DEAD_STOCK_DAYS, stock_overview_for
from apps.blister.models import (
    CycleFrequency,
    DosetteCycle,
    PatientMedication,
)
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
    unit_price=None,
    pack_price=None,
) -> StockItem:
    return StockItem.objects.create(
        pharmacy=pharmacy,
        medication=medication,
        reorder_level=reorder_level,
        unit_price=unit_price,
        pack_price=pack_price,
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


def make_patient(pharmacy: Pharmacy, reference: str = "PT-PRIVATE") -> Patient:
    return Patient.objects.create(
        pharmacy=pharmacy,
        patient_reference=reference,
        first_name="PrivateFirst",
        last_name="PrivateLast",
        date_of_birth=date(1980, 1, 1),
        address="Private Address",
        phone="020 0000 0000",
        notes="Private note body",
    )


def make_cycle(
    patient: Patient,
    reference: str,
    *,
    start_date: date = TODAY,
    end_date: date = TODAY + timedelta(days=6),
    status: str = "DRAFT",
    stock_deducted: bool = False,
) -> DosetteCycle:
    return DosetteCycle.objects.create(
        patient=patient,
        reference=reference,
        frequency=CycleFrequency.WEEKLY,
        start_date=start_date,
        end_date=end_date,
        status=status,
        stock_deducted=stock_deducted,
    )


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


@pytest.mark.django_db
def test_mds_demand_signal_counts_upcoming_active_lines_only(client, analytics_data):
    today = timezone.now().date()
    medication = make_medication(analytics_data["group_one"], "MDS Demand Medicine")
    stock_item = make_stock_item(analytics_data["pharmacy_one"], medication)
    make_batch(
        stock_item,
        "MDS-001",
        quantity=10,
        expiry_date=today + timedelta(days=120),
    )
    patient = make_patient(analytics_data["pharmacy_one"], "PRIVATE-MDS-001")
    PatientMedication.objects.create(
        patient=patient,
        medication=medication,
        quantity_morning=1,
        quantity_evening=1,
    )
    PatientMedication.objects.create(
        patient=patient,
        medication=make_medication(analytics_data["group_one"], "Zero Dose Medicine"),
    )
    inactive_line = PatientMedication.objects.create(
        patient=patient,
        medication=make_medication(analytics_data["group_one"], "Inactive Medicine"),
        quantity_morning=4,
    )
    inactive_line.is_active = False
    inactive_line.save(update_fields=["is_active", "updated_at"])
    make_cycle(
        patient,
        "MDS-ACTIVE-001",
        start_date=today,
        end_date=today + timedelta(days=6),
    )

    deducted_patient = make_patient(analytics_data["pharmacy_one"], "PRIVATE-MDS-002")
    PatientMedication.objects.create(
        patient=deducted_patient,
        medication=make_medication(analytics_data["group_one"], "Deducted Medicine"),
        quantity_morning=3,
    )
    make_cycle(
        deducted_patient,
        "MDS-DEDUCTED-001",
        start_date=today,
        end_date=today + timedelta(days=6),
        stock_deducted=True,
    )

    other_patient = make_patient(analytics_data["pharmacy_other"], "OTHER-MDS-001")
    PatientMedication.objects.create(
        patient=other_patient,
        medication=make_medication(analytics_data["group_two"], "Other Group MDS"),
        quantity_morning=3,
    )
    make_cycle(
        other_patient,
        "MDS-OTHER-001",
        start_date=today,
        end_date=today + timedelta(days=6),
    )

    authenticate(client, analytics_data["pharmacist"])
    response = client.get(
        "/api/analytics/mds-demand/",
        {"pharmacy": analytics_data["pharmacy_one"].id, "horizon_days": 28},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["total_required_units"] == 14
    assert payload["summary"]["total_available_units"] == 10
    assert payload["summary"]["total_shortfall_units"] == 4
    assert payload["summary"]["cycles_affected"] == 1
    assert payload["summary"]["patients_affected"] == 1
    assert payload["items"] == [
        {
            "stock_item_id": stock_item.id,
            "medication_id": medication.id,
            "medication_name": "MDS Demand Medicine",
            "pharmacy_id": analytics_data["pharmacy_one"].id,
            "pharmacy_name": "Pharmacy One",
            "required_units": 14,
            "available_units": 10,
            "shortfall_units": 4,
            "cycles_affected": 1,
            "patients_affected": 1,
            "mapping_status": "mapped",
            "review_message": "Review before action.",
        }
    ]
    payload_text = str(payload)
    for forbidden in [
        "PRIVATE-MDS",
        "PrivateFirst",
        "PrivateLast",
        "Private Address",
        "020 0000 0000",
        "Private note body",
        "Deducted Medicine",
        "Zero Dose Medicine",
        "Inactive Medicine",
        "Other Group MDS",
    ]:
        assert forbidden not in payload_text


@pytest.mark.django_db
def test_expiry_risk_buckets_value_and_scope(client, analytics_data):
    today = timezone.now().date()
    priced = make_stock_item(
        analytics_data["pharmacy_one"],
        make_medication(analytics_data["group_one"], "Priced Expiry Medicine"),
        unit_price="2.00",
    )
    unpriced = make_stock_item(
        analytics_data["pharmacy_one"],
        make_medication(analytics_data["group_one"], "Unpriced Expiry Medicine"),
    )
    ignored = make_stock_item(
        analytics_data["pharmacy_one"],
        make_medication(analytics_data["group_one"], "Ignored Expiry Medicine"),
        unit_price="5.00",
    )
    other_scope = make_stock_item(
        analytics_data["pharmacy_other"],
        make_medication(analytics_data["group_two"], "Other Expiry Medicine"),
        unit_price="9.00",
    )
    make_batch(priced, "EXP-001", quantity=2, expiry_date=today - timedelta(days=1))
    make_batch(priced, "EXP-002", quantity=3, expiry_date=today + timedelta(days=7))
    make_batch(priced, "EXP-003", quantity=4, expiry_date=today + timedelta(days=30))
    make_batch(priced, "EXP-004", quantity=6, expiry_date=today + timedelta(days=31))
    make_batch(unpriced, "UNP-001", quantity=5, expiry_date=today + timedelta(days=5))
    make_batch(ignored, "IGN-001", quantity=0, expiry_date=today + timedelta(days=5))
    make_batch(
        ignored,
        "IGN-002",
        quantity=8,
        expiry_date=today + timedelta(days=5),
        is_active=False,
    )
    make_batch(
        other_scope,
        "OTH-001",
        quantity=20,
        expiry_date=today + timedelta(days=5),
    )

    authenticate(client, analytics_data["pharmacist"])
    response = client.get("/api/analytics/expiry-risk/")

    assert response.status_code == 200
    payload = response.json()
    buckets = {bucket["key"]: bucket for bucket in payload["buckets"]}
    assert buckets["expired"]["units"] == 2
    assert buckets["d0_7"]["units"] == 8
    assert buckets["d8_30"]["units"] == 4
    assert buckets["d31_60"]["units"] == 6
    assert payload["summary"] == {
        "expiring_within_30_days_units": 14,
        "value_at_risk": "18.00",
        "unpriced_risk_units": 5,
        "products_affected": 2,
    }
    assert {item["bucket"] for item in payload["items"]} == {
        "expired",
        "d0_7",
        "d8_30",
        "d31_60",
    }
    payload_text = str(payload)
    assert "Other Expiry Medicine" not in payload_text
    assert "Ignored Expiry Medicine" not in payload_text


@pytest.mark.django_db
def test_stock_review_queue_combines_signals_without_duplicates(client, analytics_data):
    today = timezone.now().date()
    medication = make_medication(analytics_data["group_one"], "Queue Medicine")
    stock_item = make_stock_item(
        analytics_data["pharmacy_one"],
        medication,
        reorder_level=20,
    )
    batch = make_batch(
        stock_item,
        "QUEUE-001",
        quantity=3,
        expiry_date=today + timedelta(days=5),
    )
    patient = make_patient(analytics_data["pharmacy_one"], "PRIVATE-QUEUE-001")
    PatientMedication.objects.create(
        patient=patient,
        medication=medication,
        quantity_morning=2,
    )
    make_cycle(
        patient,
        "QUEUE-CYCLE-001",
        start_date=today,
        end_date=today + timedelta(days=6),
    )
    make_outbound_movement(
        stock_item,
        batch,
        quantity=2,
        created_at=timezone.now(),
    )
    run = ForecastRun.objects.create(
        pharmacy=analytics_data["pharmacy_one"],
        group=analytics_data["group_one"],
        horizon_days=30,
        lookback_days=90,
        generated_by=analytics_data["pharmacist"],
        status=ForecastRun.Status.COMPLETED,
    )
    ForecastItem.objects.create(
        run=run,
        stock_item=stock_item,
        medication_label="Queue Medicine",
        predicted_usage_units=25,
        current_stock_units=3,
        safety_stock_units=20,
        suggested_reorder_units=42,
        confidence="0.35",
        explanation="Forecast confidence reflects limited movement history.",
        history_points_count=1,
        window_days=90,
    )

    authenticate(client, analytics_data["pharmacist"])
    response = client.get(
        "/api/analytics/stock-review-queue/",
        {"pharmacy": analytics_data["pharmacy_one"].id},
    )

    assert response.status_code == 200
    payload = response.json()
    stock_item_ids = [item["stock_item_id"] for item in payload["items"]]
    assert stock_item_ids.count(stock_item.id) == 1
    queue_item = payload["items"][0]
    assert queue_item["medication_name"] == "Queue Medicine"
    assert queue_item["risk_level"] == "high"
    assert queue_item["required_units"] == 14
    assert queue_item["available_units"] == 3
    assert queue_item["shortfall_units"] == 11
    assert queue_item["forecast_confidence_label"] == "Low confidence"
    assert set(queue_item["reason_chips"]) >= {
        "MDS shortfall",
        "Low stock",
        "Expiry risk",
        "Low confidence",
        "Order review",
    }
    assert payload["summary"]["mds_shortfall"] == 1
    assert payload["summary"]["expiry_risk"] == 1
    assert payload["summary"]["low_confidence"] == 1
    payload_text = str(payload)
    assert "PRIVATE-QUEUE" not in payload_text
    assert "PrivateFirst" not in payload_text


@pytest.mark.django_db
def test_mds_demand_reports_mapping_needed_without_patient_pii(client, analytics_data):
    today = timezone.now().date()
    medication = make_medication(analytics_data["group_one"], "Mapping Needed Medicine")
    patient = make_patient(analytics_data["pharmacy_one"], "PRIVATE-MAPPING-001")
    PatientMedication.objects.create(
        patient=patient,
        medication=medication,
        quantity_morning=1,
    )
    make_cycle(
        patient,
        "MAPPING-CYCLE-001",
        start_date=today,
        end_date=today + timedelta(days=6),
    )

    authenticate(client, analytics_data["pharmacist"])
    response = client.get("/api/analytics/mds-demand/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0]["mapping_status"] == "mapping_needed"
    assert payload["items"][0]["shortfall_units"] == 7
    payload_text = str(payload)
    assert "PRIVATE-MAPPING" not in payload_text
    assert "PrivateFirst" not in payload_text
