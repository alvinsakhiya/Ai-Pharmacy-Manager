from dataclasses import dataclass
from typing import Any

from .models import Group, Membership, Pharmacy, Role


@dataclass(frozen=True)
class AccessScope:
    is_global: bool
    group_ids: frozenset[int]
    pharmacy_ids: frozenset[int]


EMPTY_SCOPE = AccessScope(False, frozenset(), frozenset())


def _is_authenticated(user: Any) -> bool:
    is_authenticated = getattr(user, "is_authenticated", False)
    if callable(is_authenticated):
        return bool(is_authenticated())
    return bool(is_authenticated)


def get_active_membership(user: Any) -> Membership | None:
    if user is None or not _is_authenticated(user):
        return None
    if not getattr(user, "is_active", False):
        return None

    memberships = getattr(user, "memberships", None)
    if memberships is None:
        return None

    return memberships.filter(is_active=True).first()


def resolve_scope(user: Any) -> AccessScope:
    membership = get_active_membership(user)
    if membership is None:
        return EMPTY_SCOPE

    if membership.role == Role.ADMIN:
        return AccessScope(True, frozenset(), frozenset())

    if membership.role == Role.SUPERINTENDENT and membership.group_id is not None:
        pharmacy_ids = Pharmacy.objects.filter(
            group_id=membership.group_id
        ).values_list(
            "id",
            flat=True,
        )
        return AccessScope(
            False,
            frozenset({membership.group_id}),
            frozenset(pharmacy_ids),
        )

    if membership.role == Role.STOCK_EMPLOYEE:
        pharmacy_ids = membership.pharmacies.values_list("id", flat=True)
        return AccessScope(False, frozenset(), frozenset(pharmacy_ids))

    if membership.role in {Role.PHARMACIST, Role.DISPENSER}:
        if membership.pharmacy_id is None:
            return EMPTY_SCOPE
        return AccessScope(False, frozenset(), frozenset({membership.pharmacy_id}))

    return EMPTY_SCOPE


def _target_in_scope(user: Any, target: Any) -> bool:
    scope = resolve_scope(user)
    if scope.is_global:
        return True

    if isinstance(target, Pharmacy):
        return target.id in scope.pharmacy_ids
    if isinstance(target, Group):
        return target.id in scope.group_ids

    pharmacy_id = getattr(target, "pharmacy_id", None)
    if pharmacy_id is not None:
        return pharmacy_id in scope.pharmacy_ids

    group_id = getattr(target, "group_id", None)
    if group_id is not None:
        return group_id in scope.group_ids

    return False
