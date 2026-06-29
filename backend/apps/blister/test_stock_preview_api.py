from datetime import date, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalogue.models import CatalogueProduct, Medication, MedicationForm
from apps.inventory.models import StockBatch, StockItem, StockMovement
from apps.patients.models import Patient
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from .models import CycleFrequency, CycleStatus, DosetteCycle, PatientMedication

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


def make_patient(pharmacy: Pharmacy, reference: str) -> Patient:
    return Patient.objects.create(
        pharmacy=pharmacy,
        patient_reference=reference,
        first_name="Fictional",
        last_name="Person",
        date_of_birth=date(1980, 1, 1),
        address=f"{reference} Private Street",
        postcode="TE1 1ST",
        phone="020 0000 0101",
        notes="Fictional patient note",
    )


def make_cycle(patient: Patient, reference: str) -> DosetteCycle:
    return DosetteCycle.objects.create(
        patient=patient,
        reference=reference,
        frequency=CycleFrequency.WEEKLY,
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 7),
        status=CycleStatus.DRAFT,
    )


def make_medication(
    group: Group,
    name: str,
    strength: str = "5 mg",
) -> Medication:
    return Medication.objects.create(
        group=group,
        name=name,
        form=MedicationForm.TABLET,
        strength=strength,
    )


def make_catalogue_product(
    display_name: str = "Paracetamol 500mg tablets",
) -> CatalogueProduct:
    return CatalogueProduct.objects.create(
        display_name=display_name,
        ingredient="Paracetamol",
        strength="500mg",
        dose_form="tablet",
        pack_size=100,
        pack_unit="tablets",
    )


def make_stock_item(pharmacy: Pharmacy, medication: Medication) -> StockItem:
    return StockItem.objects.create(
        pharmacy=pharmacy,
        medication=medication,
        reorder_level=5,
    )


def make_batch(
    stock_item: StockItem,
    batch_number: str,
    *,
    expiry_date: date,
    quantity: int,
    is_active: bool = True,
) -> StockBatch:
    return StockBatch.objects.create(
        stock_item=stock_item,
        batch_number=batch_number,
        expiry_date=expiry_date,
        quantity=quantity,
        quantity_received=quantity,
        received_at=timezone.now().date(),
        is_active=is_active,
    )


@pytest.fixture
def stock_preview_data():
    today = timezone.now().date()
    group_one = Group.objects.create(name="Group One", slug="stock-preview-one")
    group_two = Group.objects.create(name="Group Two", slug="stock-preview-two")
    pharmacy_one = Pharmacy.objects.create(
        group=group_one,
        name="Pharmacy One",
        code="P1",
    )
    pharmacy_two = Pharmacy.objects.create(
        group=group_two,
        name="Pharmacy Two",
        code="P2",
    )
    patient_one = make_patient(pharmacy_one, "P1-STOCK-PREVIEW")
    patient_two = make_patient(pharmacy_two, "P2-STOCK-PREVIEW")
    cycle_one = make_cycle(patient_one, "PREVIEW-CYCLE-001")
    cycle_two = make_cycle(patient_two, "PREVIEW-CYCLE-002")

    available_medication = make_medication(group_one, "Amlodipine", "5 mg")
    shortage_medication = make_medication(group_one, "Bisoprolol", "2.5 mg")
    missing_medication = make_medication(group_one, "Cetirizine", "10 mg")
    inactive_medication = make_medication(group_one, "Discontinued Secret", "1 mg")
    other_medication = make_medication(group_two, "Other Pharmacy Medication", "1 mg")

    available_line = PatientMedication.objects.create(
        patient=patient_one,
        medication=available_medication,
        quantity_morning=2,
        quantity_lunchtime=1,
        quantity_evening=1,
        quantity_bedtime=0,
    )
    shortage_line = PatientMedication.objects.create(
        patient=patient_one,
        medication=shortage_medication,
        quantity_morning=2,
        quantity_lunchtime=2,
        quantity_evening=2,
        quantity_bedtime=0,
    )
    missing_line = PatientMedication.objects.create(
        patient=patient_one,
        medication=missing_medication,
        quantity_morning=0,
        quantity_lunchtime=0,
        quantity_evening=1,
        quantity_bedtime=0,
    )
    inactive_line = PatientMedication.objects.create(
        patient=patient_one,
        medication=inactive_medication,
        quantity_morning=9,
        quantity_lunchtime=9,
        quantity_evening=9,
        quantity_bedtime=9,
    )
    inactive_line.soft_delete()
    PatientMedication.objects.create(
        patient=patient_two,
        medication=other_medication,
        quantity_morning=1,
    )

    available_stock_item = make_stock_item(pharmacy_one, available_medication)
    shortage_stock_item = make_stock_item(pharmacy_one, shortage_medication)
    other_stock_item = make_stock_item(pharmacy_two, other_medication)

    early_batch = make_batch(
        available_stock_item,
        "AML-EARLY",
        expiry_date=today + timedelta(days=10),
        quantity=2,
    )
    later_batch = make_batch(
        available_stock_item,
        "AML-LATER",
        expiry_date=today + timedelta(days=30),
        quantity=5,
    )
    expired_batch = make_batch(
        available_stock_item,
        "AML-EXPIRED",
        expiry_date=today - timedelta(days=1),
        quantity=100,
    )
    make_batch(
        shortage_stock_item,
        "BIS-SHORT",
        expiry_date=today + timedelta(days=20),
        quantity=3,
    )
    make_batch(
        other_stock_item,
        "OTHER-BATCH",
        expiry_date=today + timedelta(days=20),
        quantity=50,
    )

    admin = make_user("stock-preview-admin@example.com")
    pharmacist = make_user("stock-preview-pharmacist@example.com")
    dispenser = make_user("stock-preview-dispenser@example.com")
    superintendent = make_user("stock-preview-superintendent@example.com")
    stock_employee = make_user("stock-preview-stock@example.com")

    add_membership(admin, Role.ADMIN)
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy_one)
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy_one)
    add_membership(superintendent, Role.SUPERINTENDENT, group=group_one)
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group_one,
        pharmacies=(pharmacy_one,),
    )

    return {
        "patient_one": patient_one,
        "patient_two": patient_two,
        "cycle_one": cycle_one,
        "cycle_two": cycle_two,
        "available_line": available_line,
        "shortage_line": shortage_line,
        "missing_line": missing_line,
        "inactive_line": inactive_line,
        "early_batch": early_batch,
        "later_batch": later_batch,
        "expired_batch": expired_batch,
        "admin": admin,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
    }


def authenticate(client, user):
    client.force_login(user)


def stock_preview_url(patient: Patient, cycle: DosetteCycle) -> str:
    return f"/api/patients/{patient.id}/cycles/{cycle.id}/stock-preview/"


def rows_by_name(response):
    return {row["medication_name"]: row for row in response.json()["medications"]}


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["admin", "pharmacist", "dispenser"])
def test_blister_view_roles_can_get_stock_preview(
    client,
    stock_preview_data,
    actor_key,
):
    authenticate(client, stock_preview_data[actor_key])

    response = client.get(
        stock_preview_url(
            stock_preview_data["patient_one"],
            stock_preview_data["cycle_one"],
        )
    )

    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["superintendent", "stock_employee"])
def test_roles_without_blister_view_are_denied_stock_preview(
    client,
    stock_preview_data,
    actor_key,
):
    authenticate(client, stock_preview_data[actor_key])

    response = client.get(
        stock_preview_url(
            stock_preview_data["patient_one"],
            stock_preview_data["cycle_one"],
        )
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_stock_preview_scoping_for_pharmacist(client, stock_preview_data):
    authenticate(client, stock_preview_data["pharmacist"])

    own_response = client.get(
        stock_preview_url(
            stock_preview_data["patient_one"],
            stock_preview_data["cycle_one"],
        )
    )
    cross_patient_response = client.get(
        stock_preview_url(
            stock_preview_data["patient_two"],
            stock_preview_data["cycle_two"],
        )
    )
    cross_cycle_response = client.get(
        stock_preview_url(
            stock_preview_data["patient_one"],
            stock_preview_data["cycle_two"],
        )
    )

    assert own_response.status_code == 200
    assert cross_patient_response.status_code == 404
    assert cross_cycle_response.status_code == 404


@pytest.mark.django_db
def test_stock_preview_availability_shortage_missing_and_totals(
    client,
    stock_preview_data,
):
    authenticate(client, stock_preview_data["admin"])
    movement_count = StockMovement.objects.count()

    response = client.get(
        stock_preview_url(
            stock_preview_data["patient_one"],
            stock_preview_data["cycle_one"],
        )
    )

    assert response.status_code == 200
    data = response.json()
    rows = rows_by_name(response)
    available = rows["Amlodipine"]
    shortage = rows["Bisoprolol"]
    missing = rows["Cetirizine"]

    assert data["cycle"]["reference"] == "PREVIEW-CYCLE-001"
    assert data["patient_reference"] == "P1-STOCK-PREVIEW"
    assert data["pharmacy_id"] == stock_preview_data["patient_one"].pharmacy_id
    assert set(rows) == {"Amlodipine", "Bisoprolol", "Cetirizine"}

    assert available["required_quantity"] == 4
    assert available["available_quantity"] == 7
    assert available["shortage_quantity"] == 0
    assert available["in_stock"] is True

    assert shortage["required_quantity"] == 6
    assert shortage["available_quantity"] == 3
    assert shortage["shortage_quantity"] == 3
    assert shortage["in_stock"] is False

    assert missing["required_quantity"] == 1
    assert missing["available_quantity"] == 0
    assert missing["shortage_quantity"] == 1
    assert missing["in_stock"] is False
    assert missing["suggested_batches"] == []

    assert data["totals"] == {
        "required": 11,
        "available": 10,
        "shortage": 4,
    }
    stock_preview_data["early_batch"].refresh_from_db()
    stock_preview_data["later_batch"].refresh_from_db()
    stock_preview_data["expired_batch"].refresh_from_db()
    assert stock_preview_data["early_batch"].quantity == 2
    assert stock_preview_data["later_batch"].quantity == 5
    assert stock_preview_data["expired_batch"].quantity == 100
    assert StockMovement.objects.count() == movement_count


@pytest.mark.django_db
def test_stock_preview_fefo_suggested_batches_and_expiry(client, stock_preview_data):
    authenticate(client, stock_preview_data["admin"])

    response = client.get(
        stock_preview_url(
            stock_preview_data["patient_one"],
            stock_preview_data["cycle_one"],
        )
    )

    assert response.status_code == 200
    available = rows_by_name(response)["Amlodipine"]
    suggested_batches = available["suggested_batches"]

    assert available["earliest_expiry"] == str(
        stock_preview_data["early_batch"].expiry_date
    )
    assert suggested_batches == [
        {
            "batch_id": stock_preview_data["early_batch"].id,
            "batch_number": "AML-EARLY",
            "expiry_date": str(stock_preview_data["early_batch"].expiry_date),
            "quantity_available": 2,
            "quantity_to_pick": 2,
        },
        {
            "batch_id": stock_preview_data["later_batch"].id,
            "batch_number": "AML-LATER",
            "expiry_date": str(stock_preview_data["later_batch"].expiry_date),
            "quantity_available": 5,
            "quantity_to_pick": 2,
        },
    ]
    assert "AML-EXPIRED" not in {batch["batch_number"] for batch in suggested_batches}
    assert available["available_quantity"] == 7


@pytest.mark.django_db
def test_stock_preview_matches_catalogue_line_to_legacy_inventory_stock(client):
    group = Group.objects.create(name="Preview Match Group", slug="preview-match")
    pharmacy = Pharmacy.objects.create(
        group=group,
        name="Preview Match Pharmacy",
        code="PVM",
    )
    patient = make_patient(pharmacy, "PVM-P1")
    cycle = make_cycle(patient, "PVM-CYCLE")
    product = make_catalogue_product()
    tray_medication = Medication.objects.create(
        group=group,
        catalogue_product=product,
        name="Paracetamol 500mg tablets",
        form=MedicationForm.TABLET,
        strength="500mg",
    )
    legacy_stock_medication = make_medication(group, "Paracetamol", "500 mg")
    PatientMedication.objects.create(
        patient=patient,
        medication=tray_medication,
        quantity_morning=1,
    )
    stock_item = make_stock_item(pharmacy, legacy_stock_medication)
    batch = make_batch(
        stock_item,
        "PARA-PREVIEW",
        expiry_date=timezone.now().date() + timedelta(days=60),
        quantity=12,
    )
    pharmacist = make_user("preview-match-pharmacist@example.com")
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy)
    authenticate(client, pharmacist)

    response = client.get(stock_preview_url(patient, cycle))

    assert response.status_code == 200
    paracetamol = rows_by_name(response)["Paracetamol 500mg tablets"]
    assert paracetamol["required_quantity"] == 1
    assert paracetamol["available_quantity"] == 12
    assert paracetamol["shortage_quantity"] == 0
    assert paracetamol["in_stock"] is True
    assert paracetamol["suggested_batches"] == [
        {
            "batch_id": batch.id,
            "batch_number": "PARA-PREVIEW",
            "expiry_date": str(batch.expiry_date),
            "quantity_available": 12,
            "quantity_to_pick": 1,
        }
    ]


@pytest.mark.django_db
def test_stock_preview_reserves_shared_legacy_stock_across_lines(client):
    group = Group.objects.create(
        name="Preview Shared Stock Group",
        slug="preview-shared-stock",
    )
    pharmacy = Pharmacy.objects.create(
        group=group,
        name="Preview Shared Stock Pharmacy",
        code="PVS",
    )
    patient = make_patient(pharmacy, "PVS-P1")
    cycle = make_cycle(patient, "PVS-CYCLE")
    product = make_catalogue_product()
    legacy_medication = make_medication(group, "Paracetamol", "500 mg")
    catalogue_medication = Medication.objects.create(
        group=group,
        catalogue_product=product,
        name="Paracetamol 500mg tablets",
        form=MedicationForm.TABLET,
        strength="500mg",
    )
    PatientMedication.objects.create(
        patient=patient,
        medication=legacy_medication,
        quantity_morning=1,
    )
    PatientMedication.objects.create(
        patient=patient,
        medication=catalogue_medication,
        quantity_morning=1,
    )
    stock_item = make_stock_item(pharmacy, legacy_medication)
    batch = make_batch(
        stock_item,
        "PARA-PREVIEW-SHARED",
        expiry_date=timezone.now().date() + timedelta(days=60),
        quantity=1,
    )
    pharmacist = make_user("preview-shared-stock-pharmacist@example.com")
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy)
    authenticate(client, pharmacist)

    response = client.get(stock_preview_url(patient, cycle))

    assert response.status_code == 200
    rows = rows_by_name(response)
    assert rows["Paracetamol"]["available_quantity"] == 1
    assert rows["Paracetamol"]["shortage_quantity"] == 0
    assert rows["Paracetamol"]["suggested_batches"] == [
        {
            "batch_id": batch.id,
            "batch_number": "PARA-PREVIEW-SHARED",
            "expiry_date": str(batch.expiry_date),
            "quantity_available": 1,
            "quantity_to_pick": 1,
        }
    ]
    assert rows["Paracetamol 500mg tablets"]["available_quantity"] == 0
    assert rows["Paracetamol 500mg tablets"]["shortage_quantity"] == 1
    assert rows["Paracetamol 500mg tablets"]["suggested_batches"] == []
    assert response.json()["totals"]["shortage"] == 1


@pytest.mark.django_db
def test_ambiguous_legacy_stock_match_is_not_used_for_preview(client):
    group = Group.objects.create(
        name="Preview Ambiguous Group",
        slug="preview-ambiguous",
    )
    pharmacy = Pharmacy.objects.create(
        group=group,
        name="Preview Ambiguous Pharmacy",
        code="PVA",
    )
    patient = make_patient(pharmacy, "PVA-P1")
    cycle = make_cycle(patient, "PVA-CYCLE")
    product = CatalogueProduct.objects.create(
        display_name="Paracetamol 500mg tablets",
        amp_name="Paracetamol caplets",
        ingredient="Paracetamol",
        strength="500mg",
        dose_form="tablet",
    )
    catalogue_medication = Medication.objects.create(
        group=group,
        catalogue_product=product,
        name="Paracetamol 500mg tablets",
        form=MedicationForm.TABLET,
        strength="500mg",
    )
    PatientMedication.objects.create(
        patient=patient,
        medication=catalogue_medication,
        quantity_morning=1,
    )
    first_stock = make_stock_item(
        pharmacy,
        make_medication(group, "Paracetamol", "500 mg"),
    )
    second_stock = make_stock_item(
        pharmacy,
        make_medication(group, "Paracetamol caplets", "500 mg"),
    )
    make_batch(
        first_stock,
        "PARA-PREVIEW-AMB-1",
        expiry_date=timezone.now().date() + timedelta(days=60),
        quantity=20,
    )
    make_batch(
        second_stock,
        "PARA-PREVIEW-AMB-2",
        expiry_date=timezone.now().date() + timedelta(days=60),
        quantity=20,
    )
    pharmacist = make_user("preview-ambiguous-pharmacist@example.com")
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy)
    authenticate(client, pharmacist)

    response = client.get(stock_preview_url(patient, cycle))

    assert response.status_code == 200
    paracetamol = rows_by_name(response)["Paracetamol 500mg tablets"]
    assert paracetamol["available_quantity"] == 0
    assert paracetamol["shortage_quantity"] == 1
    assert paracetamol["suggested_batches"] == []
