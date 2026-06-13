from django.contrib import admin

from .models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = (
        "timestamp",
        "actor_username",
        "action",
        "entity_type",
        "entity_identifier",
    )
    list_filter = ("action", "entity_type", "timestamp")
    search_fields = (
        "actor_username",
        "entity_type",
        "entity_identifier",
        "summary",
        "request_path",
    )
    readonly_fields = (
        "actor",
        "actor_username",
        "action",
        "entity_type",
        "entity_identifier",
        "timestamp",
        "summary",
        "request_path",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
