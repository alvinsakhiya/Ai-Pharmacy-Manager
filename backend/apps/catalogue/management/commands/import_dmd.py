import json
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.catalogue.models import CatalogueProduct, CatalogueProductSource

REQUIRED_FIELDS = ("dmd_code", "display_name", "dose_form")

# Optional free-text columns copied straight from the extract (trimmed).
TEXT_FIELDS = (
    "vmp_name",
    "amp_name",
    "ingredient",
    "strength",
    "dose_form",
    "pack_unit",
    "manufacturer",
    "appearance_colour",
    "appearance_shape",
    "appearance_form",
)


class Command(BaseCommand):
    help = (
        "Import canonical medication products from a dm+d (Dictionary of "
        "medicines and devices) JSON extract into the catalogue. Idempotent: "
        "each product is upserted on its dmd_code."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "path",
            help=(
                "Path to a dm+d JSON extract: a list of product records, or an "
                'object with a "products" list.'
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate and report without writing to the database.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        path = Path(options["path"])
        dry_run: bool = options["dry_run"]

        if not path.is_file():
            raise CommandError(f"dm+d extract not found: {path}")

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON in {path}: {exc}") from exc

        records = payload.get("products") if isinstance(payload, dict) else payload
        if not isinstance(records, list):
            raise CommandError(
                'dm+d extract must be a JSON list, or an object with a "products" list.'
            )

        created = 0
        updated = 0
        skipped: list[str] = []

        for index, raw in enumerate(records, start=1):
            defaults, error = self._normalise(raw)
            if defaults is None:
                skipped.append(f"record {index}: {error}")
                continue
            if dry_run:
                continue
            dmd_code = defaults.pop("dmd_code")
            _, was_created = CatalogueProduct.objects.update_or_create(
                dmd_code=dmd_code,
                defaults=defaults,
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self._report(created, updated, skipped, dry_run=dry_run, total=len(records))

    def _report(
        self,
        created: int,
        updated: int,
        skipped: list[str],
        *,
        dry_run: bool,
        total: int,
    ) -> None:
        for reason in skipped[:10]:
            self.stdout.write(self.style.WARNING(f"Skipped {reason}"))
        if len(skipped) > 10:
            remaining = len(skipped) - 10
            self.stdout.write(self.style.WARNING(f"...and {remaining} more skipped."))

        if dry_run:
            valid = total - len(skipped)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Dry run: {valid} valid, {len(skipped)} skipped "
                    "(no changes written)."
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                "dm+d import complete: "
                f"{created} created, {updated} updated, {len(skipped)} skipped."
            )
        )

    def _normalise(self, raw: Any) -> tuple[dict[str, Any] | None, str | None]:
        if not isinstance(raw, dict):
            return None, "not a JSON object"

        for field in REQUIRED_FIELDS:
            value = raw.get(field)
            if not isinstance(value, str) or not value.strip():
                return None, f"missing required field '{field}'"

        pack_size = raw.get("pack_size")
        if pack_size is not None:
            try:
                pack_size = int(pack_size)
            except (TypeError, ValueError):
                return None, "pack_size must be an integer or null"
            if pack_size < 0:
                return None, "pack_size must not be negative"

        defaults: dict[str, Any] = {
            "dmd_code": raw["dmd_code"].strip(),
            "source": CatalogueProductSource.DMD,
            "display_name": raw["display_name"].strip(),
            "pack_size": pack_size,
            "is_active": bool(raw.get("is_active", True)),
        }
        for field in TEXT_FIELDS:
            value = raw.get(field, "")
            defaults[field] = value.strip() if isinstance(value, str) else ""
        if not defaults["appearance_form"]:
            defaults["appearance_form"] = defaults["dose_form"]
        return defaults, None
