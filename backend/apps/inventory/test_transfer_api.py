from datetime import date

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditAction, AuditEvent
from apps.catalogue.models import Medication, MedicationForm
from apps.tenancy.models import Group, Membership, Pharmacy, Role

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
    batch_number: str,
    quantity: int = 20,
    expiry_date: date = date(2027, 1, 31),
    is_active: bool = True,
) -> StockItem:
    stock_item = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=medication,
        reorder_level=5,
    )
    StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=batch_number,
        expiry_date=expiry_date,
        quantity=quantity,
        quantity_received=quantity,
        received_at=date(2026, 1, 1),
        is_active=is_active,
    )
    return stock_item


@pytest.fixture
def transfer_api_data():
    group_one = Group.objects.create(name="Group One", slug="transfer-api-one")
    group_two = Group.objects.create(name="Group Two", slug="transfer-api-two")
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

    medication_one = make_medication(group_one, "Paracetamol")
    medication_two = make_medication(group_one, "Ibuprofen")
    medication_other = make_medication(group_two, "Metformin")

    source_stock = make_stock_item(
        pharmacy_one,
        medication_one,
        batch_number="LOT-001",
        quantity=20,
    )
    destination_stock = make_stock_item(
        pharmacy_two,
        medication_one,
        batch_number="LOT-001",
        quantity=4,
    )
    inactive_source_stock = make_stock_item(
        pharmacy_one,
        medication_two,
        batch_number="INACTIVE-LOT",
        quantity=7,
        is_active=False,
    )
    unassigned_source_stock = make_stock_item(
        pharmacy_three,
        medication_two,
        batch_number="P3-LOT",
        quantity=11,
    )
    other_source_stock = make_stock_item(
        pharmacy_other,
        medication_other,
        batch_number="OP-LOT",
        quantity=9,
    )

    admin = make_user("transfer-admin@example.com")
    superintendent = make_user("transfer-superintendent@example.com")
    stock_employee = make_user("transfer-stock@example.com")
    pharmacist = make_user("transfer-pharmacist@example.com")
    dispenser = make_user("transfer-dispenser@example.com")

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
        "medication_one": medication_one,
        "medication_two": medication_two,
        "medication_other": medication_other,
        "source_stock": source_stock,
        "destination_stock": destination_stock,
        "inactive_source_stock": inactive_source_stock,
        "unassigned_source_stock": unassigned_source_stock,
        "other_source_stock": other_source_stock,
        "admin": admin,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
    }


def authenticate(client, user):
    client.force_login(user)


def batch_for(stock_item: StockItem) -> StockBatch:
    return StockBatch.objects.get(stock_item=stock_item)


def transfer_payload(destination_pharmacy: Pharmacy, **overrides):
    payload = {
        "destination_pharmacy": destination_pharmacy.id,
        "quantity": 3,
        "reason": "Inter-branch transfer",
        "reference": "TRF-001",
    }
    payload.update(overrides)
    return payload


def post_transfer(client, source_batch, payload):
    return client.post(
        f"/api/inventory/batches/{source_batch.id}/transfer/",
        payload,
        format="json",
    )


def movement_summary(movement):
    return {
        "id": movement.id,
        "movement_type": movement.movement_type,
        "quantity_delta": movement.quantity_delta,
        "balance_after": movement.balance_after,
        "batch": movement.batch_id,
    }


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["admin", "superintendent", "stock_employee"])
def test_roles_with_stock_transfer_can_transfer(
    client,
    transfer_api_data,
    actor_key,
):
    authenticate(client, transfer_api_data[actor_key])
    source_batch = batch_for(transfer_api_data["source_stock"])
    destination = (
        transfer_api_data["pharmacy_two"]
        if actor_key == "stock_employee"
        else transfer_api_data["pharmacy_three"]
    )

    response = post_transfer(client, source_batch, transfer_payload(destination))

    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["pharmacist", "dispenser"])
def test_pharmacist_and_dispenser_cannot_transfer(
    client,
    transfer_api_data,
    actor_key,
):
    authenticate(client, transfer_api_data[actor_key])
    source_batch = batch_for(transfer_api_data["source_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_two"]),
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_stock_employee_can_transfer_when_source_and_destination_assigned(
    client,
    transfer_api_data,
):
    authenticate(client, transfer_api_data["stock_employee"])
    source_batch = batch_for(transfer_api_data["source_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_two"]),
    )

    assert response.status_code == 200


@pytest.mark.django_db
def test_stock_employee_gets_404_for_unassigned_source_batch(
    client,
    transfer_api_data,
):
    authenticate(client, transfer_api_data["stock_employee"])
    source_batch = batch_for(transfer_api_data["unassigned_source_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_two"]),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_stock_employee_gets_400_for_unassigned_destination_pharmacy(
    client,
    transfer_api_data,
):
    authenticate(client, transfer_api_data["stock_employee"])
    source_batch = batch_for(transfer_api_data["source_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_three"]),
    )

    assert response.status_code == 400
    assert "destination_pharmacy" in response.json()


@pytest.mark.django_db
def test_superintendent_can_transfer_within_group(client, transfer_api_data):
    authenticate(client, transfer_api_data["superintendent"])
    source_batch = batch_for(transfer_api_data["source_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_three"]),
    )

    assert response.status_code == 200


@pytest.mark.django_db
def test_admin_can_transfer(client, transfer_api_data):
    authenticate(client, transfer_api_data["admin"])
    source_batch = batch_for(transfer_api_data["source_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_three"]),
    )

    assert response.status_code == 200


@pytest.mark.django_db
def test_out_of_scope_source_returns_404(client, transfer_api_data):
    authenticate(client, transfer_api_data["superintendent"])
    source_batch = batch_for(transfer_api_data["other_source_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_one"]),
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_transfer_updates_quantities_movements_and_response(
    client,
    transfer_api_data,
):
    authenticate(client, transfer_api_data["admin"])
    source_batch = batch_for(transfer_api_data["source_stock"])
    destination_batch = batch_for(transfer_api_data["destination_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_two"], quantity=6),
    )

    assert response.status_code == 200
    source_batch.refresh_from_db()
    destination_batch.refresh_from_db()
    out_movement = StockMovement.objects.get(movement_type=MovementType.TRANSFER_OUT)
    in_movement = StockMovement.objects.get(movement_type=MovementType.TRANSFER_IN)
    payload = response.json()
    assert source_batch.quantity == 14
    assert source_batch.quantity_received == 20
    assert destination_batch.quantity == 10
    assert destination_batch.quantity_received == 10
    assert out_movement.quantity_delta == -6
    assert out_movement.balance_after == 14
    assert in_movement.quantity_delta == 6
    assert in_movement.balance_after == 10
    assert set(payload) == {
        "source_stock_item",
        "destination_stock_item",
        "transfer",
    }
    assert payload["transfer"]["quantity"] == 6
    assert payload["transfer"]["out_movement"] == movement_summary(out_movement)
    assert payload["transfer"]["in_movement"] == movement_summary(in_movement)


@pytest.mark.django_db
def test_transfer_auto_creates_destination_stock_item_and_batch(
    client,
    transfer_api_data,
):
    authenticate(client, transfer_api_data["admin"])
    source_batch = batch_for(transfer_api_data["source_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_three"], quantity=5),
    )

    assert response.status_code == 200
    destination_stock_item = StockItem.objects.get(
        pharmacy=transfer_api_data["pharmacy_three"],
        medication=transfer_api_data["medication_one"],
    )
    destination_batch = StockBatch.objects.get(stock_item=destination_stock_item)
    assert destination_batch.batch_number == source_batch.batch_number
    assert destination_batch.expiry_date == source_batch.expiry_date
    assert destination_batch.quantity == 5
    assert destination_batch.quantity_received == 5


@pytest.mark.django_db
def test_transfer_tops_up_existing_destination_batch(client, transfer_api_data):
    authenticate(client, transfer_api_data["admin"])
    source_batch = batch_for(transfer_api_data["source_stock"])
    destination_batch = batch_for(transfer_api_data["destination_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_two"], quantity=4),
    )

    assert response.status_code == 200
    destination_batch.refresh_from_db()
    assert destination_batch.quantity == 8
    assert destination_batch.quantity_received == 8


@pytest.mark.django_db
def test_insufficient_source_stock_returns_400_without_writes(
    client,
    transfer_api_data,
):
    authenticate(client, transfer_api_data["admin"])
    source_batch = batch_for(transfer_api_data["source_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_two"], quantity=21),
    )

    assert response.status_code == 400
    assert "quantity" in response.json()
    source_batch.refresh_from_db()
    assert source_batch.quantity == 20
    assert not StockMovement.objects.exists()
    assert not AuditEvent.objects.filter(action=AuditAction.STOCK_TRANSFERRED).exists()


@pytest.mark.django_db
def test_inactive_source_batch_returns_400(client, transfer_api_data):
    authenticate(client, transfer_api_data["admin"])
    source_batch = batch_for(transfer_api_data["inactive_source_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_two"]),
    )

    assert response.status_code == 400
    assert response.json() == {"batch": ["Cannot transfer from an inactive batch."]}


@pytest.mark.django_db
def test_cross_group_destination_returns_400(client, transfer_api_data):
    authenticate(client, transfer_api_data["admin"])
    source_batch = batch_for(transfer_api_data["source_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_other"]),
    )

    assert response.status_code == 400
    assert "destination_pharmacy" in response.json()


@pytest.mark.django_db
def test_same_source_and_destination_pharmacy_returns_400(client, transfer_api_data):
    authenticate(client, transfer_api_data["admin"])
    source_batch = batch_for(transfer_api_data["source_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_one"]),
    )

    assert response.status_code == 400
    assert "destination_pharmacy" in response.json()


@pytest.mark.django_db
@pytest.mark.parametrize("quantity", [0, -1, "not-an-integer"])
def test_invalid_transfer_quantity_returns_400(client, transfer_api_data, quantity):
    authenticate(client, transfer_api_data["admin"])
    source_batch = batch_for(transfer_api_data["source_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_two"], quantity=quantity),
    )

    assert response.status_code == 400
    assert "quantity" in response.json()


@pytest.mark.django_db
def test_transfer_writes_one_audit_event(client, transfer_api_data):
    authenticate(client, transfer_api_data["admin"])
    source_batch = batch_for(transfer_api_data["source_stock"])

    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_two"], quantity=3),
    )

    assert response.status_code == 200
    destination_batch = batch_for(transfer_api_data["destination_stock"])
    out_movement = StockMovement.objects.get(movement_type=MovementType.TRANSFER_OUT)
    in_movement = StockMovement.objects.get(movement_type=MovementType.TRANSFER_IN)
    event = AuditEvent.objects.get(action=AuditAction.STOCK_TRANSFERRED)
    assert AuditEvent.objects.filter(action=AuditAction.STOCK_TRANSFERRED).count() == 1
    assert event.pharmacy == transfer_api_data["pharmacy_one"]
    assert event.metadata == {
        "source_pharmacy_id": transfer_api_data["pharmacy_one"].id,
        "destination_pharmacy_id": transfer_api_data["pharmacy_two"].id,
        "medication_id": transfer_api_data["medication_one"].id,
        "batch_number": source_batch.batch_number,
        "source_batch_id": source_batch.id,
        "destination_batch_id": destination_batch.id,
        "quantity": 3,
        "source_balance_after": 17,
        "destination_balance_after": 7,
        "out_movement_id": out_movement.id,
        "in_movement_id": in_movement.id,
    }


@pytest.mark.django_db
def test_transfer_rolls_back_when_audit_recording_fails(
    client,
    transfer_api_data,
    monkeypatch,
):
    authenticate(client, transfer_api_data["admin"])
    source_batch = batch_for(transfer_api_data["source_stock"])
    destination_batch = batch_for(transfer_api_data["destination_stock"])

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.inventory.services.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        post_transfer(
            client,
            source_batch,
            transfer_payload(transfer_api_data["pharmacy_two"], quantity=4),
        )

    source_batch.refresh_from_db()
    destination_batch.refresh_from_db()
    assert source_batch.quantity == 20
    assert destination_batch.quantity == 4
    assert not StockMovement.objects.filter(
        movement_type=MovementType.TRANSFER_OUT
    ).exists()
    assert not StockMovement.objects.filter(
        movement_type=MovementType.TRANSFER_IN
    ).exists()
    assert not AuditEvent.objects.filter(action=AuditAction.STOCK_TRANSFERRED).exists()


@pytest.mark.django_db
def test_transfer_movements_remain_append_only(client, transfer_api_data):
    authenticate(client, transfer_api_data["admin"])
    source_batch = batch_for(transfer_api_data["source_stock"])
    response = post_transfer(
        client,
        source_batch,
        transfer_payload(transfer_api_data["pharmacy_two"]),
    )
    assert response.status_code == 200
    movement = StockMovement.objects.get(movement_type=MovementType.TRANSFER_OUT)

    movement.reason = "Changed"
    with pytest.raises(ValueError):
        movement.save()
    with pytest.raises(ValueError):
        movement.delete()


@pytest.mark.django_db
def test_inventory_mutation_and_read_regressions_still_work(
    client,
    transfer_api_data,
):
    authenticate(client, transfer_api_data["admin"])
    source_batch = batch_for(transfer_api_data["source_stock"])

    list_response = client.get("/api/inventory/stock-items/")
    detail_response = client.get(
        f"/api/inventory/stock-items/{transfer_api_data['source_stock'].id}/",
    )
    receipt_response = client.post(
        "/api/inventory/receipts/",
        {
            "pharmacy": transfer_api_data["pharmacy_one"].id,
            "medication": transfer_api_data["medication_one"].id,
            "batch_number": "RECEIPT-6D",
            "expiry_date": "2027-12-31",
            "quantity": 5,
            "received_at": "2026-01-15",
        },
        format="json",
    )
    adjust_response = client.post(
        f"/api/inventory/batches/{source_batch.id}/adjust/",
        {"delta": 1, "reason": "Regression adjustment"},
        format="json",
    )
    count_response = client.post(
        f"/api/inventory/batches/{source_batch.id}/count/",
        {"counted_quantity": 20, "reason": "Regression count"},
        format="json",
    )
    movement_history_response = client.get("/api/inventory/movements/")

    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert receipt_response.status_code == 201
    assert adjust_response.status_code == 200
    assert count_response.status_code == 200
    assert movement_history_response.status_code == 404
