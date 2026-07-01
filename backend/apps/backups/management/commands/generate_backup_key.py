from django.core.management.base import BaseCommand

from apps.backups import encryption


class Command(BaseCommand):
    help = "Print a fresh base64 key for BACKUP_ENCRYPTION_KEY (AES-256-GCM)."

    def handle(self, *args, **options) -> None:
        key = encryption.generate_key()
        self.stdout.write(key)
        self.stderr.write(
            "Store this as BACKUP_ENCRYPTION_KEY in your environment. "
            "Keep it secret and back it up separately from the archives; "
            "without it, encrypted backups cannot be restored."
        )
