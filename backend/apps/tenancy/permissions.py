from enum import StrEnum
from typing import Any

from rest_framework.permissions import BasePermission

from .models import Role
from .policy import _target_in_scope, get_active_membership


class Action(StrEnum):
    STOCK_VIEW = "stock.view"
    STOCK_MANAGE = "stock.manage"
    STOCK_TRANSFER = "stock.transfer"

    PATIENT_VIEW = "patient.view"
    PATIENT_MANAGE = "patient.manage"

    BLISTER_VIEW = "blister.view"
    BLISTER_MANAGE = "blister.manage"
    BLISTER_MARK_PREPARED = "blister.mark_prepared"

    USER_CREATE = "user.create"
    USER_RESET_PASSWORD = "user.reset_password"
    USER_DEACTIVATE = "user.deactivate"
    USER_DELETE = "user.delete"
    USER_ASSIGN_ROLE = "user.assign_role"
    USER_MANAGE = "user.manage"

    GROUP_MANAGE = "group.manage"
    PHARMACY_MANAGE = "pharmacy.manage"

    AUDIT_VIEW = "audit.view"


PATIENT_CLASS_ACTIONS = frozenset(
    {
        Action.PATIENT_VIEW,
        Action.PATIENT_MANAGE,
        Action.BLISTER_VIEW,
        Action.BLISTER_MANAGE,
        Action.BLISTER_MARK_PREPARED,
    }
)

ROLE_CAPABILITIES = {
    Role.SUPERINTENDENT: frozenset(
        {
            Action.STOCK_VIEW,
            Action.STOCK_MANAGE,
            Action.STOCK_TRANSFER,
            Action.AUDIT_VIEW,
        }
    ),
    Role.STOCK_EMPLOYEE: frozenset(
        {
            Action.STOCK_VIEW,
            Action.STOCK_MANAGE,
            Action.STOCK_TRANSFER,
        }
    ),
    Role.PHARMACIST: frozenset(
        {
            Action.STOCK_VIEW,
            Action.STOCK_MANAGE,
            Action.PATIENT_VIEW,
            Action.PATIENT_MANAGE,
            Action.BLISTER_VIEW,
            Action.BLISTER_MANAGE,
            Action.BLISTER_MARK_PREPARED,
            Action.USER_CREATE,
            Action.USER_RESET_PASSWORD,
            Action.USER_DEACTIVATE,
            Action.USER_ASSIGN_ROLE,
            Action.USER_MANAGE,
            Action.AUDIT_VIEW,
        }
    ),
    Role.DISPENSER: frozenset(
        {
            Action.STOCK_VIEW,
            Action.PATIENT_VIEW,
            Action.BLISTER_VIEW,
        }
    ),
}


def can(user: Any, action: Action | str, target: Any = None) -> bool:
    membership = get_active_membership(user)
    if membership is None:
        return False

    try:
        action = Action(action)
    except ValueError:
        return False

    if membership.role == Role.ADMIN:
        return True

    if action not in ROLE_CAPABILITIES.get(membership.role, frozenset()):
        return False

    if target is not None:
        return _target_in_scope(user, target)

    return True


class IsActiveMember(BasePermission):
    def has_permission(self, request, view) -> bool:
        return get_active_membership(request.user) is not None


def require(*actions: Action):
    class RequireActions(BasePermission):
        def has_permission(self, request, view) -> bool:
            return all(can(request.user, action) for action in actions)

        def has_object_permission(self, request, view, obj) -> bool:
            return all(can(request.user, action, target=obj) for action in actions)

    return RequireActions
