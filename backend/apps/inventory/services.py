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
