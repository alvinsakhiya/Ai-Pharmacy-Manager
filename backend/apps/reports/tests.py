"""Dashboard and report input-validation tests."""
import pytest


@pytest.mark.django_db
def test_stock_trend_rejects_invalid_days(auth):
    client = auth("dispenser")
    assert client.get("/api/dashboard/stock-trend/?days=invalid").status_code == 400
    assert client.get("/api/dashboard/stock-trend/?days=0").status_code == 400
    assert client.get("/api/dashboard/stock-trend/?days=366").status_code == 400


@pytest.mark.django_db
def test_stock_trend_accepts_supported_range(auth):
    response = auth("dispenser").get("/api/dashboard/stock-trend/?days=90")
    assert response.status_code == 200
