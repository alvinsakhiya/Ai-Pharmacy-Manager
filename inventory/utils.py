from .models import StockBatch


def get_fefo_batches_for_medication(medication):
    return StockBatch.objects.filter(
        medication=medication,
        quantity__gt=0
    ).order_by("expiry_date")


def allocate_stock_fefo(medication, required_quantity):
    batches = get_fefo_batches_for_medication(medication)

    remaining_quantity = required_quantity
    allocation = []

    for batch in batches:
        if remaining_quantity <= 0:
            break

        quantity_from_batch = min(batch.quantity, remaining_quantity)

        allocation.append({
            "batch": batch,
            "quantity": quantity_from_batch,
            "expiry_date": batch.expiry_date,
        })

        remaining_quantity -= quantity_from_batch

    return {
        "medication": medication,
        "required_quantity": required_quantity,
        "allocated": allocation,
        "shortfall": remaining_quantity,
    }