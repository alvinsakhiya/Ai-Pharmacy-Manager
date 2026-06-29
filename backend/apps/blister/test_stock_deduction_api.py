from datetime import date, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditAction, AuditEvent
from apps.catalogue.models import CatalogueProduct, Medication, MedicationForm
from apps.inventory.models import MovementType, StockBatch, StockItem, StockMovement
from apps.patients.models import Patient
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from .models import CycleFrequency, CycleStatus, DosetteCycle, PatientMedication
from .services import deduct_dosette_stock

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
        last_name="Deduction",
        date_of_birth=date(1982, 2, 2),
        address=f"{reference} Private Avenue",
        postcode="TE1 1ST",
        phone="020 0000 0101",
        notes="Fictional private note",
    )


def make_cycle(
    patient: Patient,
    reference: str,
    *,
    status: str = "PREPARED",
) -> DosetteCycle:
    return DosetteCycle.objects.create(
        patient=patient,
        reference=reference,
        frequency=CycleFrequency.WEEKLY,
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 7),
        status=status,
    )


def make_medication(group: Group, name: str, strength: str = "5 mg") -> Medication:
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
def stock_deduction_data():
    today = timezone.now().date()
    group_one = Group.objects.create(name="Group One", slug="deduct-one")
    group_two = Group.objects.create(name="Group Two", slug="deduct-two")
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
    patient_one = make_patient(pharmacy_one, "P1-DEDUCT-001")
    patient_two = make_patient(pharmacy_two, "P2-DEDUCT-001")
    cycle_one = make_cycle(patient_one, "DEDUCT-CYCLE-001")
    cycle_two = make_cycle(patient_two, "DEDUCT-CYCLE-002")

    medication = make_medication(group_one, "Amlodipine Fictional", "5 mg")
    zero_medication = make_medication(group_one, "Zero Dose Fictional", "1 mg")
    PatientMedication.objects.create(
        patient=patient_one,
        medication=medication,
        dose_instructions="Private dose text",
        quantity_morning=1,
        quantity_evening=1,
    )
    PatientMedication.objects.create(
        patient=patient_one,
        medication=zero_medication,
        quantity_morning=0,
        quantity_lunchtime=0,
        quantity_evening=0,
        quantity_bedtime=0,
    )

    stock_item = StockItem.objects.create(
        pharmacy=pharmacy_one,
        medication=medication,
        reorder_level=5,
    )
    early_batch = make_batch(
        stock_item,
        "AML-EARLY",
        expiry_date=today + timedelta(days=10),
        quantity=5,
    )
    later_batch = make_batch(
        stock_item,
        "AML-LATER",
        expiry_date=today + timedelta(days=30),
        quantity=20,
    )
    expired_batch = make_batch(
        stock_item,
        "AML-EXPIRED",
        expiry_date=today - timedelta(days=1),
        quantity=100,
    )
    inactive_batch = make_batch(
        stock_item,
        "AML-INACTIVE",
        expiry_date=today + timedelta(days=5),
        quantity=100,
        is_active=False,
    )
    zero_batch = make_batch(
        stock_item,
        "AML-ZERO",
        expiry_date=today + timedelta(days=6),
        quantity=0,
    )

    admin = make_user("deduct-admin@example.com")
    pharmacist = make_user("deduct-pharmacist@example.com")
    dispenser = make_user("deduct-dispenser@example.com")
    superintendent = make_user("deduct-superintendent@example.com")
    stock_employee = make_user("deduct-stock@example.com")

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
        "group_one": group_one,
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "patient_one": patient_one,
        "patient_two": patient_two,
        "cycle_one": cycle_one,
        "cycle_two": cycle_two,
        "medication": medication,
        "early_batch": early_batch,
        "later_batch": later_batch,
        "expired_batch": expired_batch,
        "inactive_batch": inactive_batch,
        "zero_batch": zero_batch,
        "admin": admin,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
    }


def authenticate(client, user):
    client.force_login(user)


def deduct_url(patient: Patient, cycle: DosetteCycle) -> str:
    return f"/api/patients/{patient.id}/cycles/{cycle.id}/deduct-stock/"


def cancel_url(patient: Patient, cycle: DosetteCycle) -> str:
    return f"/api/patients/{patient.id}/cycles/{cycle.id}/cancel/"


def movement_reference(cycle: DosetteCycle) -> str:
    return f"dosette-cycle:{cycle.id}"


def movement_rows(response):
    return response.json()["deductions"][0]["movements"]


@pytest.mark.django_db
def test_prepared_cycle_deducts_stock_with_fefo_movements_and_audit(
    client,
    stock_deduction_data,
):
    authenticate(client, stock_deduction_data["pharmacist"])
    patient = stock_deduction_data["patient_one"]
    cycle = stock_deduction_data["cycle_one"]

    response = client.post(deduct_url(patient, cycle), {}, format="json")

    assert response.status_code == 200
    data = response.json()
    assert data["cycle"]["id"] == cycle.id
    assert data["cycle"]["status"] == CycleStatus.PREPARED
    assert data["cycle"]["stock_deducted"] is True
    assert data["cycle"]["deducted_at"] is not None
    assert data["cycle_days"] == 7
    assert data["patient_reference"] == patient.patient_reference
    assert (
        data["deductions"][0]["medication_id"] == stock_deduction_data["medication"].id
    )
    assert data["deductions"][0]["required_quantity"] == 14
    assert data["totals"] == {"required": 14, "deducted": 14}

    assert movement_rows(response) == [
        {
            "movement_id": movement_rows(response)[0]["movement_id"],
            "batch_id": stock_deduction_data["early_batch"].id,
            "batch_number": "AML-EARLY",
            "expiry_date": str(stock_deduction_data["early_batch"].expiry_date),
            "quantity_deducted": 5,
            "balance_after": 0,
        },
        {
            "movement_id": movement_rows(response)[1]["movement_id"],
            "batch_id": stock_deduction_data["later_batch"].id,
            "batch_number": "AML-LATER",
            "expiry_date": str(stock_deduction_data["later_batch"].expiry_date),
            "quantity_deducted": 9,
            "balance_after": 11,
        },
    ]

    cycle.refresh_from_db()
    assert cycle.stock_deducted is True
    assert cycle.deducted_at is not None

    stock_deduction_data["early_batch"].refresh_from_db()
    stock_deduction_data["later_batch"].refresh_from_db()
    stock_deduction_data["expired_batch"].refresh_from_db()
    stock_deduction_data["inactive_batch"].refresh_from_db()
    stock_deduction_data["zero_batch"].refresh_from_db()
    assert stock_deduction_data["early_batch"].quantity == 0
    assert stock_deduction_data["later_batch"].quantity == 11
    assert stock_deduction_data["expired_batch"].quantity == 100
    assert stock_deduction_data["inactive_batch"].quantity == 100
    assert stock_deduction_data["zero_batch"].quantity == 0

    movements = list(
        StockMovement.objects.filter(reference=movement_reference(cycle)).order_by("id")
    )
    assert len(movements) == 2
    assert [movement.movement_type for movement in movements] == [
        MovementType.BLISTER_DEDUCTION,
        MovementType.BLISTER_DEDUCTION,
    ]
    assert [movement.quantity_delta for movement in movements] == [-5, -9]
    assert [movement.balance_after for movement in movements] == [0, 11]
    assert [movement.batch_id for movement in movements] == [
        stock_deduction_data["early_batch"].id,
        stock_deduction_data["later_batch"].id,
    ]

    audit = AuditEvent.objects.get(action=AuditAction.BLISTER_STOCK_DEDUCTED)
    metadata = audit.metadata
    assert metadata["pharmacy_id"] == patient.pharmacy_id
    assert metadata["patient_id"] == patient.id
    assert metadata["patient_reference"] == patient.patient_reference
    assert metadata["dosette_cycle_id"] == cycle.id
    assert metadata["cycle_reference"] == cycle.reference
    assert metadata["cycle_days"] == 7
    assert metadata["total_deducted"] == 14
    assert metadata["lines"] == [
        {
            "medication_id": stock_deduction_data["medication"].id,
            "quantity_deducted": 14,
            "movement_ids": [movement.id for movement in movements],
        }
    ]
    metadata_text = str(metadata)
    assert "Fictional" not in metadata_text
    assert "Deduction" not in metadata_text
    assert "1982" not in metadata_text
    assert "Private Avenue" not in metadata_text
    assert "020 0000 0101" not in metadata_text
    assert "Private dose text" not in metadata_text


@pytest.mark.django_db
def test_dosette_deduction_uses_fefo_even_when_earlier_expiry_received_later(
    client,
):
    group = Group.objects.create(name="FEFO Group", slug="fefo-group")
    pharmacy = Pharmacy.objects.create(group=group, name="FEFO Pharmacy", code="FEFO")
    patient = make_patient(pharmacy, "FEFO-P1")
    cycle = make_cycle(patient, "FEFO-CYCLE")
    medication = make_medication(group, "Amlodipine 5mg tablets", "5mg")
    PatientMedication.objects.create(
        patient=patient,
        medication=medication,
        dose_instructions="Private dose text",
        quantity_morning=1,
    )
    stock_item = StockItem.objects.create(pharmacy=pharmacy, medication=medication)
    later_expiry_batch = StockBatch.objects.create(
        stock_item=stock_item,
        batch_number="AMLO123",
        expiry_date=date(2027, 3, 31),
        quantity=20,
        quantity_received=20,
        received_at=date(2026, 1, 15),
    )
    earlier_expiry_batch = StockBatch.objects.create(
        stock_item=stock_item,
        batch_number="AMLO124",
        expiry_date=date(2027, 1, 31),
        quantity=20,
        quantity_received=20,
        received_at=date(2026, 2, 15),
    )
    pharmacist = make_user("fefo-pharmacist@example.com")
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy)
    authenticate(client, pharmacist)

    response = client.post(deduct_url(patient, cycle), {}, format="json")

    assert response.status_code == 200
    assert movement_rows(response) == [
        {
            "movement_id": movement_rows(response)[0]["movement_id"],
            "batch_id": earlier_expiry_batch.id,
            "batch_number": "AMLO124",
            "expiry_date": "2027-01-31",
            "quantity_deducted": 7,
            "balance_after": 13,
        },
    ]
    earlier_expiry_batch.refresh_from_db()
    later_expiry_batch.refresh_from_db()
    assert earlier_expiry_batch.quantity == 13
    assert later_expiry_batch.quantity == 20


@pytest.mark.django_db
def test_dosette_deduction_matches_catalogue_line_to_legacy_inventory_stock(
    client,
):
    group = Group.objects.create(name="Catalogue Match Group", slug="cat-match")
    pharmacy = Pharmacy.objects.create(
        group=group,
        name="Catalogue Match Pharmacy",
        code="CAT",
    )
    patient = make_patient(pharmacy, "CAT-P1")
    cycle = make_cycle(patient, "CAT-CYCLE")
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
    stock_item = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=legacy_stock_medication,
    )
    batch = make_batch(
        stock_item,
        "PARA-LEGACY",
        expiry_date=timezone.now().date() + timedelta(days=60),
        quantity=12,
    )
    pharmacist = make_user("catalogue-match-pharmacist@example.com")
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy)
    authenticate(client, pharmacist)

    response = client.post(deduct_url(patient, cycle), {}, format="json")

    assert response.status_code == 200
    data = response.json()
    assert data["deductions"] == [
        {
            "medication_id": tray_medication.id,
            "medication_name": "Paracetamol 500mg tablets",
            "required_quantity": 7,
            "movements": [
                {
                    "movement_id": data["deductions"][0]["movements"][0]["movement_id"],
                    "batch_id": batch.id,
                    "batch_number": "PARA-LEGACY",
                    "expiry_date": str(batch.expiry_date),
                    "quantity_deducted": 7,
                    "balance_after": 5,
                }
            ],
        }
    ]
    assert data["totals"] == {"required": 7, "deducted": 7}
    batch.refresh_from_db()
    assert batch.quantity == 5


@pytest.mark.django_db
def test_catalogue_line_to_legacy_inventory_match_still_reports_true_shortage(
    client,
):
    group = Group.objects.create(name="Catalogue Short Group", slug="cat-short")
    pharmacy = Pharmacy.objects.create(
        group=group,
        name="Catalogue Short Pharmacy",
        code="CAS",
    )
    patient = make_patient(pharmacy, "CAS-P1")
    cycle = make_cycle(patient, "CAS-CYCLE")
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
    stock_item = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=legacy_stock_medication,
    )
    short_batch = make_batch(
        stock_item,
        "PARA-SHORT",
        expiry_date=timezone.now().date() + timedelta(days=60),
        quantity=3,
    )
    expired_batch = make_batch(
        stock_item,
        "PARA-EXPIRED",
        expiry_date=timezone.now().date() - timedelta(days=1),
        quantity=20,
    )
    pharmacist = make_user("catalogue-short-pharmacist@example.com")
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy)
    authenticate(client, pharmacist)

    response = client.post(deduct_url(patient, cycle), {}, format="json")

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Insufficient stock to deduct for this cycle.",
        "shortages": [
            {
                "medication_id": tray_medication.id,
                "medication_name": "Paracetamol 500mg tablets",
                "required_quantity": 7,
                "available_quantity": 3,
                "shortage_quantity": 4,
            }
        ],
    }
    short_batch.refresh_from_db()
    expired_batch.refresh_from_db()
    assert short_batch.quantity == 3
    assert expired_batch.quantity == 20
    assert (
        StockMovement.objects.filter(reference=movement_reference(cycle)).count() == 0
    )


@pytest.mark.django_db
def test_dosette_deduction_reserves_shared_legacy_stock_before_mutating(client):
    group = Group.objects.create(name="Shared Stock Group", slug="shared-stock")
    pharmacy = Pharmacy.objects.create(
        group=group,
        name="Shared Stock Pharmacy",
        code="SHR",
    )
    patient = make_patient(pharmacy, "SHR-P1")
    cycle = make_cycle(patient, "SHR-CYCLE")
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
    stock_item = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=legacy_medication,
    )
    batch = make_batch(
        stock_item,
        "PARA-SHARED",
        expiry_date=timezone.now().date() + timedelta(days=60),
        quantity=7,
    )
    pharmacist = make_user("shared-stock-pharmacist@example.com")
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy)
    authenticate(client, pharmacist)

    response = client.post(deduct_url(patient, cycle), {}, format="json")

    assert response.status_code == 400
    assert response.json()["detail"] == "Insufficient stock to deduct for this cycle."
    shortages = response.json()["shortages"]
    assert sum(row["required_quantity"] for row in shortages) == 7
    assert sum(row["available_quantity"] for row in shortages) == 0
    assert sum(row["shortage_quantity"] for row in shortages) == 7
    batch.refresh_from_db()
    cycle.refresh_from_db()
    assert batch.quantity == 7
    assert cycle.stock_deducted is False
    assert (
        StockMovement.objects.filter(reference=movement_reference(cycle)).count() == 0
    )


@pytest.mark.django_db
def test_dosette_deduction_allocates_shared_legacy_stock_once_when_enough(client):
    group = Group.objects.create(
        name="Shared Stock Enough Group",
        slug="shared-stock-enough",
    )
    pharmacy = Pharmacy.objects.create(
        group=group,
        name="Shared Stock Enough Pharmacy",
        code="SHE",
    )
    patient = make_patient(pharmacy, "SHE-P1")
    cycle = make_cycle(patient, "SHE-CYCLE")
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
    stock_item = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=legacy_medication,
    )
    batch = make_batch(
        stock_item,
        "PARA-SHARED-ENOUGH",
        expiry_date=timezone.now().date() + timedelta(days=60),
        quantity=14,
    )
    pharmacist = make_user("shared-stock-enough-pharmacist@example.com")
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy)
    authenticate(client, pharmacist)

    response = client.post(deduct_url(patient, cycle), {}, format="json")

    assert response.status_code == 200
    assert response.json()["totals"] == {"required": 14, "deducted": 14}
    batch.refresh_from_db()
    cycle.refresh_from_db()
    assert batch.quantity == 0
    assert cycle.stock_deducted is True
    movements = list(
        StockMovement.objects.filter(reference=movement_reference(cycle)).order_by("id")
    )
    assert [movement.batch_id for movement in movements] == [batch.id, batch.id]
    assert [movement.quantity_delta for movement in movements] == [-7, -7]
    assert [movement.balance_after for movement in movements] == [7, 0]


@pytest.mark.django_db
def test_ambiguous_legacy_stock_match_is_not_used_for_deduction(client):
    group = Group.objects.create(name="Ambiguous Stock Group", slug="ambiguous-stock")
    pharmacy = Pharmacy.objects.create(
        group=group,
        name="Ambiguous Stock Pharmacy",
        code="AMB",
    )
    patient = make_patient(pharmacy, "AMB-P1")
    cycle = make_cycle(patient, "AMB-CYCLE")
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
    first_stock = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=make_medication(group, "Paracetamol", "500 mg"),
    )
    second_stock = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=make_medication(group, "Paracetamol caplets", "500 mg"),
    )
    make_batch(
        first_stock,
        "PARA-AMB-1",
        expiry_date=timezone.now().date() + timedelta(days=60),
        quantity=20,
    )
    make_batch(
        second_stock,
        "PARA-AMB-2",
        expiry_date=timezone.now().date() + timedelta(days=60),
        quantity=20,
    )
    pharmacist = make_user("ambiguous-stock-pharmacist@example.com")
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy)
    authenticate(client, pharmacist)

    response = client.post(deduct_url(patient, cycle), {}, format="json")

    assert response.status_code == 400
    assert response.json()["shortages"] == [
        {
            "medication_id": catalogue_medication.id,
            "medication_name": "Paracetamol 500mg tablets",
            "required_quantity": 7,
            "available_quantity": 0,
            "shortage_quantity": 7,
        }
    ]
    assert (
        StockMovement.objects.filter(reference=movement_reference(cycle)).count() == 0
    )


@pytest.mark.django_db
def test_expired_batches_are_excluded_and_only_expired_stock_returns_shortage(
    client,
    stock_deduction_data,
):
    authenticate(client, stock_deduction_data["pharmacist"])
    stock_deduction_data["early_batch"].quantity = 0
    stock_deduction_data["early_batch"].save(update_fields=["quantity", "updated_at"])
    stock_deduction_data["later_batch"].quantity = 0
    stock_deduction_data["later_batch"].save(update_fields=["quantity", "updated_at"])

    response = client.post(
        deduct_url(
            stock_deduction_data["patient_one"],
            stock_deduction_data["cycle_one"],
        ),
        {},
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Insufficient stock to deduct for this cycle.",
        "shortages": [
            {
                "medication_id": stock_deduction_data["medication"].id,
                "medication_name": "Amlodipine Fictional",
                "required_quantity": 14,
                "available_quantity": 0,
                "shortage_quantity": 14,
            }
        ],
    }
    stock_deduction_data["expired_batch"].refresh_from_db()
    assert stock_deduction_data["expired_batch"].quantity == 100


@pytest.mark.django_db
def test_shortage_is_all_or_nothing(client, stock_deduction_data):
    authenticate(client, stock_deduction_data["pharmacist"])
    group = stock_deduction_data["group_one"]
    patient = stock_deduction_data["patient_one"]
    cycle = stock_deduction_data["cycle_one"]
    short_medication = make_medication(group, "Short Fictional", "2 mg")
    PatientMedication.objects.create(
        patient=patient,
        medication=short_medication,
        quantity_morning=1,
    )
    short_stock_item = StockItem.objects.create(
        pharmacy=patient.pharmacy,
        medication=short_medication,
    )
    short_batch = make_batch(
        short_stock_item,
        "SHORT-ONE",
        expiry_date=timezone.now().date() + timedelta(days=20),
        quantity=1,
    )
    early_before = stock_deduction_data["early_batch"].quantity
    later_before = stock_deduction_data["later_batch"].quantity

    response = client.post(deduct_url(patient, cycle), {}, format="json")

    assert response.status_code == 400
    assert response.json()["detail"] == "Insufficient stock to deduct for this cycle."
    assert response.json()["shortages"] == [
        {
            "medication_id": short_medication.id,
            "medication_name": "Short Fictional",
            "required_quantity": 7,
            "available_quantity": 1,
            "shortage_quantity": 6,
        }
    ]
    stock_deduction_data["early_batch"].refresh_from_db()
    stock_deduction_data["later_batch"].refresh_from_db()
    short_batch.refresh_from_db()
    cycle.refresh_from_db()
    assert stock_deduction_data["early_batch"].quantity == early_before
    assert stock_deduction_data["later_batch"].quantity == later_before
    assert short_batch.quantity == 1
    assert cycle.stock_deducted is False
    assert (
        StockMovement.objects.filter(reference=movement_reference(cycle)).count() == 0
    )
    assert not AuditEvent.objects.filter(
        action=AuditAction.BLISTER_STOCK_DEDUCTED
    ).exists()


@pytest.mark.django_db
def test_second_deduction_call_is_rejected_without_duplicates(
    client,
    stock_deduction_data,
):
    authenticate(client, stock_deduction_data["pharmacist"])
    patient = stock_deduction_data["patient_one"]
    cycle = stock_deduction_data["cycle_one"]

    first_response = client.post(deduct_url(patient, cycle), {}, format="json")
    second_response = client.post(deduct_url(patient, cycle), {}, format="json")

    assert first_response.status_code == 200
    assert second_response.status_code == 409
    assert second_response.json()["detail"] == (
        "Stock has already been deducted for this cycle."
    )
    assert second_response.json()["deducted_at"] is not None
    assert (
        StockMovement.objects.filter(reference=movement_reference(cycle)).count() == 2
    )
    assert (
        AuditEvent.objects.filter(action=AuditAction.BLISTER_STOCK_DEDUCTED).count()
        == 1
    )


@pytest.mark.django_db
@pytest.mark.parametrize("cycle_status", [CycleStatus.DRAFT, CycleStatus.CANCELLED])
def test_only_prepared_cycles_can_deduct_stock(
    client,
    stock_deduction_data,
    cycle_status,
):
    authenticate(client, stock_deduction_data["pharmacist"])
    cycle = make_cycle(
        stock_deduction_data["patient_one"],
        f"STATUS-{cycle_status}",
        status=cycle_status,
    )

    response = client.post(
        deduct_url(stock_deduction_data["patient_one"], cycle),
        {},
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Only prepared cycles can have stock deducted."
    }
    cycle.refresh_from_db()
    assert cycle.stock_deducted is False
    assert (
        StockMovement.objects.filter(reference=movement_reference(cycle)).count() == 0
    )


@pytest.mark.django_db
def test_admin_policy_can_deduct_stock(client, stock_deduction_data):
    authenticate(client, stock_deduction_data["admin"])

    response = client.post(
        deduct_url(
            stock_deduction_data["patient_one"],
            stock_deduction_data["cycle_one"],
        ),
        {},
        format="json",
    )

    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize(
    "actor_key",
    ["dispenser", "stock_employee", "superintendent"],
)
def test_non_pharmacist_roles_without_deduction_permission_are_denied(
    client,
    stock_deduction_data,
    actor_key,
):
    authenticate(client, stock_deduction_data[actor_key])

    response = client.post(
        deduct_url(
            stock_deduction_data["patient_one"],
            stock_deduction_data["cycle_one"],
        ),
        {},
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_cross_pharmacy_patient_or_cycle_returns_404_for_pharmacist(
    client,
    stock_deduction_data,
):
    authenticate(client, stock_deduction_data["pharmacist"])

    other_patient_response = client.post(
        deduct_url(
            stock_deduction_data["patient_two"],
            stock_deduction_data["cycle_two"],
        ),
        {},
        format="json",
    )
    mismatched_cycle_response = client.post(
        deduct_url(
            stock_deduction_data["patient_one"],
            stock_deduction_data["cycle_two"],
        ),
        {},
        format="json",
    )

    assert other_patient_response.status_code == 404
    assert mismatched_cycle_response.status_code == 404


@pytest.mark.django_db
def test_cancel_after_real_stock_deduction_is_blocked_without_touching_movements(
    client,
    stock_deduction_data,
):
    authenticate(client, stock_deduction_data["pharmacist"])
    patient = stock_deduction_data["patient_one"]
    cycle = stock_deduction_data["cycle_one"]

    deduct_response = client.post(deduct_url(patient, cycle), {}, format="json")
    assert deduct_response.status_code == 200

    reference = movement_reference(cycle)
    movement_values = list(
        StockMovement.objects.filter(reference=reference)
        .order_by("id")
        .values(
            "id",
            "stock_item_id",
            "batch_id",
            "movement_type",
            "quantity_delta",
            "balance_after",
            "reference",
        )
    )

    cancel_response = client.post(cancel_url(patient, cycle))

    assert cancel_response.status_code == 400
    assert cancel_response.json() == {
        "detail": ["Cannot cancel a cycle after stock has been deducted."]
    }
    assert (
        list(
            StockMovement.objects.filter(reference=reference)
            .order_by("id")
            .values(
                "id",
                "stock_item_id",
                "batch_id",
                "movement_type",
                "quantity_delta",
                "balance_after",
                "reference",
            )
        )
        == movement_values
    )
    cycle.refresh_from_db()
    assert cycle.status == CycleStatus.PREPARED
    assert cycle.stock_deducted is True
    assert cycle.deducted_at is not None
    assert not AuditEvent.objects.filter(
        action=AuditAction.BLISTER_CYCLE_CANCELLED,
        target_id=str(cycle.id),
    ).exists()


@pytest.mark.django_db(transaction=True)
def test_audit_failure_rolls_back_stock_deduction(monkeypatch, stock_deduction_data):
    def fail_record(**kwargs):
        raise RuntimeError("audit unavailable")

    monkeypatch.setattr("apps.blister.services.record", fail_record)
    cycle = stock_deduction_data["cycle_one"]
    early_before = stock_deduction_data["early_batch"].quantity
    later_before = stock_deduction_data["later_batch"].quantity

    with pytest.raises(RuntimeError, match="audit unavailable"):
        deduct_dosette_stock(
            actor=stock_deduction_data["pharmacist"],
            cycle=cycle,
        )

    cycle.refresh_from_db()
    stock_deduction_data["early_batch"].refresh_from_db()
    stock_deduction_data["later_batch"].refresh_from_db()
    assert cycle.stock_deducted is False
    assert cycle.deducted_at is None
    assert stock_deduction_data["early_batch"].quantity == early_before
    assert stock_deduction_data["later_batch"].quantity == later_before
    assert (
        StockMovement.objects.filter(reference=movement_reference(cycle)).count() == 0
    )
