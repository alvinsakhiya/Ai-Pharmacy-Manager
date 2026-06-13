from django.contrib import admin
from .models import DosetteMedicationChange, DosetteRecord


@admin.register(DosetteRecord)
class DosetteRecordAdmin(admin.ModelAdmin):
    list_display = (
        "patient",
        "medication",
        "morning_dose",
        "afternoon_dose",
        "evening_dose",
        "bedtime_dose",
        "cycle_start_date",
        "cycle_length_weeks",
        "review_date",
        "is_active",
    )

    search_fields = (
        "patient__first_name",
        "patient__last_name",
        "medication__name",
    )

    list_filter = (
        "is_active",
        "medication__form",
        "review_date",
    )


@admin.register(DosetteMedicationChange)
class DosetteMedicationChangeAdmin(admin.ModelAdmin):
    list_display = (
        "timestamp",
        "patient_name",
        "medication_name",
        "change_type",
        "actor_username",
    )
    list_filter = (
        "change_type",
        "is_active",
        "timestamp",
    )
    search_fields = (
        "patient_name",
        "medication_name",
        "actor_username",
    )
    readonly_fields = (
        "dosette_record_identifier",
        "patient_identifier",
        "patient_name",
        "medication_identifier",
        "medication_name",
        "change_type",
        "changed_fields",
        "morning_dose",
        "afternoon_dose",
        "evening_dose",
        "bedtime_dose",
        "is_active",
        "cycle_start_date",
        "cycle_length_weeks",
        "review_date",
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
