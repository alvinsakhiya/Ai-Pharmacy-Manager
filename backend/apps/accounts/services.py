from django.db import transaction

from apps.audit.models import AuditAction
from apps.audit.services import record
from apps.tenancy.models import Membership, Role


def _membership_snapshot(membership):
    if membership is None:
        return {
            "role": None,
            "group_id": None,
            "pharmacy_id": None,
            "pharmacy_ids": [],
        }

    return {
        "role": membership.role,
        "group_id": membership.group_id,
        "pharmacy_id": membership.pharmacy_id,
        "pharmacy_ids": sorted(membership.pharmacies.values_list("id", flat=True)),
    }


def reassign_membership(
    *,
    target_user,
    role,
    group=None,
    pharmacy=None,
    pharmacies=None,
    actor,
    request,
):
    with transaction.atomic():
        old = target_user.memberships.select_for_update().filter(is_active=True).first()
        old_snapshot = _membership_snapshot(old)

        if old is not None:
            old.is_active = False
            old.save(update_fields=["is_active"])

        new = Membership(user=target_user, role=role, is_active=True)
        if role in {Role.SUPERINTENDENT, Role.STOCK_EMPLOYEE}:
            new.group = group
        elif role in {Role.PHARMACIST, Role.DISPENSER}:
            new.pharmacy = pharmacy

        new.full_clean()
        new.save()

        if role == Role.STOCK_EMPLOYEE:
            new.pharmacies.set(pharmacies or [])

        new_snapshot = _membership_snapshot(new)
        record(
            action=AuditAction.ROLE_ASSIGNED,
            actor=actor,
            target=target_user,
            request=request,
            metadata={
                "old_role": old_snapshot["role"],
                "new_role": new_snapshot["role"],
                "old_group_id": old_snapshot["group_id"],
                "new_group_id": new_snapshot["group_id"],
                "old_pharmacy_id": old_snapshot["pharmacy_id"],
                "new_pharmacy_id": new_snapshot["pharmacy_id"],
                "old_pharmacy_ids": old_snapshot["pharmacy_ids"],
                "new_pharmacy_ids": new_snapshot["pharmacy_ids"],
            },
        )

        return new
