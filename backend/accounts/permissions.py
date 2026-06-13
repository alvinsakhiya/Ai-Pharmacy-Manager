from rest_framework.permissions import BasePermission

from .roles import PharmacyRole, get_user_roles


ALL_ROLES = frozenset(PharmacyRole.ALL)
MANAGER_ONLY = frozenset({PharmacyRole.MANAGER})
PATIENT_CARE_ROLES = frozenset(
    {
        PharmacyRole.MANAGER,
        PharmacyRole.PHARMACIST,
        PharmacyRole.DISPENSER,
        PharmacyRole.READ_ONLY,
    }
)
INVENTORY_READ_ROLES = ALL_ROLES


class MethodRolePermission(BasePermission):
    message = "Your pharmacy role does not permit this action."
    method_roles = {}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        effective_method = (
            "GET" if request.method in {"HEAD", "OPTIONS"} else request.method
        )
        allowed_roles = self.method_roles.get(effective_method, frozenset())
        return bool(set(get_user_roles(request.user)) & set(allowed_roles))


class DashboardRolePermission(MethodRolePermission):
    method_roles = {"GET": ALL_ROLES}


class PatientRolePermission(MethodRolePermission):
    method_roles = {
        "GET": PATIENT_CARE_ROLES,
        "POST": frozenset(
            {PharmacyRole.MANAGER, PharmacyRole.PHARMACIST}
        ),
        "PUT": frozenset(
            {PharmacyRole.MANAGER, PharmacyRole.PHARMACIST}
        ),
        "PATCH": frozenset(
            {PharmacyRole.MANAGER, PharmacyRole.PHARMACIST}
        ),
        "DELETE": frozenset(
            {PharmacyRole.MANAGER, PharmacyRole.PHARMACIST}
        ),
    }


class InventoryRolePermission(MethodRolePermission):
    method_roles = {
        "GET": INVENTORY_READ_ROLES,
        "POST": frozenset(
            {PharmacyRole.MANAGER, PharmacyRole.STOCK_ASSISTANT}
        ),
        "PUT": frozenset(
            {PharmacyRole.MANAGER, PharmacyRole.STOCK_ASSISTANT}
        ),
        "PATCH": frozenset(
            {PharmacyRole.MANAGER, PharmacyRole.STOCK_ASSISTANT}
        ),
        "DELETE": frozenset(
            {PharmacyRole.MANAGER, PharmacyRole.STOCK_ASSISTANT}
        ),
    }


class DosetteRolePermission(MethodRolePermission):
    method_roles = {
        "GET": PATIENT_CARE_ROLES,
        "POST": frozenset(
            {PharmacyRole.MANAGER, PharmacyRole.PHARMACIST}
        ),
        "PUT": frozenset(
            {
                PharmacyRole.MANAGER,
                PharmacyRole.PHARMACIST,
                PharmacyRole.DISPENSER,
            }
        ),
        "PATCH": frozenset(
            {
                PharmacyRole.MANAGER,
                PharmacyRole.PHARMACIST,
                PharmacyRole.DISPENSER,
            }
        ),
        "DELETE": frozenset(
            {PharmacyRole.MANAGER, PharmacyRole.PHARMACIST}
        ),
    }


class PickingListRolePermission(MethodRolePermission):
    method_roles = {
        "GET": frozenset(
            {
                PharmacyRole.MANAGER,
                PharmacyRole.PHARMACIST,
                PharmacyRole.DISPENSER,
            }
        )
    }


class ExpiryAlertRolePermission(MethodRolePermission):
    method_roles = {
        "GET": frozenset(
            {
                PharmacyRole.MANAGER,
                PharmacyRole.PHARMACIST,
                PharmacyRole.STOCK_ASSISTANT,
                PharmacyRole.READ_ONLY,
            }
        )
    }


class ForecastRolePermission(MethodRolePermission):
    method_roles = {
        "GET": frozenset(
            {
                PharmacyRole.MANAGER,
                PharmacyRole.PHARMACIST,
                PharmacyRole.READ_ONLY,
            }
        )
    }


class AuditLogRolePermission(MethodRolePermission):
    method_roles = {
        "GET": MANAGER_ONLY,
        "POST": MANAGER_ONLY,
        "PUT": MANAGER_ONLY,
        "PATCH": MANAGER_ONLY,
        "DELETE": MANAGER_ONLY,
    }
