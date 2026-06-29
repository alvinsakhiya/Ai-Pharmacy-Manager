"""Explicitly reset fictional local/demo data and reseed it.

This command is destructive for the known ``@demo.local`` workspace only. It is
not invoked automatically and requires an exact confirmation token.
"""

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User
from apps.backups.models import BackupRun, BackupSchedule
from apps.backups.services import _delete_group_scoped_data, delete_backup
from apps.notifications.models import NotificationDismissal
from apps.tenancy.models import Group, Membership, Pharmacy

from .seed_demo import DEMO_EMAILS, GROUP_SLUG

CONFIRM_TOKEN = "RESET_DEMO_DATA"


class Command(BaseCommand):
    help = "Reset and reseed fictional local/demo data."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--confirm",
            default="",
            help=f"Required confirmation token: {CONFIRM_TOKEN}",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Allow reset_demo_data to run when DEBUG is false.",
        )

    def handle(self, *args, **options) -> None:
        if options["confirm"] != CONFIRM_TOKEN:
            raise CommandError(f"Pass --confirm {CONFIRM_TOKEN} to reset demo data.")
        if not settings.DEBUG and not options["force"]:
            raise CommandError("reset_demo_data is dev-only; pass --force to override.")

        with transaction.atomic():
            group = Group.objects.filter(slug=GROUP_SLUG).first()
            if group is not None:
                self._delete_demo_group(group)
            demo_users = User.objects.filter(email__in=DEMO_EMAILS)
            NotificationDismissal.objects.filter(user__in=demo_users).delete()
            Membership.objects.filter(user__in=demo_users).delete()
            demo_users.delete()

        call_command("seed_demo", force=options["force"])
        self.stdout.write(self.style.SUCCESS("Reset and reseeded local demo data."))

    def _delete_demo_group(self, group: Group) -> None:
        for run in BackupRun.objects.filter(group=group):
            delete_backup(run)
        BackupSchedule.objects.filter(group=group).delete()
        _delete_group_scoped_data(group)
        Membership.objects.filter(group=group).delete()
        Membership.objects.filter(pharmacy__group=group).delete()
        for membership in Membership.objects.filter(pharmacies__group=group).distinct():
            membership.pharmacies.remove(*Pharmacy.objects.filter(group=group))
        Pharmacy.objects.filter(group=group).delete()
        group.delete()
