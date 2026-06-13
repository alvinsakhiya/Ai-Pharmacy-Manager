from django.conf import settings
from django.db import migrations


ROLE_NAMES = (
    "Manager",
    "Pharmacist",
    "Dispenser",
    "Stock Assistant",
    "Read-only User",
)


def create_roles_and_preserve_existing_access(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))

    groups = {
        role_name: Group.objects.get_or_create(name=role_name)[0]
        for role_name in ROLE_NAMES
    }

    manager_group = groups["Manager"]
    for user in User.objects.filter(is_active=True):
        user.groups.add(manager_group)


class Migration(migrations.Migration):
    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.RunPython(
            create_roles_and_preserve_existing_access,
            migrations.RunPython.noop,
        ),
    ]
