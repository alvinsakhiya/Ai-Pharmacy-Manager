from apps.tenancy.policy import resolve_scope

from .models import User


def users_visible_to(requesting_user):
    scope = resolve_scope(requesting_user)
    if scope.is_global:
        return User.objects.all()
    if not scope.pharmacy_ids:
        return User.objects.none()

    return User.objects.filter(
        memberships__is_active=True,
        memberships__pharmacy_id__in=scope.pharmacy_ids,
    ).distinct()
