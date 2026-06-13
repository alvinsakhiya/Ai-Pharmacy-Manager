from django.contrib import admin
from .models import ClinicalReviewNote, Patient
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


@admin.register(ClinicalReviewNote)
class ClinicalReviewNoteAdmin(admin.ModelAdmin):
    list_display = (
        "patient",
        "category",
        "follow_up_status",
        "review_date",
        "author_username",
        "created_at",
    )
    list_filter = (
        "category",
        "follow_up_status",
        "review_date",
    )
    search_fields = (
        "patient__first_name",
        "patient__last_name",
        "note_text",
        "author_username",
    )
    readonly_fields = (
        "author",
        "author_username",
        "created_at",
        "updated_at",
    )

    def save_model(self, request, obj, form, change):
        if not change:
            obj.author = request.user
            obj.author_username = request.user.get_username()

        super().save_model(request, obj, form, change)
