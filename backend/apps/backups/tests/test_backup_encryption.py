import zipfile
from datetime import date

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalogue.models import CatalogueProduct, Medication, MedicationForm
from apps.inventory.models import StockBatch, StockItem
from apps.patients.models import Patient
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from .. import encryption, services
from ..models import BackupRun, BackupRunStatus

PASSWORD = "Initial-pass-123!"


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture(autouse=True)
def isolated_backup_root(settings, tmp_path):
    settings.BACKUP_ROOT = tmp_path / "backups"


@pytest.fixture
def backup_key(settings):
    key = encryption.generate_key()
    settings.BACKUP_ENCRYPTION_KEY = key
    settings.BACKUP_ENCRYPTION_REQUIRED = False
    return key


@pytest.fixture
def enc_data():
    group = Group.objects.create(name="Enc Group", slug="enc-group")
    pharmacy = Pharmacy.objects.create(group=group, name="Enc Pharmacy", code="EP1")
    product = CatalogueProduct.objects.create(
        dmd_code="ENC-PAR-500",
        source="SEED",
        display_name="Paracetamol 500mg tablets",
        ingredient="Paracetamol",
        strength="500mg",
        dose_form="tablets",
        pack_size=32,
    )
    medication = Medication.objects.create(
        group=group,
        catalogue_product=product,
        name="Paracetamol",
        form=MedicationForm.TABLET,
        strength="500 mg",
    )
    stock_item = StockItem.objects.create(
        pharmacy=pharmacy,
        medication=medication,
        reorder_level=10,
    )
    StockBatch.objects.create(
        stock_item=stock_item,
        batch_number="EP1-PAR-001",
        expiry_date=date(2027, 1, 31),
        quantity=100,
        quantity_received=100,
        received_at=date(2026, 6, 1),
    )
    patient = Patient.objects.create(
        pharmacy=pharmacy,
        patient_reference="EP1-001",
        first_name="Fictional",
        last_name="Patient",
        date_of_birth=date(1980, 1, 1),
        address="1 Example Street",
        postcode="AA1 1AA",
        phone="020 0000 0000",
        notes="Fictional local demo patient.",
    )
    admin = User.objects.create_user(
        email="enc-admin@example.com",
        password=PASSWORD,
        full_name="Enc Admin",
    )
    Membership.objects.create(user=admin, role=Role.ADMIN)
    return {"group": group, "patient": patient, "admin": admin}


@pytest.mark.django_db
def test_encrypted_backup_is_not_a_readable_zip(client, enc_data, backup_key):
    run = services.create_backup(group=enc_data["group"], actor=enc_data["admin"])

    assert run.status == BackupRunStatus.SUCCESS
    assert run.encrypted is True
    archive_path = services.backup_root() / run.file
    assert archive_path.suffix == ".enc"
    assert archive_path.exists()

    blob = archive_path.read_bytes()
    assert encryption.is_encrypted_payload(blob) is True
    with pytest.raises(zipfile.BadZipFile):
        zipfile.ZipFile(archive_path)


@pytest.mark.django_db
def test_encrypted_manifest_records_encryption_and_excludes_secrets(
    client, enc_data, backup_key
):
    run = services.create_backup(group=enc_data["group"], actor=enc_data["admin"])
    archive_path = services.backup_root() / run.file

    manifest = services._read_manifest(archive_path, expected_group=enc_data["group"])
    assert manifest["encryption"]["enabled"] is True
    assert manifest["encryption"]["algorithm"] == "AES-256-GCM"
    assert manifest["content_checksum"]["algorithm"] == "sha256"
    assert manifest["content_checksum"]["value"]
    assert manifest["included_models"]
    assert "inventory.stockitem" in manifest["included_models"]

    payload = services._read_backup_data(archive_path)
    serialized = str(payload)
    assert "ENC-PAR-500" in serialized
    assert "password" not in serialized.lower()
    assert "TRUD_API_KEY" not in serialized


@pytest.mark.django_db
def test_restore_succeeds_with_correct_key(client, enc_data, backup_key):
    client.force_login(enc_data["admin"])
    created = client.post(
        "/api/backups/runs/now/",
        {"group": enc_data["group"].id},
        format="json",
    )
    assert created.status_code == 201
    assert created.json()["encrypted"] is True

    enc_data["patient"].first_name = "Changed"
    enc_data["patient"].save(update_fields=["first_name", "last_name_index"])

    response = client.post(
        f"/api/backups/runs/{created.json()['id']}/restore/",
        {"confirm": "RESTORE"},
        format="json",
    )

    assert response.status_code == 200
    enc_data["patient"].refresh_from_db()
    assert enc_data["patient"].first_name == "Fictional"
    assert BackupRun.objects.filter(
        group=enc_data["group"], trigger="PRE_RESTORE"
    ).exists()


@pytest.mark.django_db
def test_restore_fails_with_wrong_key_and_preserves_data(
    client, enc_data, backup_key, settings
):
    client.force_login(enc_data["admin"])
    created = client.post(
        "/api/backups/runs/now/",
        {"group": enc_data["group"].id},
        format="json",
    )
    assert created.status_code == 201

    enc_data["patient"].first_name = "Changed"
    enc_data["patient"].save(update_fields=["first_name", "last_name_index"])

    # Rotate the key so the archive can no longer be authenticated.
    settings.BACKUP_ENCRYPTION_KEY = encryption.generate_key()

    response = client.post(
        f"/api/backups/runs/{created.json()['id']}/restore/",
        {"confirm": "RESTORE"},
        format="json",
    )

    assert response.status_code == 400
    assert "backup" in response.json()
    # Nothing was deleted or restored: the changed record must still be present.
    enc_data["patient"].refresh_from_db()
    assert enc_data["patient"].first_name == "Changed"
    assert not BackupRun.objects.filter(
        group=enc_data["group"], trigger="PRE_RESTORE"
    ).exists()


@pytest.mark.django_db
def test_backup_refused_when_encryption_required_without_key(
    client, enc_data, settings
):
    settings.BACKUP_ENCRYPTION_KEY = ""
    settings.BACKUP_ENCRYPTION_REQUIRED = True
    client.force_login(enc_data["admin"])

    response = client.post(
        "/api/backups/runs/now/",
        {"group": enc_data["group"].id},
        format="json",
    )

    assert response.status_code == 400
    assert "backup" in response.json()
    assert not BackupRun.objects.filter(
        group=enc_data["group"], status=BackupRunStatus.SUCCESS
    ).exists()


@pytest.mark.django_db
def test_unencrypted_backup_still_works_without_key(client, enc_data, settings):
    settings.BACKUP_ENCRYPTION_KEY = ""
    settings.BACKUP_ENCRYPTION_REQUIRED = False

    run = services.create_backup(group=enc_data["group"], actor=enc_data["admin"])

    assert run.status == BackupRunStatus.SUCCESS
    assert run.encrypted is False
    archive_path = services.backup_root() / run.file
    assert archive_path.suffix == ".zip"
    with zipfile.ZipFile(archive_path) as archive:
        assert set(archive.namelist()) == {"manifest.json", "data.json"}


def test_truncated_encrypted_archive_is_rejected_cleanly(backup_key):
    # A file truncated to just the magic header (or a partial nonce) must raise a
    # clean BackupDecryptionError, not a bare ValueError from AES-GCM.
    for blob in (encryption.MAGIC, encryption.MAGIC + b"\x00" * 5):
        with pytest.raises(encryption.BackupDecryptionError):
            encryption.decrypt(blob)


@pytest.mark.django_db
def test_restore_rejects_corrupt_archive(client, enc_data, backup_key):
    client.force_login(enc_data["admin"])
    created = client.post(
        "/api/backups/runs/now/",
        {"group": enc_data["group"].id},
        format="json",
    )
    assert created.status_code == 201
    run = BackupRun.objects.get(pk=created.json()["id"])
    # Corrupt the archive on disk, keeping the magic header intact.
    (services.backup_root() / run.file).write_bytes(encryption.MAGIC + b"\x00\x00")

    response = client.post(
        f"/api/backups/runs/{run.id}/restore/",
        {"confirm": "RESTORE"},
        format="json",
    )

    assert response.status_code == 400
    assert "backup" in response.json()
    enc_data["patient"].refresh_from_db()
    assert enc_data["patient"].first_name == "Fictional"


@pytest.mark.django_db
def test_retention_prunes_encrypted_archives(client, enc_data, backup_key):
    client.force_login(enc_data["admin"])
    for _ in range(4):
        response = client.post(
            "/api/backups/runs/now/",
            {"group": enc_data["group"].id},
            format="json",
        )
        assert response.status_code == 201

    runs = BackupRun.objects.filter(
        group=enc_data["group"], status=BackupRunStatus.SUCCESS
    )
    assert runs.count() == 3
    enc_files = list((services.backup_root() / "enc-group").glob("*.zip.enc"))
    assert len(enc_files) == 3


def test_env_bool_treats_empty_value_as_default(monkeypatch):
    from config.settings.base import env_bool

    monkeypatch.setenv("AIPM_TEST_FLAG", "")
    assert env_bool("AIPM_TEST_FLAG", True) is True
    assert env_bool("AIPM_TEST_FLAG", False) is False
    monkeypatch.setenv("AIPM_TEST_FLAG", "true")
    assert env_bool("AIPM_TEST_FLAG", False) is True
    monkeypatch.delenv("AIPM_TEST_FLAG")
    assert env_bool("AIPM_TEST_FLAG", True) is True
