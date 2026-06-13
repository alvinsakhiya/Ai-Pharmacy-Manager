from django.contrib import admin

from .models import (
    FridgeTemperatureLog,
    LocalDelivery,
    OpeningHour,
    OperationalAppointment,
    OperationalTask,
)


@admin.register(OperationalTask)
class OperationalTaskAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "category",
        "priority",
        "status",
        "assigned_username",
        "due_at",
    )
    list_filter = (
        "category",
        "priority",
        "status",
        "due_at",
    )
    search_fields = (
        "title",
        "description",
        "assigned_username",
        "created_by_username",
    )
    readonly_fields = (
        "status",
        "assigned_username",
        "created_by",
        "created_by_username",
        "completed_at",
        "cancellation_reason",
        "created_at",
        "updated_at",
    )

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
            obj.created_by_username = request.user.get_username()

        obj.assigned_username = (
            obj.assigned_user.get_username() if obj.assigned_user else ""
        )
        super().save_model(request, obj, form, change)


@admin.register(OpeningHour)
class OpeningHourAdmin(admin.ModelAdmin):
    list_display = (
        "day_of_week",
        "opening_time",
        "closing_time",
        "is_closed",
        "updated_at",
    )
    list_filter = ("is_closed",)


@admin.register(LocalDelivery)
class LocalDeliveryAdmin(admin.ModelAdmin):
    list_display = (
        "patient_name",
        "scheduled_date",
        "delivery_window",
        "status",
        "assigned_username",
    )
    list_filter = (
        "status",
        "delivery_window",
        "scheduled_date",
    )
    search_fields = (
        "patient_name",
        "assigned_username",
    )
    readonly_fields = (
        "patient_name",
        "status",
        "assigned_username",
        "outcome_notes",
        "created_by",
        "created_by_username",
        "delivered_at",
        "created_at",
        "updated_at",
    )

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
            obj.created_by_username = request.user.get_username()

        if obj.patient:
            obj.patient_name = (
                f"{obj.patient.first_name} {obj.patient.last_name}"
            )
        obj.assigned_username = (
            obj.assigned_user.get_username() if obj.assigned_user else ""
        )
        super().save_model(request, obj, form, change)


@admin.register(FridgeTemperatureLog)
class FridgeTemperatureLogAdmin(admin.ModelAdmin):
    list_display = (
        "temperature_celsius",
        "recorded_by_username",
        "recorded_at",
    )
    list_filter = ("recorded_at",)
    search_fields = ("recorded_by_username",)
    readonly_fields = (
        "temperature_celsius",
        "action_taken",
        "notes",
        "recorded_by",
        "recorded_by_username",
        "recorded_at",
    )

    def has_change_permission(self, request, obj=None):
        return obj is None

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        obj.recorded_by = request.user
        obj.recorded_by_username = request.user.get_username()
        super().save_model(request, obj, form, change)


@admin.register(OperationalAppointment)
class OperationalAppointmentAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "appointment_type",
        "scheduled_start",
        "status",
        "assigned_username",
    )
    list_filter = (
        "appointment_type",
        "status",
        "scheduled_start",
    )
    search_fields = (
        "title",
        "patient_name",
        "assigned_username",
    )
    readonly_fields = (
        "patient_name",
        "status",
        "assigned_username",
        "outcome_notes",
        "created_by",
        "created_by_username",
        "completed_at",
        "created_at",
        "updated_at",
    )

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
            obj.created_by_username = request.user.get_username()

        obj.patient_name = (
            f"{obj.patient.first_name} {obj.patient.last_name}"
            if obj.patient
            else ""
        )
        obj.assigned_username = (
            obj.assigned_user.get_username() if obj.assigned_user else ""
        )
        super().save_model(request, obj, form, change)
