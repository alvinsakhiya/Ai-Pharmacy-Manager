from datetime import date, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditEvent
from apps.blister.models import DosetteCycle, PatientMedication
from apps.catalogue.models import Medication, MedicationForm
from apps.inventory.models import StockBatch, StockItem, StockMovement
from apps.patients.models import Patient, PatientNote
from apps.tenancy import permissions
from apps.tenancy.models import Group, Membership, Pharmacy, Role
from apps.tenancy.permissions import Action

PASSWORD = "Initial-pass-123!"
ADJUSTMENT = "ADJUSTMENT"
WEEKLY = "WEEKLY"
PREPARED = "PREPARED"
DRAFT = "DRAFT"
CANCELLED = "CANCELLED"
COMPLETED = "COMPLETED"
SEVERITY_RANK = {"critical": 0, "warning": 1, "info": 2}


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


def make_medication(group: Group, name: str) -> Medication:
    return Medication.objects.create(
        group=group,
        name=name,
        form=MedicationForm.TABLET,
        strength="5 mg",
    )


def make_stock_item(
    pharmacy: Pharmacy,
    medication: Medication,
    *,
    reorder_level: int = 0,
) -> StockItem:
    return StockItem.objects.create(
        pharmacy=pharmacy,
        medication=medication,
        reorder_level=reorder_level,
    )


def make_batch(
    stock_item: StockItem,
    batch_number: str,
    *,
    quantity: int,
    expiry_date: date,
) -> StockBatch:
    return StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=batch_number,
        expiry_date=expiry_date,
        quantity=quantity,
        quantity_received=quantity,
        received_at=timezone.now().date(),
    )


def make_outbound(stock_item: StockItem, batch: StockBatch, *, quantity: int) -> None:
    StockMovement.objects.create(
        stock_item=stock_item,
        batch=batch,
        movement_type=ADJUSTMENT,
        quantity_delta=-quantity,
        balance_after=batch.quantity,
        reference="notifications-test",
    )


def make_patient(
    pharmacy: Pharmacy,
    reference: str,
    *,
    first_name: str = "PrivateFirst",
    last_name: str = "PrivateLast",
) -> Patient:
    return Patient.objects.create(
        pharmacy=pharmacy,
        patient_reference=reference,
        first_name=first_name,
        last_name=last_name,
        date_of_birth=date(1981, 1, 1),
        address=f"{reference} Hidden Address",
        postcode="TE1 1ST",
        phone="020 0000 1111",
        notes=f"{reference} private patient notes",
    )


def make_cycle(
    patient: Patient,
    reference: str,
    *,
    status: str = PREPARED,
    stock_deducted: bool = False,
) -> DosetteCycle:
    return DosetteCycle.objects.create(
        patient=patient,
        reference=reference,
        frequency=WEEKLY,
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 7),
        status=status,
        stock_deducted=stock_deducted,
        deducted_at=timezone.now() if stock_deducted else None,
    )


@pytest.fixture
def alerts_data():
    today = timezone.now().date()
    group_one = Group.objects.create(name="Group One", slug="alerts-one")
    group_two = Group.objects.create(name="Group Two", slug="alerts-two")
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

    stockout = make_stock_item(
        pharmacy_one,
        make_medication(group_one, "A Stockout Medicine"),
        reorder_level=20,
    )
    low_stock = make_stock_item(
        pharmacy_one,
        make_medication(group_one, "Low Stock Medicine"),
        reorder_level=20,
    )
    near_expiry = make_stock_item(
        pharmacy_one,
        make_medication(group_one, "Near Expiry Medicine"),
    )
    dead_stock = make_stock_item(
        pharmacy_one,
        make_medication(group_one, "Dead Stock Medicine"),
    )
    slow_moving = make_stock_item(
        pharmacy_two,
        make_medication(group_one, "Slow Moving Medicine"),
    )
    no_attention = make_stock_item(
        pharmacy_two,
        make_medication(group_one, "No Attention Medicine"),
    )
    cross_pharmacy_stock = make_stock_item(
        pharmacy_three,
        make_medication(group_one, "Cross Pharmacy Medicine"),
    )
    cross_tenant_stock = make_stock_item(
        pharmacy_other,
        make_medication(group_two, "Cross Tenant Medicine"),
    )

    make_batch(
        stockout,
        "OUT-001",
        quantity=0,
        expiry_date=today + timedelta(days=120),
    )
    low_batch = make_batch(
        low_stock,
        "LOW-001",
        quantity=3,
        expiry_date=today + timedelta(days=120),
    )
    near_batch = make_batch(
        near_expiry,
        "NEAR-001",
        quantity=10,
        expiry_date=today + timedelta(days=10),
    )
    make_batch(
        dead_stock,
        "DEAD-001",
        quantity=12,
        expiry_date=today + timedelta(days=120),
    )
    slow_batch = make_batch(
        slow_moving,
        "SLOW-001",
        quantity=12,
        expiry_date=today + timedelta(days=120),
    )
    no_attention_batch = make_batch(
        no_attention,
        "NOATTN-001",
        quantity=20,
        expiry_date=today + timedelta(days=120),
    )
    make_batch(
        cross_pharmacy_stock,
        "CROSS-PHARMACY-001",
        quantity=7,
        expiry_date=today + timedelta(days=120),
    )
    make_batch(
        cross_tenant_stock,
        "CROSS-TENANT-001",
        quantity=7,
        expiry_date=today + timedelta(days=120),
    )
    make_outbound(low_stock, low_batch, quantity=8)
    make_outbound(near_expiry, near_batch, quantity=8)
    make_outbound(slow_moving, slow_batch, quantity=2)
    make_outbound(no_attention, no_attention_batch, quantity=8)

    patient_one = make_patient(pharmacy_one, "P1-ALERT-001")
    patient_two = make_patient(pharmacy_two, "P2-ALERT-001")
    patient_three = make_patient(pharmacy_three, "P3-ALERT-001")
    patient_other = make_patient(pharmacy_other, "OTHER-ALERT-001")
    prepared_cycle = make_cycle(patient_one, "MDS-PREPARED-001")
    deducted_cycle = make_cycle(
        patient_one,
        "MDS-DEDUCTED-001",
        stock_deducted=True,
    )
    draft_cycle = make_cycle(patient_one, "MDS-DRAFT-001", status=DRAFT)
    cancelled_cycle = make_cycle(
        patient_one,
        "MDS-CANCELLED-001",
        status=CANCELLED,
    )
    completed_cycle = make_cycle(
        patient_one,
        "MDS-COMPLETED-001",
        status=COMPLETED,
    )
    pharmacy_two_cycle = make_cycle(patient_two, "MDS-P2-PREPARED-001")
    cross_pharmacy_cycle = make_cycle(patient_three, "MDS-P3-PREPARED-001")
    cross_tenant_cycle = make_cycle(patient_other, "MDS-OTHER-PREPARED-001")

    medication = make_medication(group_one, "Sensitive Dose Medicine")
    PatientMedication.objects.create(
        patient=patient_one,
        medication=medication,
        dose_instructions="Hidden dose instructions",
        quantity_morning=1,
    )
    PatientNote.objects.create(
        patient=patient_one,
        body="Hidden patient note body",
        author=None,
        author_email="",
    )

    stock_employee = make_user("alerts-stock@example.com")
    pharmacist = make_user("alerts-pharmacist@example.com")
    dispenser = make_user("alerts-dispenser@example.com")
    outsider = make_user("alerts-outsider@example.com")
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group_one,
        pharmacies=(pharmacy_one, pharmacy_two),
    )
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy_one)
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy_one)

    return {
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "pharmacy_three": pharmacy_three,
        "stockout": stockout,
        "low_stock": low_stock,
        "near_expiry": near_expiry,
        "dead_stock": dead_stock,
        "slow_moving": slow_moving,
        "cross_pharmacy_stock": cross_pharmacy_stock,
        "cross_tenant_stock": cross_tenant_stock,
        "patient_one": patient_one,
        "prepared_cycle": prepared_cycle,
        "deducted_cycle": deducted_cycle,
        "draft_cycle": draft_cycle,
        "cancelled_cycle": cancelled_cycle,
        "completed_cycle": completed_cycle,
        "pharmacy_two_cycle": pharmacy_two_cycle,
        "cross_pharmacy_cycle": cross_pharmacy_cycle,
        "cross_tenant_cycle": cross_tenant_cycle,
        "stock_employee": stock_employee,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
        "outsider": outsider,
    }


def alerts_url() -> str:
    return "/api/notifications/alerts/"


def alerts(response) -> list[dict]:
    return response.json()["alerts"]


def alert_ids(response) -> set[str]:
    return {alert["id"] for alert in alerts(response)}


def alert_by_id(response, alert_id: str) -> dict:
    return next(alert for alert in alerts(response) if alert["id"] == alert_id)


@pytest.mark.django_db
def test_alerts_endpoint_access_and_empty_capabilities(
    client,
    alerts_data,
    monkeypatch,
):
    unauthenticated = client.get(alerts_url())
    assert unauthenticated.status_code in {401, 403}

    monkeypatch.setitem(
        permissions.ROLE_CAPABILITIES,
        Role.STOCK_EMPLOYEE,
        frozenset(),
    )
    authenticate(client, alerts_data["stock_employee"])

    response = client.get(alerts_url())

    assert response.status_code == 200
    assert response.json()["summary"] == {
        "total": 0,
        "critical": 0,
        "warning": 0,
        "info": 0,
        "by_category": {"stock": 0, "dosette": 0},
    }
    assert response.json()["alerts"] == []


@pytest.mark.django_db
def test_stock_role_receives_stock_alerts_without_dosette_or_patient_data(
    client,
    alerts_data,
):
    authenticate(client, alerts_data["stock_employee"])

    response = client.get(alerts_url())

    assert response.status_code == 200
    categories = {alert["category"] for alert in alerts(response)}
    assert categories == {"stock"}
    assert response.json()["summary"]["by_category"]["stock"] > 0
    assert response.json()["summary"]["by_category"]["dosette"] == 0
    assert f"stock:stockout:{alerts_data['stockout'].id}" in alert_ids(response)
    assert "dosette" not in categories

    payload_text = str(response.json())
    for forbidden in [
        "patient_reference",
        "first_name",
        "last_name",
        "date_of_birth",
        "address",
        "phone",
        "dose_instructions",
        "note",
        "P1-ALERT-001",
        "PrivateFirst",
        "PrivateLast",
        "Hidden Address",
        "020 0000 1111",
        "Hidden dose instructions",
        "Hidden patient note body",
    ]:
        assert forbidden not in payload_text


@pytest.mark.django_db
def test_blister_capability_receives_only_prepared_not_deducted_dosette_alerts(
    client,
    alerts_data,
    monkeypatch,
):
    monkeypatch.setitem(
        permissions.ROLE_CAPABILITIES,
        Role.DISPENSER,
        frozenset({Action.BLISTER_VIEW}),
    )
    authenticate(client, alerts_data["dispenser"])

    response = client.get(alerts_url())

    assert response.status_code == 200
    assert response.json()["summary"]["by_category"] == {"stock": 0, "dosette": 1}
    assert alert_ids(response) == {
        f"dosette:prepared_not_deducted:{alerts_data['prepared_cycle'].id}"
    }
    alert = alerts(response)[0]
    assert alert["type"] == "prepared_not_deducted"
    assert alert["severity"] == "warning"
    assert alert["title"] == "Prepared cycle awaiting stock deduction"
    assert alert["message"] == (
        "Cycle MDS-PREPARED-001 is prepared but stock has not been deducted."
    )
    assert alert["subject"] == {
        "dosette_cycle_id": alerts_data["prepared_cycle"].id,
        "cycle_reference": "MDS-PREPARED-001",
        "patient_id": alerts_data["patient_one"].id,
        "patient_reference": "P1-ALERT-001",
    }
    for excluded in [
        alerts_data["deducted_cycle"],
        alerts_data["draft_cycle"],
        alerts_data["cancelled_cycle"],
        alerts_data["completed_cycle"],
    ]:
        assert f"dosette:prepared_not_deducted:{excluded.id}" not in alert_ids(response)


@pytest.mark.django_db
def test_combined_role_receives_stock_and_dosette_categories(client, alerts_data):
    authenticate(client, alerts_data["pharmacist"])

    response = client.get(alerts_url())

    assert response.status_code == 200
    categories = {alert["category"] for alert in alerts(response)}
    assert categories == {"stock", "dosette"}
    assert response.json()["summary"]["by_category"]["stock"] > 0
    assert response.json()["summary"]["by_category"]["dosette"] == 1


@pytest.mark.django_db
def test_tenant_scoping_for_stock_and_dosette_alerts(client, alerts_data):
    authenticate(client, alerts_data["pharmacist"])

    response = client.get(alerts_url())

    ids = alert_ids(response)
    assert f"stock:dead_stock:{alerts_data['cross_pharmacy_stock'].id}" not in ids
    assert f"stock:dead_stock:{alerts_data['cross_tenant_stock'].id}" not in ids
    assert (
        f"dosette:prepared_not_deducted:{alerts_data['cross_pharmacy_cycle'].id}"
        not in ids
    )
    assert (
        f"dosette:prepared_not_deducted:{alerts_data['cross_tenant_cycle'].id}"
        not in ids
    )
    assert (
        f"dosette:prepared_not_deducted:{alerts_data['pharmacy_two_cycle'].id}"
        not in ids
    )


@pytest.mark.django_db
def test_stock_alert_generation_shape_severity_and_subject(client, alerts_data):
    authenticate(client, alerts_data["stock_employee"])

    response = client.get(alerts_url())

    assert response.status_code == 200
    expected = [
        ("stockout", "critical", "Stockout", alerts_data["stockout"]),
        ("low_stock", "warning", "Low stock", alerts_data["low_stock"]),
        ("near_expiry", "warning", "Near expiry", alerts_data["near_expiry"]),
        ("dead_stock", "info", "Dead stock", alerts_data["dead_stock"]),
        ("slow_moving", "info", "Slow moving", alerts_data["slow_moving"]),
    ]
    for alert_type, severity, title, stock_item in expected:
        alert = alert_by_id(response, f"stock:{alert_type}:{stock_item.id}")
        assert alert["category"] == "stock"
        assert alert["type"] == alert_type
        assert alert["severity"] == severity
        assert alert["title"] == f"{title}: {stock_item.medication.name}"
        assert alert["pharmacy_id"] == stock_item.pharmacy_id
        assert alert["subject"] == {
            "stock_item_id": stock_item.id,
            "medication_id": stock_item.medication_id,
            "medication_name": stock_item.medication.name,
        }
    assert (
        alert_by_id(
            response,
            f"stock:stockout:{alerts_data['stockout'].id}",
        )["message"]
        == "0 units on hand."
    )


@pytest.mark.django_db
def test_alerts_are_ordered_by_severity_category_and_title(client, alerts_data):
    authenticate(client, alerts_data["stock_employee"])

    response = client.get(alerts_url())

    severities = [alert["severity"] for alert in alerts(response)]
    assert severities[0] == "critical"
    assert severities == sorted(
        severities, key=lambda severity: SEVERITY_RANK[severity]
    )


@pytest.mark.django_db
def test_deterministic_alert_ids(client, alerts_data):
    authenticate(client, alerts_data["pharmacist"])

    response = client.get(alerts_url())

    assert f"stock:stockout:{alerts_data['stockout'].id}" in alert_ids(response)
    assert (
        f"dosette:prepared_not_deducted:{alerts_data['prepared_cycle'].id}"
        in alert_ids(response)
    )


@pytest.mark.django_db
def test_pharmacy_filter_narrows_stock_alerts_and_invalid_filter_400(
    client,
    alerts_data,
):
    authenticate(client, alerts_data["stock_employee"])

    response = client.get(alerts_url(), {"pharmacy": alerts_data["pharmacy_two"].id})
    invalid = client.get(alerts_url(), {"pharmacy": "not-an-id"})

    assert response.status_code == 200
    ids = alert_ids(response)
    assert f"stock:slow_moving:{alerts_data['slow_moving'].id}" in ids
    assert f"stock:stockout:{alerts_data['stockout'].id}" not in ids
    assert all(
        alert["pharmacy_id"] == alerts_data["pharmacy_two"].id
        for alert in alerts(response)
    )
    assert invalid.status_code == 400
    assert invalid.json() == {"pharmacy": ["Pharmacy filter must be an integer."]}


@pytest.mark.django_db
def test_empty_state_for_no_matching_alerts(client, alerts_data):
    authenticate(client, alerts_data["stock_employee"])

    response = client.get(alerts_url(), {"pharmacy": alerts_data["pharmacy_three"].id})

    assert response.status_code == 200
    assert response.json()["summary"] == {
        "total": 0,
        "critical": 0,
        "warning": 0,
        "info": 0,
        "by_category": {"stock": 0, "dosette": 0},
    }
    assert response.json()["alerts"] == []


@pytest.mark.django_db
def test_dosette_alerts_only_include_pseudonymous_patient_cycle_identifiers(
    client,
    alerts_data,
    monkeypatch,
):
    monkeypatch.setitem(
        permissions.ROLE_CAPABILITIES,
        Role.DISPENSER,
        frozenset({Action.BLISTER_VIEW}),
    )
    authenticate(client, alerts_data["dispenser"])

    response = client.get(alerts_url())

    assert response.status_code == 200
    payload = response.json()
    subject = payload["alerts"][0]["subject"]
    assert set(subject) == {
        "dosette_cycle_id",
        "cycle_reference",
        "patient_id",
        "patient_reference",
    }
    assert subject["patient_reference"] == "P1-ALERT-001"

    payload_text = str(payload)
    for forbidden in [
        "first_name",
        "last_name",
        "date_of_birth",
        "address",
        "phone",
        "dose_instructions",
        "notes",
        "PrivateFirst",
        "PrivateLast",
        "Hidden Address",
        "020 0000 1111",
        "Hidden dose instructions",
        "Hidden patient note body",
    ]:
        assert forbidden not in payload_text


@pytest.mark.django_db
def test_alerts_endpoint_is_read_only_and_unaudited(client, alerts_data):
    authenticate(client, alerts_data["pharmacist"])
    audit_count = AuditEvent.objects.count()

    response = client.get(alerts_url())

    assert response.status_code == 200
    assert AuditEvent.objects.count() == audit_count
