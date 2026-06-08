from django.contrib import admin
from .models import Medication


@admin.register(Medication)
class MedicationAdmin(admin.ModelAdmin):
    list_display = ("name", "strength", "form", "manufacturer", "created_at")
    search_fields = ("name", "strength", "form", "manufacturer")
    list_filter = ("form", "manufacturer")