"""Seed fictional development/demo accounts and tenancy data.

This command is for development/demo use only. It creates fictional
``@demo.local`` accounts and fictional patient records for local demos and
tests, and does not create real patient, NHS, customer, or movement data.
"""

from datetime import UTC, date, datetime, time
from decimal import Decimal
from typing import NamedTuple, cast

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User
from apps.blister.models import (
    CycleFrequency,
    CycleStatus,
    DosetteCycle,
    PatientMedication,
)
from apps.catalogue.models import Medication, MedicationForm
from apps.inventory.models import StockBatch, StockItem
from apps.patients.models import Patient
from apps.tenancy.models import Group, Membership, Pharmacy, Role

DEMO_PASSWORD = "DemoPass!2026"

GROUP_SLUG = "jmw-pharmacy-group"
GROUP_NAME = "JMW Pharmacy Group"

PHARMACIES = [
    {"name": "JMW Sutton", "code": "SUT"},
    {"name": "JMW Croydon", "code": "CRO"},
    {"name": "JMW Wimbledon", "code": "WIM"},
]

MEDICATIONS = [
    {"name": "Paracetamol", "form": MedicationForm.TABLET, "strength": "500 mg"},
    {"name": "Ibuprofen", "form": MedicationForm.TABLET, "strength": "200 mg"},
    {"name": "Amlodipine", "form": MedicationForm.TABLET, "strength": "5 mg"},
    {"name": "Metformin", "form": MedicationForm.TABLET, "strength": "500 mg"},
    {
        "name": "Salbutamol",
        "form": MedicationForm.INHALER,
        "strength": "100 micrograms/dose",
    },
]

STOCK_RECEIVED_AT = date(2026, 1, 15)
CYCLE_DRAFT_START = date(2026, 6, 22)
CYCLE_DRAFT_END = date(2026, 6, 28)
CYCLE_PREPARED_START = date(2026, 6, 1)
CYCLE_PREPARED_END = date(2026, 6, 28)
MEDICATION_DISCONTINUED_AT = date(2026, 6, 15)


class DemoStockBatch(NamedTuple):
    batch_number: str
    expiry_date: date
    quantity: int
    quantity_received: int


class DemoStockItem(NamedTuple):
    pharmacy_code: str
    medication_name: str
    unit_price: Decimal
    batches: tuple[DemoStockBatch, ...]


class DemoPatientMedication(NamedTuple):
    patient_reference: str
    medication_name: str
    quantity_morning: int
    quantity_lunchtime: int
    quantity_evening: int
    quantity_bedtime: int
    is_active: bool = True


class DemoDosetteCycle(NamedTuple):
    patient_reference: str
    reference: str
    frequency: str
    start_date: date
    end_date: date
    status: str


STOCK_ITEMS = [
    DemoStockItem(
        "SUT",
        "Paracetamol",
        Decimal("0.03"),
        (
            DemoStockBatch("SUT-PAR-001", date(2027, 1, 31), 120, 150),
            DemoStockBatch("SUT-PAR-002", date(2027, 6, 30), 80, 100),
        ),
    ),
    DemoStockItem(
        "SUT",
        "Ibuprofen",
        Decimal("0.04"),
        (DemoStockBatch("SUT-IBU-001", date(2027, 3, 31), 90, 100),),
    ),
    DemoStockItem(
        "SUT",
        "Amlodipine",
        Decimal("0.06"),
        (DemoStockBatch("SUT-AML-001", date(2028, 2, 29), 60, 60),),
    ),
    DemoStockItem(
        "CRO",
        "Paracetamol",
        Decimal("0.03"),
        (DemoStockBatch("CRO-PAR-001", date(2027, 2, 28), 110, 120),),
    ),
    DemoStockItem(
        "CRO",
        "Ibuprofen",
        Decimal("0.04"),
        (DemoStockBatch("CRO-IBU-001", date(2027, 4, 30), 75, 80),),
    ),
    DemoStockItem(
        "CRO",
        "Amlodipine",
        Decimal("0.06"),
        (DemoStockBatch("CRO-AML-001", date(2028, 1, 31), 55, 60),),
    ),
]

PATIENT_MEDICATION_LINES = [
    DemoPatientMedication("SUT-P1", "Paracetamol", 1, 0, 0, 1),
    DemoPatientMedication("SUT-P1", "Metformin", 1, 0, 1, 0),
    DemoPatientMedication("SUT-P2", "Salbutamol", 0, 0, 0, 0),
    DemoPatientMedication("CRO-P1", "Ibuprofen", 0, 1, 1, 0),
    DemoPatientMedication("CRO-P1", "Amlodipine", 1, 0, 0, 0, is_active=False),
]

DOSETTE_CYCLES = [
    DemoDosetteCycle(
        "SUT-P1",
        "MDS-2026-W26",
        cast(str, CycleFrequency.WEEKLY),
        CYCLE_DRAFT_START,
        CYCLE_DRAFT_END,
        cast(str, CycleStatus.DRAFT),
    ),
    DemoDosetteCycle(
        "CRO-P1",
        "MDS-2026-FW07",
        cast(str, CycleFrequency.FOUR_WEEKLY),
        CYCLE_PREPARED_START,
        CYCLE_PREPARED_END,
        cast(str, CycleStatus.PREPARED),
    ),
]


class DemoPatient(NamedTuple):
    pharmacy_code: str
    patient_reference: str
    first_name: str
    last_name: str
    date_of_birth: date
    address: str
    postcode: str
    phone: str
    notes: str


DEMO_PATIENTS = [
    DemoPatient(
        "SUT",
        "SUT-P1",
        "Demo",
        "PatientOne",
        date(1980, 1, 1),
        "1 Demo Street, Sutton",
        "SM1 1AA",
        "020 0000 0001",
        "Fictional local demo patient.",
    ),
    DemoPatient(
        "SUT",
        "SUT-P2",
        "Demo",
        "PatientTwo",
        date(1975, 5, 12),
        "2 Demo Street, Sutton",
        "SM1 1AB",
        "020 0000 0002",
        "Fictional local demo patient.",
    ),
    DemoPatient(
        "CRO",
        "CRO-P1",
        "Demo",
        "PatientThree",
        date(1990, 9, 23),
        "3 Demo Road, Croydon",
        "CR0 1AA",
        "020 0000 0003",
        "Fictional local demo patient.",
    ),
    DemoPatient(
        "CRO",
        "CRO-P2",
        "Demo",
        "PatientFour",
        date(1968, 3, 14),
        "4 Demo Road, Croydon",
        "CR0 1AB",
        "020 0000 0004",
        "Fictional local demo patient.",
    ),
]


class DemoUser(NamedTuple):
    email: str
    full_name: str
    role: str
    pharmacy_code: str | None


DEMO_USERS = [
    DemoUser("admin@demo.local", "Demo Admin", "ADMIN", None),
    DemoUser(
        "superintendent@demo.local",
        "Demo Superintendent",
        "SUPERINTENDENT",
        None,
    ),
    DemoUser("pharmacist@demo.local", "Demo Pharmacist", "PHARMACIST", "SUT"),
    DemoUser("dispenser@demo.local", "Demo Dispenser", "DISPENSER", "CRO"),
    DemoUser("stock@demo.local", "Demo Stock Employee", "STOCK_EMPLOYEE", None),
]


class Command(BaseCommand):
    help = "Seed fictional local/demo users and tenancy data."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--force",
            action="store_true",
            help="Allow seed_demo to run when DEBUG is false.",
        )

    def handle(self, *args, **options) -> None:
        if not settings.DEBUG and not options["force"]:
            raise CommandError("seed_demo is dev-only; pass --force to override.")

        with transaction.atomic():
            group, group_created = Group.objects.get_or_create(
                slug=GROUP_SLUG,
                defaults={
                    "name": GROUP_NAME,
                    "is_active": True,
                },
            )
            group.name = GROUP_NAME
            group.is_active = True
            group.save(update_fields=["name", "is_active", "updated_at"])

            pharmacies_by_code = {}
            pharmacy_statuses = []
            for pharmacy_data in PHARMACIES:
                pharmacy, created = Pharmacy.objects.get_or_create(
                    group=group,
                    code=pharmacy_data["code"],
                    defaults={
                        "name": pharmacy_data["name"],
                        "is_active": True,
                    },
                )
                pharmacy.name = pharmacy_data["name"]
                pharmacy.is_active = True
                pharmacy.save(update_fields=["name", "is_active", "updated_at"])
                pharmacies_by_code[pharmacy.code] = pharmacy
                pharmacy_statuses.append((pharmacy, created))

            user_statuses = []
            for user_data in DEMO_USERS:
                user, created = self._get_or_create_user(
                    email=user_data.email,
                    full_name=user_data.full_name,
                )
                user.full_name = user_data.full_name
                user.is_active = True
                user.must_change_password = False
                user.is_staff = False
                user.is_superuser = False
                user.set_password(DEMO_PASSWORD)
                user.save()

                membership = self._get_or_create_active_membership(user)
                self._configure_membership(
                    membership=membership,
                    role=user_data.role,
                    group=group,
                    pharmacy=pharmacies_by_code.get(user_data.pharmacy_code),
                    pharmacies_by_code=pharmacies_by_code,
                )
                user_statuses.append((user, created))

            medication_statuses = []
            medications_by_name = {}
            for medication_data in MEDICATIONS:
                medication, created = Medication.objects.get_or_create(
                    group=group,
                    name=medication_data["name"],
                    form=medication_data["form"],
                    strength=medication_data["strength"],
                    defaults={"is_active": True},
                )
                medication.is_active = True
                medication.save(update_fields=["is_active", "updated_at"])
                medication_statuses.append((medication, created))
                medications_by_name[medication.name] = medication

            stock_item_statuses = []
            stock_batch_statuses = []
            for stock_data in STOCK_ITEMS:
                stock_item, created = StockItem.objects.get_or_create(
                    pharmacy=pharmacies_by_code[stock_data.pharmacy_code],
                    medication=medications_by_name[stock_data.medication_name],
                    defaults={
                        "is_active": True,
                        "reorder_level": 20,
                        "unit_price": stock_data.unit_price,
                    },
                )
                stock_item.is_active = True
                stock_item.reorder_level = 20
                stock_item.unit_price = stock_data.unit_price
                stock_item.save(
                    update_fields=[
                        "is_active",
                        "reorder_level",
                        "unit_price",
                        "updated_at",
                    ]
                )
                stock_item_statuses.append((stock_item, created))

                for batch_data in stock_data.batches:
                    batch, batch_created = StockBatch.objects.get_or_create(
                        stock_item=stock_item,
                        batch_number=batch_data.batch_number,
                        defaults={
                            "expiry_date": batch_data.expiry_date,
                            "quantity": batch_data.quantity,
                            "quantity_received": batch_data.quantity_received,
                            "received_at": STOCK_RECEIVED_AT,
                            "is_active": True,
                        },
                    )
                    batch.expiry_date = batch_data.expiry_date
                    batch.quantity = batch_data.quantity
                    batch.quantity_received = batch_data.quantity_received
                    batch.received_at = STOCK_RECEIVED_AT
                    batch.is_active = True
                    batch.save(
                        update_fields=[
                            "expiry_date",
                            "quantity",
                            "quantity_received",
                            "received_at",
                            "is_active",
                            "updated_at",
                        ]
                    )
                    stock_batch_statuses.append((batch, batch_created))

            patient_statuses = []
            patients_by_reference = {}
            for patient_data in DEMO_PATIENTS:
                patient, created = Patient.objects.get_or_create(
                    pharmacy=pharmacies_by_code[patient_data.pharmacy_code],
                    patient_reference=patient_data.patient_reference,
                    defaults={
                        "first_name": patient_data.first_name,
                        "last_name": patient_data.last_name,
                        "date_of_birth": patient_data.date_of_birth,
                        "address": patient_data.address,
                        "postcode": patient_data.postcode,
                        "phone": patient_data.phone,
                        "notes": patient_data.notes,
                        "is_active": True,
                    },
                )
                patient.first_name = patient_data.first_name
                patient.last_name = patient_data.last_name
                patient.date_of_birth = patient_data.date_of_birth
                patient.address = patient_data.address
                patient.postcode = patient_data.postcode
                patient.phone = patient_data.phone
                patient.notes = patient_data.notes
                patient.is_active = True
                patient.save(
                    update_fields=[
                        "first_name",
                        "last_name",
                        "date_of_birth",
                        "address",
                        "postcode",
                        "phone",
                        "notes",
                        "is_active",
                        "updated_at",
                    ]
                )
                patients_by_reference[patient.patient_reference] = patient
                patient_statuses.append((patient, created))

            patient_medication_statuses = []
            for line_data in PATIENT_MEDICATION_LINES:
                line, created = PatientMedication.objects.update_or_create(
                    patient=patients_by_reference[line_data.patient_reference],
                    medication=medications_by_name[line_data.medication_name],
                    defaults={
                        "dose_instructions": "",
                        "quantity_morning": line_data.quantity_morning,
                        "quantity_lunchtime": line_data.quantity_lunchtime,
                        "quantity_evening": line_data.quantity_evening,
                        "quantity_bedtime": line_data.quantity_bedtime,
                        "start_date": None,
                        "is_active": line_data.is_active,
                        "deleted_at": (
                            None
                            if line_data.is_active
                            else datetime.combine(
                                MEDICATION_DISCONTINUED_AT,
                                time.min,
                                tzinfo=UTC,
                            )
                        ),
                    },
                )
                patient_medication_statuses.append((line, created))

            dosette_cycle_statuses = []
            for cycle_data in DOSETTE_CYCLES:
                cycle, created = DosetteCycle.objects.update_or_create(
                    patient=patients_by_reference[cycle_data.patient_reference],
                    reference=cycle_data.reference,
                    defaults={
                        "frequency": cycle_data.frequency,
                        "start_date": cycle_data.start_date,
                        "end_date": cycle_data.end_date,
                        "status": cycle_data.status,
                    },
                )
                dosette_cycle_statuses.append((cycle, created))

        self.stdout.write(self.style.SUCCESS("Seeded local demo data."))
        self.stdout.write(
            f"Group: {group.name} ({'created' if group_created else 'found'})"
        )
        self.stdout.write("Pharmacies:")
        for pharmacy, created in pharmacy_statuses:
            self.stdout.write(
                f"- {pharmacy.name} [{pharmacy.code}] "
                f"({'created' if created else 'found'})"
            )
        self.stdout.write("Demo users:")
        for user, created in user_statuses:
            self.stdout.write(f"- {user.email} ({'created' if created else 'found'})")
        self.stdout.write("Medication catalogue:")
        for medication, created in medication_statuses:
            self.stdout.write(
                f"- {medication.name} {medication.strength} "
                f"({'created' if created else 'found'})"
            )
        self.stdout.write("Stock:")
        self.stdout.write(
            f"- {len(stock_item_statuses)} stock items, "
            f"{len(stock_batch_statuses)} batches"
        )
        self.stdout.write("Patients:")
        self.stdout.write(f"- {len(patient_statuses)} fictional patient records")
        self.stdout.write("Dosette/MDS:")
        self.stdout.write(
            f"- {len(patient_medication_statuses)} patient medication lines, "
            f"{len(dosette_cycle_statuses)} cycles"
        )
        self.stdout.write(
            f"Shared password ({self.style.WARNING('local demo credentials only')}): "
            f"{DEMO_PASSWORD}"
        )

    def _get_or_create_user(self, *, email: str, full_name: str):
        try:
            return User.objects.get(email=email), False
        except User.DoesNotExist:
            return (
                User.objects.create_user(
                    email=email,
                    password=DEMO_PASSWORD,
                    full_name=full_name,
                    must_change_password=False,
                ),
                True,
            )

    def _get_or_create_active_membership(self, user: User) -> Membership:
        membership = Membership.objects.filter(user=user, is_active=True).first()
        if membership is not None:
            return membership
        return Membership.objects.create(user=user, role=Role.ADMIN)

    def _configure_membership(
        self,
        *,
        membership: Membership,
        role: str,
        group: Group,
        pharmacy: Pharmacy | None,
        pharmacies_by_code: dict[str, Pharmacy],
    ) -> None:
        membership.role = role
        membership.group = None
        membership.pharmacy = None

        if role in {Role.SUPERINTENDENT, Role.STOCK_EMPLOYEE}:
            membership.group = group
        elif role in {Role.PHARMACIST, Role.DISPENSER}:
            membership.pharmacy = pharmacy

        membership.is_active = True
        membership.save()

        if role == Role.STOCK_EMPLOYEE:
            membership.pharmacies.set(
                [
                    pharmacies_by_code["SUT"],
                    pharmacies_by_code["CRO"],
                ]
            )
        else:
            membership.pharmacies.clear()
