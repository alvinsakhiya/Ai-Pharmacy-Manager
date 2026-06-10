from django.contrib import admin
from .models import Patient
from dosette.models import DosetteRecord


class DosetteRecordInline(admin.TabularInline):
    model = DosetteRecord
    extra = 1
    fields = (
        "medication",
        "morning_dose",
        "afternoon_dose",
        "evening_dose",
        "bedtime_dose",
        "instructions",
        "is_active",
    )


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = (
        "first_name",
        "last_name",
        "date_of_birth",
        "contact_number",
    )

    search_fields = (
        "first_name",
        "last_name",
        "contact_number",
    )

    inlines = [
        DosetteRecordInline,
    ]