from django.contrib import admin

from .models import TrustedDirection


@admin.register(TrustedDirection)
class TrustedDirectionAdmin(admin.ModelAdmin):
    list_display = ("code", "text", "category", "is_active", "sort_order")
    list_filter = ("category", "is_active")
    search_fields = ("code", "text")
    ordering = ("sort_order", "code")
