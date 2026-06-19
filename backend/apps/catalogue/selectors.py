from apps.tenancy.models import Pharmacy
from apps.tenancy.policy import resolve_scope

from .models import Medication


def effective_group_ids(user) -> frozenset[int] | None:
    scope = resolve_scope(user)
    if scope.is_global:
        return None

    group_ids = set(scope.group_ids)
    if scope.pharmacy_ids:
        pharmacy_group_ids = Pharmacy.objects.filter(
            id__in=scope.pharmacy_ids,
        ).values_list("group_id", flat=True)
        group_ids.update(pharmacy_group_ids)

    return frozenset(group_ids)


def medications_for(user):
    group_ids = effective_group_ids(user)
    if group_ids is None:
        return Medication.objects.all()
    return Medication.objects.filter(group_id__in=group_ids)
