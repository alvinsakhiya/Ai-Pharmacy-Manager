from django.contrib import admin

from .models import DosetteCycle, DosetteItem, DosettePlan


class DosetteItemInline(admin.TabularInline):
    model = DosetteItem
    extra = 0


@admin.register(DosettePlan)
class DosettePlanAdmin(admin.ModelAdmin):
    list_display = ("patient", "frequency", "is_active", "review_date")
    list_filter = ("frequency", "is_active")
    inlines = [DosetteItemInline]


@admin.register(DosetteCycle)
class DosetteCycleAdmin(admin.ModelAdmin):
    list_display = ("plan", "cycle_start", "due_date", "status")
    list_filter = ("status",)
