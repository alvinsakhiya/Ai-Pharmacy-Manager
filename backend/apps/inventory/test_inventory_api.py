from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalogue.models import CatalogueProduct, Medication, MedicationForm
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from .models import StockBatch, StockItem

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


def make_medication(group: Group, name: str) -> Medication:
    return Medication.objects.create(
        group=group,
        name=name,
        form=MedicationForm.TABLET,
        strength="500 mg",
    )


def make_stock_item(
    pharmacy: Pharmacy,
    medication: Medication,
    *,
    batch_prefix: str,
) -> StockItem:
    stock_item = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=medication,
        unit_price=Decimal("0.03"),
        reorder_level=20,
    )
    StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=f"{batch_prefix}-ACTIVE-1",
        expiry_date=date(2027, 1, 31),
        quantity=10,
        quantity_received=10,
        received_at=date(2026, 1, 1),
    )
    StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=f"{batch_prefix}-ACTIVE-2",
        expiry_date=date(2027, 6, 30),
        quantity=5,
        quantity_received=5,
        received_at=date(2026, 1, 1),
    )
    StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=f"{batch_prefix}-INACTIVE",
        expiry_date=date(2026, 6, 30),
        quantity=99,
        quantity_received=99,
        received_at=date(2026, 1, 1),
        is_active=False,
    )
    StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=f"{batch_prefix}-ZERO",
        expiry_date=date(2026, 5, 31),
        quantity=0,
        quantity_received=20,
        received_at=date(2026, 1, 1),
    )
    return stock_item


@pytest.fixture
def inventory_api_data():
    group_one = Group.objects.create(name="Group One", slug="inventory-api-one")
    group_two = Group.objects.create(name="Group Two", slug="inventory-api-two")
    pharmacy_one = Pharmacy.objects.create(
        group=group_one, name="Pharmacy One", code="P1"
    )
    pharmacy_two = Pharmacy.objects.create(
        group=group_one, name="Pharmacy Two", code="P2"
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

    medication_one = make_medication(group_one, "Paracetamol")
    medication_two = make_medication(group_one, "Ibuprofen")
    medication_three = make_medication(group_one, "Amlodipine")
    medication_other = make_medication(group_two, "Metformin")

    stock_one = make_stock_item(pharmacy_one, medication_one, batch_prefix="P1-PAR")
    stock_two = make_stock_item(pharmacy_two, medication_two, batch_prefix="P2-IBU")
    stock_three = make_stock_item(
        pharmacy_three, medication_three, batch_prefix="P3-AML"
    )
    stock_other = make_stock_item(
        pharmacy_other,
        medication_other,
        batch_prefix="OP-MET",
    )

    admin = make_user("inventory-admin@example.com")
    superintendent = make_user("inventory-superintendent@example.com")
    stock_employee = make_user("inventory-stock@example.com")
    pharmacist = make_user("inventory-pharmacist@example.com")
    dispenser = make_user("inventory-dispenser@example.com")

    add_membership(admin, Role.ADMIN)
    add_membership(superintendent, Role.SUPERINTENDENT, group=group_one)
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group_one,
        pharmacies=(pharmacy_one, pharmacy_two),
    )
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy_one)
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy_two)

    return {
        "group_one": group_one,
        "group_two": group_two,
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "pharmacy_three": pharmacy_three,
        "pharmacy_other": pharmacy_other,
        "stock_one": stock_one,
        "stock_two": stock_two,
        "stock_three": stock_three,
        "stock_other": stock_other,
        "admin": admin,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
    }


def authenticate(client, user):
    client.force_login(user)


def ids_from_response(response):
    return {item["id"] for item in response.json()}


@pytest.mark.django_db
@pytest.mark.parametrize(
    "actor_key",
    ["admin", "superintendent", "stock_employee", "pharmacist", "dispenser"],
)
def test_roles_with_stock_view_can_list_stock(client, inventory_api_data, actor_key):
    authenticate(client, inventory_api_data[actor_key])

    response = client.get("/api/inventory/stock-items/")

    assert response.status_code == 200
    assert response.json()


@pytest.mark.django_db
def test_stock_employee_sees_only_assigned_pharmacies(client, inventory_api_data):
    authenticate(client, inventory_api_data["stock_employee"])

    response = client.get("/api/inventory/stock-items/")

    assert response.status_code == 200
    assert ids_from_response(response) == {
        inventory_api_data["stock_one"].id,
        inventory_api_data["stock_two"].id,
    }


@pytest.mark.django_db
def test_pharmacist_sees_only_own_pharmacy(client, inventory_api_data):
    authenticate(client, inventory_api_data["pharmacist"])

    response = client.get("/api/inventory/stock-items/")

    assert response.status_code == 200
    assert ids_from_response(response) == {inventory_api_data["stock_one"].id}


@pytest.mark.django_db
def test_dispenser_sees_only_own_pharmacy(client, inventory_api_data):
    authenticate(client, inventory_api_data["dispenser"])

    response = client.get("/api/inventory/stock-items/")

    assert response.status_code == 200
    assert ids_from_response(response) == {inventory_api_data["stock_two"].id}


@pytest.mark.django_db
def test_superintendent_sees_group_pharmacies(client, inventory_api_data):
    authenticate(client, inventory_api_data["superintendent"])

    response = client.get("/api/inventory/stock-items/")

    assert response.status_code == 200
    assert ids_from_response(response) == {
        inventory_api_data["stock_one"].id,
        inventory_api_data["stock_two"].id,
        inventory_api_data["stock_three"].id,
    }
    assert inventory_api_data["stock_other"].id not in ids_from_response(response)


@pytest.mark.django_db
def test_admin_sees_all_pharmacies(client, inventory_api_data):
    authenticate(client, inventory_api_data["admin"])

    response = client.get("/api/inventory/stock-items/")

    assert response.status_code == 200
    assert ids_from_response(response) == {
        inventory_api_data["stock_one"].id,
        inventory_api_data["stock_two"].id,
        inventory_api_data["stock_three"].id,
        inventory_api_data["stock_other"].id,
    }


@pytest.mark.django_db
def test_detail_access_to_out_of_scope_stock_returns_404(client, inventory_api_data):
    authenticate(client, inventory_api_data["pharmacist"])

    response = client.get(
        f"/api/inventory/stock-items/{inventory_api_data['stock_two'].id}/",
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_quantity_annotations_exclude_inactive_and_zero_expiry_batches(
    client,
    inventory_api_data,
):
    authenticate(client, inventory_api_data["admin"])

    response = client.get(
        f"/api/inventory/stock-items/{inventory_api_data['stock_one'].id}/",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["quantity_on_hand"] == 15
    assert payload["earliest_expiry"] == "2027-01-31"
    assert [batch["batch_number"] for batch in payload["batches"]] == [
        "P1-PAR-ZERO",
        "P1-PAR-INACTIVE",
        "P1-PAR-ACTIVE-1",
        "P1-PAR-ACTIVE-2",
    ]


@pytest.mark.django_db
def test_pharmacy_query_param_narrows_in_scope_results(client, inventory_api_data):
    authenticate(client, inventory_api_data["stock_employee"])

    response = client.get(
        "/api/inventory/stock-items/",
        {"pharmacy": inventory_api_data["pharmacy_two"].id},
    )

    assert response.status_code == 200
    assert ids_from_response(response) == {inventory_api_data["stock_two"].id}


@pytest.mark.django_db
def test_pharmacy_query_param_does_not_widen_scope(client, inventory_api_data):
    authenticate(client, inventory_api_data["stock_employee"])

    response = client.get(
        "/api/inventory/stock-items/",
        {"pharmacy": inventory_api_data["pharmacy_three"].id},
    )

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
def test_invalid_pharmacy_query_param_is_safe_empty_response(
    client,
    inventory_api_data,
):
    authenticate(client, inventory_api_data["admin"])

    response = client.get("/api/inventory/stock-items/", {"pharmacy": "not-an-id"})

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
def test_search_filters_stock_items_by_medication_name(client, inventory_api_data):
    authenticate(client, inventory_api_data["superintendent"])

    response = client.get("/api/inventory/stock-items/", {"search": "ibu"})

    assert response.status_code == 200
    assert ids_from_response(response) == {inventory_api_data["stock_two"].id}


@pytest.mark.django_db
def test_search_filters_stock_items_by_catalogue_product(client, inventory_api_data):
    product = CatalogueProduct.objects.create(
        display_name="Brufen 200mg tablets",
        ingredient="Ibuprofen",
        strength="200mg",
        dose_form="tablet",
    )
    medication = inventory_api_data["stock_two"].medication
    medication.catalogue_product = product
    medication.save(update_fields=["catalogue_product"])
    authenticate(client, inventory_api_data["superintendent"])

    response = client.get("/api/inventory/stock-items/", {"search": "brufen"})

    assert response.status_code == 200
    assert ids_from_response(response) == {inventory_api_data["stock_two"].id}


@pytest.mark.django_db
def test_search_filters_stock_items_by_batch_number_without_duplicates(
    client,
    inventory_api_data,
):
    authenticate(client, inventory_api_data["superintendent"])

    response = client.get("/api/inventory/stock-items/", {"search": "P2-IBU"})

    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload] == [inventory_api_data["stock_two"].id]
    assert payload[0]["quantity_on_hand"] == 15


@pytest.mark.django_db
def test_search_respects_pharmacy_scope(client, inventory_api_data):
    authenticate(client, inventory_api_data["stock_employee"])

    response = client.get("/api/inventory/stock-items/", {"search": "amlo"})

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
def test_search_does_not_return_other_tenant_matches(client, inventory_api_data):
    authenticate(client, inventory_api_data["superintendent"])

    response = client.get("/api/inventory/stock-items/", {"search": "metformin"})

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
def test_empty_search_behaves_like_unfiltered_list(client, inventory_api_data):
    authenticate(client, inventory_api_data["stock_employee"])

    response = client.get("/api/inventory/stock-items/", {"search": "   "})

    assert response.status_code == 200
    assert ids_from_response(response) == {
        inventory_api_data["stock_one"].id,
        inventory_api_data["stock_two"].id,
    }


@pytest.mark.django_db
def test_stock_item_list_is_read_only(client, inventory_api_data):
    authenticate(client, inventory_api_data["admin"])

    response = client.post("/api/inventory/stock-items/", {}, format="json")

    assert response.status_code == 405


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["patch", "put", "delete"])
def test_stock_item_detail_is_read_only(client, inventory_api_data, method):
    authenticate(client, inventory_api_data["admin"])

    response = getattr(client, method)(
        f"/api/inventory/stock-items/{inventory_api_data['stock_one'].id}/",
        {},
        format="json",
    )

    assert response.status_code == 405
