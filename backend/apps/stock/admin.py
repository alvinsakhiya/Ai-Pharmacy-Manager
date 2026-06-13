from django.contrib import admin

from .models import (
    Manufacturer,
    Medicine,
    MedicineUsage,
    StockBatch,
    StockMovement,
    Supplier,
)


@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
    list_display = ("name", "strength", "form", "reorder_level", "is_active")
    list_filter = ("form", "is_active")
    search_fields = ("name", "strength")


@admin.register(StockBatch)
class StockBatchAdmin(admin.ModelAdmin):
    list_display = ("medicine", "batch_number", "expiry_date", "quantity_on_hand", "location")
    list_filter = ("supplier", "location")
    search_fields = ("batch_number", "medicine__name")


admin.site.register([Supplier, Manufacturer, StockMovement, MedicineUsage])
