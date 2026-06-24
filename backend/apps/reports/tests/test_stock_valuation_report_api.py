import csv
from decimal import Decimal
from io import StringIO

import pytest
from rest_framework.test import APIClient

from apps.reports.csv import STOCK_VALUATION_CSV_COLUMNS
from apps.tenancy.models import Group, Pharmacy, Role

from .test_operational_reports_api import (
    add_membership,
    make_medication,
    make_stock_item,
    make_user,
)


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def valuation_data():
    group = Group.objects.create(name="Val Group", slug="val-group")
    pharmacy = Pharmacy.objects.create(group=group, name="Val Pharmacy", code="VP")

    priced = make_medication(group, "Amlodipine 5mg")
    unpriced = make_medication(group, "Ibuprofen 400mg")

    priced_item = make_stock_item(pharmacy, priced, quantity=100)
    priced_item.unit_price = Decimal("0.50")
    priced_item.pack_price = Decimal("14.00")
    priced_item.save(update_fields=["unit_price", "pack_price"])

    # No price set on this one -> counts as unpriced, value null.
    make_stock_item(pharmacy, unpriced, quantity=40)

    admin = make_user("valuation-admin@example.com")
    add_membership(admin, Role.ADMIN)

    return {"group": group, "pharmacy": pharmacy, "admin": admin}


@pytest.mark.django_db
def test_valuation_report_totals_value_from_unit_price(client, valuation_data):
    client.force_login(valuation_data["admin"])
    response = client.get("/api/reports/stock/valuation/")
    assert response.status_code == 200
    body = response.json()

    assert body["report"] == "stock_valuation"
    # 100 units x 0.50 = 50.00 from the only priced item.
    assert Decimal(body["summary"]["total_value"]) == Decimal("50.00")
    assert body["summary"]["priced_items"] == 1
    assert body["summary"]["unpriced_items"] == 1
    assert body["summary"]["total_units"] == 140

    priced_row = next(
        r for r in body["rows"] if r["medication_label"] == "Amlodipine 5mg"
    )
    assert Decimal(priced_row["stock_value"]) == Decimal("50.00")
    assert priced_row["pack_price"] == "14.00"

    unpriced_row = next(
        r for r in body["rows"] if r["medication_label"] == "Ibuprofen 400mg"
    )
    assert unpriced_row["unit_price"] is None
    assert unpriced_row["stock_value"] is None


@pytest.mark.django_db
def test_valuation_report_csv_exports_value_column(client, valuation_data):
    client.force_login(valuation_data["admin"])
    response = client.get("/api/reports/stock/valuation.csv")
    assert response.status_code == 200
    assert response["Content-Type"] == "text/csv"

    rows = list(csv.DictReader(StringIO(response.content.decode())))
    assert "stock_value" in STOCK_VALUATION_CSV_COLUMNS
    priced = next(r for r in rows if r["medication_label"] == "Amlodipine 5mg")
    assert priced["stock_value"] == "50.00"
    assert priced["unit_price"] == "0.50"


@pytest.mark.django_db
def test_valuation_report_requires_stock_view(client, valuation_data):
    response = client.get("/api/reports/stock/valuation/")
    assert response.status_code in (401, 403)
