"""Role-based access control permissions.

Roles (see apps.accounts.models.Role):
    administrator – full access incl. user management & configuration
    pharmacist    – clinical checks, final checks, full operational access
    dispenser     – picking, pack assembly, stock movements (no user mgmt)
"""
from rest_framework.permissions import SAFE_METHODS, BasePermission


class RolePermission(BasePermission):
    """Generic role gate.

    A ViewSet sets:
        allowed_roles      – roles permitted for write/unsafe methods
        read_roles         – roles permitted for safe (GET) methods (defaults: all authed)
    """

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser or getattr(user, "role", None) == "administrator":
            return True
        if request.method in SAFE_METHODS:
            read_roles = getattr(view, "read_roles", None)
            return read_roles is None or user.role in read_roles
        allowed = getattr(view, "allowed_roles", None)
        return allowed is None or user.role in allowed


class IsAdministrator(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and
                    (user.is_superuser or user.role == "administrator"))


class IsPharmacistOrAdmin(BasePermission):
    """Clinical/final-check actions are restricted to pharmacists & admins."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and
                    (user.is_superuser or user.role in {"administrator", "pharmacist"}))
