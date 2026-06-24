import json

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from .models import CatalogueProduct, CatalogueProductSource

VALID_RECORD = {
    "dmd_code": "VMP-318272001",
    "vmp_name": "Amlodipine 5mg tablets",
    "amp_name": "Amlodipine 5mg tablets (Almus)",
    "display_name": "Amlodipine 5mg tablets",
    "ingredient": "Amlodipine",
    "strength": "5mg",
    "dose_form": "tablet",
    "pack_size": 28,
    "pack_unit": "",
    "manufacturer": "Almus",
}


def _write(tmp_path, payload) -> str:
    path = tmp_path / "dmd.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return str(path)


@pytest.mark.django_db
def test_import_dmd_creates_products(tmp_path):
    call_command("import_dmd", _write(tmp_path, [VALID_RECORD]))

    product = CatalogueProduct.objects.get(dmd_code="VMP-318272001")
    assert product.source == CatalogueProductSource.DMD
    assert product.display_name == "Amlodipine 5mg tablets"
    assert product.pack_size == 28
    # appearance_form falls back to dose_form when not supplied.
    assert product.appearance_form == "tablet"
    assert "amlodipine" in product.search_text


@pytest.mark.django_db
def test_import_dmd_is_idempotent_and_updates(tmp_path):
    call_command("import_dmd", _write(tmp_path, [VALID_RECORD]))

    updated = {**VALID_RECORD, "manufacturer": "Bristol Labs"}
    call_command("import_dmd", _write(tmp_path, {"products": [updated]}))

    assert CatalogueProduct.objects.filter(dmd_code="VMP-318272001").count() == 1
    product = CatalogueProduct.objects.get(dmd_code="VMP-318272001")
    assert product.manufacturer == "Bristol Labs"


@pytest.mark.django_db
def test_import_dmd_skips_invalid_records(tmp_path):
    payload = [
        VALID_RECORD,
        {"dmd_code": "X", "display_name": "No form"},  # missing dose_form
        {"vmp_name": "no code"},  # missing required fields
        "not-an-object",
    ]

    call_command("import_dmd", _write(tmp_path, payload))

    assert CatalogueProduct.objects.count() == 1


@pytest.mark.django_db
def test_import_dmd_dry_run_writes_nothing(tmp_path):
    call_command("import_dmd", _write(tmp_path, [VALID_RECORD]), "--dry-run")

    assert CatalogueProduct.objects.count() == 0


def test_import_dmd_missing_file_errors(tmp_path):
    with pytest.raises(CommandError):
        call_command("import_dmd", str(tmp_path / "missing.json"))
