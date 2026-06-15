from django.contrib import admin

from .models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "action",
        "actor_email",
        "actor_role",
        "group",
        "pharmacy",
        "target_type",
        "target_id",
    )
    list_filter = ("action", "group", "pharmacy", "created_at")
    search_fields = ("actor_email", "action", "target_type", "target_id", "ip_address")
    date_hierarchy = "created_at"
    readonly_fields = tuple(field.name for field in AuditEvent._meta.fields)

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False
