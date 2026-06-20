from dataclasses import dataclass
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.audit.models import AuditAction
from apps.audit.services import record
from apps.inventory.models import MovementType, StockBatch, StockItem, StockMovement

from .models import CycleStatus, DosetteCycle, PatientMedication


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


def _line_daily_required(line: PatientMedication) -> int:
    return (
        line.quantity_morning
        + line.quantity_lunchtime
        + line.quantity_evening
        + line.quantity_bedtime
    )


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
