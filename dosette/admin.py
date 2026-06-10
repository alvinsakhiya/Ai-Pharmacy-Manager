from django.contrib import admin
from .models import DosetteRecord


@admin.register(DosetteRecord)
class DosetteRecordAdmin(admin.ModelAdmin):
    list_display = (
        "patient",
        "medication",
        "morning_dose",
        "afternoon_dose",
        "evening_dose",
        "bedtime_dose",
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
    )