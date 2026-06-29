import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.models import AuditAction
from apps.audit.services import record
from apps.catalogue.models import MedicationForm
from apps.inventory.models import MovementType, StockBatch, StockItem, StockMovement

from .models import (
    CycleFrequency,
    CycleStatus,
    DosetteCycle,
    DosettePeriod,
    DosettePeriodStatus,
    PatientMedication,
)


@dataclass(frozen=True)
class BatchAllocation:
    batch: StockBatch
    quantity: int
    available_quantity: int


@dataclass(frozen=True)
class LineAllocation:
    line: PatientMedication
    required_quantity: int
    available_quantity: int
    shortage_quantity: int
    allocations: list[BatchAllocation]


class DosetteDeductionStatusError(Exception):
    detail = "Only prepared cycles can have stock deducted."


class InvalidDosetteCycleDates(Exception):
    detail = "Cycle dates are invalid for stock deduction."


class DosetteStockAlreadyDeducted(Exception):
    detail = "Stock has already been deducted for this cycle."

    def __init__(self, *, deducted_at):
        self.deducted_at = deducted_at
        super().__init__(self.detail)


class InsufficientDosetteStock(Exception):
    detail = "Insufficient stock to deduct for this cycle."

    def __init__(self, *, shortages: list[dict[str, object]]):
        self.shortages = shortages
        super().__init__(self.detail)


class DosettePeriodValidationError(Exception):
    def __init__(self, detail):
        self.detail = detail
        super().__init__(str(detail))


_DUPLICATE_OPEN_PERIOD_CONSTRAINT = "unique_submitted_dosette_period_per_patient"
_DUPLICATE_OPEN_PERIOD_SQLITE_MARKER = "blister_dosetteperiod.patient_id"
_DUPLICATE_OPEN_PERIOD_MESSAGE = "Patient already has an open dosette period."


def _duplicate_open_period_error() -> DosettePeriodValidationError:
    return DosettePeriodValidationError({"detail": [_DUPLICATE_OPEN_PERIOD_MESSAGE]})


def _is_duplicate_open_period_integrity_error(exc: IntegrityError) -> bool:
    cause = exc.__cause__
    diag = getattr(cause, "diag", None)
    constraint_name = getattr(diag, "constraint_name", None)
    if constraint_name == _DUPLICATE_OPEN_PERIOD_CONSTRAINT:
        return True

    message = " ".join(str(part) for part in (*exc.args, cause) if part)
    return (
        _DUPLICATE_OPEN_PERIOD_CONSTRAINT in message
        or _DUPLICATE_OPEN_PERIOD_SQLITE_MARKER in message
    )


def _line_daily_required(line: PatientMedication) -> int:
    return (
        line.quantity_morning
        + line.quantity_lunchtime
        + line.quantity_evening
        + line.quantity_bedtime
    )


def _normalise_stock_match_text(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").casefold())


_PRODUCT_FORM_KEYWORDS = {
    MedicationForm.TABLET: ("tablet", "caplet", "dispersible"),
    MedicationForm.CAPSULE: ("capsule",),
    MedicationForm.LIQUID: ("liquid", "solution", "suspension", "oral suspension"),
    MedicationForm.CREAM: ("cream", "ointment", "gel"),
    MedicationForm.INHALER: ("inhaler",),
    MedicationForm.INJECTION: ("injection", "injectable"),
}


def _medication_matches_catalogue_product(medication, product) -> bool:
    if product is None:
        return False

    medication_name = _normalise_stock_match_text(medication.name)
    product_names = {
        _normalise_stock_match_text(product.display_name),
        _normalise_stock_match_text(product.vmp_name),
        _normalise_stock_match_text(product.amp_name),
        _normalise_stock_match_text(product.ingredient),
    }
    product_names.discard("")
    if medication_name not in product_names:
        return False

    if _normalise_stock_match_text(medication.strength) != _normalise_stock_match_text(
        product.strength
    ):
        return False

    dose_form = (product.dose_form or "").casefold()
    if not dose_form:
        return False

    keywords = _PRODUCT_FORM_KEYWORDS.get(medication.form, ())
    return any(keyword in dose_form for keyword in keywords)


def _unique_stock_item(items: list[StockItem]) -> StockItem | None:
    if len(items) != 1:
        return None
    return items[0]


def stock_item_for_medication_line(*, stock_items, pharmacy, line) -> StockItem | None:
    exact_match = (
        stock_items.filter(pharmacy=pharmacy, medication=line.medication)
        .select_related("medication", "medication__catalogue_product")
        .first()
    )
    if exact_match is not None:
        return exact_match

    catalogue_product_id = line.medication.catalogue_product_id
    if catalogue_product_id is not None:
        same_product = list(
            stock_items.filter(
                pharmacy=pharmacy,
                medication__group=line.medication.group,
                medication__catalogue_product_id=catalogue_product_id,
            )
            .select_related("medication", "medication__catalogue_product")
            .order_by("id")[:2]
        )
        product_match = _unique_stock_item(same_product)
        if product_match is not None:
            return product_match

        product = line.medication.catalogue_product
        legacy_candidates = [
            stock_item
            for stock_item in stock_items.filter(
                pharmacy=pharmacy,
                medication__group=line.medication.group,
                medication__catalogue_product__isnull=True,
            )
            .select_related("medication")
            .order_by("id")
            if _medication_matches_catalogue_product(stock_item.medication, product)
        ]
        return _unique_stock_item(legacy_candidates)

    reverse_product_candidates = [
        stock_item
        for stock_item in stock_items.filter(
            pharmacy=pharmacy,
            medication__group=line.medication.group,
            medication__catalogue_product__isnull=False,
        )
        .select_related("medication", "medication__catalogue_product")
        .order_by("id")
        if _medication_matches_catalogue_product(
            line.medication,
            stock_item.medication.catalogue_product,
        )
    ]
    return _unique_stock_item(reverse_product_candidates)


def plan_dosette_stock(
    *,
    lines,
    pharmacy,
    stock_items,
    stock_batches,
    quantity_multiplier: int,
    today: date | None = None,
) -> tuple[list[LineAllocation], list[dict[str, object]], dict[str, int]]:
    plan_date = today or timezone.now().date()
    reservations_by_batch_id: dict[int, int] = {}
    allocation_plan: list[LineAllocation] = []
    shortages = []
    totals = {"required": 0, "available": 0, "shortage": 0}

    for line in lines:
        required_quantity = _line_daily_required(line) * quantity_multiplier
        if required_quantity <= 0:
            continue

        totals["required"] += required_quantity
        stock_item = stock_item_for_medication_line(
            stock_items=stock_items,
            pharmacy=pharmacy,
            line=line,
        )
        batches = []
        if stock_item is not None:
            batches = list(
                stock_batches.filter(
                    stock_item=stock_item,
                    is_active=True,
                    quantity__gt=0,
                    expiry_date__gte=plan_date,
                ).order_by("expiry_date", "id")
            )

        available_quantity = sum(
            max(0, batch.quantity - reservations_by_batch_id.get(batch.id, 0))
            for batch in batches
        )
        totals["available"] += available_quantity

        remaining_required = required_quantity
        allocations: list[BatchAllocation] = []
        for batch in batches:
            available_in_batch = max(
                0,
                batch.quantity - reservations_by_batch_id.get(batch.id, 0),
            )
            allocated_quantity = min(remaining_required, available_in_batch)
            if allocated_quantity <= 0:
                continue
            allocations.append(
                BatchAllocation(
                    batch=batch,
                    quantity=allocated_quantity,
                    available_quantity=available_in_batch,
                )
            )
            reservations_by_batch_id[batch.id] = (
                reservations_by_batch_id.get(batch.id, 0) + allocated_quantity
            )
            remaining_required -= allocated_quantity
            if remaining_required <= 0:
                break

        shortage_quantity = max(0, required_quantity - available_quantity)
        totals["shortage"] += shortage_quantity
        if shortage_quantity > 0:
            shortages.append(
                {
                    "medication_id": line.medication_id,
                    "medication_name": line.medication.name,
                    "required_quantity": required_quantity,
                    "available_quantity": available_quantity,
                    "shortage_quantity": shortage_quantity,
                }
            )

        allocation_plan.append(
            LineAllocation(
                line=line,
                required_quantity=required_quantity,
                available_quantity=available_quantity,
                shortage_quantity=shortage_quantity,
                allocations=allocations,
            )
        )

    return allocation_plan, shortages, totals


def _period_audit_metadata(period: DosettePeriod) -> dict[str, object]:
    return {
        "pharmacy_id": period.patient.pharmacy_id,
        "patient_id": period.patient_id,
        "patient_reference": period.patient.patient_reference,
        "dosette_period_id": period.id,
        "status": period.status,
    }


def _create_period_cycles(period: DosettePeriod) -> list[DosetteCycle]:
    cycles = []
    for index in range(4):
        week_number = index + 1
        start_date = period.start_date + timedelta(days=index * 7)
        end_date = start_date + timedelta(days=6)
        cycles.append(
            DosetteCycle.objects.create(
                patient=period.patient,
                period=period,
                week_number=week_number,
                reference=f"MDS-PERIOD-{period.id}-W{week_number}",
                frequency=CycleFrequency.WEEKLY,
                start_date=start_date,
                end_date=end_date,
                status=CycleStatus.DRAFT,
            )
        )
    return cycles


def submit_dosette_period(
    *,
    actor,
    patient,
    start_date: date | None = None,
    request=None,
) -> DosettePeriod:
    period_start = start_date or timezone.localdate()
    period_end = period_start + timedelta(days=27)

    if not PatientMedication.objects.filter(patient=patient, is_active=True).exists():
        raise DosettePeriodValidationError(
            {"detail": ["Add at least one active medication before submitting."]}
        )

    if DosettePeriod.objects.filter(
        patient=patient,
        status=DosettePeriodStatus.SUBMITTED,
    ).exists():
        raise _duplicate_open_period_error()

    try:
        with transaction.atomic():
            period = DosettePeriod.objects.create(
                patient=patient,
                start_date=period_start,
                end_date=period_end,
                status=DosettePeriodStatus.SUBMITTED,
                submitted_at=timezone.now(),
                submitted_by=actor
                if getattr(actor, "is_authenticated", False)
                else None,
            )
            cycles = _create_period_cycles(period)
            record(
                action="BLISTER_PERIOD_SUBMITTED",
                actor=actor,
                pharmacy=patient.pharmacy,
                target=period,
                request=request,
                metadata={
                    **_period_audit_metadata(period),
                    "start_date": str(period.start_date),
                    "end_date": str(period.end_date),
                    "cycle_ids": [cycle.id for cycle in cycles],
                },
            )
    except IntegrityError as exc:
        if _is_duplicate_open_period_integrity_error(exc):
            raise _duplicate_open_period_error() from exc
        raise

    return period


def record_dosette_period_collection(
    *,
    actor,
    period,
    collected_on: date | None = None,
    request=None,
) -> DosettePeriod:
    collection_date = collected_on or timezone.localdate()
    if collection_date > timezone.localdate():
        raise DosettePeriodValidationError(
            {"collected_on": ["Collection date cannot be in the future."]}
        )

    with transaction.atomic():
        locked_period = (
            DosettePeriod.objects.select_for_update()
            .select_related("patient", "patient__pharmacy")
            .get(pk=period.pk)
        )
        if locked_period.status == DosettePeriodStatus.CANCELLED:
            raise DosettePeriodValidationError(
                {"detail": ["Cannot collect a cancelled dosette period."]}
            )
        if locked_period.collected_on is not None:
            raise DosettePeriodValidationError(
                {"detail": ["Collection has already been recorded."]}
            )

        cycles = list(
            DosetteCycle.objects.select_for_update()
            .filter(period=locked_period)
            .order_by("week_number", "id")
        )
        if len(cycles) != 4:
            raise DosettePeriodValidationError(
                {"detail": ["Period must have four weekly cycles before collection."]}
            )
        if any(
            cycle.status != CycleStatus.CHECKED or not cycle.stock_deducted
            for cycle in cycles
        ):
            raise DosettePeriodValidationError(
                {
                    "detail": [
                        "All four cycles must be checked and stock deducted before "
                        "collection can be recorded."
                    ]
                }
            )

        locked_period.status = DosettePeriodStatus.COLLECTED
        locked_period.collected_on = collection_date
        locked_period.collected_by = (
            actor if getattr(actor, "is_authenticated", False) else None
        )
        locked_period.save(
            update_fields=["status", "collected_on", "collected_by", "updated_at"]
        )
        # Period collection is the source of truth for next due reminders. Linked
        # cycles are deliberately left checked/deducted so existing stock and pack
        # lifecycle rules remain unchanged.
        record(
            action="BLISTER_PERIOD_COLLECTED",
            actor=actor,
            pharmacy=locked_period.patient.pharmacy,
            target=locked_period,
            request=request,
            metadata={
                **_period_audit_metadata(locked_period),
                "collected_on": str(collection_date),
                "cycle_ids": [cycle.id for cycle in cycles],
            },
        )

    return locked_period


def deduct_dosette_stock(*, actor, cycle, request=None) -> dict[str, Any]:
    with transaction.atomic():
        cycle = (
            DosetteCycle.objects.select_for_update()
            .select_related("patient", "patient__pharmacy")
            .get(pk=cycle.pk)
        )

        if cycle.status != CycleStatus.PREPARED:
            raise DosetteDeductionStatusError()

        if cycle.stock_deducted:
            raise DosetteStockAlreadyDeducted(deducted_at=cycle.deducted_at)

        cycle_days = (cycle.end_date - cycle.start_date).days + 1
        if cycle_days <= 0:
            raise InvalidDosetteCycleDates()

        lines = (
            PatientMedication.objects.filter(patient=cycle.patient, is_active=True)
            .select_related(
                "medication",
                "medication__group",
                "medication__catalogue_product",
            )
            .order_by("medication__name", "id")
        )
        allocation_plan, shortages, plan_totals = plan_dosette_stock(
            lines=lines,
            pharmacy=cycle.patient.pharmacy,
            stock_items=StockItem.objects.all(),
            stock_batches=StockBatch.objects.select_for_update(),
            quantity_multiplier=cycle_days,
        )
        totals = {"required": plan_totals["required"], "deducted": 0}

        if shortages:
            raise InsufficientDosetteStock(shortages=shortages)

        deductions = []
        audit_lines = []
        reference = f"dosette-cycle:{cycle.id}"
        balances_by_batch_id: dict[int, int] = {}

        for planned_line in allocation_plan:
            movements = []
            movement_ids = []

            for allocation in planned_line.allocations:
                batch = allocation.batch
                allocated_quantity = allocation.quantity
                current_balance = balances_by_batch_id.get(batch.id, batch.quantity)
                batch.quantity = current_balance - allocated_quantity
                batch.save(update_fields=["quantity", "updated_at"])
                balances_by_batch_id[batch.id] = batch.quantity

                movement = StockMovement.objects.create(
                    stock_item=batch.stock_item,
                    batch=batch,
                    movement_type=MovementType.BLISTER_DEDUCTION,
                    quantity_delta=-allocated_quantity,
                    balance_after=batch.quantity,
                    reference=reference,
                    actor=actor,
                )
                movements.append(
                    {
                        "movement_id": movement.id,
                        "batch_id": batch.id,
                        "batch_number": batch.batch_number,
                        "expiry_date": batch.expiry_date,
                        "quantity_deducted": allocated_quantity,
                        "balance_after": batch.quantity,
                    }
                )
                movement_ids.append(movement.id)
                totals["deducted"] += allocated_quantity

            deductions.append(
                {
                    "medication_id": planned_line.line.medication_id,
                    "medication_name": planned_line.line.medication.name,
                    "required_quantity": planned_line.required_quantity,
                    "movements": movements,
                }
            )
            audit_lines.append(
                {
                    "medication_id": planned_line.line.medication_id,
                    "quantity_deducted": planned_line.required_quantity,
                    "movement_ids": movement_ids,
                }
            )

        cycle.stock_deducted = True
        cycle.deducted_at = timezone.now()
        cycle.save(update_fields=["stock_deducted", "deducted_at", "updated_at"])

        record(
            action=AuditAction.BLISTER_STOCK_DEDUCTED,
            actor=actor,
            pharmacy=cycle.patient.pharmacy,
            target=cycle,
            request=request,
            metadata={
                "pharmacy_id": cycle.patient.pharmacy_id,
                "patient_id": cycle.patient_id,
                "patient_reference": cycle.patient.patient_reference,
                "dosette_cycle_id": cycle.id,
                "cycle_reference": cycle.reference,
                "cycle_days": cycle_days,
                "total_deducted": totals["deducted"],
                "lines": audit_lines,
            },
        )

        return {
            "cycle": cycle,
            "cycle_days": cycle_days,
            "patient_reference": cycle.patient.patient_reference,
            "deductions": deductions,
            "totals": totals,
        }
