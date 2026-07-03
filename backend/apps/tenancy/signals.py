from django.core.exceptions import ValidationError
from django.db.models.signals import m2m_changed
from django.dispatch import receiver

from .models import Membership, Pharmacy, Role


@receiver(m2m_changed, sender=Membership.pharmacies.through)
def validate_membership_pharmacies(
    sender,
    instance: Membership,
    action: str,
    pk_set: set[int],
    **kwargs,
) -> None:
    if action != "pre_add":
        return

    if instance.role != Role.STOCK_EMPLOYEE:
        raise ValidationError(
            "Only stock employee memberships can have selected pharmacies."
        )

    mismatched_pharmacy_exists = (
        Pharmacy.objects.filter(pk__in=pk_set)
        .exclude(group_id=instance.group_id)  # type: ignore[misc]  # stock-employee membership has a group (validated above)
        .exists()
    )
    if mismatched_pharmacy_exists:
        raise ValidationError(
            "Stock employee selected pharmacies must belong to the membership group."
        )
