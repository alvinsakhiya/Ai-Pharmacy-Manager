from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.catalogue.trud_dmd import (
    DMD_PRODUCT_TYPES,
    DmdImportSummary,
    TrudDmdError,
    TrudDownloadError,
    download_trud_release,
    env_value,
    import_trud_dmd_zip,
    inspect_trud_dmd_zip,
)


class Command(BaseCommand):
    help = (
        "Import a TRUD dm+d reference release ZIP into the local catalogue. "
        "The import is idempotent and upserts catalogue rows by dm+d code."
    )

    def add_arguments(self, parser: Any) -> None:
        source = parser.add_mutually_exclusive_group(required=True)
        source.add_argument(
            "--file",
            dest="file_path",
            help="Path to a local TRUD dm+d reference release ZIP.",
        )
        source.add_argument(
            "--latest",
            action="store_true",
            help="Download the configured TRUD dm+d release before importing.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and compare without writing catalogue rows.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            help="Import at most this many parsed usable records.",
        )
        parser.add_argument(
            "--type",
            action="append",
            choices=DMD_PRODUCT_TYPES,
            dest="product_types",
            help="Limit import to one dm+d product type. May be repeated.",
        )
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Redownload the configured release even when the ZIP exists locally.",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Show sample invalid record reasons.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        dry_run: bool = options["dry_run"]
        verbose: bool = options["verbose"]
        try:
            path = self._resolve_zip_path(options)
            summary = import_trud_dmd_zip(
                path,
                dry_run=dry_run,
                limit=options["limit"],
                product_types=options["product_types"],
            )
        except (TrudDmdError, TrudDownloadError) as exc:
            raise CommandError(str(exc)) from exc

        self._report(summary, verbose=verbose)

    def _resolve_zip_path(self, options: dict[str, Any]) -> Path:
        file_path = options.get("file_path")
        if file_path:
            path = Path(file_path)
            inspection = inspect_trud_dmd_zip(path)
            self.stdout.write(
                "Using local TRUD reference release "
                f"{inspection.metadata.release_file or path.name}."
            )
            return path

        release_file = env_value("TRUD_DMD_RELEASE_FILE")
        item_id = env_value("TRUD_DMD_ITEM_ID")
        api_key = env_value("TRUD_API_KEY")
        download_dir = settings.BASE_DIR / "tmp" / "trud"
        path, downloaded = download_trud_release(
            api_key=api_key,
            item_id=item_id,
            release_file=release_file,
            download_dir=download_dir,
            overwrite=bool(options["overwrite"]),
        )
        action = "Downloaded" if downloaded else "Reusing local"
        self.stdout.write(f"{action} TRUD reference release {path.name}.")
        return path

    def _report(self, summary: DmdImportSummary, *, verbose: bool) -> None:
        metadata = summary.metadata
        version = metadata.release_version or "unknown"
        self.stdout.write(
            f"TRUD reference release: file={metadata.release_file}, version={version}"
        )
        if summary.product_types:
            parsed_types = ", ".join(sorted(summary.product_types))
            self.stdout.write(f"Parsed XML product types: {parsed_types}")
        if summary.product_files:
            files = ", ".join(
                f"{product_type}={Path(member).name}"
                for product_type, member in sorted(summary.product_files.items())
            )
            self.stdout.write(f"Recognised XML files: {files}")

        if verbose:
            for reason in summary.invalid_reasons:
                self.stdout.write(self.style.WARNING(f"Invalid {reason}"))

        prefix = "Dry run" if summary.dry_run else "Import complete"
        suffix = " (no changes written)" if summary.dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}: parsed={summary.parsed}, "
                f"created={summary.created}, updated={summary.updated}, "
                f"unchanged={summary.unchanged}, skipped={summary.skipped}, "
                f"invalid={summary.invalid}{suffix}."
            )
        )
