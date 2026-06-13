from django.contrib.auth.models import Group


class PharmacyRole:
    MANAGER = "Manager"
    PHARMACIST = "Pharmacist"
    DISPENSER = "Dispenser"
    STOCK_ASSISTANT = "Stock Assistant"
    READ_ONLY = "Read-only User"

    ALL = (
        MANAGER,
        PHARMACIST,
        DISPENSER,
        STOCK_ASSISTANT,
        READ_ONLY,
    )


def get_user_roles(user):
    if not user or not user.is_authenticated:
        return []

    if user.is_superuser:
        return [PharmacyRole.MANAGER]

    assigned_role_names = set(
        user.groups.filter(name__in=PharmacyRole.ALL)
        .values_list("name", flat=True)
    )
    assigned_roles = [
        role_name
        for role_name in PharmacyRole.ALL
        if role_name in assigned_role_names
    ]

    # An authenticated account without an assigned pharmacy group receives the
    # least-privileged role until a manager assigns its operational role.
    return assigned_roles or [PharmacyRole.READ_ONLY]


def assign_role(user, role_name):
    if role_name not in PharmacyRole.ALL:
        raise ValueError(f"Unknown pharmacy role: {role_name}")

    pharmacy_groups = Group.objects.filter(name__in=PharmacyRole.ALL)
    user.groups.remove(*pharmacy_groups)
    role_group, _ = Group.objects.get_or_create(name=role_name)
    user.groups.add(role_group)


def user_access_payload(user):
    roles = get_user_roles(user)
    primary_role = roles[0] if roles else PharmacyRole.READ_ONLY

    return {
        "id": user.pk,
        "username": user.get_username(),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "display_name": user.get_full_name() or user.get_username(),
        "roles": roles,
        "primary_role": primary_role,
    }
