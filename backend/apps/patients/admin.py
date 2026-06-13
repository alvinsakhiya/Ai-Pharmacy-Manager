from django.contrib import admin

from .models import Patient, PatientNote


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ("patient_id", "first_name", "last_name", "status", "is_dosette")
    list_filter = ("status", "is_dosette")
    search_fields = ("patient_id", "first_name", "last_name")


admin.site.register(PatientNote)
