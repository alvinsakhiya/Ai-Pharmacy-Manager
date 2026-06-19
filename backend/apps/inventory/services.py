from datetime import date

from django.db import transaction
from rest_framework import serializers

from apps.audit.models import AuditAction
from apps.audit.services import record

from .models import MovementType, StockBatch, StockItem, StockMovement


def receive_stock(
    *,
    actor,
    pharmacy,
    medication,
    batch_number,
    expiry_date,
    quantity,
    received_at,
    unit_price=None,
    reason="",
    reference="",
    request=None,
) -> tuple[StockItem, StockMovement]:
    with transaction.atomic():
        try:
            stock_item = StockItem.objects.select_for_update().get(
                pharmacy=pharmacy,
                medication=medication,
            )
            changed_fields = []
            if not stock_item.is_active:
                stock_item.is_active = True
                changed_fields.append("is_active")
            if unit_price is not None and stock_item.unit_price != unit_price:
                stock_item.unit_price = unit_price
                changed_fields.append("unit_price")
            if changed_fields:
                stock_item.save(update_fields=[*changed_fields, "updated_at"])
        except StockItem.DoesNotExist:
            stock_item = StockItem.objects.create(
                pharmacy=pharmacy,
                medication=medication,
                is_active=True,
                unit_price=unit_price,
            )

        try:
            batch = StockBatch.objects.select_for_update().get(
                stock_item=stock_item,
                batch_number=batch_number,
            )
            if batch.expiry_date != expiry_date:
                raise serializers.ValidationError(
                    {"expiry_date": ["Existing batch has a different expiry date."]}
                )
            batch.quantity += quantity
            batch.quantity_received += quantity
            batch.is_active = True
            batch.save(
                update_fields=[
                    "quantity",
                    "quantity_received",
                    "is_active",
                    "updated_at",
                ]
            )
        except StockBatch.DoesNotExist:
            batch = StockBatch.objects.create(
                stock_item=stock_item,
                batch_number=batch_number,
                expiry_date=expiry_date,
                quantity=quantity,
                quantity_received=quantity,
                received_at=received_at,
                is_active=True,
            )

        movement = StockMovement.objects.create(
            stock_item=stock_item,
            batch=batch,
            movement_type=MovementType.RECEIPT,
            quantity_delta=quantity,
            balance_after=batch.quantity,
            actor=actor,
            reason=reason,
            reference=reference,
        )

        record(
            action=AuditAction.STOCK_RECEIVED,
            actor=actor,
            pharmacy=stock_item.pharmacy,
            target=batch,
            request=request,
            metadata={
                "pharmacy_id": stock_item.pharmacy_id,
                "medication_id": stock_item.medication_id,
                "batch_number": batch.batch_number,
                "quantity": quantity,
                "balance_after": movement.balance_after,
                "movement_id": movement.id,
            },
        )

        return stock_item, movement


def adjust_stock(
    *,
    actor,
    batch,
    delta,
    reason,
    reference="",
    request=None,
) -> tuple[StockItem, StockMovement]:
    with transaction.atomic():
        batch = (
            StockBatch.objects.select_for_update()
            .select_related("stock_item", "stock_item__pharmacy")
            .get(pk=batch.pk)
        )
        if not batch.is_active:
            raise serializers.ValidationError(
                {"batch": ["Cannot modify an inactive batch."]}
            )

        new_quantity = batch.quantity + delta
        if new_quantity < 0:
            raise serializers.ValidationError(
                {"delta": ["Adjustment would result in negative stock."]}
            )

        batch.quantity = new_quantity
        batch.save(update_fields=["quantity", "updated_at"])

        movement = StockMovement.objects.create(
            stock_item=batch.stock_item,
            batch=batch,
            movement_type=MovementType.ADJUSTMENT,
            quantity_delta=delta,
            balance_after=new_quantity,
            actor=actor,
            reason=reason,
            reference=reference,
        )

        record(
            action=AuditAction.STOCK_ADJUSTED,
            actor=actor,
            pharmacy=batch.stock_item.pharmacy,
            target=batch,
            request=request,
            metadata={
                "pharmacy_id": batch.stock_item.pharmacy_id,
                "medication_id": batch.stock_item.medication_id,
                "batch_id": batch.id,
                "batch_number": batch.batch_number,
                "quantity_delta": movement.quantity_delta,
                "balance_after": movement.balance_after,
                "movement_id": movement.id,
            },
        )

        return batch.stock_item, movement


def reconcile_count(
    *,
    actor,
    batch,
    counted_quantity,
    reason="",
    reference="",
    request=None,
) -> tuple[StockItem, StockMovement | None]:
    with transaction.atomic():
        batch = (
            StockBatch.objects.select_for_update()
            .select_related("stock_item", "stock_item__pharmacy")
            .get(pk=batch.pk)
        )
        if not batch.is_active:
            raise serializers.ValidationError(
                {"batch": ["Cannot modify an inactive batch."]}
            )

        delta = counted_quantity - batch.quantity
        if delta == 0:
            return batch.stock_item, None

        batch.quantity = counted_quantity
        batch.save(update_fields=["quantity", "updated_at"])

        movement = StockMovement.objects.create(
            stock_item=batch.stock_item,
            batch=batch,
            movement_type=MovementType.COUNT_CORRECTION,
            quantity_delta=delta,
            balance_after=counted_quantity,
            actor=actor,
            reason=reason,
            reference=reference,
        )

        record(
            action=AuditAction.STOCK_COUNT_RECONCILED,
            actor=actor,
            pharmacy=batch.stock_item.pharmacy,
            target=batch,
            request=request,
            metadata={
                "pharmacy_id": batch.stock_item.pharmacy_id,
                "medication_id": batch.stock_item.medication_id,
                "batch_id": batch.id,
                "batch_number": batch.batch_number,
                "quantity_delta": movement.quantity_delta,
                "balance_after": movement.balance_after,
                "movement_id": movement.id,
            },
        )

        return batch.stock_item, movement


def transfer_stock(
    *,
    actor,
    source_batch,
    destination_pharmacy,
    quantity,
    reason="",
    reference="",
    request=None,
) -> dict:
    with transaction.atomic():
        source_batch = (
            StockBatch.objects.select_for_update()
            .select_related(
                "stock_item",
                "stock_item__pharmacy",
                "stock_item__medication",
            )
            .get(pk=source_batch.pk)
        )
        source_item = source_batch.stock_item
        source_pharmacy = source_item.pharmacy
        source_pharmacy_id = source_pharmacy.pk

        if not source_batch.is_active:
            raise serializers.ValidationError(
                {"batch": ["Cannot transfer from an inactive batch."]}
            )
        if destination_pharmacy.pk == source_pharmacy_id:
            raise serializers.ValidationError(
                {"destination_pharmacy": ["Cannot transfer to the same pharmacy."]}
            )
        if destination_pharmacy.group_id != source_pharmacy.group_id:
            raise serializers.ValidationError(
                {
                    "destination_pharmacy": [
                        "Destination pharmacy must be in the same group as the source."
                    ]
                }
            )
        if source_batch.quantity < quantity:
            raise serializers.ValidationError(
                {"quantity": ["Insufficient stock in the source batch."]}
            )

        try:
            destination_stock_item = StockItem.objects.select_for_update().get(
                pharmacy=destination_pharmacy,
                medication=source_item.medication,
            )
        except StockItem.DoesNotExist:
            destination_stock_item = StockItem.objects.create(
                pharmacy=destination_pharmacy,
                medication=source_item.medication,
                is_active=True,
            )
            destination_stock_item = StockItem.objects.select_for_update().get(
                pk=destination_stock_item.pk,
            )

        if not destination_stock_item.is_active:
            destination_stock_item.is_active = True
            destination_stock_item.save(update_fields=["is_active", "updated_at"])

        try:
            destination_batch = StockBatch.objects.select_for_update().get(
                stock_item=destination_stock_item,
                batch_number=source_batch.batch_number,
            )
            if destination_batch.expiry_date != source_batch.expiry_date:
                raise serializers.ValidationError(
                    {"batch": ["Destination batch has a different expiry date."]}
                )
            destination_batch.quantity += quantity
            destination_batch.quantity_received += quantity
            destination_batch.is_active = True
            destination_batch.save(
                update_fields=[
                    "quantity",
                    "quantity_received",
                    "is_active",
                    "updated_at",
                ]
            )
        except StockBatch.DoesNotExist:
            destination_batch = StockBatch.objects.create(
                stock_item=destination_stock_item,
                batch_number=source_batch.batch_number,
                expiry_date=source_batch.expiry_date,
                quantity=quantity,
                quantity_received=quantity,
                received_at=date.today(),
                is_active=True,
            )

        source_batch.quantity -= quantity
        source_batch.save(update_fields=["quantity", "updated_at"])

        out_movement = StockMovement.objects.create(
            stock_item=source_item,
            batch=source_batch,
            movement_type=MovementType.TRANSFER_OUT,
            quantity_delta=-quantity,
            balance_after=source_batch.quantity,
            actor=actor,
            reason=reason,
            reference=reference,
        )
        in_movement = StockMovement.objects.create(
            stock_item=destination_stock_item,
            batch=destination_batch,
            movement_type=MovementType.TRANSFER_IN,
            quantity_delta=quantity,
            balance_after=destination_batch.quantity,
            actor=actor,
            reason=reason,
            reference=reference,
        )

        record(
            action=AuditAction.STOCK_TRANSFERRED,
            actor=actor,
            pharmacy=source_pharmacy,
            target=source_batch,
            request=request,
            metadata={
                "source_pharmacy_id": source_pharmacy_id,
                "destination_pharmacy_id": destination_pharmacy.id,
                "medication_id": source_item.medication_id,
                "batch_number": source_batch.batch_number,
                "source_batch_id": source_batch.id,
                "destination_batch_id": destination_batch.id,
                "quantity": quantity,
                "source_balance_after": source_batch.quantity,
                "destination_balance_after": destination_batch.quantity,
                "out_movement_id": out_movement.id,
                "in_movement_id": in_movement.id,
            },
        )

        return {
            "source_stock_item": source_item,
            "destination_stock_item": destination_stock_item,
            "out_movement": out_movement,
            "in_movement": in_movement,
            "quantity": quantity,
        }
