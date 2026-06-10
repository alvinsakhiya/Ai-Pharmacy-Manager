from django.contrib import admin
from .models import Medication, StockBatch


@admin.register(Medication)
class MedicationAdmin(admin.ModelAdmin):
    list_display = ("name", "strength", "form", "manufacturer", "created_at")
    search_fields = ("name", "strength", "form", "manufacturer")
    list_filter = ("form", "manufacturer")


@admin.register(StockBatch)
class StockBatchAdmin(admin.ModelAdmin):
    list_display = (
        "medication",
        "batch_number",
        "expiry_date",
        "quantity",
        "received_date",
        "supplier",
    )
    search_fields = (
        "medication__name",
        "batch_number",
        "supplier",
    )
    list_filter = (
        "expiry_date",
        "received_date",
        "supplier",
    )