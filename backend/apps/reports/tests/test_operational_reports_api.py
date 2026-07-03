import csv
from datetime import date, timedelta
from decimal import Decimal
from io import StringIO

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.analytics.models import ForecastItem, ForecastRun, TransferSuggestion
from apps.blister.models import CycleFrequency, CycleStatus, DosetteCycle
from apps.catalogue.models import CatalogueProduct, Medication, MedicationForm
from apps.inventory.models import MovementType, StockBatch, StockItem, StockMovement
from apps.patients.models import Patient
from apps.reports.csv import (
    DEAD_STOCK_CSV_COLUMNS,
    EXPIRY_CSV_COLUMNS,
    FORECAST_REORDER_CSV_COLUMNS,
    MDS_WORKLOAD_CSV_COLUMNS,
    TRANSFER_SUGGESTIONS_CSV_COLUMNS,
)
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


def make_product(name="Paracetamol 500mg tablets", *, pack_size=100):
    return CatalogueProduct.objects.create(
        dmd_code=f"REPORT-{name[:8].upper()}",
        source="SEED",
        display_name=name,
        ingredient=name.split()[0],
        strength="500mg",
        dose_form="tablets",
        pack_size=pack_size,
        pack_unit="tablets",
    )


def make_medication(group: Group, name: str, product=None) -> Medication:
    return Medication.objects.create(
        group=group,
        catalogue_product=product,
        name=name,
        form=MedicationForm.TABLET,
        strength="500mg",
    )


def make_stock_item(
    pharmacy: Pharmacy,
    medication: Medication,
    *,
    quantity: int,
    expiry_date: date | None = None,
) -> StockItem:
    stock_item = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=medication,
        reorder_level=20,
    )
    StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=f"BATCH-{stock_item.id}",
        expiry_date=expiry_date or timezone.now().date() + timedelta(days=365),
        quantity=quantity,
        quantity_received=quantity,
        received_at=timezone.now().date() - timedelta(days=30),
    )
    return stock_item


def make_outbound(stock_item: StockItem, *, quantity: int, days_ago: int):
    movement = StockMovement.objects.create(
        stock_item=stock_item,
        batch=stock_item.batches.first(),
        movement_type=MovementType.ADJUSTMENT,
        quantity_delta=-quantity,
        balance_after=stock_item.batches.first().quantity,  # type: ignore[union-attr]  # batch created above
        reference="operational-report-test",
    )
    StockMovement.objects.filter(pk=movement.pk).update(
        created_at=timezone.now() - timedelta(days=days_ago)
    )
    movement.refresh_from_db()
    return movement


def csv_dict_rows(response):
    reader = csv.DictReader(StringIO(response.content.decode()))
    return reader.fieldnames, list(reader)


@pytest.fixture
def operational_data():
    today = timezone.now().date()
    group_one = Group.objects.create(name="Reports Group", slug="reports-group")
    group_two = Group.objects.create(name="Other Group", slug="other-reports-group")
    pharmacy_one = Pharmacy.objects.create(
        group=group_one,
        name="Sutton Pharmacy",
        code="SUT",
    )
    pharmacy_two = Pharmacy.objects.create(
        group=group_one,
        name="Wimbledon Pharmacy",
        code="WIM",
    )
    other_pharmacy = Pharmacy.objects.create(
        group=group_two,
        name="Other Pharmacy",
        code="OTH",
    )

    admin = make_user("reports-admin@example.com")
    superintendent = make_user("reports-superintendent@example.com")
    pharmacist = make_user("reports-pharmacist@example.com")
    stock_employee = make_user("reports-stock@example.com")
    outsider = make_user("reports-outsider@example.com")

    add_membership(admin, Role.ADMIN)
    add_membership(superintendent, Role.SUPERINTENDENT, group=group_one)
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy_one)
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group_one,
        pharmacies=(pharmacy_one, pharmacy_two),
    )

    product = make_product()
    medication_one = make_medication(group_one, product.display_name, product)
    medication_two = Medication.objects.get(group=group_one, catalogue_product=product)
    active_medication = make_medication(group_one, "Active medicine")
    other_medication = make_medication(group_two, "Other tenant medicine")
    expiring_stock = make_stock_item(
        pharmacy_one,
        medication_one,
        quantity=20,
        expiry_date=today + timedelta(days=5),
    )
    active_stock = make_stock_item(pharmacy_one, active_medication, quantity=40)
    destination_stock = make_stock_item(pharmacy_two, medication_two, quantity=10)
    other_stock = make_stock_item(other_pharmacy, other_medication, quantity=90)
    make_outbound(active_stock, quantity=10, days_ago=3)
    make_outbound(destination_stock, quantity=30, days_ago=2)
    make_outbound(other_stock, quantity=9, days_ago=1)

    old_run = ForecastRun.objects.create(
        pharmacy=pharmacy_one,
        group=group_one,
        generated_by=pharmacist,
        status=ForecastRun.Status.COMPLETED,
    )
    ForecastItem.objects.create(
        run=old_run,
        stock_item=active_stock,
        catalogue_product=product,
        medication_label="Old forecast",
        predicted_usage_units=1,
        current_stock_units=40,
        safety_stock_units=5,
        suggested_reorder_units=0,
        suggested_reorder_packs=0,
        confidence=Decimal("0.10"),
        explanation="Old safe forecast. Human review required before ordering.",
    )
    latest_run = ForecastRun.objects.create(
        pharmacy=pharmacy_one,
        group=group_one,
        generated_by=pharmacist,
        status=ForecastRun.Status.COMPLETED,
    )
    ForecastItem.objects.create(
        run=latest_run,
        stock_item=expiring_stock,
        catalogue_product=product,
        medication_label=product.full_label,
        predicted_usage_units=80,
        current_stock_units=20,
        safety_stock_units=20,
        suggested_reorder_units=80,
        suggested_reorder_packs=1,
        confidence=Decimal("0.80"),
        explanation="Forecast suggestion only; human review required before ordering.",
    )

    TransferSuggestion.objects.create(
        group=group_one,
        catalogue_product=product,
        medication_label=product.full_label,
        source_pharmacy=pharmacy_one,
        destination_pharmacy=pharmacy_two,
        source_stock_item=expiring_stock,
        destination_stock_item=destination_stock,
        suggested_quantity_units=12,
        suggested_quantity_packs=1,
        current_source_stock_units=20,
        destination_recent_usage_units=30,
        confidence=Decimal("0.65"),
        reason="Human review required before transfer.",
        status=TransferSuggestion.Status.OPEN,
        generated_by=superintendent,
    )
    TransferSuggestion.objects.create(
        group=group_two,
        medication_label="Other group suggestion",
        source_pharmacy=other_pharmacy,
        destination_pharmacy=other_pharmacy,
        suggested_quantity_units=5,
        confidence=Decimal("0.55"),
        reason="Other group only.",
        status=TransferSuggestion.Status.OPEN,
    )

    patient = Patient.objects.create(
        pharmacy=pharmacy_one,
        patient_reference="PRIVATE-MDS-PATIENT",
        first_name="Private",
        last_name="Patient",
        date_of_birth=date(1970, 1, 1),
        address="Private Address",
        postcode="PR1 1VA",
        phone="020 0000 0000",
        notes="Private patient note",
    )
    DosetteCycle.objects.create(
        patient=patient,
        reference="CYCLE-1",
        frequency=CycleFrequency.WEEKLY,
        start_date=today,
        end_date=today + timedelta(days=6),
        status=CycleStatus.DRAFT,
    )
    DosetteCycle.objects.create(
        patient=patient,
        reference="CYCLE-2",
        frequency=CycleFrequency.WEEKLY,
        start_date=today - timedelta(days=14),
        end_date=today - timedelta(days=7),
        status=CycleStatus.PREPARED,
    )

    return {
        "group_one": group_one,
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "other_pharmacy": other_pharmacy,
        "expiring_stock": expiring_stock,
        "latest_run": latest_run,
        "admin": admin,
        "superintendent": superintendent,
        "pharmacist": pharmacist,
        "stock_employee": stock_employee,
        "outsider": outsider,
    }


@pytest.mark.django_db
def test_expiry_report_scopes_rows_and_exports_csv(client, operational_data):
    authenticate(client, operational_data["stock_employee"])

    response = client.get("/api/reports/expiry/", {"days": 30})
    csv_response = client.get("/api/reports/expiry.csv", {"days": 30})

    assert response.status_code == 200
    payload = response.json()
    assert payload["row_count"] == 1
    row = payload["rows"][0]
    assert row["pharmacy_id"] == operational_data["pharmacy_one"].id
    assert row["days_until_expiry"] == 5
    assert row["severity"] == "critical"

    fieldnames, rows = csv_dict_rows(csv_response)
    assert csv_response.status_code == 200
    assert fieldnames == EXPIRY_CSV_COLUMNS
    assert rows[0]["batch_number"] == row["batch_number"]
    assert "Other Pharmacy" not in csv_response.content.decode()


@pytest.mark.django_db
def test_dead_stock_report_uses_scope_and_excludes_patient_pii(
    client,
    operational_data,
):
    authenticate(client, operational_data["stock_employee"])

    response = client.get("/api/reports/dead-stock/", {"days": 90})
    csv_response = client.get("/api/reports/dead-stock.csv", {"days": 90})

    assert response.status_code == 200
    assert csv_response.status_code == 200
    statuses = {row["status"] for row in response.json()["rows"]}
    assert "dead" in statuses
    assert "active" in statuses

    fieldnames, _rows = csv_dict_rows(csv_response)
    assert fieldnames == DEAD_STOCK_CSV_COLUMNS
    combined = f"{response.json()} {csv_response.content.decode()}"
    for forbidden in [
        "PRIVATE-MDS-PATIENT",
        "Private",
        "Patient",
        "date_of_birth",
        "postcode",
    ]:
        assert forbidden not in combined


@pytest.mark.django_db
def test_forecast_report_uses_latest_forecast_run_and_exports_csv(
    client,
    operational_data,
):
    authenticate(client, operational_data["pharmacist"])

    response = client.get(
        "/api/reports/forecast-reorder/",
        {"pharmacy": operational_data["pharmacy_one"].id},
    )
    csv_response = client.get(
        "/api/reports/forecast-reorder.csv",
        {"pharmacy": operational_data["pharmacy_one"].id},
    )

    assert response.status_code == 200
    rows = response.json()["rows"]
    assert len(rows) == 1
    assert rows[0]["forecast_run_id"] == operational_data["latest_run"].id
    assert rows[0]["suggested_reorder_units"] == 80
    assert rows[0]["human_review_required"] is True

    fieldnames, csv_rows = csv_dict_rows(csv_response)
    assert fieldnames == FORECAST_REORDER_CSV_COLUMNS
    assert csv_rows[0]["forecast_run_id"] == str(operational_data["latest_run"].id)
    assert "patient" not in csv_response.content.decode().lower()


@pytest.mark.django_db
def test_transfer_suggestion_report_is_admin_superintendent_only_and_scoped(
    client,
    operational_data,
):
    authenticate(client, operational_data["superintendent"])

    response = client.get(
        "/api/reports/transfer-suggestions/",
        {"group": operational_data["group_one"].id, "status": "OPEN"},
    )
    csv_response = client.get(
        "/api/reports/transfer-suggestions.csv",
        {"group": operational_data["group_one"].id, "status": "OPEN"},
    )

    assert response.status_code == 200
    assert response.json()["row_count"] == 1
    assert response.json()["rows"][0]["source_pharmacy_name"] == "Sutton Pharmacy"
    assert response.json()["rows"][0]["human_review_required"] is True
    assert "Other group suggestion" not in str(response.json())

    fieldnames, rows = csv_dict_rows(csv_response)
    assert fieldnames == TRANSFER_SUGGESTIONS_CSV_COLUMNS
    assert rows[0]["status"] == TransferSuggestion.Status.OPEN

    client.logout()
    authenticate(client, operational_data["stock_employee"])
    denied = client.get(
        "/api/reports/transfer-suggestions/",
        {"group": operational_data["group_one"].id},
    )
    assert denied.status_code == 403


@pytest.mark.django_db
def test_mds_workload_report_is_aggregate_and_pii_free(client, operational_data):
    authenticate(client, operational_data["pharmacist"])

    response = client.get("/api/reports/mds-workload/", {"days": 30})
    csv_response = client.get("/api/reports/mds-workload.csv", {"days": 30})

    assert response.status_code == 200
    payload = response.json()
    assert payload["row_count"] == 2
    assert {row["cycle_status"] for row in payload["rows"]} == {
        CycleStatus.DRAFT,
        CycleStatus.PREPARED,
    }
    assert sum(row["due_count"] for row in payload["rows"]) == 1
    assert sum(row["overdue_count"] for row in payload["rows"]) == 1

    fieldnames, _rows = csv_dict_rows(csv_response)
    assert fieldnames == MDS_WORKLOAD_CSV_COLUMNS
    combined = f"{payload} {csv_response.content.decode()}"
    for forbidden in [
        "PRIVATE-MDS-PATIENT",
        "Private",
        "Patient",
        "date_of_birth",
        "postcode",
        "Private Address",
    ]:
        assert forbidden not in combined


@pytest.mark.django_db
def test_reports_dashboard_returns_permission_aware_cards(client, operational_data):
    authenticate(client, operational_data["pharmacist"])

    response = client.get(
        "/api/reports/dashboard/",
        {"pharmacy": operational_data["pharmacy_one"].id},
    )

    assert response.status_code == 200
    reports = {card["report"] for card in response.json()["cards"]}
    assert "stock_attention" in reports
    assert "forecast_reorder" in reports
    assert "mds_workload" in reports
    assert "transfer_suggestions" not in reports
