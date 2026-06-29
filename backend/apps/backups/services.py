from __future__ import annotations

import hashlib
import json
import re
import zipfile
from datetime import time
from pathlib import Path
from typing import Any, cast

from django.apps import apps
from django.conf import settings
from django.core import serializers
from django.db import transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.blister.models import DosetteCycle, DosettePeriod, PatientMedication
from apps.catalogue.models import CatalogueProduct, Medication
from apps.inventory.models import StockBatch, StockItem, StockMovement
from apps.patients.models import Patient, PatientGp, PatientNote
from apps.reviews.models import ReviewRecord
from apps.tenancy.models import Group, Pharmacy

from .models import BackupRun, BackupRunStatus, BackupRunTrigger, BackupSchedule

BACKUP_ARCHIVE_VERSION = 1
DEFAULT_DAILY_TIME = time(hour=2)
SECRET_MARKERS = (
    "DJANGO_SECRET_KEY",
    "PATIENT_FIELD_KEY",
    "PATIENT_INDEX_KEY",
    "TRUD_API_KEY",
    "download/api/v1/keys/",
    "BEGIN PRIVATE KEY",
)
USER_REFERENCE_FIELDS = {
    "analytics.forecastrun": ("generated_by",),
    "analytics.transfersuggestion": ("generated_by",),
    "audit.auditevent": ("actor",),
    "blister.dosettecycle": ("prepared_by", "checked_by"),
    "blister.dosetteperiod": ("submitted_by", "collected_by"),
    "inventory.stockmovement": ("actor",),
    "patients.patientnote": ("author",),
    "reviews.reviewrecord": ("assigned_to",),
}
RESTORE_SKIP_MODELS = frozenset({"catalogue.catalogueproduct"})


class BackupError(Exception):
    pass


class RestoreConfirmationError(BackupError):
    pass


def backup_root() -> Path:
    configured = getattr(settings, "BACKUP_ROOT", None)
    root = (
        Path(configured)
        if configured
        else Path(settings.BASE_DIR) / "media" / "backups"
    )
    root.mkdir(parents=True, exist_ok=True)
    return root


def get_or_create_schedule(group: Group, *, actor=None) -> BackupSchedule:
    schedule, created = BackupSchedule.objects.get_or_create(
        group=group,
        defaults={
            "daily_time": DEFAULT_DAILY_TIME,
            "created_by": actor if getattr(actor, "is_authenticated", False) else None,
            "updated_by": actor if getattr(actor, "is_authenticated", False) else None,
        },
    )
    if created:
        return schedule
    return schedule


def create_backup(
    *,
    group: Group,
    actor=None,
    trigger: str = cast(str, BackupRunTrigger.MANUAL),
    enforce_retention: bool = True,
) -> BackupRun:
    run = BackupRun.objects.create(
        group=group,
        status=BackupRunStatus.PENDING,
        trigger=trigger,
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
    )
    run.status = BackupRunStatus.RUNNING
    run.started_at = timezone.now()
    run.save(update_fields=["status", "started_at", "updated_at"])

    try:
        archive_path, archive_size, checksum = _write_backup_archive(group, run)
    except Exception as exc:
        run.status = BackupRunStatus.FAILED
        run.completed_at = timezone.now()
        run.error_message = _safe_error(exc)
        run.save(
            update_fields=[
                "status",
                "completed_at",
                "error_message",
                "updated_at",
            ]
        )
        raise

    run.status = BackupRunStatus.SUCCESS
    run.file = str(archive_path.relative_to(backup_root()))
    run.file_size = archive_size
    run.completed_at = timezone.now()
    run.checksum = checksum
    run.error_message = ""
    run.save(
        update_fields=[
            "status",
            "file",
            "file_size",
            "completed_at",
            "checksum",
            "error_message",
            "updated_at",
        ]
    )

    if enforce_retention:
        enforce_backup_retention(group)
    return run


def restore_backup(*, run: BackupRun, actor=None, confirm: str) -> BackupRun:
    if confirm != "RESTORE":
        raise RestoreConfirmationError("Type RESTORE to confirm this action.")
    if not run.file:
        raise BackupError("Selected backup has no archive file.")

    archive_path = backup_root() / run.file
    if not archive_path.exists():
        raise BackupError("Selected backup file is not available.")

    _read_manifest(archive_path, expected_group=run.group)
    create_backup(
        group=run.group,
        actor=actor,
        trigger=cast(str, BackupRunTrigger.PRE_RESTORE),
        enforce_retention=False,
    )

    data = _read_backup_data(archive_path)
    with transaction.atomic():
        _delete_group_scoped_data(run.group)
        for obj in serializers.deserialize("json", json.dumps(data["objects"])):
            if obj.object._meta.label_lower in RESTORE_SKIP_MODELS:
                continue
            obj.save()
        run.status = BackupRunStatus.RESTORED
        run.completed_at = timezone.now()
        run.save(update_fields=["status", "completed_at", "updated_at"])

    enforce_backup_retention(run.group)
    return run


def delete_backup(run: BackupRun) -> None:
    if run.file:
        archive_path = backup_root() / run.file
        if archive_path.exists():
            archive_path.unlink()
    run.delete()


def enforce_backup_retention(group: Group) -> None:
    schedule = BackupSchedule.objects.filter(group=group).first()
    retention_count = schedule.retention_count if schedule else 3
    retention_count = max(retention_count, 1)
    kept_statuses = [BackupRunStatus.SUCCESS, BackupRunStatus.RESTORED]
    runs = list(
        BackupRun.objects.filter(group=group, status__in=kept_statuses)
        .exclude(file="")
        .order_by("-completed_at", "-id")
    )
    for old_run in runs[retention_count:]:
        delete_backup(old_run)


def run_scheduled_backups(*, now=None) -> list[BackupRun]:
    current = now or timezone.localtime()
    today = current.date()
    created_runs = []
    schedules = BackupSchedule.objects.select_related("group").filter(enabled=True)
    for schedule in schedules:
        if current.time() < schedule.daily_time:
            continue
        already_ran = BackupRun.objects.filter(
            group=schedule.group,
            trigger=BackupRunTrigger.SCHEDULED,
            started_at__date=today,
            status__in=[
                BackupRunStatus.RUNNING,
                BackupRunStatus.SUCCESS,
                BackupRunStatus.RESTORED,
            ],
        ).exists()
        if already_ran:
            continue
        created_runs.append(
            create_backup(
                group=schedule.group,
                trigger=cast(str, BackupRunTrigger.SCHEDULED),
            )
        )
    return created_runs


def _write_backup_archive(group: Group, run: BackupRun) -> tuple[Path, int, str]:
    manifest = _build_manifest(group, run)
    data = {
        "version": BACKUP_ARCHIVE_VERSION,
        "group": {"id": group.id, "slug": group.slug, "name": group.name},
        "objects": _serialized_group_objects(group),
    }
    _assert_no_secret_markers(manifest)
    _assert_no_secret_markers(data)

    group_dir = backup_root() / _safe_slug(group.slug)
    group_dir.mkdir(parents=True, exist_ok=True)
    timestamp = timezone.now().strftime("%Y%m%d%H%M%S")
    archive_path = group_dir / f"group-{group.id}-{timestamp}-{run.id}.zip"

    with zipfile.ZipFile(
        archive_path,
        mode="w",
        compression=zipfile.ZIP_DEFLATED,
    ) as archive:
        archive.writestr(
            "manifest.json", json.dumps(manifest, indent=2, sort_keys=True)
        )
        archive.writestr("data.json", json.dumps(data, separators=(",", ":")))

    checksum = _sha256_file(archive_path)
    return archive_path, archive_path.stat().st_size, checksum


def _build_manifest(group: Group, run: BackupRun) -> dict[str, Any]:
    return {
        "version": BACKUP_ARCHIVE_VERSION,
        "created_at": timezone.now().isoformat(),
        "run_id": run.id,
        "trigger": run.trigger,
        "group": {"id": group.id, "slug": group.slug, "name": group.name},
        "excludes": [
            "environment variables",
            "API keys",
            "TRUD keys",
            "password hashes",
            "sessions",
            "cache files",
            "uploaded design assets",
        ],
    }


def _read_manifest(archive_path: Path, *, expected_group: Group) -> dict[str, Any]:
    with zipfile.ZipFile(archive_path) as archive:
        manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
    group = manifest.get("group", {})
    if group.get("id") != expected_group.id or group.get("slug") != expected_group.slug:
        raise BackupError("Backup does not match this group.")
    return manifest


def _read_backup_data(archive_path: Path) -> dict[str, Any]:
    with zipfile.ZipFile(archive_path) as archive:
        return json.loads(archive.read("data.json").decode("utf-8"))


def _serialized_group_objects(group: Group) -> list[dict[str, Any]]:
    objects: list[dict[str, Any]] = []
    pharmacy_ids = list(
        Pharmacy.objects.filter(group=group).values_list("id", flat=True)
    )
    patient_ids = list(
        Patient.objects.filter(pharmacy_id__in=pharmacy_ids).values_list(
            "id", flat=True
        )
    )
    catalogue_product_ids = list(
        Medication.objects.filter(group=group, catalogue_product__isnull=False)
        .values_list("catalogue_product_id", flat=True)
        .distinct()
    )
    stock_item_ids = list(
        StockItem.objects.filter(pharmacy_id__in=pharmacy_ids).values_list(
            "id", flat=True
        )
    )
    forecast_run_ids = list(
        apps.get_model("analytics", "ForecastRun")
        .objects.filter(group=group)
        .values_list("id", flat=True)
    )

    querysets: tuple[QuerySet[Any], ...] = (
        Group.objects.filter(pk=group.pk),
        Pharmacy.objects.filter(group=group),
        CatalogueProduct.objects.filter(pk__in=catalogue_product_ids),
        Medication.objects.filter(group=group),
        Patient.objects.filter(pharmacy_id__in=pharmacy_ids),
        PatientGp.objects.filter(patient_id__in=patient_ids),
        PatientNote.objects.filter(patient_id__in=patient_ids),
        PatientMedication.objects.filter(patient_id__in=patient_ids),
        DosettePeriod.objects.filter(patient_id__in=patient_ids),
        DosetteCycle.objects.filter(patient_id__in=patient_ids),
        StockItem.objects.filter(pharmacy_id__in=pharmacy_ids),
        StockBatch.objects.filter(stock_item_id__in=stock_item_ids),
        StockMovement.objects.filter(stock_item_id__in=stock_item_ids),
        ReviewRecord.objects.filter(patient_id__in=patient_ids),
        apps.get_model("analytics", "ForecastRun").objects.filter(group=group),
        apps.get_model("analytics", "ForecastItem").objects.filter(
            run_id__in=forecast_run_ids
        ),
        apps.get_model("analytics", "TransferSuggestion").objects.filter(group=group),
        AuditEvent.objects.filter(Q(group=group) | Q(pharmacy_id__in=pharmacy_ids)),
    )
    for queryset in querysets:
        objects.extend(_json_objects(queryset.order_by("pk")))
    return objects


def _json_objects(queryset: QuerySet[Any]) -> list[dict[str, Any]]:
    rows = json.loads(serializers.serialize("json", queryset))
    for row in rows:
        for field in USER_REFERENCE_FIELDS.get(row["model"], ()):
            row["fields"][field] = None
    return rows


def _delete_group_scoped_data(group: Group) -> None:
    pharmacy_ids = list(
        Pharmacy.objects.filter(group=group).values_list("id", flat=True)
    )
    patient_ids = list(
        Patient.objects.filter(pharmacy_id__in=pharmacy_ids).values_list(
            "id", flat=True
        )
    )
    stock_item_ids = list(
        StockItem.objects.filter(pharmacy_id__in=pharmacy_ids).values_list(
            "id", flat=True
        )
    )
    stock_batch_ids = list(
        StockBatch.objects.filter(stock_item_id__in=stock_item_ids).values_list(
            "id",
            flat=True,
        )
    )
    forecast_run_ids = list(
        apps.get_model("analytics", "ForecastRun")
        .objects.filter(group=group)
        .values_list("id", flat=True)
    )

    AuditEvent.objects.filter(Q(group=group) | Q(pharmacy_id__in=pharmacy_ids)).delete()
    apps.get_model("analytics", "ForecastItem").objects.filter(
        run_id__in=forecast_run_ids
    ).delete()
    apps.get_model("analytics", "TransferSuggestion").objects.filter(
        group=group
    ).delete()
    apps.get_model("analytics", "ForecastRun").objects.filter(group=group).delete()
    ReviewRecord.objects.filter(patient_id__in=patient_ids).delete()
    DosetteCycle.objects.filter(patient_id__in=patient_ids).delete()
    DosettePeriod.objects.filter(patient_id__in=patient_ids).delete()
    PatientMedication.objects.filter(patient_id__in=patient_ids).delete()
    PatientGp.objects.filter(patient_id__in=patient_ids).delete()
    PatientNote.objects.filter(patient_id__in=patient_ids).delete()
    StockMovement.objects.filter(
        Q(stock_item_id__in=stock_item_ids) | Q(batch_id__in=stock_batch_ids)
    ).delete()
    StockBatch.objects.filter(stock_item_id__in=stock_item_ids).delete()
    StockItem.objects.filter(pharmacy_id__in=pharmacy_ids).delete()
    Patient.objects.filter(pharmacy_id__in=pharmacy_ids).delete()
    Medication.objects.filter(group=group).delete()


def _assert_no_secret_markers(payload: Any) -> None:
    serialized = json.dumps(payload)
    for marker in SECRET_MARKERS:
        if marker in serialized:
            raise BackupError("Backup content included a blocked secret marker.")


def _safe_slug(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]+", "-", value).strip("-") or "group"


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_error(exc: Exception) -> str:
    return str(exc)[:300] or exc.__class__.__name__
