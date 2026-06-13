from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "priority",
        "status",
        "assigned_username",
        "due_date",
        "expiry_date",
        "created_at",
    )
    list_filter = (
        "priority",
        "status",
        "due_date",
        "expiry_date",
    )
    search_fields = (
        "title",
        "message",
        "assigned_username",
        "related_entity_type",
        "related_entity_id",
    )
    readonly_fields = (
        "status",
        "assigned_username",
        "created_at",
        "acknowledged_at",
        "resolved_at",
        "resolution_reason",
    )

    def save_model(self, request, obj, form, change):
        obj.assigned_username = (
            obj.assigned_user.get_username() if obj.assigned_user else ""
        )
        super().save_model(request, obj, form, change)
