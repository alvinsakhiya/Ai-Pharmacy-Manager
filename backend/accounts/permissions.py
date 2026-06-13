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


class StockMovementRolePermission(MethodRolePermission):
    method_roles = {
        "GET": frozenset(
            {
                PharmacyRole.MANAGER,
                PharmacyRole.STOCK_ASSISTANT,
            }
        ),
        "POST": frozenset(
            {
                PharmacyRole.MANAGER,
                PharmacyRole.STOCK_ASSISTANT,
            }
        ),
        "PUT": frozenset(
            {
                PharmacyRole.MANAGER,
                PharmacyRole.STOCK_ASSISTANT,
            }
        ),
        "PATCH": frozenset(
            {
                PharmacyRole.MANAGER,
                PharmacyRole.STOCK_ASSISTANT,
            }
        ),
        "DELETE": frozenset(
            {
                PharmacyRole.MANAGER,
                PharmacyRole.STOCK_ASSISTANT,
            }
        ),
    }


class StockIntelligenceRolePermission(MethodRolePermission):
    method_roles = {
        "GET": frozenset(
            {
                PharmacyRole.MANAGER,
                PharmacyRole.STOCK_ASSISTANT,
            }
        )
    }


class OrderingRolePermission(MethodRolePermission):
    ordering_roles = frozenset(
        {
            PharmacyRole.MANAGER,
            PharmacyRole.STOCK_ASSISTANT,
        }
    )
    method_roles = {
        "GET": ordering_roles,
        "POST": ordering_roles,
        "PATCH": ordering_roles,
    }


class ClinicalReviewRolePermission(MethodRolePermission):
    clinical_roles = frozenset(
        {
            PharmacyRole.MANAGER,
            PharmacyRole.PHARMACIST,
        }
    )
    method_roles = {
        "GET": clinical_roles,
        "POST": clinical_roles,
        "PUT": clinical_roles,
        "PATCH": clinical_roles,
        "DELETE": clinical_roles,
    }


class NotificationRolePermission(BasePermission):
    message = "Your pharmacy role does not permit this notification action."
    manager_actions = {
        "create",
        "update",
        "partial_update",
        "destroy",
        "assignees",
    }
    read_actions = {"list", "retrieve", "summary"}
    lifecycle_actions = {"mark_read", "acknowledge", "resolve"}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        action = getattr(view, "action", None)
        roles = set(get_user_roles(request.user))

        if action in self.read_actions or action in self.lifecycle_actions:
            return bool(roles & set(ALL_ROLES))

        if action in self.manager_actions:
            return PharmacyRole.MANAGER in roles

        return False

    def has_object_permission(self, request, view, obj):
        roles = set(get_user_roles(request.user))

        if PharmacyRole.MANAGER in roles:
            return True

        if getattr(view, "action", None) in self.lifecycle_actions:
            return obj.assigned_user_id == request.user.id

        return True


class NotificationReportRolePermission(MethodRolePermission):
    method_roles = {"GET": ALL_ROLES}


class OperationalTaskRolePermission(BasePermission):
    message = "Your pharmacy role does not permit this task action."
    manager_actions = {
        "create",
        "update",
        "partial_update",
        "destroy",
        "assignees",
        "cancel",
    }
    read_actions = {"list", "retrieve", "summary"}
    lifecycle_actions = {"claim", "start", "complete"}
    lifecycle_roles = frozenset(
        {
            PharmacyRole.MANAGER,
            PharmacyRole.PHARMACIST,
            PharmacyRole.DISPENSER,
            PharmacyRole.STOCK_ASSISTANT,
        }
    )

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        action = getattr(view, "action", None)
        roles = set(get_user_roles(request.user))

        if action in self.read_actions:
            return bool(roles & set(ALL_ROLES))

        if action in self.lifecycle_actions:
            return bool(roles & set(self.lifecycle_roles))

        if action in self.manager_actions:
            return PharmacyRole.MANAGER in roles

        return False

    def has_object_permission(self, request, view, obj):
        roles = set(get_user_roles(request.user))

        if PharmacyRole.MANAGER in roles:
            return True

        action = getattr(view, "action", None)
        if action == "claim":
            return obj.assigned_user_id is None and not obj.assigned_username

        if action in {"start", "complete"}:
            return obj.assigned_user_id == request.user.id

        return True


class OpeningHourRolePermission(MethodRolePermission):
    method_roles = {
        "GET": ALL_ROLES,
        "POST": MANAGER_ONLY,
        "PUT": MANAGER_ONLY,
        "PATCH": MANAGER_ONLY,
        "DELETE": MANAGER_ONLY,
    }


class LocalDeliveryRolePermission(BasePermission):
    message = "Your pharmacy role does not permit this delivery action."
    care_roles = frozenset(
        {
            PharmacyRole.MANAGER,
            PharmacyRole.PHARMACIST,
            PharmacyRole.DISPENSER,
            PharmacyRole.READ_ONLY,
        }
    )
    action_roles = frozenset(
        {
            PharmacyRole.MANAGER,
            PharmacyRole.PHARMACIST,
            PharmacyRole.DISPENSER,
        }
    )
    manager_actions = {
        "create",
        "update",
        "partial_update",
        "assignees",
        "cancel",
    }
    read_actions = {"list", "retrieve", "summary"}
    lifecycle_actions = {
        "claim",
        "ready",
        "mark_dispatched",
        "deliver",
        "fail",
    }

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        action = getattr(view, "action", None)
        roles = set(get_user_roles(request.user))

        if action in self.read_actions:
            return bool(roles & set(self.care_roles))

        if action in self.lifecycle_actions:
            return bool(roles & set(self.action_roles))

        if action in self.manager_actions:
            return bool(
                roles
                & {
                    PharmacyRole.MANAGER,
                    PharmacyRole.PHARMACIST,
                }
            )

        return False

    def has_object_permission(self, request, view, obj):
        roles = set(get_user_roles(request.user))

        if roles & {
            PharmacyRole.MANAGER,
            PharmacyRole.PHARMACIST,
        }:
            return True

        action = getattr(view, "action", None)
        if action == "claim":
            return (
                obj.assigned_user_id is None
                and not obj.assigned_username
            )

        if action in {"ready", "mark_dispatched", "deliver", "fail"}:
            return obj.assigned_user_id == request.user.id

        return True


class FridgeTemperatureRolePermission(MethodRolePermission):
    method_roles = {
        "GET": ALL_ROLES,
        "POST": frozenset(
            {
                PharmacyRole.MANAGER,
                PharmacyRole.PHARMACIST,
                PharmacyRole.STOCK_ASSISTANT,
            }
        ),
    }


class OperationalAppointmentRolePermission(BasePermission):
    message = "Your pharmacy role does not permit this appointment action."
    read_roles = PATIENT_CARE_ROLES
    management_roles = frozenset(
        {
            PharmacyRole.MANAGER,
            PharmacyRole.PHARMACIST,
        }
    )
    completion_roles = frozenset(
        {
            PharmacyRole.MANAGER,
            PharmacyRole.PHARMACIST,
            PharmacyRole.DISPENSER,
        }
    )
    read_actions = {"list", "retrieve", "summary"}
    management_actions = {
        "create",
        "update",
        "partial_update",
        "assignees",
        "cancel",
    }

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        action = getattr(view, "action", None)
        roles = set(get_user_roles(request.user))

        if action in self.read_actions:
            return bool(roles & set(self.read_roles))

        if action == "complete":
            return bool(roles & set(self.completion_roles))

        if action in self.management_actions:
            return bool(roles & set(self.management_roles))

        return False

    def has_object_permission(self, request, view, obj):
        roles = set(get_user_roles(request.user))

        if roles & set(self.management_roles):
            return True

        if getattr(view, "action", None) == "complete":
            return obj.assigned_user_id == request.user.id

        return True
