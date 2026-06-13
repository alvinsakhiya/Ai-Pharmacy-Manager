from django.contrib import admin

from .models import OpeningHour, OperationalTask


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
