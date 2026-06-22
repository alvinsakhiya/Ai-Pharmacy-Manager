import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.tenancy.models import Group, Membership, Role

from .models import CatalogueProduct

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


@pytest.fixture
def product_api_data():
    Group.objects.create(name="Group One", slug="catalogue-product-api-one")
    amlodipine_5 = CatalogueProduct.objects.create(
        dmd_code="SEED-AMLO-5",
        source="SEED",
        display_name="Amlodipine 5mg tablets",
        ingredient="Amlodipine",
        strength="5mg",
        dose_form="tablets",
        pack_size=28,
    )
    amlodipine_10 = CatalogueProduct.objects.create(
        dmd_code="SEED-AMLO-10",
        source="SEED",
        display_name="Amlodipine 10mg tablets",
        ingredient="Amlodipine",
        strength="10mg",
        dose_form="tablets",
        pack_size=28,
    )
    paracetamol = CatalogueProduct.objects.create(
        dmd_code="SEED-PARA-500",
        source="SEED",
        display_name="Paracetamol 500mg tablets",
        ingredient="Paracetamol",
        strength="500mg",
        dose_form="tablets",
        pack_size=100,
    )
    inactive = CatalogueProduct.objects.create(
        dmd_code="SEED-INACTIVE",
        source="SEED",
        display_name="Inactive 5mg tablets",
        ingredient="Inactive",
        strength="5mg",
        dose_form="tablets",
        pack_size=28,
        is_active=False,
    )
    user = make_user("catalogue-product-admin@example.com")
    Membership.objects.create(user=user, role=Role.ADMIN)
    return {
        "user": user,
        "amlodipine_5": amlodipine_5,
        "amlodipine_10": amlodipine_10,
        "paracetamol": paracetamol,
        "inactive": inactive,
    }


def authenticate(client, user):
    client.force_login(user)


@pytest.mark.django_db
def test_catalogue_product_search_matches_partial_ingredient(
    client,
    product_api_data,
):
    authenticate(client, product_api_data["user"])

    response = client.get("/api/catalogue/products/?q=amlo")

    assert response.status_code == 200
    labels = {item["full_label"] for item in response.json()}
    assert "Amlodipine 5mg tablets — pack of 28" in labels
    assert "Amlodipine 10mg tablets — pack of 28" in labels


@pytest.mark.django_db
def test_catalogue_product_search_matches_strength_and_label(
    client,
    product_api_data,
):
    authenticate(client, product_api_data["user"])

    response = client.get("/api/catalogue/products/?q=paracetamol 500")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["full_label"] == "Paracetamol 500mg tablets — pack of 100"
    assert payload[0]["strength"] == "500mg"
    assert payload[0]["pack_size"] == 100


@pytest.mark.django_db
def test_catalogue_product_search_hides_inactive_by_default(
    client,
    product_api_data,
):
    authenticate(client, product_api_data["user"])

    response = client.get("/api/catalogue/products/?q=inactive")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
def test_catalogue_product_detail_returns_full_label(client, product_api_data):
    authenticate(client, product_api_data["user"])

    response = client.get(
        f"/api/catalogue/products/{product_api_data['amlodipine_5'].id}/",
    )

    assert response.status_code == 200
    assert response.json()["full_label"] == "Amlodipine 5mg tablets — pack of 28"
