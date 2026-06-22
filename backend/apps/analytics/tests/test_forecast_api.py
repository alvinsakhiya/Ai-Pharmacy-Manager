from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.analytics.models import ForecastItem, ForecastRun
from apps.analytics.services import generate_stock_forecast
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


def make_product(
    name: str = "Paracetamol 500mg tablets",
    *,
    pack_size: int | None = 100,
) -> CatalogueProduct:
    return CatalogueProduct.objects.create(
        dmd_code=f"SEED-{name[:8].upper()}",
        source="SEED",
        display_name=name,
        ingredient=name.split()[0],
        strength="500mg",
        dose_form="tablets",
        pack_size=pack_size,
        pack_unit="tablets",
    )


def make_medication(
    group: Group, product: CatalogueProduct | None = None
) -> Medication:
    if product is not None:
        return Medication.objects.create(
            group=group,
            catalogue_product=product,
            name=product.display_name,
            form=MedicationForm.TABLET,
            strength=product.strength,
        )
    return Medication.objects.create(
        group=group,
        name="Legacy medicine",
        form=MedicationForm.TABLET,
        strength="5mg",
    )


def make_stock_item(
    pharmacy: Pharmacy,
    medication: Medication,
    *,
    quantity: int,
    reorder_level: int = 0,
) -> StockItem:
    stock_item = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=medication,
        reorder_level=reorder_level,
    )
    StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=f"BATCH-{stock_item.id}",
        expiry_date=timezone.now().date() + timedelta(days=365),
        quantity=quantity,
        quantity_received=quantity,
        received_at=timezone.now().date() - timedelta(days=90),
    )
    return stock_item


def make_movement(
    stock_item: StockItem,
    *,
    quantity_delta: int,
    days_ago: int,
) -> StockMovement:
    movement = StockMovement.objects.create(
        stock_item=stock_item,
        batch=stock_item.batches.first(),
        movement_type=MovementType.ADJUSTMENT,
        quantity_delta=quantity_delta,
        balance_after=stock_item.batches.first().quantity,
        reference="forecast-test",
    )
    StockMovement.objects.filter(pk=movement.pk).update(
        created_at=timezone.now() - timedelta(days=days_ago)
    )
    movement.refresh_from_db()
    return movement


@pytest.fixture
def forecast_data():
    group_one = Group.objects.create(name="Forecast Group", slug="forecast-group")
    group_two = Group.objects.create(name="Other Group", slug="other-forecast-group")
    pharmacy_one = Pharmacy.objects.create(
        group=group_one,
        name="Forecast Pharmacy",
        code="FP",
    )
    pharmacy_two = Pharmacy.objects.create(
        group=group_one,
        name="Second Pharmacy",
        code="SP",
    )
    other_pharmacy = Pharmacy.objects.create(
        group=group_two,
        name="Other Pharmacy",
        code="OP",
    )
    admin = make_user("forecast-admin@example.com")
    pharmacist = make_user("forecast-pharmacist@example.com")
    dispenser = make_user("forecast-dispenser@example.com")
    stock_employee = make_user("forecast-stock@example.com")
    outsider = make_user("forecast-outsider@example.com")

    add_membership(admin, Role.ADMIN)
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy_one)
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy_one)
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group_one,
        pharmacies=(pharmacy_one, pharmacy_two),
    )

    return {
        "group_one": group_one,
        "group_two": group_two,
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "other_pharmacy": other_pharmacy,
        "admin": admin,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
        "stock_employee": stock_employee,
        "outsider": outsider,
    }


@pytest.mark.django_db
def test_forecast_models_store_safe_pii_free_snapshots(forecast_data):
    product = make_product()
    stock_item = make_stock_item(
        forecast_data["pharmacy_one"],
        make_medication(forecast_data["group_one"], product),
        quantity=50,
    )

    run = generate_stock_forecast(
        forecast_data["pharmacist"],
        pharmacy=forecast_data["pharmacy_one"],
    )

    item = ForecastItem.objects.get(run=run, stock_item=stock_item)
    assert run.model_version == "baseline-1"
    assert run.status == ForecastRun.Status.COMPLETED
    assert item.medication_label == "Paracetamol 500mg tablets — pack of 100 tablets"
    assert "human review required" in item.explanation
    assert "patient" not in item.explanation.lower()


@pytest.mark.django_db
def test_no_movement_history_gives_low_confidence_and_safe_output(forecast_data):
    product = make_product()
    stock_item = make_stock_item(
        forecast_data["pharmacy_one"],
        make_medication(forecast_data["group_one"], product),
        quantity=5,
        reorder_level=20,
    )

    run = generate_stock_forecast(
        forecast_data["pharmacist"],
        pharmacy=forecast_data["pharmacy_one"],
    )

    item = run.items.get(stock_item=stock_item)
    assert item.predicted_usage_units == 0
    assert item.current_stock_units == 5
    assert item.safety_stock_units == 20
    assert item.suggested_reorder_units == 15
    assert item.suggested_reorder_packs == 1
    assert item.confidence == Decimal("0.10")
    assert item.history_points_count == 0


@pytest.mark.django_db
def test_movement_history_calculates_prediction_reorder_and_pack_conversion(
    forecast_data,
):
    product = make_product(pack_size=100)
    stock_item = make_stock_item(
        forecast_data["pharmacy_one"],
        make_medication(forecast_data["group_one"], product),
        quantity=50,
        reorder_level=50,
    )
    for days_ago in [5, 15, 25, 35, 45, 55]:
        make_movement(stock_item, quantity_delta=-100, days_ago=days_ago)

    run = generate_stock_forecast(
        forecast_data["pharmacist"],
        pharmacy=forecast_data["pharmacy_one"],
        horizon_days=30,
    )

    item = run.items.get(stock_item=stock_item)
    assert item.predicted_usage_units == 200
    assert item.predicted_usage_packs == Decimal("2.00")
    assert item.current_stock_units == 50
    assert item.current_stock_packs == Decimal("0.50")
    assert item.suggested_reorder_units == 200
    assert item.suggested_reorder_packs == 2
    assert item.confidence == Decimal("0.60")
    assert "average usage is 6.7 units/day" in item.explanation


@pytest.mark.django_db
def test_reorder_suggestion_never_negative(forecast_data):
    product = make_product(pack_size=28)
    stock_item = make_stock_item(
        forecast_data["pharmacy_one"],
        make_medication(forecast_data["group_one"], product),
        quantity=1000,
        reorder_level=20,
    )
    make_movement(stock_item, quantity_delta=-10, days_ago=7)

    run = generate_stock_forecast(
        forecast_data["pharmacist"],
        pharmacy=forecast_data["pharmacy_one"],
    )

    item = run.items.get(stock_item=stock_item)
    assert item.suggested_reorder_units == 0
    assert item.suggested_reorder_packs == 0


@pytest.mark.django_db
def test_only_negative_outbound_movements_count_as_usage(forecast_data):
    product = make_product(pack_size=10)
    stock_item = make_stock_item(
        forecast_data["pharmacy_one"],
        make_medication(forecast_data["group_one"], product),
        quantity=10,
    )
    make_movement(stock_item, quantity_delta=-90, days_ago=10)
    make_movement(stock_item, quantity_delta=500, days_ago=9)

    run = generate_stock_forecast(
        forecast_data["pharmacist"],
        pharmacy=forecast_data["pharmacy_one"],
    )

    item = run.items.get(stock_item=stock_item)
    assert item.predicted_usage_units == 30
    assert item.history_points_count == 1


@pytest.mark.django_db
def test_forecast_generation_does_not_mutate_stock_quantities(forecast_data):
    product = make_product()
    stock_item = make_stock_item(
        forecast_data["pharmacy_one"],
        make_medication(forecast_data["group_one"], product),
        quantity=50,
    )
    batch = stock_item.batches.get()

    generate_stock_forecast(
        forecast_data["pharmacist"],
        pharmacy=forecast_data["pharmacy_one"],
    )

    batch.refresh_from_db()
    assert batch.quantity == 50
    assert batch.quantity_received == 50
    assert StockMovement.objects.filter(stock_item=stock_item).count() == 0


@pytest.mark.django_db
def test_forecast_api_permissions_scoping_and_response(client, forecast_data):
    product = make_product()
    stock_item = make_stock_item(
        forecast_data["pharmacy_one"],
        make_medication(forecast_data["group_one"], product),
        quantity=50,
        reorder_level=20,
    )
    make_stock_item(
        forecast_data["pharmacy_two"],
        make_medication(forecast_data["group_one"], make_product("Ibuprofen tablets")),
        quantity=50,
    )

    authenticate(client, forecast_data["pharmacist"])
    response = client.post(
        "/api/analytics/forecasts/",
        {"pharmacy": forecast_data["pharmacy_one"].id, "horizon_days": 30},
        format="json",
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["model_version"] == "baseline-1"
    assert payload["pharmacy"] == forecast_data["pharmacy_one"].id
    assert payload["items"][0]["stock_item"] == stock_item.id
    assert "explanation" in payload["items"][0]
    assert "confidence" in payload["items"][0]

    latest = client.get(
        "/api/analytics/forecasts/latest/",
        {"pharmacy": forecast_data["pharmacy_one"].id},
    )
    assert latest.status_code == 200
    assert latest.json()["id"] == payload["id"]

    detail = client.get(f"/api/analytics/forecasts/{payload['id']}/")
    assert detail.status_code == 200
    assert detail.json()["id"] == payload["id"]

    out_of_scope = client.post(
        "/api/analytics/forecasts/",
        {"pharmacy": forecast_data["pharmacy_two"].id},
        format="json",
    )
    assert out_of_scope.status_code == 400

    client.logout()
    authenticate(client, forecast_data["dispenser"])
    denied = client.post(
        "/api/analytics/forecasts/",
        {"pharmacy": forecast_data["pharmacy_one"].id},
        format="json",
    )
    assert denied.status_code == 403
    view_allowed = client.get(
        "/api/analytics/forecasts/latest/",
        {"pharmacy": forecast_data["pharmacy_one"].id},
    )
    assert view_allowed.status_code == 200

    client.logout()
    authenticate(client, forecast_data["outsider"])
    outsider_denied = client.get(
        "/api/analytics/forecasts/latest/",
        {"pharmacy": forecast_data["pharmacy_one"].id},
    )
    assert outsider_denied.status_code == 403


@pytest.mark.django_db
def test_forecast_empty_latest_and_invalid_filters(client, forecast_data):
    authenticate(client, forecast_data["pharmacist"])

    empty = client.get(
        "/api/analytics/forecasts/latest/",
        {"pharmacy": forecast_data["pharmacy_one"].id},
    )
    assert empty.status_code == 200
    assert empty.json() == {"detail": "No forecast generated yet."}

    missing = client.get("/api/analytics/forecasts/latest/")
    assert missing.status_code == 400
    assert missing.json() == {"pharmacy": ["Pharmacy query parameter is required."]}

    invalid = client.get("/api/analytics/forecasts/latest/", {"pharmacy": "abc"})
    assert invalid.status_code == 400
    assert invalid.json() == {"pharmacy": ["Pharmacy filter must be an integer."]}


def test_forecast_permissions_are_least_privilege():
    assert Action.FORECAST_VIEW in ROLE_CAPABILITIES[Role.DISPENSER]
    assert Action.FORECAST_RUN not in ROLE_CAPABILITIES[Role.DISPENSER]
    assert Action.FORECAST_RUN in ROLE_CAPABILITIES[Role.PHARMACIST]
    assert Action.FORECAST_RUN in ROLE_CAPABILITIES[Role.STOCK_EMPLOYEE]
