"""Shared pytest fixtures."""
from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.stock.models import Medicine, StockBatch, Supplier

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def users(db):
    out = {}
    for username, role in [("admin", "administrator"), ("pharm", "pharmacist"), ("disp", "dispenser")]:
        u = User.objects.create_user(username=username, password="Password123!", role=role)
        if role == "administrator":
            u.is_superuser = u.is_staff = True
            u.save()
        out[role] = u
    return out


@pytest.fixture
def auth(api, users):
    def _login(role):
        res = api.post("/api/auth/login/", {"username": {
            "administrator": "admin", "pharmacist": "pharm", "dispenser": "disp"
        }[role], "password": "Password123!"}, format="json")
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        return api
    return _login


@pytest.fixture
def supplier(db):
    return Supplier.objects.create(name="AAH", lead_time_days=2)


@pytest.fixture
def medicine(db, supplier):
    return Medicine.objects.create(
        name="Amlodipine", strength="5mg", form="tablet", pack_size=28,
        unit_cost="0.03", reorder_level=200, reorder_quantity=400,
        default_supplier=supplier,
    )


@pytest.fixture
def batches(db, medicine, supplier):
    today = date.today()
    b1 = StockBatch.objects.create(
        medicine=medicine, supplier=supplier, batch_number="OLD1",
        expiry_date=today + timedelta(days=20), quantity_received=100,
        quantity_on_hand=100, unit_cost="0.03")
    b2 = StockBatch.objects.create(
        medicine=medicine, supplier=supplier, batch_number="NEW1",
        expiry_date=today + timedelta(days=300), quantity_received=200,
        quantity_on_hand=200, unit_cost="0.03")
    return [b1, b2]
