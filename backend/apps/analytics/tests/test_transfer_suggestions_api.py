from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.analytics.models import TransferSuggestion
from apps.analytics.services import generate_transfer_suggestions
from apps.catalogue.models import CatalogueProduct, Medication, MedicationForm
from apps.inventory.models import MovementType, StockBatch, StockItem, StockMovement
from apps.tenancy.models import Group, Membership, Pharmacy, Role
from apps.tenancy.permissions import ROLE_CAPABILITIES, Action

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


def make_product(name="Ibuprofen 400mg tablets", *, pack_size=48):
    return CatalogueProduct.objects.create(
        dmd_code=f"SEED-TRANSFER-{name[:8].upper()}-{pack_size}",
        source="SEED",
        display_name=name,
        ingredient=name.split()[0],
        strength="400mg",
        dose_form="tablets",
        pack_size=pack_size,
        pack_unit="tablets",
    )


def make_medication(group: Group, product: CatalogueProduct) -> Medication:
    return Medication.objects.create(
        group=group,
        catalogue_product=product,
        name=product.display_name,
        form=MedicationForm.TABLET,
        strength=product.strength,
    )


def make_stock_item(
    pharmacy: Pharmacy,
    medication: Medication,
    *,
    quantity: int,
) -> StockItem:
    stock_item = StockItem.objects.create(pharmacy=pharmacy, medication=medication)
    StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=f"BATCH-{stock_item.id}",
        expiry_date=timezone.now().date() + timedelta(days=365),
        quantity=quantity,
        quantity_received=quantity,
        received_at=timezone.now().date() - timedelta(days=90),
    )
    return stock_item


def make_outbound(stock_item: StockItem, *, quantity: int, days_ago: int):
    movement = StockMovement.objects.create(
        stock_item=stock_item,
        batch=stock_item.batches.first(),
        movement_type=MovementType.ADJUSTMENT,
        quantity_delta=-quantity,
        balance_after=stock_item.batches.first().quantity,
        reference="transfer-suggestion-test",
    )
    StockMovement.objects.filter(pk=movement.pk).update(
        created_at=timezone.now() - timedelta(days=days_ago)
    )
    movement.refresh_from_db()
    return movement


@pytest.fixture
def transfer_data():
    group_one = Group.objects.create(name="Group One", slug="transfer-one")
    group_two = Group.objects.create(name="Group Two", slug="transfer-two")
    source = Pharmacy.objects.create(group=group_one, name="JMW Sutton", code="SUT")
    destination = Pharmacy.objects.create(
        group=group_one,
        name="JMW Wimbledon",
        code="WIM",
    )
    third = Pharmacy.objects.create(group=group_one, name="JMW Croydon", code="CRO")
    other = Pharmacy.objects.create(group=group_two, name="Other Pharmacy", code="OTH")

    admin = make_user("transfer-admin@example.com")
    superintendent = make_user("transfer-superintendent@example.com")
    stock_employee = make_user("transfer-stock@example.com")
    pharmacist = make_user("transfer-pharmacist@example.com")
    dispenser = make_user("transfer-dispenser@example.com")

    add_membership(admin, Role.ADMIN)
    add_membership(superintendent, Role.SUPERINTENDENT, group=group_one)
    add_membership(stock_employee, Role.STOCK_EMPLOYEE, group=group_one)
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=source)
    add_membership(dispenser, Role.DISPENSER, pharmacy=source)

    return {
        "group_one": group_one,
        "group_two": group_two,
        "source": source,
        "destination": destination,
        "third": third,
        "other": other,
        "admin": admin,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
    }


def seed_transfer_scenario(
    transfer_data, *, source_quantity=240, destination_usage=160
):
    product = make_product()
    source_medication = make_medication(transfer_data["group_one"], product)
    destination_medication = Medication.objects.get(
        group=transfer_data["group_one"],
        catalogue_product=product,
    )
    source_stock = make_stock_item(
        transfer_data["source"],
        source_medication,
        quantity=source_quantity,
    )
    destination_stock = make_stock_item(
        transfer_data["destination"],
        destination_medication,
        quantity=12,
    )
    make_outbound(source_stock, quantity=10, days_ago=45)
    if destination_usage:
        make_outbound(destination_stock, quantity=destination_usage, days_ago=5)
    return product, source_stock, destination_stock


@pytest.mark.django_db
def test_transfer_suggestion_model_stores_safe_snapshot(transfer_data):
    product, source_stock, destination_stock = seed_transfer_scenario(transfer_data)

    suggestion = generate_transfer_suggestions(
        transfer_data["superintendent"],
        group=transfer_data["group_one"],
    )[0]

    assert suggestion.group == transfer_data["group_one"]
    assert suggestion.catalogue_product == product
    assert suggestion.medication_label == "Ibuprofen 400mg tablets — pack of 48 tablets"
    assert suggestion.source_stock_item == source_stock
    assert suggestion.destination_stock_item == destination_stock
    assert suggestion.status == TransferSuggestion.Status.OPEN
    assert suggestion.model_version == "transfer-baseline-1"
    assert "Human review required before transfer" in suggestion.reason
    assert "patient" not in suggestion.reason.lower()


@pytest.mark.django_db
def test_generate_transfer_suggestion_for_dead_stock_and_destination_usage(
    transfer_data,
):
    seed_transfer_scenario(transfer_data)

    suggestions = generate_transfer_suggestions(
        transfer_data["superintendent"],
        group=transfer_data["group_one"],
        dead_days=30,
    )

    assert len(suggestions) == 1
    suggestion = suggestions[0]
    assert suggestion.source_pharmacy == transfer_data["source"]
    assert suggestion.destination_pharmacy == transfer_data["destination"]
    assert suggestion.current_source_stock_units == 240
    assert suggestion.destination_recent_usage_units == 160
    assert suggestion.suggested_quantity_units == 160
    assert suggestion.suggested_quantity_packs == 4
    assert suggestion.confidence == Decimal("0.65")
    assert "JMW Sutton has 240 units" in suggestion.reason
    assert "JMW Wimbledon used 160 units" in suggestion.reason


@pytest.mark.django_db
def test_no_suggestion_without_stock_usage_match_or_group_match(transfer_data):
    product = make_product()
    source_stock = make_stock_item(
        transfer_data["source"],
        make_medication(transfer_data["group_one"], product),
        quantity=0,
    )
    destination_stock = make_stock_item(
        transfer_data["destination"],
        Medication.objects.get(
            group=transfer_data["group_one"], catalogue_product=product
        ),
        quantity=10,
    )
    make_outbound(destination_stock, quantity=100, days_ago=3)

    assert (
        generate_transfer_suggestions(
            transfer_data["superintendent"],
            group=transfer_data["group_one"],
        )
        == []
    )

    source_stock.batches.update(quantity=100)
    StockMovement.objects.update(created_at=timezone.now() - timedelta(days=45))
    assert (
        generate_transfer_suggestions(
            transfer_data["superintendent"],
            group=transfer_data["group_one"],
        )
        == []
    )

    other_product = make_product("Naproxen 250mg tablets", pack_size=28)
    other_destination = make_stock_item(
        transfer_data["third"],
        make_medication(transfer_data["group_one"], other_product),
        quantity=10,
    )
    make_outbound(other_destination, quantity=100, days_ago=3)
    assert (
        generate_transfer_suggestions(
            transfer_data["superintendent"],
            group=transfer_data["group_one"],
        )
        == []
    )

    other_group_stock = make_stock_item(
        transfer_data["other"],
        make_medication(transfer_data["group_two"], product),
        quantity=10,
    )
    make_outbound(other_group_stock, quantity=100, days_ago=3)
    assert (
        generate_transfer_suggestions(
            transfer_data["superintendent"],
            group=transfer_data["group_one"],
        )
        == []
    )


@pytest.mark.django_db
def test_transfer_suggestion_quantity_is_conservative_and_never_negative(
    transfer_data,
):
    seed_transfer_scenario(
        transfer_data,
        source_quantity=1,
        destination_usage=160,
    )

    assert (
        generate_transfer_suggestions(
            transfer_data["superintendent"],
            group=transfer_data["group_one"],
        )
        == []
    )


@pytest.mark.django_db
def test_generation_replaces_open_suggestions_without_mutating_stock(transfer_data):
    product, source_stock, destination_stock = seed_transfer_scenario(transfer_data)
    source_batch = source_stock.batches.get()
    destination_batch = destination_stock.batches.get()
    movement_count = StockMovement.objects.count()

    first = generate_transfer_suggestions(
        transfer_data["superintendent"],
        group=transfer_data["group_one"],
    )
    second = generate_transfer_suggestions(
        transfer_data["superintendent"],
        group=transfer_data["group_one"],
    )

    source_batch.refresh_from_db()
    destination_batch.refresh_from_db()
    assert source_batch.quantity == 240
    assert destination_batch.quantity == 12
    assert StockMovement.objects.count() == movement_count
    assert len(first) == 1
    assert len(second) == 1
    assert (
        TransferSuggestion.objects.filter(
            catalogue_product=product,
            status=TransferSuggestion.Status.OPEN,
        ).count()
        == 1
    )
    assert (
        TransferSuggestion.objects.filter(
            catalogue_product=product,
            status=TransferSuggestion.Status.DISMISSED,
        ).count()
        == 1
    )


@pytest.mark.django_db
def test_transfer_suggestion_api_rbac_scope_and_dismiss(client, transfer_data):
    seed_transfer_scenario(transfer_data)

    authenticate(client, transfer_data["superintendent"])
    generated = client.post(
        "/api/analytics/transfer-suggestions/",
        {"group": transfer_data["group_one"].id, "dead_days": 30},
        format="json",
    )
    assert generated.status_code == 201
    payload = generated.json()
    assert len(payload) == 1
    assert payload[0]["source_pharmacy_name"] == "JMW Sutton"
    assert payload[0]["destination_pharmacy_name"] == "JMW Wimbledon"
    assert payload[0]["suggested_quantity_units"] == 160

    listed = client.get(
        "/api/analytics/transfer-suggestions/",
        {"group": transfer_data["group_one"].id},
    )
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == payload[0]["id"]

    dismissed = client.post(
        f"/api/analytics/transfer-suggestions/{payload[0]['id']}/dismiss/",
        {},
        format="json",
    )
    assert dismissed.status_code == 200
    assert dismissed.json()["status"] == TransferSuggestion.Status.DISMISSED
    assert TransferSuggestion.objects.filter(pk=payload[0]["id"]).exists()

    denied_group = client.post(
        "/api/analytics/transfer-suggestions/",
        {"group": transfer_data["group_two"].id, "dead_days": 30},
        format="json",
    )
    assert denied_group.status_code == 400

    client.logout()
    for actor_key in ["stock_employee", "pharmacist", "dispenser"]:
        authenticate(client, transfer_data[actor_key])
        response = client.get(
            "/api/analytics/transfer-suggestions/",
            {"group": transfer_data["group_one"].id},
        )
        assert response.status_code == 403
        response = client.post(
            "/api/analytics/transfer-suggestions/",
            {"group": transfer_data["group_one"].id},
            format="json",
        )
        assert response.status_code == 403
        client.logout()


@pytest.mark.django_db
def test_admin_can_generate_view_and_dismiss(client, transfer_data):
    seed_transfer_scenario(transfer_data)
    authenticate(client, transfer_data["admin"])

    generated = client.post(
        "/api/analytics/transfer-suggestions/",
        {"group": transfer_data["group_one"].id},
        format="json",
    )
    assert generated.status_code == 201
    suggestion_id = generated.json()[0]["id"]

    listed = client.get(
        "/api/analytics/transfer-suggestions/",
        {"group": transfer_data["group_one"].id},
    )
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == suggestion_id

    dismissed = client.post(
        f"/api/analytics/transfer-suggestions/{suggestion_id}/dismiss/",
        {},
        format="json",
    )
    assert dismissed.status_code == 200


def test_transfer_suggestion_permissions_are_group_level_only():
    for action in [
        Action.TRANSFER_SUGGESTION_VIEW,
        Action.TRANSFER_SUGGESTION_GENERATE,
        Action.TRANSFER_SUGGESTION_DISMISS,
    ]:
        assert action in ROLE_CAPABILITIES[Role.SUPERINTENDENT]
        assert action not in ROLE_CAPABILITIES[Role.STOCK_EMPLOYEE]
        assert action not in ROLE_CAPABILITIES[Role.PHARMACIST]
        assert action not in ROLE_CAPABILITIES[Role.DISPENSER]
