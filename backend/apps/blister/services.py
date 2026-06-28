from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.audit.models import AuditAction
from apps.audit.services import record
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


@dataclass(frozen=True)
class LineAllocation:
    line: PatientMedication
    required_quantity: int
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


def _line_daily_required(line: PatientMedication) -> int:
    return (
        line.quantity_morning
        + line.quantity_lunchtime
        + line.quantity_evening
        + line.quantity_bedtime
    )


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
        raise DosettePeriodValidationError(
            {"detail": ["Patient already has an open dosette period."]}
        )

    with transaction.atomic():
        period = DosettePeriod.objects.create(
            patient=patient,
            start_date=period_start,
            end_date=period_end,
            status=DosettePeriodStatus.SUBMITTED,
            submitted_at=timezone.now(),
            submitted_by=actor if getattr(actor, "is_authenticated", False) else None,
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
            .select_related("medication")
            .order_by("medication__name", "id")
        )
        today = timezone.now().date()
        shortages = []
        allocation_plan: list[LineAllocation] = []
        totals = {"required": 0, "deducted": 0}

        for line in lines:
            required_quantity = _line_daily_required(line) * cycle_days
            if required_quantity <= 0:
                continue

            totals["required"] += required_quantity
            stock_item = StockItem.objects.filter(
                pharmacy=cycle.patient.pharmacy,
                medication=line.medication,
            ).first()
            batches = []
            if stock_item is not None:
                batches = list(
                    StockBatch.objects.select_for_update()
                    .filter(
                        stock_item=stock_item,
                        is_active=True,
                        quantity__gt=0,
                        expiry_date__gte=today,
                    )
                    .order_by("expiry_date", "id")
                )

            available_quantity = sum(batch.quantity for batch in batches)
            if available_quantity < required_quantity:
                shortages.append(
                    {
                        "medication_id": line.medication_id,
                        "medication_name": line.medication.name,
                        "required_quantity": required_quantity,
                        "available_quantity": available_quantity,
                        "shortage_quantity": required_quantity - available_quantity,
                    }
                )
                continue

            remaining_required = required_quantity
            allocations: list[BatchAllocation] = []
            for batch in batches:
                allocated_quantity = min(remaining_required, batch.quantity)
                if allocated_quantity <= 0:
                    continue
                allocations.append(
                    BatchAllocation(batch=batch, quantity=allocated_quantity)
                )
                remaining_required -= allocated_quantity
                if remaining_required <= 0:
                    break

            allocation_plan.append(
                LineAllocation(
                    line=line,
                    required_quantity=required_quantity,
                    allocations=allocations,
                )
            )

        if shortages:
            raise InsufficientDosetteStock(shortages=shortages)

        deductions = []
        audit_lines = []
        reference = f"dosette-cycle:{cycle.id}"

        for planned_line in allocation_plan:
            movements = []
            movement_ids = []

            for allocation in planned_line.allocations:
                batch = allocation.batch
                allocated_quantity = allocation.quantity
                batch.quantity -= allocated_quantity
                batch.save(update_fields=["quantity", "updated_at"])

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
