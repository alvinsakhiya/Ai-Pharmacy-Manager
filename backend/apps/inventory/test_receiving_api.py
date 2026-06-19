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


@pytest.fixture
def receiving_api_data():
    group_one = Group.objects.create(name="Group One", slug="receiving-api-one")
    group_two = Group.objects.create(name="Group Two", slug="receiving-api-two")
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

    admin = make_user("receiving-admin@example.com")
    superintendent = make_user("receiving-superintendent@example.com")
    stock_employee = make_user("receiving-stock@example.com")
    pharmacist = make_user("receiving-pharmacist@example.com")
    dispenser = make_user("receiving-dispenser@example.com")

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
        "admin": admin,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
    }


def authenticate(client, user):
    client.force_login(user)


def receive_payload(pharmacy: Pharmacy, medication: Medication, **overrides):
    payload = {
        "pharmacy": pharmacy.id,
        "medication": medication.id,
        "batch_number": "BATCH-001",
        "expiry_date": "2027-01-31",
        "quantity": 10,
        "received_at": "2026-01-15",
        "unit_price": "0.03",
        "reason": "Supplier delivery",
        "reference": "INV-001",
    }
    payload.update(overrides)
    return payload


def post_receipt(client, payload):
    return client.post("/api/inventory/receipts/", payload, format="json")


@pytest.mark.django_db
@pytest.mark.parametrize(
    "actor_key",
    ["admin", "superintendent", "stock_employee", "pharmacist"],
)
def test_roles_with_stock_manage_can_receive_stock(
    client,
    receiving_api_data,
    actor_key,
):
    authenticate(client, receiving_api_data[actor_key])

    response = post_receipt(
        client,
        receive_payload(
            receiving_api_data["pharmacy_one"],
            receiving_api_data["medication_one"],
            batch_number=f"{actor_key}-BATCH",
        ),
    )

    assert response.status_code == 201


@pytest.mark.django_db
def test_dispenser_cannot_receive_stock(client, receiving_api_data):
    authenticate(client, receiving_api_data["dispenser"])

    response = post_receipt(
        client,
        receive_payload(
            receiving_api_data["pharmacy_one"],
            receiving_api_data["medication_one"],
        ),
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_stock_employee_can_receive_into_assigned_pharmacy(
    client,
    receiving_api_data,
):
    authenticate(client, receiving_api_data["stock_employee"])

    response = post_receipt(
        client,
        receive_payload(
            receiving_api_data["pharmacy_two"],
            receiving_api_data["medication_one"],
        ),
    )

    assert response.status_code == 201


@pytest.mark.django_db
def test_stock_employee_cannot_receive_into_unassigned_pharmacy(
    client,
    receiving_api_data,
):
    authenticate(client, receiving_api_data["stock_employee"])

    response = post_receipt(
        client,
        receive_payload(
            receiving_api_data["pharmacy_three"],
            receiving_api_data["medication_one"],
        ),
    )

    assert response.status_code == 400
    assert "pharmacy" in response.json()


@pytest.mark.django_db
def test_pharmacist_can_receive_into_own_pharmacy(client, receiving_api_data):
    authenticate(client, receiving_api_data["pharmacist"])

    response = post_receipt(
        client,
        receive_payload(
            receiving_api_data["pharmacy_one"],
            receiving_api_data["medication_one"],
        ),
    )

    assert response.status_code == 201


@pytest.mark.django_db
def test_pharmacist_cannot_receive_into_another_pharmacy(client, receiving_api_data):
    authenticate(client, receiving_api_data["pharmacist"])

    response = post_receipt(
        client,
        receive_payload(
            receiving_api_data["pharmacy_two"],
            receiving_api_data["medication_one"],
        ),
    )

    assert response.status_code == 400
    assert "pharmacy" in response.json()


@pytest.mark.django_db
def test_superintendent_can_receive_into_group_pharmacy(client, receiving_api_data):
    authenticate(client, receiving_api_data["superintendent"])

    response = post_receipt(
        client,
        receive_payload(
            receiving_api_data["pharmacy_three"],
            receiving_api_data["medication_one"],
        ),
    )

    assert response.status_code == 201


@pytest.mark.django_db
def test_admin_can_receive_into_any_pharmacy(client, receiving_api_data):
    authenticate(client, receiving_api_data["admin"])

    response = post_receipt(
        client,
        receive_payload(
            receiving_api_data["pharmacy_other"],
            receiving_api_data["medication_other"],
        ),
    )

    assert response.status_code == 201


@pytest.mark.django_db
def test_medication_must_belong_to_pharmacy_group(client, receiving_api_data):
    authenticate(client, receiving_api_data["admin"])

    response = post_receipt(
        client,
        receive_payload(
            receiving_api_data["pharmacy_one"],
            receiving_api_data["medication_other"],
        ),
    )

    assert response.status_code == 400
    assert "medication" in response.json()


@pytest.mark.django_db
def test_first_receipt_creates_stock_item_batch_and_movement(
    client,
    receiving_api_data,
):
    authenticate(client, receiving_api_data["admin"])

    response = post_receipt(
        client,
        receive_payload(
            receiving_api_data["pharmacy_one"],
            receiving_api_data["medication_one"],
            quantity=12,
        ),
    )

    assert response.status_code == 201
    stock_item = StockItem.objects.get(
        pharmacy=receiving_api_data["pharmacy_one"],
        medication=receiving_api_data["medication_one"],
    )
    batch = StockBatch.objects.get(stock_item=stock_item, batch_number="BATCH-001")
    movement = StockMovement.objects.get(stock_item=stock_item, batch=batch)
    assert batch.quantity == 12
    assert batch.quantity_received == 12
    assert movement.movement_type == MovementType.RECEIPT
    assert movement.quantity_delta == 12
    assert movement.balance_after == 12
    assert response.json()["movement"] == {
        "id": movement.id,
        "movement_type": MovementType.RECEIPT,
        "quantity_delta": 12,
        "balance_after": 12,
        "batch": batch.id,
    }


@pytest.mark.django_db
def test_second_receipt_tops_up_existing_batch(client, receiving_api_data):
    authenticate(client, receiving_api_data["admin"])
    payload = receive_payload(
        receiving_api_data["pharmacy_one"],
        receiving_api_data["medication_one"],
        quantity=10,
    )
    first = post_receipt(client, payload)
    assert first.status_code == 201

    second = post_receipt(client, {**payload, "quantity": 5})

    assert second.status_code == 201
    stock_item = StockItem.objects.get(
        pharmacy=receiving_api_data["pharmacy_one"],
        medication=receiving_api_data["medication_one"],
    )
    batch = StockBatch.objects.get(stock_item=stock_item, batch_number="BATCH-001")
    movements = StockMovement.objects.filter(stock_item=stock_item).order_by("id")
    assert batch.quantity == 15
    assert batch.quantity_received == 15
    assert movements.count() == 2
    assert movements[1].balance_after == 15


@pytest.mark.django_db
def test_receiving_reuses_existing_stock_item(client, receiving_api_data):
    authenticate(client, receiving_api_data["admin"])
    base_payload = receive_payload(
        receiving_api_data["pharmacy_one"],
        receiving_api_data["medication_one"],
    )

    first = post_receipt(client, base_payload)
    second = post_receipt(
        client,
        {
            **base_payload,
            "batch_number": "BATCH-002",
            "expiry_date": "2027-02-28",
        },
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert (
        StockItem.objects.filter(
            pharmacy=receiving_api_data["pharmacy_one"],
            medication=receiving_api_data["medication_one"],
        ).count()
        == 1
    )


@pytest.mark.django_db
def test_stock_movement_is_append_only(receiving_api_data):
    stock_item = StockItem.objects.create(
        pharmacy=receiving_api_data["pharmacy_one"],
        medication=receiving_api_data["medication_one"],
    )
    batch = StockBatch.objects.create(
        stock_item=stock_item,
        batch_number="APPEND-1",
        expiry_date=date(2027, 1, 31),
        quantity=10,
        quantity_received=10,
        received_at=date(2026, 1, 15),
    )
    movement = StockMovement.objects.create(
        stock_item=stock_item,
        batch=batch,
        movement_type=MovementType.RECEIPT,
        quantity_delta=10,
        balance_after=10,
        actor=receiving_api_data["admin"],
    )

    movement.reason = "Changed"
    with pytest.raises(ValueError):
        movement.save()
    with pytest.raises(ValueError):
        movement.delete()


@pytest.mark.django_db
def test_receiving_writes_stock_received_audit_event(client, receiving_api_data):
    authenticate(client, receiving_api_data["admin"])

    response = post_receipt(
        client,
        receive_payload(
            receiving_api_data["pharmacy_one"],
            receiving_api_data["medication_one"],
            quantity=7,
        ),
    )

    assert response.status_code == 201
    movement = StockMovement.objects.get()
    event = AuditEvent.objects.get(action=AuditAction.STOCK_RECEIVED)
    assert event.pharmacy == receiving_api_data["pharmacy_one"]
    assert event.metadata == {
        "pharmacy_id": receiving_api_data["pharmacy_one"].id,
        "medication_id": receiving_api_data["medication_one"].id,
        "batch_number": "BATCH-001",
        "quantity": 7,
        "balance_after": 7,
        "movement_id": movement.id,
    }


@pytest.mark.django_db
def test_receiving_rolls_back_when_audit_recording_fails(
    client,
    receiving_api_data,
    monkeypatch,
):
    authenticate(client, receiving_api_data["admin"])

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.inventory.services.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        post_receipt(
            client,
            receive_payload(
                receiving_api_data["pharmacy_three"],
                receiving_api_data["medication_two"],
                batch_number="ROLLBACK-1",
            ),
        )

    assert not StockItem.objects.filter(
        pharmacy=receiving_api_data["pharmacy_three"],
        medication=receiving_api_data["medication_two"],
    ).exists()
    assert not StockBatch.objects.filter(batch_number="ROLLBACK-1").exists()
    assert not StockMovement.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("quantity", [0, -1, "not-an-integer"])
def test_invalid_quantity_returns_400(client, receiving_api_data, quantity):
    authenticate(client, receiving_api_data["admin"])

    response = post_receipt(
        client,
        receive_payload(
            receiving_api_data["pharmacy_one"],
            receiving_api_data["medication_one"],
            quantity=quantity,
        ),
    )

    assert response.status_code == 400
    assert "quantity" in response.json()


@pytest.mark.django_db
def test_missing_expiry_date_returns_400(client, receiving_api_data):
    authenticate(client, receiving_api_data["admin"])
    payload = receive_payload(
        receiving_api_data["pharmacy_one"],
        receiving_api_data["medication_one"],
    )
    del payload["expiry_date"]

    response = post_receipt(client, payload)

    assert response.status_code == 400
    assert "expiry_date" in response.json()


@pytest.mark.django_db
def test_conflicting_existing_batch_expiry_returns_400(client, receiving_api_data):
    authenticate(client, receiving_api_data["admin"])
    payload = receive_payload(
        receiving_api_data["pharmacy_one"],
        receiving_api_data["medication_one"],
        expiry_date="2027-01-31",
    )
    first = post_receipt(client, payload)
    assert first.status_code == 201

    response = post_receipt(client, {**payload, "expiry_date": "2027-02-28"})

    assert response.status_code == 400
    assert "expiry_date" in response.json()


@pytest.mark.django_db
def test_expiry_before_received_date_returns_400(client, receiving_api_data):
    authenticate(client, receiving_api_data["admin"])

    response = post_receipt(
        client,
        receive_payload(
            receiving_api_data["pharmacy_one"],
            receiving_api_data["medication_one"],
            expiry_date="2026-01-01",
            received_at="2026-01-15",
        ),
    )

    assert response.status_code == 400
    assert "expiry_date" in response.json()


@pytest.mark.django_db
def test_inventory_get_endpoints_still_work_and_no_movement_history_exists(
    client,
    receiving_api_data,
):
    authenticate(client, receiving_api_data["admin"])
    receipt = post_receipt(
        client,
        receive_payload(
            receiving_api_data["pharmacy_one"],
            receiving_api_data["medication_one"],
        ),
    )
    stock_item_id = receipt.json()["stock_item"]["id"]

    list_response = client.get("/api/inventory/stock-items/")
    detail_response = client.get(f"/api/inventory/stock-items/{stock_item_id}/")
    movement_history_response = client.get("/api/inventory/movements/")

    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert movement_history_response.status_code == 404


@pytest.mark.django_db
def test_receipts_endpoint_has_no_read_or_update_methods(client, receiving_api_data):
    authenticate(client, receiving_api_data["admin"])

    assert client.get("/api/inventory/receipts/").status_code == 405
    assert client.put("/api/inventory/receipts/", {}, format="json").status_code == 405
    assert (
        client.patch("/api/inventory/receipts/", {}, format="json").status_code == 405
    )
    assert client.delete("/api/inventory/receipts/").status_code == 405
