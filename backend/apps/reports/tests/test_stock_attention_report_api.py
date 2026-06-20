import csv
from datetime import date, timedelta
from io import StringIO

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalogue.models import Medication, MedicationForm
from apps.inventory.models import MovementType, StockBatch, StockItem, StockMovement
from apps.patients.models import Patient
from apps.reports.csv import CSV_COLUMNS
from apps.reports.services import ALLOWED_STOCK_ATTENTION_FLAGS
from apps.tenancy.models import Group, Membership, Pharmacy, Role

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
) -> StockBatch:
    return StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=batch_number,
        expiry_date=expiry_date,
        quantity=quantity,
        quantity_received=quantity,
        received_at=timezone.now().date(),
    )


def make_outbound(stock_item: StockItem, batch: StockBatch, *, quantity: int) -> None:
    StockMovement.objects.create(
        stock_item=stock_item,
        batch=batch,
        movement_type=MovementType.ADJUSTMENT,
        quantity_delta=-quantity,
        balance_after=batch.quantity,
        reference="reports-test",
    )


@pytest.fixture
def reports_data():
    today = timezone.now().date()
    group_one = Group.objects.create(name="Group One", slug="reports-one")
    group_two = Group.objects.create(name="Group Two", slug="reports-two")
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

    stockout = make_stock_item(
        pharmacy_one,
        make_medication(group_one, "A Stockout Medicine"),
        reorder_level=20,
    )
    near_expiry = make_stock_item(
        pharmacy_one,
        make_medication(group_one, "Near Expiry Medicine"),
    )
    low_stock = make_stock_item(
        pharmacy_two,
        make_medication(group_one, "Low Stock Medicine"),
        reorder_level=20,
    )
    slow_moving = make_stock_item(
        pharmacy_two,
        make_medication(group_one, "Slow Moving Medicine"),
    )
    no_attention = make_stock_item(
        pharmacy_one,
        make_medication(group_one, "No Attention Medicine"),
    )
    out_of_scope_group = make_stock_item(
        pharmacy_other,
        make_medication(group_two, "Other Group Medicine"),
    )
    out_of_scope_pharmacy = make_stock_item(
        pharmacy_three,
        make_medication(group_one, "Other Pharmacy Medicine"),
    )

    make_batch(
        stockout,
        "STOCKOUT-ZERO",
        quantity=0,
        expiry_date=today + timedelta(days=120),
    )
    make_batch(
        near_expiry,
        "NEAR-001",
        quantity=8,
        expiry_date=today + timedelta(days=10),
    )
    make_batch(
        low_stock,
        "LOW-001",
        quantity=3,
        expiry_date=today + timedelta(days=120),
    )
    slow_batch = make_batch(
        slow_moving,
        "SLOW-001",
        quantity=9,
        expiry_date=today + timedelta(days=120),
    )
    no_attention_batch = make_batch(
        no_attention,
        "NOATTN-001",
        quantity=30,
        expiry_date=today + timedelta(days=120),
    )
    make_batch(
        out_of_scope_group,
        "OTHER-GROUP-001",
        quantity=10,
        expiry_date=today + timedelta(days=120),
    )
    make_batch(
        out_of_scope_pharmacy,
        "OTHER-PHARMACY-001",
        quantity=10,
        expiry_date=today + timedelta(days=120),
    )
    make_outbound(slow_moving, slow_batch, quantity=2)
    make_outbound(no_attention, no_attention_batch, quantity=9)

    stock_employee = make_user("reports-stock@example.com")
    dispenser = make_user("reports-dispenser@example.com")
    outsider = make_user("reports-outsider@example.com")
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group_one,
        pharmacies=(pharmacy_one, pharmacy_two),
    )
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy_one)

    return {
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "pharmacy_three": pharmacy_three,
        "stockout": stockout,
        "near_expiry": near_expiry,
        "low_stock": low_stock,
        "slow_moving": slow_moving,
        "no_attention": no_attention,
        "out_of_scope_group": out_of_scope_group,
        "out_of_scope_pharmacy": out_of_scope_pharmacy,
        "stock_employee": stock_employee,
        "dispenser": dispenser,
        "outsider": outsider,
    }


def stock_attention_url() -> str:
    return "/api/reports/stock/attention/"


def stock_attention_csv_url() -> str:
    return "/api/reports/stock/attention.csv"


def row_ids(response) -> set[int]:
    return {row["stock_item_id"] for row in response.json()["rows"]}


def csv_rows(response):
    return list(StringIO(response.content.decode()).read().splitlines())


@pytest.mark.django_db
def test_stock_attention_report_rbac(client, reports_data):
    authenticate(client, reports_data["stock_employee"])

    json_response = client.get(stock_attention_url())
    csv_response = client.get(stock_attention_csv_url())

    assert json_response.status_code == 200
    assert csv_response.status_code == 200

    client.logout()
    authenticate(client, reports_data["outsider"])
    assert client.get(stock_attention_url()).status_code == 403
    assert client.get(stock_attention_csv_url()).status_code == 403


@pytest.mark.django_db
def test_stock_attention_report_tenant_scoping_and_pharmacy_filter(
    client,
    reports_data,
):
    authenticate(client, reports_data["stock_employee"])

    response = client.get(stock_attention_url())

    assert response.status_code == 200
    assert row_ids(response) == {
        reports_data["stockout"].id,
        reports_data["near_expiry"].id,
        reports_data["low_stock"].id,
        reports_data["slow_moving"].id,
        reports_data["no_attention"].id,
    }
    assert reports_data["out_of_scope_group"].id not in row_ids(response)
    assert reports_data["out_of_scope_pharmacy"].id not in row_ids(response)

    narrowed = client.get(
        stock_attention_url(), {"pharmacy": reports_data["pharmacy_one"].id}
    )
    assert narrowed.status_code == 200
    assert row_ids(narrowed) == {
        reports_data["stockout"].id,
        reports_data["near_expiry"].id,
        reports_data["no_attention"].id,
    }


@pytest.mark.django_db
@pytest.mark.parametrize("flag", sorted(ALLOWED_STOCK_ATTENTION_FLAGS))
def test_stock_attention_report_flag_filters(client, reports_data, flag):
    authenticate(client, reports_data["stock_employee"])

    response = client.get(stock_attention_url(), {"flag": flag})

    assert response.status_code == 200
    payload = response.json()
    assert payload["filters"]["flag"] == flag
    assert payload["row_count"] == len(payload["rows"])
    assert payload["rows"]
    assert all(row["flags"][flag] is True for row in payload["rows"])


@pytest.mark.django_db
def test_stock_attention_report_needs_attention_filter(client, reports_data):
    authenticate(client, reports_data["stock_employee"])

    response = client.get(stock_attention_url(), {"needs_attention": "true"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["filters"]["needs_attention"] is True
    assert reports_data["no_attention"].id not in row_ids(response)
    assert all(any(row["flags"].values()) for row in payload["rows"])


@pytest.mark.django_db
def test_stock_attention_report_invalid_query_values(client, reports_data):
    authenticate(client, reports_data["stock_employee"])

    invalid_pharmacy = client.get(stock_attention_url(), {"pharmacy": "bad"})
    invalid_flag = client.get(stock_attention_url(), {"flag": "unsupported"})

    assert invalid_pharmacy.status_code == 400
    assert invalid_pharmacy.json() == {
        "pharmacy": ["Pharmacy filter must be an integer."]
    }
    assert invalid_flag.status_code == 400
    assert invalid_flag.json() == {
        "flag": ["Unsupported stock attention flag: unsupported."]
    }


@pytest.mark.django_db
def test_stock_attention_json_envelope_and_full_scope_summary(client, reports_data):
    authenticate(client, reports_data["stock_employee"])

    full = client.get(stock_attention_url())
    filtered = client.get(stock_attention_url(), {"flag": "stockout"})

    assert full.status_code == 200
    assert filtered.status_code == 200
    payload = filtered.json()
    assert payload["report"] == "stock_attention"
    assert payload["generated_at"]
    assert payload["thresholds"]
    assert payload["filters"] == {
        "pharmacy_id": None,
        "flag": "stockout",
        "needs_attention": False,
    }
    assert payload["summary"] == full.json()["summary"]
    assert payload["row_count"] == len(payload["rows"])
    assert payload["row_count"] < full.json()["row_count"]


@pytest.mark.django_db
def test_stock_attention_csv_response_and_content(client, reports_data):
    authenticate(client, reports_data["stock_employee"])
    json_response = client.get(stock_attention_url(), {"flag": "stockout"})
    csv_response = client.get(stock_attention_csv_url(), {"flag": "stockout"})

    assert csv_response.status_code == 200
    assert "text/csv" in csv_response["Content-Type"]
    assert "attachment" in csv_response["Content-Disposition"]
    assert "stock-attention-report.csv" in csv_response["Content-Disposition"]

    decoded = csv_response.content.decode()
    reader = csv.DictReader(StringIO(decoded))
    rows = list(reader)
    assert reader.fieldnames == CSV_COLUMNS
    assert len(rows) == json_response.json()["row_count"]
    assert rows
    json_row = json_response.json()["rows"][0]
    csv_row = rows[0]
    assert csv_row["stock_item_id"] == str(json_row["stock_item_id"])
    assert csv_row["medication_name"] == json_row["medication_name"]
    assert csv_row["stockout"] == "true"
    assert csv_row["reasons"] == "; ".join(json_row["reasons"])


@pytest.mark.django_db
def test_stock_attention_empty_state_json_and_csv(client, reports_data):
    authenticate(client, reports_data["dispenser"])

    json_response = client.get(
        stock_attention_url(),
        {"pharmacy": reports_data["pharmacy_two"].id},
    )
    csv_response = client.get(
        stock_attention_csv_url(),
        {"pharmacy": reports_data["pharmacy_two"].id},
    )

    assert json_response.status_code == 200
    assert json_response.json()["row_count"] == 0
    assert json_response.json()["rows"] == []
    assert csv_response.status_code == 200
    assert csv_rows(csv_response) == [",".join(CSV_COLUMNS)]


@pytest.mark.django_db
def test_stock_attention_reports_do_not_leak_patient_data(client, reports_data):
    Patient.objects.create(
        pharmacy=reports_data["pharmacy_one"],
        patient_reference="PRIVATE-REPORT-PATIENT",
        first_name="PrivateFirst",
        last_name="PrivateLast",
        date_of_birth=date(1980, 1, 1),
        address="Private Address",
        phone="020 0000 0000",
        notes="Private report note body",
    )
    authenticate(client, reports_data["stock_employee"])

    json_response = client.get(stock_attention_url())
    csv_response = client.get(stock_attention_csv_url())

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
        "PRIVATE-REPORT-PATIENT",
        "PrivateFirst",
        "PrivateLast",
        "Private Address",
        "020 0000 0000",
        "Private report note body",
    ]:
        assert forbidden not in combined
