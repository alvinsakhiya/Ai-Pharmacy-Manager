from django.contrib import admin
from .models import Patient


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