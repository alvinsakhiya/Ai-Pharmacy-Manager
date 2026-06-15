from django.contrib import admin

from .models import Group, Membership, Pharmacy


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active")
    search_fields = ("name", "slug")


@admin.register(Pharmacy)
class PharmacyAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "group", "postcode", "is_active")
    search_fields = ("name", "code", "postcode", "group__name")
    list_filter = ("group", "is_active")


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "group", "pharmacy", "is_active")
    list_filter = ("role", "is_active")
    search_fields = ("user__email", "user__full_name", "group__name", "pharmacy__name")
    filter_horizontal = ("pharmacies",)
