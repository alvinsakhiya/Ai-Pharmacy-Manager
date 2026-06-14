"""Seed the database with realistic, pseudo-anonymised, simulated data.

    python manage.py seed            # default volumes
    python manage.py seed --flush    # wipe domain data first

Generates: staff users (one per role), suppliers, manufacturers, 60+ medicines,
200+ patients, dosette plans + items, stock batches with a realistic expiry mix,
~18 months of daily usage history (trend + weekly/seasonal pattern + noise) for
the forecasting engine, an initial picking list, and notifications.

NONE of this is real patient data and NONE of it connects to external systems.
"""
import math
import random
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.dosette.models import DAYS, DosetteCycle, DosetteItem, DosettePlan
from apps.notifications.services import generate_notifications
from apps.patients.models import Patient, PatientNote
from apps.picking.models import PickingItem, PickingList
from apps.picking.services import generate_picking_list
from apps.stock.models import (
    Manufacturer,
    Medicine,
    MedicineUsage,
    StockBatch,
    StockMovement,
    Supplier,
)
from apps.workflow.models import (
    JobStatus,
    Priority,
    WorkflowJob,
    WorkflowStatusHistory,
)

User = get_user_model()
rng = random.Random(42)

FIRST_NAMES = [
    "Margaret", "David", "Priya", "Thomas", "Aisha", "John", "Emily", "Mohammed",
    "Sarah", "James", "Fatima", "Robert", "Grace", "Daniel", "Olivia", "Samuel",
    "Hannah", "Joseph", "Chloe", "Benjamin", "Sofia", "William", "Amara", "Henry",
    "Isla", "George", "Yusuf", "Charlotte", "Oscar", "Maya", "Arthur", "Leah",
    "Ivan", "Nadia", "Patrick", "Rosa", "Edward", "Zainab", "Frank", "Clara",
]
LAST_NAMES = [
    "Hayes", "Okafor", "Sharma", "Reilly", "Bello", "Thompson", "Patel", "Walsh",
    "Nguyen", "Khan", "O'Brien", "Adeyemi", "Murphy", "Singh", "Foster", "Mensah",
    "Doyle", "Hussain", "Clarke", "Abara", "Lewis", "Costa", "Ahmed", "Byrne",
    "Owusu", "Fletcher", "Rahman", "Kelly", "Diallo", "Pereira",
]
GP_PRACTICES = [
    "Riverside Medical Centre", "Oakfield Surgery", "Bridgewater Health Practice",
    "Elmwood Family Practice", "Northgate Medical Group", "Parkview Surgery",
]
GP_NAMES = ["Dr A. Morgan", "Dr S. Patel", "Dr L. Chen", "Dr R. Okoro", "Dr M. Hughes"]
ALLERGIES = ["", "", "", "Penicillin", "Sulfonamides", "Aspirin", "Codeine", "Latex", "Statins (myalgia)"]

# (name, strength, form, pack_size, unit_cost, base_daily_demand, typical slots)
MEDICINES = [
    ("Amlodipine", "5mg", "tablet", 28, 0.03, ["morning"]),
    ("Amlodipine", "10mg", "tablet", 28, 0.04, ["morning"]),
    ("Atorvastatin", "20mg", "tablet", 28, 0.05, ["bedtime"]),
    ("Atorvastatin", "40mg", "tablet", 28, 0.06, ["bedtime"]),
    ("Metformin", "500mg", "tablet", 56, 0.02, ["morning", "evening"]),
    ("Metformin", "850mg", "tablet", 56, 0.03, ["morning", "evening"]),
    ("Levothyroxine", "50mcg", "tablet", 28, 0.04, ["morning"]),
    ("Levothyroxine", "100mcg", "tablet", 28, 0.05, ["morning"]),
    ("Ramipril", "2.5mg", "capsule", 28, 0.04, ["morning"]),
    ("Ramipril", "5mg", "capsule", 28, 0.05, ["morning"]),
    ("Ramipril", "10mg", "capsule", 28, 0.06, ["morning"]),
    ("Omeprazole", "20mg", "capsule", 28, 0.05, ["morning"]),
    ("Omeprazole", "40mg", "capsule", 28, 0.07, ["morning"]),
    ("Lansoprazole", "30mg", "capsule", 28, 0.06, ["morning"]),
    ("Sertraline", "50mg", "tablet", 28, 0.05, ["morning"]),
    ("Sertraline", "100mg", "tablet", 28, 0.07, ["morning"]),
    ("Citalopram", "20mg", "tablet", 28, 0.04, ["morning"]),
    ("Bisoprolol", "2.5mg", "tablet", 28, 0.04, ["morning"]),
    ("Bisoprolol", "5mg", "tablet", 28, 0.05, ["morning"]),
    ("Simvastatin", "40mg", "tablet", 28, 0.04, ["bedtime"]),
    ("Lisinopril", "10mg", "tablet", 28, 0.04, ["morning"]),
    ("Lisinopril", "20mg", "tablet", 28, 0.05, ["morning"]),
    ("Furosemide", "40mg", "tablet", 28, 0.03, ["morning"]),
    ("Aspirin", "75mg", "tablet", 28, 0.02, ["morning"]),
    ("Clopidogrel", "75mg", "tablet", 28, 0.06, ["morning"]),
    ("Warfarin", "3mg", "tablet", 28, 0.05, ["evening"]),
    ("Apixaban", "5mg", "tablet", 56, 0.55, ["morning", "evening"]),
    ("Gliclazide", "80mg", "tablet", 28, 0.04, ["morning", "evening"]),
    ("Empagliflozin", "10mg", "tablet", 28, 0.85, ["morning"]),
    ("Pregabalin", "75mg", "capsule", 56, 0.10, ["morning", "bedtime"]),
    ("Gabapentin", "300mg", "capsule", 100, 0.05, ["morning", "afternoon", "bedtime"]),
    ("Amitriptyline", "10mg", "tablet", 28, 0.03, ["bedtime"]),
    ("Mirtazapine", "30mg", "tablet", 28, 0.06, ["bedtime"]),
    ("Quetiapine", "25mg", "tablet", 60, 0.08, ["bedtime"]),
    ("Donepezil", "10mg", "tablet", 28, 0.07, ["bedtime"]),
    ("Memantine", "20mg", "tablet", 28, 0.12, ["morning"]),
    ("Levetiracetam", "500mg", "tablet", 60, 0.15, ["morning", "evening"]),
    ("Lamotrigine", "100mg", "tablet", 56, 0.09, ["morning", "evening"]),
    ("Carbamazepine", "200mg", "tablet", 84, 0.06, ["morning", "evening"]),
    ("Prednisolone", "5mg", "tablet", 28, 0.04, ["morning"]),
    ("Allopurinol", "100mg", "tablet", 28, 0.03, ["morning"]),
    ("Allopurinol", "300mg", "tablet", 28, 0.04, ["morning"]),
    ("Tamsulosin", "400mcg", "capsule", 30, 0.05, ["morning"]),
    ("Finasteride", "5mg", "tablet", 28, 0.06, ["morning"]),
    ("Doxazosin", "4mg", "tablet", 28, 0.05, ["morning"]),
    ("Candesartan", "8mg", "tablet", 28, 0.05, ["morning"]),
    ("Losartan", "50mg", "tablet", 28, 0.04, ["morning"]),
    ("Indapamide", "2.5mg", "tablet", 28, 0.03, ["morning"]),
    ("Spironolactone", "25mg", "tablet", 28, 0.04, ["morning"]),
    ("Digoxin", "125mcg", "tablet", 28, 0.04, ["morning"]),
    ("Isosorbide mononitrate", "30mg", "tablet", 28, 0.05, ["morning"]),
    ("Atenolol", "50mg", "tablet", 28, 0.03, ["morning"]),
    ("Carvedilol", "12.5mg", "tablet", 28, 0.05, ["morning", "evening"]),
    ("Montelukast", "10mg", "tablet", 28, 0.06, ["bedtime"]),
    ("Salbutamol", "100mcg", "inhaler", 1, 2.50, ["morning"]),
    ("Beclometasone", "200mcg", "inhaler", 1, 6.20, ["morning", "bedtime"]),
    ("Tiotropium", "18mcg", "inhaler", 1, 28.00, ["morning"]),
    ("Folic acid", "5mg", "tablet", 28, 0.02, ["morning"]),
    ("Ferrous sulfate", "200mg", "tablet", 28, 0.03, ["morning"]),
    ("Colecalciferol", "1000iu", "tablet", 30, 0.04, ["morning"]),
    ("Adcal-D3", "", "tablet", 56, 0.07, ["morning", "evening"]),
    ("Lactulose", "", "liquid", 1, 1.80, ["morning", "bedtime"]),
    ("Senna", "7.5mg", "tablet", 60, 0.02, ["bedtime"]),
    ("Movicol", "", "sachet", 30, 0.18, ["morning"]),
    ("Paracetamol", "500mg", "tablet", 100, 0.01, ["morning", "afternoon", "evening", "bedtime"]),
]

SUPPLIERS = [
    ("AAH Pharmaceuticals", 1), ("Alliance Healthcare", 1), ("Phoenix Healthcare", 2),
    ("Sigma Pharmaceuticals", 3), ("Bestway Medhub", 2),
]
MANUFACTURERS = [
    "Teva UK", "Mylan", "Accord Healthcare", "Sandoz", "Wockhardt", "Bristol Labs",
    "Aurobindo", "Glenmark", "Dr Reddy's", "Zentiva",
]


class Command(BaseCommand):
    help = "Seed the database with realistic simulated pharmacy data."

    def add_arguments(self, parser):
        parser.add_argument("--flush", action="store_true",
                            help="Delete existing domain data before seeding.")
        parser.add_argument("--patients", type=int, default=220)
        parser.add_argument("--history-weeks", type=int, default=78)  # ~18 months

    @transaction.atomic
    def handle(self, *args, **opts):
        if opts["flush"]:
            self.stdout.write("Flushing existing domain data…")
            for model in (WorkflowStatusHistory, WorkflowJob,
                          PickingItem, PickingList,
                          MedicineUsage, StockMovement, StockBatch, DosetteItem,
                          DosetteCycle, DosettePlan, PatientNote, Patient, Medicine,
                          Manufacturer, Supplier):
                model.objects.all().delete()
        elif Patient.objects.exists() or MedicineUsage.objects.exists():
            # Idempotent: the entrypoint seeds on every container start, so skip
            # if data already exists. Use --flush to wipe and reseed from scratch.
            self.stdout.write(self.style.WARNING(
                "Data already present — skipping seed. Run with --flush to reseed."))
            return

        self._users()
        suppliers = self._suppliers()
        manufacturers = self._manufacturers()
        medicines = self._medicines(suppliers, manufacturers)
        self._stock_batches(medicines, suppliers)
        self._usage_history(medicines, opts["history_weeks"])
        patients = self._patients(opts["patients"])
        self._dosette(patients, medicines)
        self._picking()
        self._workflow(patients)
        generate_notifications()

        self.stdout.write(self.style.SUCCESS(
            f"Seed complete: {User.objects.count()} users, {len(medicines)} medicines, "
            f"{len(patients)} patients, {DosettePlan.objects.count()} dosette plans, "
            f"{StockBatch.objects.count()} batches, {MedicineUsage.objects.count()} usage rows."
        ))

    # --- builders ----------------------------------------------------------
    def _users(self):
        defs = [
            ("admin", "administrator", "Alex", "Doyle", "Pharmacy Manager"),
            ("pharmacist", "pharmacist", "Priya", "Sharma", "Responsible Pharmacist"),
            ("dispenser", "dispenser", "Tom", "Reilly", "Dispensing Assistant"),
        ]
        for username, role, first, last, title in defs:
            user, created = User.objects.get_or_create(
                username=username,
                defaults=dict(role=role, first_name=first, last_name=last,
                              job_title=title, email=f"{username}@example-pharmacy.test",
                              is_staff=(role == "administrator"),
                              is_superuser=(role == "administrator")),
            )
            if created:
                user.set_password("Password123!")
                user.save()
        self.stdout.write("✓ users")

    def _suppliers(self):
        out = []
        for name, lead in SUPPLIERS:
            s, _ = Supplier.objects.get_or_create(
                name=name, defaults=dict(lead_time_days=lead,
                                         account_ref=f"ACC-{rng.randint(1000,9999)}"))
            out.append(s)
        return out

    def _manufacturers(self):
        return [Manufacturer.objects.get_or_create(name=n)[0] for n in MANUFACTURERS]

    def _medicines(self, suppliers, manufacturers):
        out = []
        for name, strength, form, pack, cost, slots in MEDICINES:
            base_daily = 0  # stored on usage, not the medicine
            reorder = rng.choice([150, 200, 250, 300, 400])
            m, _ = Medicine.objects.get_or_create(
                name=name, strength=strength, form=form,
                defaults=dict(
                    pack_size=pack, unit_cost=cost,
                    reorder_level=reorder, reorder_quantity=reorder * 2,
                    default_supplier=rng.choice(suppliers),
                    manufacturer=rng.choice(manufacturers),
                    unit="dose" if form in ("inhaler", "liquid") else form,
                ),
            )
            m._slots = slots  # transient, used by usage/dosette builders
            out.append(m)
        self.stdout.write(f"✓ {len(out)} medicines")
        return out

    def _stock_batches(self, medicines, suppliers):
        today = date.today()
        # expiry mix: some expired, some <=30d, <=90d, <=180d, fresh
        offsets = [-20, 18, 45, 75, 120, 160, 240, 320, 430, 560]
        loc_rows = "ABCDE"
        for m in medicines:
            n = rng.randint(1, 3)
            for _ in range(n):
                off = rng.choice(offsets)
                qty = rng.randint(0, 8) * 50 + rng.choice([0, 30, 90])
                # occasionally make stock low to trigger alerts
                if rng.random() < 0.18:
                    qty = rng.randint(0, m.reorder_level)
                batch = StockBatch.objects.create(
                    medicine=m, supplier=rng.choice(suppliers),
                    batch_number=f"{rng.choice('BKMOPQR')}{rng.randint(1000,9999)}{rng.choice('ABCDEF')}",
                    expiry_date=today + timedelta(days=off),
                    quantity_received=max(qty, 50),
                    quantity_on_hand=qty,
                    location=f"{rng.choice(loc_rows)}{rng.randint(1,9)}",
                    received_date=today - timedelta(days=rng.randint(10, 200)),
                    unit_cost=m.unit_cost,
                )
                StockMovement.objects.create(
                    batch=batch, kind=StockMovement.Kind.RECEIPT,
                    quantity=batch.quantity_on_hand, reason="Initial seed receipt")
        self.stdout.write(f"✓ {StockBatch.objects.count()} stock batches")

    def _usage_history(self, medicines, weeks):
        """Daily usage = base * trend * seasonal * weekday * noise."""
        end = date.today()
        start = end - timedelta(weeks=weeks)
        bulk = []
        for m in medicines:
            base = rng.uniform(8, 60)
            trend = rng.uniform(-0.04, 0.10)         # slow growth/decline per week
            seasonal_amp = rng.uniform(0.05, 0.25)   # annual-ish seasonality
            d = start
            week_idx = 0
            while d <= end:
                weekofyear = d.isocalendar()[1]
                seasonal = 1 + seasonal_amp * math.sin(2 * math.pi * weekofyear / 52)
                growth = 1 + trend * (week_idx / 4.0)
                weekday = 0.4 if d.weekday() >= 5 else 1.0  # quieter weekends
                noise = rng.uniform(0.75, 1.25)
                qty = max(0, int(round(base * growth * seasonal * weekday * noise)))
                if qty:
                    bulk.append(MedicineUsage(medicine=m, date=d, quantity=qty))
                d += timedelta(days=1)
                if d.weekday() == 0:
                    week_idx += 1
        MedicineUsage.objects.bulk_create(bulk, batch_size=2000)
        self.stdout.write(f"✓ {len(bulk)} usage rows ({weeks} weeks)")

    def _patients(self, count):
        out = []
        today = date.today()
        for i in range(count):
            first = rng.choice(FIRST_NAMES)
            last = rng.choice(LAST_NAMES)
            age_days = rng.randint(30, 95) * 365
            is_dosette = rng.random() < 0.45
            p = Patient.objects.create(
                patient_id=f"PT-{10000 + i}",
                first_name=first, last_name=last,
                date_of_birth=today - timedelta(days=age_days + rng.randint(0, 364)),
                address_line=f"{rng.randint(1, 200)} {rng.choice(['High St','Mill Rd','Church Ln','Park Ave','Queens Rd'])}",
                postcode=f"{rng.choice('ABCEGLMNS')}{rng.randint(1,9)} {rng.randint(1,9)}{rng.choice('ABDEFGH')}{rng.choice('JLNPQR')}",
                phone=f"07{rng.randint(100000000, 999999999)}",
                gp_practice=rng.choice(GP_PRACTICES), gp_name=rng.choice(GP_NAMES),
                allergies=rng.choice(ALLERGIES),
                status="active" if rng.random() < 0.92 else "inactive",
                is_dosette=is_dosette,
            )
            out.append(p)
        self.stdout.write(f"✓ {len(out)} patients")
        return out

    def _dosette(self, patients, medicines):
        pharmacist = User.objects.filter(role="pharmacist").first()
        today = date.today()
        dosette_patients = [p for p in patients if p.is_dosette and p.status == "active"]
        for p in dosette_patients:
            freq = rng.choice(["weekly", "weekly", "monthly"])
            plan = DosettePlan.objects.create(
                patient=p, frequency=freq,
                start_date=today - timedelta(days=rng.randint(7, 200)),
                review_date=today + timedelta(days=rng.choice([-20, -5, 14, 40, 90])),
                is_active=True,
            )
            for med in rng.sample(medicines, rng.randint(3, 7)):
                slots = getattr(med, "_slots", ["morning"])
                schedule = {day: list(slots) for day in DAYS}
                # some meds only on certain days
                if rng.random() < 0.15:
                    keep = rng.sample(DAYS, rng.randint(3, 6))
                    schedule = {day: list(slots) for day in keep}
                DosetteItem.objects.create(
                    plan=plan, medicine=med,
                    dose_quantity=rng.choice([1, 1, 1, 2]),
                    schedule=schedule,
                    instructions=rng.choice(["", "", "With food", "Before food", "After food"]),
                )
            # generate an upcoming cycle for some
            if rng.random() < 0.7:
                DosetteCycle.generate_for_plan(
                    plan, start=today + timedelta(days=rng.randint(-2, 10)))
            if rng.random() < 0.3:
                PatientNote.objects.create(
                    patient=p, author=pharmacist, category="review",
                    text="Medication reconciliation completed; no changes this cycle.")
        self.stdout.write(f"✓ {DosettePlan.objects.count()} dosette plans, "
                          f"{DosetteCycle.objects.count()} cycles")

    def _picking(self):
        admin = User.objects.filter(role="administrator").first()
        start = date.today() - timedelta(days=date.today().weekday())
        generate_picking_list(start, weeks=1, created_by=admin,
                              name=f"Picking list w/c {start:%d %b %Y}")
        self.stdout.write("✓ picking list")

    def _workflow(self, patients):
        """Populate the dispensing pipeline board with a realistic spread of jobs.

        Dosette jobs are derived from generated cycles; a handful of prescription
        and stock-issue jobs round out the board. Statuses, priorities and due dates
        are spread so the board (and its AI suggestions) look like a live pharmacy.
        """
        today = date.today()
        dispenser = User.objects.filter(role="dispenser").first()
        pharmacist = User.objects.filter(role="pharmacist").first()
        staff = [None, dispenser, pharmacist]

        # Map a dosette cycle's prep state onto a board status.
        cycle_status_map = {
            "scheduled": [JobStatus.NEW, JobStatus.PICKING_REQUIRED],
            "in_prep": [JobStatus.PICKING_IN_PROGRESS],
            "assembled": [JobStatus.PICKED, JobStatus.ACCURACY_CHECK],
            "checked": [JobStatus.READY],
            "sealed": [JobStatus.COLLECTED],
        }

        def priority_for(due):
            if due is None:
                return Priority.NORMAL
            d = (due - today).days
            if d < 0:
                return Priority.URGENT
            if d <= 2:
                return Priority.HIGH
            if d <= 7:
                return Priority.NORMAL
            return Priority.LOW

        jobs = []
        for cycle in DosetteCycle.objects.select_related("plan__patient")[:120]:
            status = rng.choice(cycle_status_map.get(cycle.status, [JobStatus.NEW]))
            # occasionally park a job as an issue
            if rng.random() < 0.06 and status not in (JobStatus.NEW, JobStatus.COLLECTED):
                status = JobStatus.ISSUE_FOUND
            job = WorkflowJob(
                patient=cycle.plan.patient,
                dosette_cycle=cycle,
                job_type="dosette",
                title=f"{cycle.plan.get_frequency_display()} dosette pack",
                priority=priority_for(cycle.due_date),
                status=status,
                due_date=cycle.due_date,
                assigned_to=rng.choice(staff),
                issue_notes=("Stock below requirement — awaiting delivery."
                             if status == JobStatus.ISSUE_FOUND else ""),
            )
            jobs.append(job)

        # A few prescription jobs and stock issues across active patients.
        active = [p for p in patients if p.status == "active"][:40]
        for p in rng.sample(active, min(18, len(active))):
            due = today + timedelta(days=rng.randint(-3, 9))
            jobs.append(WorkflowJob(
                patient=p, job_type="prescription",
                title="Acute prescription",
                priority=priority_for(due),
                status=rng.choice([JobStatus.NEW, JobStatus.PICKING_REQUIRED,
                                   JobStatus.PICKING_IN_PROGRESS, JobStatus.READY]),
                due_date=due, assigned_to=rng.choice(staff),
            ))
        for p in rng.sample(active, min(6, len(active))):
            jobs.append(WorkflowJob(
                patient=p, job_type="stock_issue",
                title="Owed item — short supply",
                priority=Priority.HIGH,
                status=JobStatus.ISSUE_FOUND, due_date=today + timedelta(days=rng.randint(0, 3)),
                issue_notes="Item owed to patient; reorder placed.",
            ))

        WorkflowJob.objects.bulk_create(jobs)
        # Seed a creation history row for each job (best-effort, non-critical).
        WorkflowStatusHistory.objects.bulk_create([
            WorkflowStatusHistory(job=j, from_status="", to_status=j.status,
                                  changed_by_label="system", note="Seeded")
            for j in WorkflowJob.objects.all()
        ])
        self.stdout.write(f"✓ {WorkflowJob.objects.count()} workflow jobs")
