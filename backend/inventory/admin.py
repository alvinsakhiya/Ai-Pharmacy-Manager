from django.contrib import admin
from .models import (
    DraftPurchaseOrder,
    DraftPurchaseOrderItem,
    Medication,
    StockBatch,
    StockMovement,
    Supplier,
)
from .services import record_initial_stock_receipt


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "contact_name",
        "email",
        "lead_time_days",
        "is_active",
        "updated_at",
    )
    list_filter = ("is_active", "lead_time_days")
    search_fields = (
        "name",
        "contact_name",
        "email",
        "account_reference",
    )

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Medication)
class MedicationAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "strength",
        "form",
        "minimum_stock_level",
        "reorder_threshold",
        "target_weeks_of_cover",
        "preferred_supplier",
        "manufacturer",
        "created_at",
    )
    search_fields = ("name", "strength", "form", "manufacturer")
    list_filter = ("form", "manufacturer", "preferred_supplier")


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

    def get_readonly_fields(self, request, obj=None):
        return ("quantity",) if obj else ()

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)

        if not change:
            record_initial_stock_receipt(obj, request=request)


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = (
        "timestamp",
        "medication_name",
        "batch_number",
        "movement_type",
        "quantity_change",
        "quantity_before",
        "quantity_after",
        "actor_username",
    )
    list_filter = ("movement_type", "timestamp")
    search_fields = (
        "medication_name",
        "batch_number",
        "reason",
        "actor_username",
    )
    readonly_fields = (
        "stock_batch",
        "stock_batch_identifier",
        "medication_identifier",
        "medication_name",
        "batch_number",
        "movement_type",
        "quantity_change",
        "quantity_before",
        "quantity_after",
        "reason",
        "actor",
        "actor_username",
        "timestamp",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class DraftPurchaseOrderItemInline(admin.TabularInline):
    model = DraftPurchaseOrderItem
    extra = 0
    can_delete = False
    readonly_fields = (
        "medication",
        "medication_name",
        "quantity",
        "recommended_quantity",
        "current_stock",
        "target_stock",
        "rationale",
    )

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(DraftPurchaseOrder)
class DraftPurchaseOrderAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "supplier",
        "status",
        "created_by_username",
        "created_at",
    )
    list_filter = ("status", "supplier", "created_at")
    search_fields = (
        "supplier__name",
        "created_by_username",
        "notes",
    )
    readonly_fields = (
        "supplier",
        "created_by",
        "created_by_username",
        "created_at",
        "updated_at",
    )
    inlines = (DraftPurchaseOrderItemInline,)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
