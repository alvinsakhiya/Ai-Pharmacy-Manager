from django.core.management.base import BaseCommand

from apps.backups.services import run_scheduled_backups


class Command(BaseCommand):
    help = "Run due local group backups. Safe to invoke from cron every few minutes."

    def handle(self, *args, **options) -> None:
        runs = run_scheduled_backups()
        if not runs:
            self.stdout.write("No scheduled backups due.")
            return
        self.stdout.write(
            self.style.SUCCESS(f"Created {len(runs)} scheduled backup(s).")
        )
        for run in runs:
            self.stdout.write(
                f"- group={run.group_id} run={run.id} status={run.status}"
            )
