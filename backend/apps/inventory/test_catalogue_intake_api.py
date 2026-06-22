from datetime import date

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalogue.models import CatalogueProduct, Medication
from apps.tenancy.models import Group, Membership, Pharmacy, Role
from apps.tenancy.permissions import ROLE_CAPABILITIES, Action

from .models import MovementType, StockBatch, StockItem, StockMovement

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


@pytest.fixture
def intake_api_data():
    group_one = Group.objects.create(name="Group One", slug="intake-api-one")
    group_two = Group.objects.create(name="Group Two", slug="intake-api-two")
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
    product = CatalogueProduct.objects.create(
        dmd_code="SEED-INTAKE-AMLO-5",
        source="SEED",
        display_name="Amlodipine 5mg tablets",
        ingredient="Amlodipine",
        strength="5mg",
        dose_form="tablets",
        pack_size=28,
    )
    inactive_product = CatalogueProduct.objects.create(
        dmd_code="SEED-INTAKE-INACTIVE",
        source="SEED",
        display_name="Inactive 5mg tablets",
        ingredient="Inactive",
        strength="5mg",
        dose_form="tablets",
        pack_size=28,
        is_active=False,
    )

    admin = make_user("intake-admin@example.com")
    superintendent = make_user("intake-superintendent@example.com")
    stock_employee = make_user("intake-stock@example.com")
    pharmacist = make_user("intake-pharmacist@example.com")
    dispenser = make_user("intake-dispenser@example.com")
    no_membership = make_user("intake-no-membership@example.com")

    add_membership(admin, Role.ADMIN)
    add_membership(superintendent, Role.SUPERINTENDENT, group=group_one)
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group_one,
        pharmacies=(pharmacy_one, pharmacy_two),
    )
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy_one)
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy_one)

    return {
        "group_one": group_one,
        "group_two": group_two,
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "pharmacy_three": pharmacy_three,
        "pharmacy_other": pharmacy_other,
        "product": product,
        "inactive_product": inactive_product,
        "admin": admin,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
        "no_membership": no_membership,
    }


def authenticate(client, user):
    client.force_login(user)


def intake_payload(pharmacy: Pharmacy, product: CatalogueProduct, **overrides):
    payload = {
        "pharmacy": pharmacy.id,
        "catalogue_product": product.id,
        "packs_received": 500,
        "batch_number": "AMLO123",
        "expiry_date": "2027-03-31",
        "received_at": "2026-06-22",
        "reference": "SUPPLIER-001",
    }
    payload.update(overrides)
    return payload


def post_intake(client, payload):
    return client.post("/api/inventory/stock/intake/", payload, format="json")


@pytest.mark.django_db
@pytest.mark.parametrize(
    "actor_key",
    ["admin", "superintendent", "stock_employee", "pharmacist", "dispenser"],
)
def test_permitted_roles_can_receive_catalogue_stock(
    client,
    intake_api_data,
    actor_key,
):
    authenticate(client, intake_api_data[actor_key])

    response = post_intake(
        client,
        intake_payload(
            intake_api_data["pharmacy_one"],
            intake_api_data["product"],
            batch_number=f"{actor_key}-AMLO",
        ),
    )

    assert response.status_code == 201
    assert response.json()["intake"] == {
        "packs_received": 500,
        "pack_size": 28,
        "pack_unit": "",
        "quantity_received": 14000,
    }


@pytest.mark.django_db
def test_intake_creates_medication_stock_item_batch_and_movement(
    client,
    intake_api_data,
):
    authenticate(client, intake_api_data["admin"])

    response = post_intake(
        client,
        intake_payload(intake_api_data["pharmacy_one"], intake_api_data["product"]),
    )

    assert response.status_code == 201
    medication = Medication.objects.get(
        group=intake_api_data["group_one"],
        catalogue_product=intake_api_data["product"],
    )
    stock_item = StockItem.objects.get(
        pharmacy=intake_api_data["pharmacy_one"],
        medication=medication,
    )
    batch = StockBatch.objects.get(stock_item=stock_item, batch_number="AMLO123")
    movement = StockMovement.objects.get(stock_item=stock_item, batch=batch)
    assert medication.name == "Amlodipine 5mg tablets"
    assert batch.quantity == 14000
    assert batch.quantity_received == 14000
    assert batch.expiry_date == date(2027, 3, 31)
    assert movement.movement_type == MovementType.RECEIPT
    assert movement.quantity_delta == 14000
    assert movement.balance_after == 14000
    assert response.json()["stock_item"]["id"] == stock_item.id


@pytest.mark.django_db
def test_intake_reuses_existing_medication_and_stock_item(client, intake_api_data):
    authenticate(client, intake_api_data["admin"])
    first = post_intake(
        client,
        intake_payload(intake_api_data["pharmacy_one"], intake_api_data["product"]),
    )
    second = post_intake(
        client,
        intake_payload(
            intake_api_data["pharmacy_one"],
            intake_api_data["product"],
            batch_number="AMLO124",
            expiry_date="2027-01-31",
        ),
    )

    assert first.status_code == 201
    assert second.status_code == 201
    medication = Medication.objects.get(
        group=intake_api_data["group_one"],
        catalogue_product=intake_api_data["product"],
    )
    assert (
        Medication.objects.filter(catalogue_product=intake_api_data["product"]).count()
        == 1
    )
    assert (
        StockItem.objects.filter(
            pharmacy=intake_api_data["pharmacy_one"],
            medication=medication,
        ).count()
        == 1
    )
    assert StockBatch.objects.filter(stock_item__medication=medication).count() == 2


@pytest.mark.django_db
def test_intake_rejects_inactive_catalogue_product(client, intake_api_data):
    authenticate(client, intake_api_data["admin"])

    response = post_intake(
        client,
        intake_payload(
            intake_api_data["pharmacy_one"],
            intake_api_data["inactive_product"],
        ),
    )

    assert response.status_code == 400
    assert "catalogue_product" in response.json()


@pytest.mark.django_db
@pytest.mark.parametrize("packs_received", [0, -1, "not-a-number"])
def test_intake_rejects_zero_negative_or_invalid_packs(
    client,
    intake_api_data,
    packs_received,
):
    authenticate(client, intake_api_data["admin"])

    response = post_intake(
        client,
        intake_payload(
            intake_api_data["pharmacy_one"],
            intake_api_data["product"],
            packs_received=packs_received,
        ),
    )

    assert response.status_code == 400
    assert "packs_received" in response.json()


@pytest.mark.django_db
def test_intake_rejects_missing_batch_number(client, intake_api_data):
    authenticate(client, intake_api_data["admin"])
    payload = intake_payload(
        intake_api_data["pharmacy_one"], intake_api_data["product"]
    )
    del payload["batch_number"]

    response = post_intake(client, payload)

    assert response.status_code == 400
    assert "batch_number" in response.json()


@pytest.mark.django_db
def test_intake_rejects_missing_expiry_date(client, intake_api_data):
    authenticate(client, intake_api_data["admin"])
    payload = intake_payload(
        intake_api_data["pharmacy_one"], intake_api_data["product"]
    )
    del payload["expiry_date"]

    response = post_intake(client, payload)

    assert response.status_code == 400
    assert "expiry_date" in response.json()


@pytest.mark.django_db
def test_intake_rejects_past_expiry_date(client, intake_api_data):
    authenticate(client, intake_api_data["admin"])

    response = post_intake(
        client,
        intake_payload(
            intake_api_data["pharmacy_one"],
            intake_api_data["product"],
            expiry_date="2020-01-01",
            received_at="2020-01-01",
        ),
    )

    assert response.status_code == 400
    assert "expiry_date" in response.json()


@pytest.mark.django_db
def test_intake_rejects_expiry_before_received_date(client, intake_api_data):
    authenticate(client, intake_api_data["admin"])

    response = post_intake(
        client,
        intake_payload(
            intake_api_data["pharmacy_one"],
            intake_api_data["product"],
            expiry_date="2027-01-31",
            received_at="2027-03-31",
        ),
    )

    assert response.status_code == 400
    assert "expiry_date" in response.json()


@pytest.mark.django_db
def test_intake_rejects_pharmacy_outside_user_scope(client, intake_api_data):
    authenticate(client, intake_api_data["pharmacist"])

    response = post_intake(
        client,
        intake_payload(intake_api_data["pharmacy_two"], intake_api_data["product"]),
    )

    assert response.status_code == 400
    assert "pharmacy" in response.json()


@pytest.mark.django_db
def test_intake_denies_user_without_receive_permission(client, intake_api_data):
    authenticate(client, intake_api_data["no_membership"])

    response = post_intake(
        client,
        intake_payload(intake_api_data["pharmacy_one"], intake_api_data["product"]),
    )

    assert response.status_code == 403


def test_dispenser_stock_receive_is_least_privilege():
    assert Action.STOCK_RECEIVE in ROLE_CAPABILITIES[Role.DISPENSER]
    assert Action.STOCK_MANAGE not in ROLE_CAPABILITIES[Role.DISPENSER]
    assert Action.STOCK_TRANSFER not in ROLE_CAPABILITIES[Role.DISPENSER]
