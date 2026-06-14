from django.contrib import admin

from .models import WorkflowJob, WorkflowStatusHistory


class StatusHistoryInline(admin.TabularInline):
    model = WorkflowStatusHistory
    extra = 0
    readonly_fields = ["from_status", "to_status", "changed_by_label", "note", "timestamp"]
    can_delete = False


@admin.register(WorkflowJob)
class WorkflowJobAdmin(admin.ModelAdmin):
    list_display = ["id", "patient", "job_type", "priority", "status", "due_date", "assigned_to"]
    list_filter = ["status", "job_type", "priority"]
    search_fields = ["patient__first_name", "patient__last_name", "patient__patient_id", "title"]
    autocomplete_fields = ["patient", "assigned_to"]
    inlines = [StatusHistoryInline]


@admin.register(WorkflowStatusHistory)
class WorkflowStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ["job", "from_status", "to_status", "changed_by_label", "timestamp"]
    list_filter = ["to_status"]
