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
    batch_prefix: str,
) -> StockItem:
    stock_item = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=medication,
        reorder_level=20,
    )
    StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=f"{batch_prefix}-ACTIVE",
        expiry_date=date(2027, 1, 31),
        quantity=10,
        quantity_received=10,
        received_at=date(2026, 1, 1),
    )
    StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=f"{batch_prefix}-INACTIVE",
        expiry_date=date(2027, 6, 30),
        quantity=8,
        quantity_received=8,
        received_at=date(2026, 1, 1),
        is_active=False,
    )
    return stock_item


@pytest.fixture
def adjustment_api_data():
    group_one = Group.objects.create(name="Group One", slug="adjustment-api-one")
    group_two = Group.objects.create(name="Group Two", slug="adjustment-api-two")
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
    medication_three = make_medication(group_one, "Amlodipine")
    medication_other = make_medication(group_two, "Metformin")

    stock_one = make_stock_item(pharmacy_one, medication_one, batch_prefix="P1-PAR")
    stock_two = make_stock_item(pharmacy_two, medication_two, batch_prefix="P2-IBU")
    stock_three = make_stock_item(
        pharmacy_three,
        medication_three,
        batch_prefix="P3-AML",
    )
    stock_other = make_stock_item(
        pharmacy_other,
        medication_other,
        batch_prefix="OP-MET",
    )

    admin = make_user("adjustment-admin@example.com")
    superintendent = make_user("adjustment-superintendent@example.com")
    stock_employee = make_user("adjustment-stock@example.com")
    pharmacist = make_user("adjustment-pharmacist@example.com")
    dispenser = make_user("adjustment-dispenser@example.com")

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
        "medication_three": medication_three,
        "medication_other": medication_other,
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


def active_batch(stock_item: StockItem) -> StockBatch:
    return StockBatch.objects.get(stock_item=stock_item, is_active=True)


def inactive_batch(stock_item: StockItem) -> StockBatch:
    return StockBatch.objects.get(stock_item=stock_item, is_active=False)


def adjust_payload(**overrides):
    payload = {
        "delta": 3,
        "reason": "Damaged pack correction",
        "reference": "ADJ-001",
    }
    payload.update(overrides)
    return payload


def count_payload(**overrides):
    payload = {
        "counted_quantity": 12,
        "reason": "Cycle count",
        "reference": "COUNT-001",
    }
    payload.update(overrides)
    return payload


def post_adjust(client, batch, payload):
    return client.post(
        f"/api/inventory/batches/{batch.id}/adjust/",
        payload,
        format="json",
    )


def post_count(client, batch, payload):
    return client.post(
        f"/api/inventory/batches/{batch.id}/count/",
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
@pytest.mark.parametrize(
    "actor_key",
    ["admin", "superintendent", "stock_employee", "pharmacist"],
)
def test_roles_with_stock_manage_can_adjust_and_count(
    client,
    adjustment_api_data,
    actor_key,
):
    authenticate(client, adjustment_api_data[actor_key])
    batch = active_batch(adjustment_api_data["stock_one"])

    adjust_response = post_adjust(client, batch, adjust_payload(delta=2))
    count_response = post_count(client, batch, count_payload(counted_quantity=9))

    assert adjust_response.status_code == 200
    assert count_response.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("endpoint", [post_adjust, post_count])
def test_dispenser_cannot_adjust_or_count(client, adjustment_api_data, endpoint):
    authenticate(client, adjustment_api_data["dispenser"])
    batch = active_batch(adjustment_api_data["stock_one"])
    payload = adjust_payload() if endpoint is post_adjust else count_payload()

    response = endpoint(client, batch, payload)

    assert response.status_code == 403


@pytest.mark.django_db
def test_stock_employee_can_act_on_assigned_pharmacy_batch(
    client,
    adjustment_api_data,
):
    authenticate(client, adjustment_api_data["stock_employee"])
    batch = active_batch(adjustment_api_data["stock_two"])

    response = post_adjust(client, batch, adjust_payload(delta=1))

    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("endpoint", [post_adjust, post_count])
def test_stock_employee_gets_404_for_unassigned_pharmacy_batch(
    client,
    adjustment_api_data,
    endpoint,
):
    authenticate(client, adjustment_api_data["stock_employee"])
    batch = active_batch(adjustment_api_data["stock_three"])
    payload = adjust_payload() if endpoint is post_adjust else count_payload()

    response = endpoint(client, batch, payload)

    assert response.status_code == 404


@pytest.mark.django_db
def test_pharmacist_can_act_on_own_pharmacy_batch(client, adjustment_api_data):
    authenticate(client, adjustment_api_data["pharmacist"])
    batch = active_batch(adjustment_api_data["stock_one"])

    response = post_count(client, batch, count_payload(counted_quantity=11))

    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("endpoint", [post_adjust, post_count])
def test_pharmacist_gets_404_for_another_pharmacy_batch(
    client,
    adjustment_api_data,
    endpoint,
):
    authenticate(client, adjustment_api_data["pharmacist"])
    batch = active_batch(adjustment_api_data["stock_two"])
    payload = adjust_payload() if endpoint is post_adjust else count_payload()

    response = endpoint(client, batch, payload)

    assert response.status_code == 404


@pytest.mark.django_db
def test_superintendent_can_act_on_group_pharmacy_batch(client, adjustment_api_data):
    authenticate(client, adjustment_api_data["superintendent"])
    batch = active_batch(adjustment_api_data["stock_three"])

    response = post_adjust(client, batch, adjust_payload(delta=1))

    assert response.status_code == 200


@pytest.mark.django_db
def test_admin_can_act_on_any_batch(client, adjustment_api_data):
    authenticate(client, adjustment_api_data["admin"])
    batch = active_batch(adjustment_api_data["stock_other"])

    response = post_count(client, batch, count_payload(counted_quantity=6))

    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("endpoint", [post_adjust, post_count])
def test_out_of_scope_batch_returns_404(client, adjustment_api_data, endpoint):
    authenticate(client, adjustment_api_data["superintendent"])
    batch = active_batch(adjustment_api_data["stock_other"])
    payload = adjust_payload() if endpoint is post_adjust else count_payload()

    response = endpoint(client, batch, payload)

    assert response.status_code == 404


@pytest.mark.django_db
def test_positive_adjustment_increases_quantity_and_creates_movement(
    client,
    adjustment_api_data,
):
    authenticate(client, adjustment_api_data["admin"])
    batch = active_batch(adjustment_api_data["stock_one"])

    response = post_adjust(client, batch, adjust_payload(delta=4))

    assert response.status_code == 200
    batch.refresh_from_db()
    movement = StockMovement.objects.get()
    assert batch.quantity == 14
    assert batch.quantity_received == 10
    assert movement.movement_type == MovementType.ADJUSTMENT
    assert movement.quantity_delta == 4
    assert movement.balance_after == 14
    assert response.json()["movement"] == movement_summary(movement)


@pytest.mark.django_db
def test_negative_adjustment_decreases_quantity(client, adjustment_api_data):
    authenticate(client, adjustment_api_data["admin"])
    batch = active_batch(adjustment_api_data["stock_one"])

    response = post_adjust(client, batch, adjust_payload(delta=-3))

    assert response.status_code == 200
    batch.refresh_from_db()
    movement = StockMovement.objects.get()
    assert batch.quantity == 7
    assert movement.quantity_delta == -3
    assert movement.balance_after == 7


@pytest.mark.django_db
@pytest.mark.parametrize("delta", [0, "not-an-integer"])
def test_invalid_adjustment_delta_returns_400(client, adjustment_api_data, delta):
    authenticate(client, adjustment_api_data["admin"])
    batch = active_batch(adjustment_api_data["stock_one"])

    response = post_adjust(client, batch, adjust_payload(delta=delta))

    assert response.status_code == 400
    assert "delta" in response.json()


@pytest.mark.django_db
def test_missing_adjustment_reason_returns_400(client, adjustment_api_data):
    authenticate(client, adjustment_api_data["admin"])
    batch = active_batch(adjustment_api_data["stock_one"])
    payload = adjust_payload()
    del payload["reason"]

    response = post_adjust(client, batch, payload)

    assert response.status_code == 400
    assert "reason" in response.json()


@pytest.mark.django_db
def test_adjustment_below_zero_returns_400_without_writes(
    client,
    adjustment_api_data,
):
    authenticate(client, adjustment_api_data["admin"])
    batch = active_batch(adjustment_api_data["stock_one"])

    response = post_adjust(client, batch, adjust_payload(delta=-11))

    assert response.status_code == 400
    assert "delta" in response.json()
    batch.refresh_from_db()
    assert batch.quantity == 10
    assert not StockMovement.objects.exists()
    assert not AuditEvent.objects.filter(action=AuditAction.STOCK_ADJUSTED).exists()


@pytest.mark.django_db
def test_count_greater_than_current_increases_quantity_and_creates_movement(
    client,
    adjustment_api_data,
):
    authenticate(client, adjustment_api_data["admin"])
    batch = active_batch(adjustment_api_data["stock_one"])

    response = post_count(client, batch, count_payload(counted_quantity=13))

    assert response.status_code == 200
    batch.refresh_from_db()
    movement = StockMovement.objects.get()
    assert batch.quantity == 13
    assert movement.movement_type == MovementType.COUNT_CORRECTION
    assert movement.quantity_delta == 3
    assert movement.balance_after == 13
    assert response.json()["changed"] is True
    assert response.json()["movement"] == movement_summary(movement)


@pytest.mark.django_db
def test_count_less_than_current_decreases_quantity(client, adjustment_api_data):
    authenticate(client, adjustment_api_data["admin"])
    batch = active_batch(adjustment_api_data["stock_one"])

    response = post_count(client, batch, count_payload(counted_quantity=4))

    assert response.status_code == 200
    batch.refresh_from_db()
    movement = StockMovement.objects.get()
    assert batch.quantity == 4
    assert movement.movement_type == MovementType.COUNT_CORRECTION
    assert movement.quantity_delta == -6
    assert movement.balance_after == 4


@pytest.mark.django_db
def test_count_equal_to_current_is_noop_without_movement_or_audit(
    client,
    adjustment_api_data,
):
    authenticate(client, adjustment_api_data["admin"])
    batch = active_batch(adjustment_api_data["stock_one"])

    response = post_count(client, batch, count_payload(counted_quantity=10))

    assert response.status_code == 200
    assert response.json()["changed"] is False
    assert response.json()["movement"] is None
    batch.refresh_from_db()
    assert batch.quantity == 10
    assert not StockMovement.objects.exists()
    assert not AuditEvent.objects.filter(
        action=AuditAction.STOCK_COUNT_RECONCILED,
    ).exists()


@pytest.mark.django_db
def test_negative_counted_quantity_returns_400(client, adjustment_api_data):
    authenticate(client, adjustment_api_data["admin"])
    batch = active_batch(adjustment_api_data["stock_one"])

    response = post_count(client, batch, count_payload(counted_quantity=-1))

    assert response.status_code == 400
    assert "counted_quantity" in response.json()


@pytest.mark.django_db
def test_adjustment_writes_audit_event(client, adjustment_api_data):
    authenticate(client, adjustment_api_data["admin"])
    batch = active_batch(adjustment_api_data["stock_one"])

    response = post_adjust(client, batch, adjust_payload(delta=2))

    assert response.status_code == 200
    movement = StockMovement.objects.get()
    event = AuditEvent.objects.get(action=AuditAction.STOCK_ADJUSTED)
    assert event.pharmacy == adjustment_api_data["pharmacy_one"]
    assert event.metadata == {
        "pharmacy_id": adjustment_api_data["pharmacy_one"].id,
        "medication_id": adjustment_api_data["medication_one"].id,
        "batch_id": batch.id,
        "batch_number": batch.batch_number,
        "quantity_delta": 2,
        "balance_after": 12,
        "movement_id": movement.id,
    }


@pytest.mark.django_db
def test_count_writes_audit_event(client, adjustment_api_data):
    authenticate(client, adjustment_api_data["admin"])
    batch = active_batch(adjustment_api_data["stock_one"])

    response = post_count(client, batch, count_payload(counted_quantity=6))

    assert response.status_code == 200
    movement = StockMovement.objects.get()
    event = AuditEvent.objects.get(action=AuditAction.STOCK_COUNT_RECONCILED)
    assert event.pharmacy == adjustment_api_data["pharmacy_one"]
    assert event.metadata == {
        "pharmacy_id": adjustment_api_data["pharmacy_one"].id,
        "medication_id": adjustment_api_data["medication_one"].id,
        "batch_id": batch.id,
        "batch_number": batch.batch_number,
        "quantity_delta": -4,
        "balance_after": 6,
        "movement_id": movement.id,
    }


@pytest.mark.django_db
def test_adjustment_rolls_back_when_audit_recording_fails(
    client,
    adjustment_api_data,
    monkeypatch,
):
    authenticate(client, adjustment_api_data["admin"])
    batch = active_batch(adjustment_api_data["stock_one"])

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.inventory.services.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        post_adjust(client, batch, adjust_payload(delta=2))

    batch.refresh_from_db()
    assert batch.quantity == 10
    assert not StockMovement.objects.exists()


@pytest.mark.django_db
def test_count_rolls_back_when_audit_recording_fails(
    client,
    adjustment_api_data,
    monkeypatch,
):
    authenticate(client, adjustment_api_data["admin"])
    batch = active_batch(adjustment_api_data["stock_one"])

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.inventory.services.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        post_count(client, batch, count_payload(counted_quantity=6))

    batch.refresh_from_db()
    assert batch.quantity == 10
    assert not StockMovement.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("endpoint", [post_adjust, post_count])
def test_inactive_batch_returns_400(client, adjustment_api_data, endpoint):
    authenticate(client, adjustment_api_data["admin"])
    batch = inactive_batch(adjustment_api_data["stock_one"])
    payload = adjust_payload() if endpoint is post_adjust else count_payload()

    response = endpoint(client, batch, payload)

    assert response.status_code == 400
    assert response.json() == {"batch": ["Cannot modify an inactive batch."]}


@pytest.mark.django_db
def test_inventory_get_and_receipt_endpoints_still_work(
    client,
    adjustment_api_data,
):
    authenticate(client, adjustment_api_data["admin"])

    list_response = client.get("/api/inventory/stock-items/")
    detail_response = client.get(
        f"/api/inventory/stock-items/{adjustment_api_data['stock_one'].id}/",
    )
    receipt_response = client.post(
        "/api/inventory/receipts/",
        {
            "pharmacy": adjustment_api_data["pharmacy_one"].id,
            "medication": adjustment_api_data["medication_one"].id,
            "batch_number": "RECEIPT-6C",
            "expiry_date": "2027-12-31",
            "quantity": 5,
            "received_at": "2026-01-15",
        },
        format="json",
    )
    movement_history_response = client.get("/api/inventory/movements/")

    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert receipt_response.status_code == 201
    assert movement_history_response.status_code == 404
