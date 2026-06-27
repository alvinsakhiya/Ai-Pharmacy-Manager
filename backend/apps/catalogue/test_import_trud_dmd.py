import io
import json
import urllib.error
import zipfile
from email.message import Message
from pathlib import Path

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from .models import CatalogueProduct, CatalogueProductSource
from .trud_dmd import TrudDownloadError, download_trud_release

RELEASE_FILE = "nhsbsa_dmd_6.3.0_20260622000001.zip"

LOOKUP_XML = """
<LOOKUP>
  <UNIT_OF_MEASURE>
    <INFO><CD>258684004</CD><DESC>mg</DESC></INFO>
    <INFO><CD>428673006</CD><DESC>tablet</DESC></INFO>
  </UNIT_OF_MEASURE>
  <SUPPLIER>
    <INFO><CD>SUPP1</CD><DESC>Example Pharma Ltd</DESC></INFO>
  </SUPPLIER>
</LOOKUP>
"""

VMP_XML = """
<DMD>
  <VMP>
    <VPID>VMP1</VPID>
    <VTMID>VTM1</VTMID>
    <NM>Amlodipine 5mg tablets</NM>
  </VMP>
  <VPI>
    <VPID>VMP1</VPID>
    <STRNT_NMRTR_VAL>5.0</STRNT_NMRTR_VAL>
    <STRNT_NMRTR_UOMCD>258684004</STRNT_NMRTR_UOMCD>
  </VPI>
</DMD>
"""

AMP_XML = """
<DMD>
  <AMP>
    <APID>AMP1</APID>
    <VPID>VMP1</VPID>
    <NM>Amlodipine 5mg tablets</NM>
    <DESC>Amlodipine 5mg tablets (Example Pharma Ltd)</DESC>
    <SUPPCD>SUPP1</SUPPCD>
  </AMP>
</DMD>
"""

VMPP_XML = """
<DMD>
  <VMPP>
    <VPPID>VMPP1</VPPID>
    <VPID>VMP1</VPID>
    <NM>Amlodipine 5mg tablets 28 tablet</NM>
    <QTYVAL>28.0</QTYVAL>
    <QTY_UOMCD>428673006</QTY_UOMCD>
  </VMPP>
</DMD>
"""

AMPP_XML = """
<DMD>
  <AMPP>
    <APPID>AMPP1</APPID>
    <VPPID>VMPP1</VPPID>
    <APID>AMP1</APID>
    <NM>Amlodipine 5mg tablets (Example Pharma Ltd) 28 tablet</NM>
  </AMPP>
</DMD>
"""


def _write_zip(tmp_path: Path, members: dict[str, str] | None = None) -> Path:
    path = tmp_path / RELEASE_FILE
    payload = members or {
        "f_lookup2_test.xml": LOOKUP_XML,
        "f_vmp2_test.xml": VMP_XML,
        "f_amp2_test.xml": AMP_XML,
        "f_vmpp2_test.xml": VMPP_XML,
        "f_ampp2_test.xml": AMPP_XML,
    }
    with zipfile.ZipFile(path, "w") as archive:
        for name, content in payload.items():
            archive.writestr(name, content)
    return path


def _zip_bytes() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("f_lookup2_test.xml", LOOKUP_XML)
        archive.writestr("f_vmp2_test.xml", VMP_XML)
        archive.writestr("f_amp2_test.xml", AMP_XML)
        archive.writestr("f_vmpp2_test.xml", VMPP_XML)
        archive.writestr("f_ampp2_test.xml", AMPP_XML)
    return buffer.getvalue()


@pytest.mark.django_db
def test_import_trud_dmd_local_zip_dry_run_writes_nothing(tmp_path):
    path = _write_zip(tmp_path)
    stdout = io.StringIO()

    call_command("import_trud_dmd", "--file", str(path), "--dry-run", stdout=stdout)

    assert CatalogueProduct.objects.count() == 0
    output = stdout.getvalue()
    assert "Dry run: parsed=4, created=4" in output
    assert "no changes written" in output


@pytest.mark.django_db
def test_import_trud_dmd_local_zip_imports_product_types(tmp_path):
    path = _write_zip(tmp_path)

    call_command("import_trud_dmd", "--file", str(path))

    assert CatalogueProduct.objects.count() == 4
    vmp = CatalogueProduct.objects.get(dmd_code="VMP1")
    assert vmp.source == CatalogueProductSource.TRUD_DMD
    assert vmp.dmd_type == "VMP"
    assert vmp.parent_dmd_code == "VTM1"
    assert vmp.strength == "5mg"
    assert vmp.dose_form == ""
    assert vmp.release_version == "6.3.0"
    assert vmp.release_file == RELEASE_FILE
    assert "vmp1" in vmp.search_text

    amp = CatalogueProduct.objects.get(dmd_code="AMP1")
    assert amp.dmd_type == "AMP"
    assert amp.parent_dmd_code == "VMP1"
    assert amp.manufacturer == "Example Pharma Ltd"

    vmpp = CatalogueProduct.objects.get(dmd_code="VMPP1")
    assert vmpp.dmd_type == "VMPP"
    assert vmpp.pack_size == 28
    assert vmpp.pack_unit == "tablet"

    ampp = CatalogueProduct.objects.get(dmd_code="AMPP1")
    assert ampp.dmd_type == "AMPP"
    assert ampp.parent_dmd_code == "AMP1"
    assert ampp.pack_size == 28
    assert ampp.pack_unit == "tablet"
    assert ampp.manufacturer == "Example Pharma Ltd"


@pytest.mark.django_db
def test_import_trud_dmd_repeated_import_upserts_without_duplicates(tmp_path):
    path = _write_zip(tmp_path)

    call_command("import_trud_dmd", "--file", str(path))
    stdout = io.StringIO()
    call_command("import_trud_dmd", "--file", str(path), stdout=stdout)

    assert CatalogueProduct.objects.count() == 4
    assert "unchanged=4" in stdout.getvalue()


def test_import_trud_dmd_invalid_zip_errors(tmp_path):
    path = tmp_path / "bad.zip"
    path.write_text("not a zip", encoding="utf-8")

    with pytest.raises(CommandError, match="valid ZIP"):
        call_command("import_trud_dmd", "--file", str(path), "--dry-run")


def test_import_trud_dmd_unknown_zip_structure_errors(tmp_path):
    path = _write_zip(tmp_path, {"f_lookup2_test.xml": LOOKUP_XML})

    with pytest.raises(CommandError, match="No recognised dm\\+d product XML"):
        call_command("import_trud_dmd", "--file", str(path), "--dry-run")


def test_import_trud_dmd_latest_requires_api_key(monkeypatch):
    monkeypatch.delenv("TRUD_API_KEY", raising=False)
    monkeypatch.setenv("TRUD_DMD_ITEM_ID", "24")
    monkeypatch.setenv("TRUD_DMD_RELEASE_FILE", RELEASE_FILE)

    with pytest.raises(CommandError) as exc:
        call_command("import_trud_dmd", "--latest", "--dry-run")

    message = str(exc.value)
    assert "TRUD_API_KEY" in message
    assert "download/api" not in message


@pytest.mark.django_db
def test_import_trud_dmd_latest_does_not_print_api_key(
    monkeypatch,
    settings,
    tmp_path,
):
    api_key = "placeholder"
    requested_urls: list[str] = []

    class FakeResponse(io.BytesIO):
        status = 200

        def getcode(self):
            return 200

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

    def fake_urlopen(request, timeout):
        requested_urls.append(request.full_url)
        return FakeResponse(_zip_bytes())

    monkeypatch.setenv("TRUD_API_KEY", api_key)
    monkeypatch.setenv("TRUD_DMD_ITEM_ID", "24")
    monkeypatch.setenv("TRUD_DMD_RELEASE_FILE", RELEASE_FILE)
    monkeypatch.setattr(settings, "BASE_DIR", tmp_path)
    monkeypatch.setattr("apps.catalogue.trud_dmd.urllib.request.urlopen", fake_urlopen)

    stdout = io.StringIO()
    call_command("import_trud_dmd", "--latest", "--dry-run", stdout=stdout)

    output = stdout.getvalue()
    assert api_key not in output
    assert "download/api" not in output
    assert requested_urls
    assert api_key in requested_urls[0]


def test_trud_download_error_does_not_include_api_key(monkeypatch, tmp_path):
    api_key = "placeholder"

    def fake_urlopen(request, timeout):
        raise urllib.error.HTTPError(
            request.full_url,
            403,
            "Forbidden",
            hdrs=Message(),
            fp=None,
        )

    monkeypatch.setattr("apps.catalogue.trud_dmd.urllib.request.urlopen", fake_urlopen)

    with pytest.raises(TrudDownloadError) as exc:
        download_trud_release(
            api_key=api_key,
            item_id="24",
            release_file=RELEASE_FILE,
            download_dir=tmp_path,
        )

    message = str(exc.value)
    assert api_key not in message
    assert "download/api" not in message


@pytest.mark.django_db
def test_import_trud_dmd_handles_missing_optional_xml_fields(tmp_path):
    path = _write_zip(
        tmp_path,
        {
            "f_amp2_test.xml": """
            <DMD>
              <AMP>
                <APID>AMP-OPTIONAL</APID>
                <VPID>VMP-OPTIONAL</VPID>
                <NM>Minimal product name</NM>
              </AMP>
            </DMD>
            """,
        },
    )

    call_command("import_trud_dmd", "--file", str(path), "--type", "AMP")

    product = CatalogueProduct.objects.get(dmd_code="AMP-OPTIONAL")
    assert product.display_name == "Minimal product name"
    assert product.manufacturer == ""
    assert product.parent_dmd_code == "VMP-OPTIONAL"


@pytest.mark.django_db
def test_import_trud_dmd_limit_keeps_safe_test_import_small(tmp_path):
    path = _write_zip(tmp_path)

    call_command("import_trud_dmd", "--file", str(path), "--limit", "1")

    assert CatalogueProduct.objects.count() == 1


@pytest.mark.django_db
def test_existing_json_dmd_import_still_works(tmp_path):
    path = tmp_path / "dmd.json"
    path.write_text(
        json.dumps(
            [
                {
                    "dmd_code": "JSON-VMP-1",
                    "display_name": "Aspirin 75mg tablets",
                    "dose_form": "tablet",
                }
            ]
        ),
        encoding="utf-8",
    )

    call_command("import_dmd", str(path))

    product = CatalogueProduct.objects.get(dmd_code="JSON-VMP-1")
    assert product.source == CatalogueProductSource.DMD
    assert product.display_name == "Aspirin 75mg tablets"
