from __future__ import annotations

import os
import re
import shutil
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections.abc import Iterator, Sequence
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path, PurePosixPath
from typing import Any
from xml.etree import ElementTree

from django.db import transaction
from django.utils import timezone

from .models import (
    CatalogueProduct,
    CatalogueProductDmdType,
    CatalogueProductSource,
)

DMD_PRODUCT_TYPES = ("VMP", "AMP", "VMPP", "AMPP")
PRODUCT_FILE_ORDER = ("VMP", "AMP", "VMPP", "AMPP")
CATALOGUE_TEXT_LIMITS = {
    "dmd_code": 64,
    "dmd_type": 8,
    "parent_dmd_code": 64,
    "vmp_name": 255,
    "amp_name": 255,
    "display_name": 255,
    "ingredient": 255,
    "strength": 64,
    "dose_form": 64,
    "pack_unit": 64,
    "manufacturer": 255,
    "release_version": 64,
    "release_file": 255,
}
CATALOGUE_UPDATE_FIELDS = [
    "source",
    "dmd_type",
    "parent_dmd_code",
    "vmp_name",
    "amp_name",
    "display_name",
    "ingredient",
    "strength",
    "dose_form",
    "pack_size",
    "pack_unit",
    "manufacturer",
    "release_version",
    "release_file",
    "is_active",
    "is_discontinued",
    "search_text",
]


class TrudDmdError(Exception):
    """Raised when a TRUD dm+d reference release cannot be imported safely."""


class TrudDownloadError(TrudDmdError):
    """Raised when a TRUD reference release cannot be downloaded."""


@dataclass(frozen=True)
class DmdReleaseMetadata:
    release_file: str
    release_version: str = ""


@dataclass(frozen=True)
class DmdZipInspection:
    metadata: DmdReleaseMetadata
    product_members: dict[str, str]
    lookup_member: str = ""


@dataclass(frozen=True)
class DmdProductRecord:
    dmd_code: str
    dmd_type: str
    display_name: str
    parent_dmd_code: str = ""
    vmp_name: str = ""
    amp_name: str = ""
    ingredient: str = ""
    strength: str = ""
    dose_form: str = ""
    pack_size: int | None = None
    pack_unit: str = ""
    manufacturer: str = ""
    is_active: bool = True
    is_discontinued: bool = False


@dataclass(frozen=True)
class ParsedDmdItem:
    product_type: str
    record: DmdProductRecord | None
    error: str = ""


@dataclass(frozen=True)
class PackDetails:
    pack_size: int | None = None
    pack_unit: str = ""


@dataclass
class DmdImportSummary:
    metadata: DmdReleaseMetadata
    dry_run: bool
    parsed: int = 0
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    skipped: int = 0
    invalid: int = 0
    product_types: set[str] = field(default_factory=set)
    product_files: dict[str, str] = field(default_factory=dict)
    invalid_reasons: list[str] = field(default_factory=list)


def download_trud_release(
    *,
    api_key: str,
    item_id: str,
    release_file: str,
    download_dir: Path,
    overwrite: bool = False,
    timeout: int = 60,
) -> tuple[Path, bool]:
    if not api_key.strip():
        raise TrudDownloadError("Missing TRUD_API_KEY for TRUD reference download.")
    if not item_id.strip():
        raise TrudDownloadError("Missing TRUD_DMD_ITEM_ID for TRUD reference download.")
    if not release_file.strip():
        raise TrudDownloadError(
            "Missing TRUD_DMD_RELEASE_FILE for TRUD reference download."
        )

    download_dir.mkdir(parents=True, exist_ok=True)
    target = download_dir / release_file
    if target.exists() and not overwrite:
        validate_zip_file(target)
        return target, False

    url = _download_url(
        api_key=api_key,
        item_id=item_id,
        release_file=release_file,
    )
    tmp_path = target.with_suffix(f"{target.suffix}.download")
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "ai-pharmacy-manager-trud-reference-import/1.0"},
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status = getattr(response, "status", response.getcode())
            if status != 200:
                raise TrudDownloadError(
                    "TRUD reference release download failed with "
                    f"HTTP {status} for item {item_id} and file {release_file}."
                )
            with tmp_path.open("wb") as output:
                shutil.copyfileobj(response, output)
    except urllib.error.HTTPError as exc:
        if tmp_path.exists():
            tmp_path.unlink()
        raise TrudDownloadError(
            "TRUD reference release download failed with "
            f"HTTP {exc.code} for item {item_id} and file {release_file}."
        ) from None
    except urllib.error.URLError:
        if tmp_path.exists():
            tmp_path.unlink()
        raise TrudDownloadError(
            "TRUD reference release download failed for "
            f"item {item_id} and file {release_file}."
        ) from None

    try:
        validate_zip_file(tmp_path)
    except TrudDmdError:
        if tmp_path.exists():
            tmp_path.unlink()
        raise

    tmp_path.replace(target)
    return target, True


def validate_zip_file(path: Path) -> None:
    if not path.is_file():
        raise TrudDmdError(f"TRUD reference release file not found: {path}")
    if not zipfile.is_zipfile(path):
        raise TrudDmdError(f"TRUD reference release is not a valid ZIP file: {path}")


def inspect_trud_dmd_zip(path: Path) -> DmdZipInspection:
    validate_zip_file(path)
    try:
        with zipfile.ZipFile(path) as archive:
            return _inspect_archive(archive, path.name)
    except zipfile.BadZipFile as exc:
        raise TrudDmdError(
            f"TRUD reference release is not a valid ZIP file: {path}"
        ) from exc


def import_trud_dmd_zip(
    path: Path,
    *,
    dry_run: bool,
    limit: int | None = None,
    product_types: Sequence[str] | None = None,
    batch_size: int = 1000,
) -> DmdImportSummary:
    if limit is not None and limit < 1:
        raise TrudDmdError("--limit must be greater than zero.")

    validate_zip_file(path)
    selected_types = _normalise_product_types(product_types)
    try:
        with zipfile.ZipFile(path) as archive:
            inspection = _inspect_archive(archive, path.name)
            missing_types = [
                product_type
                for product_type in selected_types
                if product_type not in inspection.product_members
            ]
            if missing_types:
                missing = ", ".join(missing_types)
                raise TrudDmdError(
                    f"TRUD reference release does not contain XML for: {missing}"
                )

            summary = DmdImportSummary(
                metadata=inspection.metadata,
                dry_run=dry_run,
                product_files=dict(inspection.product_members),
            )
            lookup = _parse_lookup_tables(archive, inspection.lookup_member)
            strengths_by_vpid: dict[str, str] = {}
            supplier_by_apid: dict[str, str] = {}
            pack_by_vppid: dict[str, PackDetails] = {}

            if "VMP" in selected_types and "VMP" in inspection.product_members:
                strengths_by_vpid = _parse_vmp_strengths(
                    archive,
                    inspection.product_members["VMP"],
                    lookup.units,
                )
            if "AMPP" in selected_types:
                if "AMP" in inspection.product_members:
                    supplier_by_apid = _parse_amp_suppliers(
                        archive,
                        inspection.product_members["AMP"],
                        lookup.suppliers,
                    )
                if "VMPP" in inspection.product_members:
                    pack_by_vppid = _parse_vmpp_packs(
                        archive,
                        inspection.product_members["VMPP"],
                        lookup.units,
                    )

            batch: list[DmdProductRecord] = []
            accepted = 0
            for item in _iter_product_items(
                archive,
                inspection.product_members,
                selected_types=selected_types,
                strengths_by_vpid=strengths_by_vpid,
                supplier_by_apid=supplier_by_apid,
                pack_by_vppid=pack_by_vppid,
                units=lookup.units,
                suppliers=lookup.suppliers,
            ):
                summary.parsed += 1
                summary.product_types.add(item.product_type)
                if item.record is None:
                    summary.invalid += 1
                    if len(summary.invalid_reasons) < 10:
                        summary.invalid_reasons.append(
                            f"{item.product_type}: {item.error}"
                        )
                    continue

                batch.append(item.record)
                accepted += 1
                if len(batch) >= batch_size:
                    _flush_batch(batch, summary, dry_run=dry_run)
                    batch.clear()
                if limit is not None and accepted >= limit:
                    break

            if batch:
                _flush_batch(batch, summary, dry_run=dry_run)
            return summary
    except zipfile.BadZipFile as exc:
        raise TrudDmdError(
            f"TRUD reference release is not a valid ZIP file: {path}"
        ) from exc


@dataclass(frozen=True)
class _LookupTables:
    units: dict[str, str] = field(default_factory=dict)
    suppliers: dict[str, str] = field(default_factory=dict)


def _download_url(*, api_key: str, item_id: str, release_file: str) -> str:
    path = "/".join(
        [
            "download",
            "api",
            "v1",
            "keys",
            urllib.parse.quote(api_key.strip(), safe=""),
            "content",
            "items",
            urllib.parse.quote(item_id.strip(), safe=""),
            urllib.parse.quote(release_file.strip(), safe=""),
        ]
    )
    return f"https://isd.digital.nhs.uk/{path}?consumer=webapp-releases-page"


def _normalise_product_types(product_types: Sequence[str] | None) -> tuple[str, ...]:
    if product_types is None:
        return DMD_PRODUCT_TYPES
    selected: list[str] = []
    for product_type in product_types:
        normalised = product_type.strip().upper()
        if normalised not in DMD_PRODUCT_TYPES:
            valid = ", ".join(DMD_PRODUCT_TYPES)
            raise TrudDmdError(f"Unsupported dm+d product type {product_type}: {valid}")
        if normalised not in selected:
            selected.append(normalised)
    return tuple(selected) if selected else DMD_PRODUCT_TYPES


def _inspect_archive(
    archive: zipfile.ZipFile,
    release_file: str,
) -> DmdZipInspection:
    product_members: dict[str, str] = {}
    lookup_member = ""
    for member in archive.namelist():
        _validate_zip_member(member)
        basename = PurePosixPath(member).name.lower()
        if not basename.endswith(".xml"):
            continue
        if basename.startswith("f_ampp"):
            product_members["AMPP"] = member
        elif basename.startswith("f_amp"):
            product_members["AMP"] = member
        elif basename.startswith("f_vmpp"):
            product_members["VMPP"] = member
        elif basename.startswith("f_vmp"):
            product_members["VMP"] = member
        elif basename.startswith("f_lookup"):
            lookup_member = member

    if not product_members:
        raise TrudDmdError(
            "No recognised dm+d product XML files were found in the TRUD "
            "reference release."
        )

    return DmdZipInspection(
        metadata=_release_metadata(release_file),
        product_members=product_members,
        lookup_member=lookup_member,
    )


def _validate_zip_member(member: str) -> None:
    path = PurePosixPath(member)
    if path.is_absolute() or ".." in path.parts:
        raise TrudDmdError(f"Unsafe path in TRUD reference ZIP member: {member}")


def _release_metadata(release_file: str) -> DmdReleaseMetadata:
    match = re.search(
        r"nhsbsa_dmd_(?P<version>[^_]+)_(?P<stamp>\d+)\.zip$", release_file
    )
    version = match.group("version") if match else ""
    return DmdReleaseMetadata(release_file=release_file, release_version=version)


def _parse_lookup_tables(
    archive: zipfile.ZipFile,
    member: str,
) -> _LookupTables:
    if not member:
        return _LookupTables()

    units: dict[str, str] = {}
    suppliers: dict[str, str] = {}
    stack: list[str] = []
    with archive.open(member) as source:
        for event, element in ElementTree.iterparse(source, events=("start", "end")):
            tag = _local_name(element.tag)
            if event == "start":
                stack.append(tag)
                continue

            if tag == "INFO" and len(stack) >= 2:
                table_name = stack[-2]
                code = _child_text(element, "CD")
                description = _child_text(element, "DESC")
                if code and description:
                    if table_name == "UNIT_OF_MEASURE":
                        units[code] = description
                    elif table_name == "SUPPLIER":
                        suppliers[code] = description
                element.clear()
            if stack:
                stack.pop()
    return _LookupTables(units=units, suppliers=suppliers)


def _parse_vmp_strengths(
    archive: zipfile.ZipFile,
    member: str,
    units: dict[str, str],
) -> dict[str, str]:
    by_vpid: dict[str, list[str]] = {}
    with archive.open(member) as source:
        for _event, element in ElementTree.iterparse(source, events=("end",)):
            if _local_name(element.tag) == "VPI":
                vpid = _child_text(element, "VPID")
                strength = _strength_label(element, units)
                if vpid and strength:
                    by_vpid.setdefault(vpid, [])
                    if strength not in by_vpid[vpid]:
                        by_vpid[vpid].append(strength)
                element.clear()
            elif _local_name(element.tag) == "VMP":
                element.clear()
    return {vpid: " / ".join(parts) for vpid, parts in by_vpid.items()}


def _parse_amp_suppliers(
    archive: zipfile.ZipFile,
    member: str,
    suppliers: dict[str, str],
) -> dict[str, str]:
    by_apid: dict[str, str] = {}
    with archive.open(member) as source:
        for _event, element in ElementTree.iterparse(source, events=("end",)):
            if _local_name(element.tag) == "AMP":
                apid = _child_text(element, "APID")
                supplier = suppliers.get(_child_text(element, "SUPPCD"), "")
                if apid and supplier:
                    by_apid[apid] = supplier
                element.clear()
    return by_apid


def _parse_vmpp_packs(
    archive: zipfile.ZipFile,
    member: str,
    units: dict[str, str],
) -> dict[str, PackDetails]:
    by_vppid: dict[str, PackDetails] = {}
    with archive.open(member) as source:
        for _event, element in ElementTree.iterparse(source, events=("end",)):
            if _local_name(element.tag) == "VMPP":
                vppid = _child_text(element, "VPPID")
                if vppid:
                    by_vppid[vppid] = _pack_details(element, units)
                element.clear()
    return by_vppid


def _iter_product_items(
    archive: zipfile.ZipFile,
    product_members: dict[str, str],
    *,
    selected_types: Sequence[str],
    strengths_by_vpid: dict[str, str],
    supplier_by_apid: dict[str, str],
    pack_by_vppid: dict[str, PackDetails],
    units: dict[str, str],
    suppliers: dict[str, str],
) -> Iterator[ParsedDmdItem]:
    for product_type in PRODUCT_FILE_ORDER:
        if product_type not in selected_types or product_type not in product_members:
            continue
        member = product_members[product_type]
        with archive.open(member) as source:
            for _event, element in ElementTree.iterparse(source, events=("end",)):
                tag = _local_name(element.tag)
                if tag != product_type:
                    if product_type == "VMP" and tag == "VPI":
                        element.clear()
                    continue
                yield _parse_product_item(
                    product_type,
                    element,
                    strengths_by_vpid=strengths_by_vpid,
                    supplier_by_apid=supplier_by_apid,
                    pack_by_vppid=pack_by_vppid,
                    units=units,
                    suppliers=suppliers,
                )
                element.clear()


def _parse_product_item(
    product_type: str,
    element: ElementTree.Element,
    *,
    strengths_by_vpid: dict[str, str],
    supplier_by_apid: dict[str, str],
    pack_by_vppid: dict[str, PackDetails],
    units: dict[str, str],
    suppliers: dict[str, str],
) -> ParsedDmdItem:
    if product_type == "VMP":
        record = _vmp_record(element, strengths_by_vpid)
    elif product_type == "AMP":
        record = _amp_record(element, suppliers)
    elif product_type == "VMPP":
        record = _vmpp_record(element, units)
    elif product_type == "AMPP":
        record = _ampp_record(element, supplier_by_apid, pack_by_vppid)
    else:
        return ParsedDmdItem(
            product_type=product_type, record=None, error="unknown type"
        )

    if record is None:
        return ParsedDmdItem(
            product_type=product_type,
            record=None,
            error="missing required code or display name",
        )
    return ParsedDmdItem(product_type=product_type, record=record)


def _vmp_record(
    element: ElementTree.Element,
    strengths_by_vpid: dict[str, str],
) -> DmdProductRecord | None:
    code = _child_text(element, "VPID")
    name = _child_text(element, "NM")
    if not code or not name:
        return None
    is_discontinued = _is_discontinued(element)
    return DmdProductRecord(
        dmd_code=code,
        dmd_type=str(CatalogueProductDmdType.VMP),
        display_name=name,
        parent_dmd_code=_child_text(element, "VTMID"),
        vmp_name=name,
        strength=strengths_by_vpid.get(code, ""),
        is_active=not is_discontinued,
        is_discontinued=is_discontinued,
    )


def _amp_record(
    element: ElementTree.Element,
    suppliers: dict[str, str],
) -> DmdProductRecord | None:
    code = _child_text(element, "APID")
    name = _child_text(element, "NM")
    display_name = _child_text(element, "DESC") or name
    if not code or not display_name:
        return None
    is_discontinued = _is_discontinued(element)
    return DmdProductRecord(
        dmd_code=code,
        dmd_type=str(CatalogueProductDmdType.AMP),
        display_name=display_name,
        parent_dmd_code=_child_text(element, "VPID"),
        amp_name=name or display_name,
        manufacturer=suppliers.get(_child_text(element, "SUPPCD"), ""),
        is_active=not is_discontinued,
        is_discontinued=is_discontinued,
    )


def _vmpp_record(
    element: ElementTree.Element,
    units: dict[str, str],
) -> DmdProductRecord | None:
    code = _child_text(element, "VPPID")
    name = _child_text(element, "NM")
    if not code or not name:
        return None
    pack = _pack_details(element, units)
    is_discontinued = _is_discontinued(element)
    return DmdProductRecord(
        dmd_code=code,
        dmd_type=str(CatalogueProductDmdType.VMPP),
        display_name=name,
        parent_dmd_code=_child_text(element, "VPID"),
        pack_size=pack.pack_size,
        pack_unit=pack.pack_unit,
        is_active=not is_discontinued,
        is_discontinued=is_discontinued,
    )


def _ampp_record(
    element: ElementTree.Element,
    supplier_by_apid: dict[str, str],
    pack_by_vppid: dict[str, PackDetails],
) -> DmdProductRecord | None:
    code = _child_text(element, "APPID")
    name = _child_text(element, "NM")
    if not code or not name:
        return None
    apid = _child_text(element, "APID")
    vppid = _child_text(element, "VPPID")
    pack = pack_by_vppid.get(vppid, PackDetails())
    is_discontinued = _is_discontinued(element)
    return DmdProductRecord(
        dmd_code=code,
        dmd_type=str(CatalogueProductDmdType.AMPP),
        display_name=name,
        parent_dmd_code=apid or vppid,
        amp_name=name,
        pack_size=pack.pack_size,
        pack_unit=pack.pack_unit,
        manufacturer=supplier_by_apid.get(apid, ""),
        is_active=not is_discontinued,
        is_discontinued=is_discontinued,
    )


def _pack_details(element: ElementTree.Element, units: dict[str, str]) -> PackDetails:
    return PackDetails(
        pack_size=_integer_quantity(_child_text(element, "QTYVAL")),
        pack_unit=units.get(_child_text(element, "QTY_UOMCD"), ""),
    )


def _is_discontinued(element: ElementTree.Element) -> bool:
    discontinued_code = _child_text(element, "DISCCD")
    discontinued_date = _child_text(element, "DISCDT")
    invalid = _child_text(element, "INVALID").upper()
    return (
        discontinued_code == "0001"
        or bool(discontinued_date)
        or invalid in {"1", "TRUE", "Y", "YES"}
    )


def _strength_label(
    element: ElementTree.Element,
    units: dict[str, str],
) -> str:
    numerator_value = _format_decimal(_child_text(element, "STRNT_NMRTR_VAL"))
    numerator_unit = units.get(_child_text(element, "STRNT_NMRTR_UOMCD"), "")
    if not numerator_value or not numerator_unit:
        return ""

    label = f"{numerator_value}{numerator_unit}"
    denominator_value = _format_decimal(_child_text(element, "STRNT_DNMTR_VAL"))
    denominator_unit = units.get(_child_text(element, "STRNT_DNMTR_UOMCD"), "")
    if denominator_value and denominator_unit:
        denominator = denominator_unit
        if denominator_value != "1":
            denominator = f"{denominator_value}{denominator_unit}"
        label = f"{label}/{denominator}"
    return label


def _integer_quantity(value: str) -> int | None:
    if not value:
        return None
    try:
        quantity = Decimal(value)
    except InvalidOperation:
        return None
    if quantity <= 0 or quantity != quantity.to_integral_value():
        return None
    return int(quantity)


def _format_decimal(value: str) -> str:
    if not value:
        return ""
    try:
        decimal_value = Decimal(value)
    except InvalidOperation:
        return value.strip()
    formatted = format(decimal_value.normalize(), "f")
    if "." in formatted:
        formatted = formatted.rstrip("0").rstrip(".")
    return formatted


def _flush_batch(
    records: Sequence[DmdProductRecord],
    summary: DmdImportSummary,
    *,
    dry_run: bool,
) -> None:
    codes = [record.dmd_code for record in records]
    existing_by_code: dict[str, CatalogueProduct] = {}
    for product in CatalogueProduct.objects.filter(dmd_code__in=codes).order_by("id"):
        existing_by_code.setdefault(product.dmd_code, product)
    creates: list[CatalogueProduct] = []
    updates: list[CatalogueProduct] = []
    now = timezone.now()

    for record in records:
        defaults = _catalogue_defaults(record, summary.metadata)
        existing = existing_by_code.get(record.dmd_code)
        if existing is None:
            summary.created += 1
            if not dry_run:
                product = CatalogueProduct(dmd_code=record.dmd_code, **defaults)
                product.search_text = product.build_search_text()
                product.created_at = now
                product.updated_at = now
                creates.append(product)
            continue

        changed = False
        for field_name, value in defaults.items():
            if getattr(existing, field_name) != value:
                setattr(existing, field_name, value)
                changed = True
        if changed:
            summary.updated += 1
            if not dry_run:
                existing.search_text = existing.build_search_text()
                existing.updated_at = now
                updates.append(existing)
        else:
            summary.unchanged += 1

    if dry_run:
        return

    with transaction.atomic():
        if creates:
            CatalogueProduct.objects.bulk_create(creates, batch_size=1000)
        if updates:
            CatalogueProduct.objects.bulk_update(
                updates,
                [*CATALOGUE_UPDATE_FIELDS, "updated_at"],
                batch_size=1000,
            )


def _catalogue_defaults(
    record: DmdProductRecord,
    metadata: DmdReleaseMetadata,
) -> dict[str, Any]:
    return {
        "source": CatalogueProductSource.TRUD_DMD,
        "dmd_type": _truncate(record.dmd_type, "dmd_type"),
        "parent_dmd_code": _truncate(record.parent_dmd_code, "parent_dmd_code"),
        "vmp_name": _truncate(record.vmp_name, "vmp_name"),
        "amp_name": _truncate(record.amp_name, "amp_name"),
        "display_name": _truncate(record.display_name, "display_name"),
        "ingredient": _truncate(record.ingredient, "ingredient"),
        "strength": _truncate(record.strength, "strength"),
        "dose_form": _truncate(record.dose_form, "dose_form"),
        "pack_size": record.pack_size,
        "pack_unit": _truncate(record.pack_unit, "pack_unit"),
        "manufacturer": _truncate(record.manufacturer, "manufacturer"),
        "release_version": _truncate(metadata.release_version, "release_version"),
        "release_file": _truncate(metadata.release_file, "release_file"),
        "is_active": record.is_active,
        "is_discontinued": record.is_discontinued,
    }


def _truncate(value: str, field_name: str) -> str:
    return value.strip()[: CATALOGUE_TEXT_LIMITS[field_name]]


def _child_text(element: ElementTree.Element, child_name: str) -> str:
    for child in element:
        if _local_name(child.tag) == child_name and child.text:
            return child.text.strip()
    return ""


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[1]
    return tag


def env_value(name: str) -> str:
    return os.getenv(name, "").strip()
