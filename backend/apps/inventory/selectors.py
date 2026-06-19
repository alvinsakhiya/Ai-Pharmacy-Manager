from django.db.models import IntegerField, Min, Q, Sum, Value
from django.db.models.functions import Coalesce

from .models import StockItem


def stock_items_for(user):
    return (
        StockItem.scoped.for_user(user)
        .select_related("medication", "pharmacy")
        .annotate(
            quantity_on_hand=Coalesce(
                Sum(
                    "batches__quantity",
                    filter=Q(batches__is_active=True),
                ),
                Value(0),
                output_field=IntegerField(),
            ),
            earliest_expiry=Min(
                "batches__expiry_date",
                filter=Q(batches__is_active=True, batches__quantity__gt=0),
            ),
        )
    )
