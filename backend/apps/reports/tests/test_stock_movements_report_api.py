import csv
from datetime import date, datetime
from io import StringIO
from zoneinfo import ZoneInfo

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalogue.models import Medication, MedicationForm
from apps.inventory.models import StockBatch, StockItem, StockMovement
from apps.patients.models import Patient
from apps.reports.csv import MOVEMENT_CSV_COLUMNS
from apps.tenancy.models import Group, Membership, Pharmacy, Role

PASSWORD = "Initial-pass-123!"
RECEIPT = "RECEIPT"
ADJUSTMENT = "ADJUSTMENT"
COUNT_CORRECTION = "COUNT_CORRECTION"


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


def make_stock_item(pharmacy: Pharmacy, medication: Medication) -> StockItem:
    return StockItem.objects.create(
        pharmacy=pharmacy,
        medication=medication,
        reorder_level=10,
    )


def make_batch(stock_item: StockItem, batch_number: str) -> StockBatch:
    return StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=batch_number,
        expiry_date=date(2027, 1, 31),
        quantity=100,
        quantity_received=100,
        received_at=date(2026, 1, 1),
    )


def make_movement(
    stock_item: StockItem,
    batch: StockBatch | None,
    *,
    movement_type: str = RECEIPT,
    quantity_delta: int = 10,
    balance_after: int = 100,
    reference: str = "movement-report-ref",
    created_at: datetime | None = None,
    actor=None,
    reason: str = "Private staff reason",
) -> StockMovement:
    movement = StockMovement.objects.create(
        stock_item=stock_item,
        batch=batch,
        movement_type=movement_type,
        quantity_delta=quantity_delta,
        balance_after=balance_after,
        reference=reference,
        actor=actor,
        reason=reason,
    )
    if created_at is not None:
        StockMovement.objects.filter(pk=movement.pk).update(created_at=created_at)
        movement.refresh_from_db()
    return movement


def aware_datetime(year: int, month: int, day: int, hour: int) -> datetime:
    return datetime(year, month, day, hour, tzinfo=ZoneInfo("Europe/London"))


@pytest.fixture
def movements_data():
    group_one = Group.objects.create(name="Group One", slug="movement-reports-one")
    group_two = Group.objects.create(name="Group Two", slug="movement-reports-two")
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

    medication_one = make_medication(group_one, "Amlodipine")
    medication_two = make_medication(group_one, "Bisoprolol")
    medication_three = make_medication(group_one, "Cetirizine")
    medication_other = make_medication(group_two, "Other Tenant Medicine")

    stock_one = make_stock_item(pharmacy_one, medication_one)
    stock_two = make_stock_item(pharmacy_two, medication_two)
    stock_three = make_stock_item(pharmacy_three, medication_three)
    stock_other = make_stock_item(pharmacy_other, medication_other)
    batch_one = make_batch(stock_one, "AML-001")
    batch_two = make_batch(stock_two, "BIS-001")
    batch_three = make_batch(stock_three, "CET-001")
    batch_other = make_batch(stock_other, "OTHER-001")

    actor = make_user("movement-actor@example.com")
    in_scope_old = make_movement(
        stock_one,
        batch_one,
        movement_type=RECEIPT,
        quantity_delta=100,
        balance_after=100,
        reference="receipt-one",
        created_at=aware_datetime(2026, 6, 1, 9),
        actor=actor,
        reason="Sensitive stock receipt reason",
    )
    in_scope_newer_low_id = make_movement(
        stock_two,
        batch_two,
        movement_type=ADJUSTMENT,
        quantity_delta=-2,
        balance_after=98,
        reference="adjust-two",
        created_at=aware_datetime(2026, 6, 2, 10),
        actor=actor,
    )
    in_scope_newer_high_id = make_movement(
        stock_one,
        None,
        movement_type=COUNT_CORRECTION,
        quantity_delta=5,
        balance_after=105,
        reference="count-one",
        created_at=aware_datetime(2026, 6, 2, 10),
        actor=actor,
    )
    cross_pharmacy = make_movement(
        stock_three,
        batch_three,
        movement_type=RECEIPT,
        quantity_delta=50,
        balance_after=50,
        reference="cross-pharmacy",
        created_at=aware_datetime(2026, 6, 3, 10),
        actor=actor,
    )
    cross_tenant = make_movement(
        stock_other,
        batch_other,
        movement_type=RECEIPT,
        quantity_delta=50,
        balance_after=50,
        reference="cross-tenant",
        created_at=aware_datetime(2026, 6, 4, 10),
        actor=actor,
    )

    stock_employee = make_user("movement-stock@example.com")
    dispenser = make_user("movement-dispenser@example.com")
    outsider = make_user("movement-outsider@example.com")
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group_one,
        pharmacies=(pharmacy_one, pharmacy_two),
    )
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy_one)

    return {
        "group_one": group_one,
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "pharmacy_three": pharmacy_three,
        "stock_one": stock_one,
        "stock_two": stock_two,
        "stock_three": stock_three,
        "stock_other": stock_other,
        "medication_one": medication_one,
        "medication_two": medication_two,
        "batch_one": batch_one,
        "in_scope_old": in_scope_old,
        "in_scope_newer_low_id": in_scope_newer_low_id,
        "in_scope_newer_high_id": in_scope_newer_high_id,
        "cross_pharmacy": cross_pharmacy,
        "cross_tenant": cross_tenant,
        "stock_employee": stock_employee,
        "dispenser": dispenser,
        "outsider": outsider,
        "actor": actor,
    }


def movements_url() -> str:
    return "/api/reports/stock/movements/"


def movements_csv_url() -> str:
    return "/api/reports/stock/movements.csv"


def movement_ids(response) -> list[int]:
    return [row["movement_id"] for row in response.json()["rows"]]


def csv_dict_rows(response):
    reader = csv.DictReader(StringIO(response.content.decode()))
    return reader.fieldnames, list(reader)


@pytest.mark.django_db
def test_stock_movements_report_rbac(client, movements_data):
    authenticate(client, movements_data["stock_employee"])

    json_response = client.get(movements_url())
    csv_response = client.get(movements_csv_url())

    assert json_response.status_code == 200
    assert csv_response.status_code == 200

    client.logout()
    authenticate(client, movements_data["outsider"])
    assert client.get(movements_url()).status_code == 403
    assert client.get(movements_csv_url()).status_code == 403


@pytest.mark.django_db
def test_stock_movements_report_tenant_scoping(client, movements_data):
    authenticate(client, movements_data["stock_employee"])

    response = client.get(movements_url())

    assert response.status_code == 200
    assert set(movement_ids(response)) == {
        movements_data["in_scope_old"].id,
        movements_data["in_scope_newer_low_id"].id,
        movements_data["in_scope_newer_high_id"].id,
    }
    assert movements_data["cross_pharmacy"].id not in movement_ids(response)
    assert movements_data["cross_tenant"].id not in movement_ids(response)


@pytest.mark.django_db
def test_stock_movements_report_filters(client, movements_data):
    authenticate(client, movements_data["stock_employee"])

    pharmacy_response = client.get(
        movements_url(),
        {"pharmacy": movements_data["pharmacy_one"].id},
    )
    medication_response = client.get(
        movements_url(),
        {"medication": movements_data["medication_two"].id},
    )
    stock_item_response = client.get(
        movements_url(),
        {"stock_item": movements_data["stock_one"].id},
    )
    type_response = client.get(
        movements_url(),
        {"movement_type": ADJUSTMENT},
    )
    date_response = client.get(
        movements_url(),
        {
            "date_from": "2026-06-02",
            "date_to": "2026-06-02",
        },
    )

    assert set(movement_ids(pharmacy_response)) == {
        movements_data["in_scope_old"].id,
        movements_data["in_scope_newer_high_id"].id,
    }
    assert movement_ids(medication_response) == [
        movements_data["in_scope_newer_low_id"].id
    ]
    assert set(movement_ids(stock_item_response)) == {
        movements_data["in_scope_old"].id,
        movements_data["in_scope_newer_high_id"].id,
    }
    assert movement_ids(type_response) == [movements_data["in_scope_newer_low_id"].id]
    assert movement_ids(date_response) == [
        movements_data["in_scope_newer_high_id"].id,
        movements_data["in_scope_newer_low_id"].id,
    ]


@pytest.mark.django_db
def test_stock_movements_report_limit_and_ordering(client, movements_data):
    authenticate(client, movements_data["stock_employee"])

    response = client.get(movements_url(), {"limit": 2})

    assert response.status_code == 200
    payload = response.json()
    assert payload["row_count"] == 2
    assert payload["limited"] is True
    assert movement_ids(response) == [
        movements_data["in_scope_newer_high_id"].id,
        movements_data["in_scope_newer_low_id"].id,
    ]
    assert payload["filters"]["limit"] == 2


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"pharmacy": "bad"}, {"pharmacy": ["Pharmacy filter must be an integer."]}),
        (
            {"medication": "bad"},
            {"medication": ["Medication filter must be an integer."]},
        ),
        (
            {"stock_item": "bad"},
            {"stock_item": ["Stock item filter must be an integer."]},
        ),
        (
            {"movement_type": "NOT_REAL"},
            {"movement_type": ["Unsupported movement type: NOT_REAL."]},
        ),
        ({"date_from": "not-a-date"}, {"date_from": ["Date must be in ISO format."]}),
        ({"date_to": "not-a-date"}, {"date_to": ["Date must be in ISO format."]}),
        ({"limit": "bad"}, {"limit": ["Limit must be an integer."]}),
        ({"limit": "0"}, {"limit": ["Limit must be at least 1."]}),
    ],
)
def test_stock_movements_report_invalid_query_values(
    client,
    movements_data,
    params,
    expected,
):
    authenticate(client, movements_data["stock_employee"])

    response = client.get(movements_url(), params)

    assert response.status_code == 400
    assert response.json() == expected


@pytest.mark.django_db
def test_stock_movements_report_csv_response_and_content(client, movements_data):
    authenticate(client, movements_data["stock_employee"])

    json_response = client.get(movements_url(), {"movement_type": RECEIPT})
    csv_response = client.get(
        movements_csv_url(),
        {"movement_type": RECEIPT},
    )

    assert csv_response.status_code == 200
    assert "text/csv" in csv_response["Content-Type"]
    assert "attachment" in csv_response["Content-Disposition"]
    assert "stock-movements-report.csv" in csv_response["Content-Disposition"]

    fieldnames, rows = csv_dict_rows(csv_response)
    assert fieldnames == MOVEMENT_CSV_COLUMNS
    assert len(rows) == json_response.json()["row_count"]
    assert rows
    json_row = json_response.json()["rows"][0]
    csv_row = rows[0]
    assert csv_row["movement_id"] == str(json_row["movement_id"])
    assert csv_row["medication_name"] == json_row["medication_name"]
    assert csv_row["created_at"] == json_row["created_at"]
    assert csv_row["batch_id"] == str(json_row["batch_id"])
    assert csv_row["batch_number"] == json_row["batch_number"]
    assert csv_row["reference"] == json_row["reference"]
    assert "reason" not in fieldnames
    assert "actor" not in fieldnames


@pytest.mark.django_db
def test_stock_movements_report_empty_state_json_and_csv(client, movements_data):
    authenticate(client, movements_data["dispenser"])

    json_response = client.get(
        movements_url(),
        {"pharmacy": movements_data["pharmacy_two"].id},
    )
    csv_response = client.get(
        movements_csv_url(),
        {"pharmacy": movements_data["pharmacy_two"].id},
    )

    assert json_response.status_code == 200
    assert json_response.json()["row_count"] == 0
    assert json_response.json()["rows"] == []
    assert json_response.json()["limited"] is False
    assert csv_response.status_code == 200
    assert csv_response.content.decode().splitlines() == [
        ",".join(MOVEMENT_CSV_COLUMNS)
    ]


@pytest.mark.django_db
def test_stock_movements_report_does_not_leak_patient_staff_or_reason_data(
    client,
    movements_data,
):
    Patient.objects.create(
        pharmacy=movements_data["pharmacy_one"],
        patient_reference="PRIVATE-MOVEMENT-PATIENT",
        first_name="MovementFirst",
        last_name="MovementLast",
        date_of_birth=date(1980, 1, 1),
        address="Movement Private Address",
        phone="020 0000 9999",
        notes="Movement patient note body",
    )
    authenticate(client, movements_data["stock_employee"])

    json_response = client.get(movements_url())
    csv_response = client.get(movements_csv_url())

    assert json_response.status_code == 200
    assert csv_response.status_code == 200
    combined = f"{json_response.json()} {csv_response.content.decode()}"
    for forbidden in [
        "patient_reference",
        "first_name",
        "last_name",
        "date_of_birth",
        "address",
        "phone",
        "dose_instructions",
        "note",
        "PRIVATE-MOVEMENT-PATIENT",
        "MovementFirst",
        "MovementLast",
        "Movement Private Address",
        "020 0000 9999",
        "Movement patient note body",
        "reason",
        "actor",
        "actor_id",
        "actor_email",
        "movement-actor@example.com",
        "Sensitive stock receipt reason",
    ]:
        assert forbidden not in combined
