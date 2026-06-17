from apps.tenancy.models import Role
from apps.tenancy.policy import get_active_membership, resolve_scope

from .models import AuditEvent


def audit_events_for(user):
    membership = get_active_membership(user)
    scope = resolve_scope(user)
    queryset = AuditEvent.objects.select_related("actor", "group", "pharmacy")

    if membership is None:
        return queryset.none()

    if scope.is_global:
        return queryset.all()

    if (
        membership.role == Role.PHARMACIST
        and membership.pharmacy_id in scope.pharmacy_ids
    ):
        return queryset.filter(pharmacy_id=membership.pharmacy_id)

    # Superintendent holds audit.view but group-scoped, patient-safe audit visibility is deferred until stock/patient audit actions exist. Do not broaden without a patient-action allowlist.  # noqa: E501
    return queryset.none()
