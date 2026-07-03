import zipfile
from datetime import date, time

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.blister.models import CycleFrequency, CycleStatus, DosetteCycle
from apps.catalogue.models import CatalogueProduct, Medication, MedicationForm
from apps.inventory.models import StockBatch, StockItem
from apps.patients.models import Patient
from apps.tenancy.models import Group, Membership, Pharmacy, Role

from ..models import BackupRun, BackupRunStatus, BackupSchedule
from ..services import backup_root

PASSWORD = "Initial-pass-123!"


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture(autouse=True)
def isolated_backup_root(settings, tmp_path):
    settings.BACKUP_ROOT = tmp_path / "backups"


def make_user(email: str) -> User:
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        full_name=email.split("@")[0],
    )


def add_membership(user, role, *, group=None, pharmacy=None, pharmacies=()):
    membership = Membership.objects.create(
        user=user,
        role=role,
        group=group,
        pharmacy=pharmacy,
    )
    if pharmacies:
        membership.pharmacies.add(*pharmacies)
    return membership


def authenticate(client, user):
    client.force_login(user)


@pytest.fixture
def backup_api_data():
    group_one = Group.objects.create(name="Group One", slug="backup-group-one")
    group_two = Group.objects.create(name="Group Two", slug="backup-group-two")
    pharmacy_one = Pharmacy.objects.create(
        group=group_one,
        name="Pharmacy One",
        code="P1",
    )
    pharmacy_two = Pharmacy.objects.create(
        group=group_two,
        name="Other Pharmacy",
        code="OP",
    )
    product = CatalogueProduct.objects.create(
        dmd_code="BACKUP-PAR-500",
        source="SEED",
        display_name="Paracetamol 500mg tablets",
        ingredient="Paracetamol",
        strength="500mg",
        dose_form="tablets",
        pack_size=32,
    )
    medication = Medication.objects.create(
        group=group_one,
        catalogue_product=product,
        name="Paracetamol",
        form=MedicationForm.TABLET,
        strength="500 mg",
    )
    other_medication = Medication.objects.create(
        group=group_two,
        catalogue_product=product,
        name="Paracetamol",
        form=MedicationForm.TABLET,
        strength="500 mg",
    )
    stock_item = StockItem.objects.create(
        pharmacy=pharmacy_one,
        medication=medication,
        reorder_level=10,
    )
    StockBatch.objects.create(
        stock_item=stock_item,
        batch_number="P1-PAR-001",
        expiry_date=date(2027, 1, 31),
        quantity=100,
        quantity_received=100,
        received_at=date(2026, 6, 1),
    )
    StockItem.objects.create(
        pharmacy=pharmacy_two,
        medication=other_medication,
        reorder_level=10,
    )
    patient = Patient.objects.create(
        pharmacy=pharmacy_one,
        patient_reference="P1-001",
        first_name="Fictional",
        last_name="Patient",
        date_of_birth=date(1980, 1, 1),
        address="1 Example Street",
        postcode="AA1 1AA",
        phone="020 0000 0000",
        notes="Fictional local demo patient.",
    )
    DosetteCycle.objects.create(
        patient=patient,
        reference="MDS-001",
        frequency=CycleFrequency.WEEKLY,
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 7),
        status=CycleStatus.PREPARED,
    )

    admin = make_user("backup-admin@example.com")
    pharmacist = make_user("backup-pharmacist@example.com")
    dispenser = make_user("backup-dispenser@example.com")

    add_membership(admin, Role.ADMIN)
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy_one)
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy_one)

    return {
        "group_one": group_one,
        "group_two": group_two,
        "pharmacy_one": pharmacy_one,
        "patient": patient,
        "admin": admin,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
    }


@pytest.mark.django_db
def test_pharmacist_can_update_backup_schedule(client, backup_api_data):
    authenticate(client, backup_api_data["pharmacist"])

    response = client.put(
        "/api/backups/schedule/",
        {"enabled": True, "daily_time": "03:15"},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["enabled"] is True
    assert response.json()["daily_time"] == "03:15:00"
    schedule = BackupSchedule.objects.get(group=backup_api_data["group_one"])
    assert schedule.daily_time == time(hour=3, minute=15)
    assert schedule.retention_count == 3


@pytest.mark.django_db
def test_run_backup_now_creates_group_scoped_zip_without_secrets(
    client,
    backup_api_data,
):
    authenticate(client, backup_api_data["pharmacist"])

    response = client.post("/api/backups/runs/now/", {}, format="json")

    assert response.status_code == 201
    run = BackupRun.objects.get(pk=response.json()["id"])
    assert run.status == BackupRunStatus.SUCCESS
    archive_path = backup_root() / run.file
    assert archive_path.exists()
    with zipfile.ZipFile(archive_path) as archive:
        names = set(archive.namelist())
        payload = archive.read("data.json").decode("utf-8")
    assert names == {"manifest.json", "data.json"}
    assert "BACKUP-PAR-500" in payload
    assert "backup-group-two" not in payload
    assert "password" not in payload.lower()
    assert "TRUD_API_KEY" not in payload


@pytest.mark.django_db
def test_retention_keeps_latest_three_backups(client, backup_api_data):
    authenticate(client, backup_api_data["pharmacist"])

    for _ in range(4):
        response = client.post("/api/backups/runs/now/", {}, format="json")
        assert response.status_code == 201

    runs = BackupRun.objects.filter(
        group=backup_api_data["group_one"],
        status=BackupRunStatus.SUCCESS,
    )
    assert runs.count() == 3
    assert len(list((backup_root() / "backup-group-one").glob("*.zip"))) == 3


@pytest.mark.django_db
def test_restore_requires_confirmation(client, backup_api_data):
    authenticate(client, backup_api_data["admin"])
    backup_response = client.post(
        "/api/backups/runs/now/",
        {"group": backup_api_data["group_one"].id},
        format="json",
    )

    response = client.post(
        f"/api/backups/runs/{backup_response.json()['id']}/restore/",
        {"confirm": "restore"},
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {"confirm": "Type RESTORE to confirm this action."}


@pytest.mark.django_db
def test_non_admin_cannot_restore_backup(client, backup_api_data):
    authenticate(client, backup_api_data["pharmacist"])
    backup_response = client.post("/api/backups/runs/now/", {}, format="json")

    response = client.post(
        f"/api/backups/runs/{backup_response.json()['id']}/restore/",
        {"confirm": "RESTORE"},
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_restore_reinstates_group_scoped_records(client, backup_api_data):
    authenticate(client, backup_api_data["admin"])
    backup_response = client.post(
        "/api/backups/runs/now/",
        {"group": backup_api_data["group_one"].id},
        format="json",
    )
    backup_api_data["patient"].first_name = "Changed"
    backup_api_data["patient"].save(update_fields=["first_name", "last_name_index"])

    response = client.post(
        f"/api/backups/runs/{backup_response.json()['id']}/restore/",
        {"confirm": "RESTORE"},
        format="json",
    )

    assert response.status_code == 200
    backup_api_data["patient"].refresh_from_db()
    assert backup_api_data["patient"].first_name == "Fictional"
    assert BackupRun.objects.filter(
        group=backup_api_data["group_one"],
        trigger="PRE_RESTORE",
    ).exists()


@pytest.mark.django_db
def test_restore_does_not_overwrite_global_catalogue_product(
    client,
    backup_api_data,
):
    authenticate(client, backup_api_data["admin"])
    product = CatalogueProduct.objects.get(dmd_code="BACKUP-PAR-500")
    group_two_stock = StockItem.objects.get(
        pharmacy__group=backup_api_data["group_two"],
        medication__catalogue_product=product,
    )
    backup_response = client.post(
        "/api/backups/runs/now/",
        {"group": backup_api_data["group_one"].id},
        format="json",
    )
    backup_api_data["patient"].first_name = "Changed"
    backup_api_data["patient"].save(update_fields=["first_name", "last_name_index"])
    product.display_name = "Corrected global Paracetamol 500mg caplets"
    product.strength = "500mg corrected"
    product.save()

    response = client.post(
        f"/api/backups/runs/{backup_response.json()['id']}/restore/",
        {"confirm": "RESTORE"},
        format="json",
    )

    assert response.status_code == 200
    product.refresh_from_db()
    assert product.display_name == "Corrected global Paracetamol 500mg caplets"
    assert product.strength == "500mg corrected"
    backup_api_data["patient"].refresh_from_db()
    assert backup_api_data["patient"].first_name == "Fictional"
    assert StockItem.objects.filter(pk=group_two_stock.pk).exists()
    assert Medication.objects.filter(
        group=backup_api_data["group_two"],
        catalogue_product=product,
    ).exists()


@pytest.mark.django_db
def test_backup_list_is_group_scoped_for_pharmacist(client, backup_api_data):
    BackupRun.objects.create(
        group=backup_api_data["group_two"],
        status=BackupRunStatus.SUCCESS,
        file="other.zip",
    )
    authenticate(client, backup_api_data["pharmacist"])

    response = client.get("/api/backups/runs/")

    assert response.status_code == 200
    assert all(
        item["group"] == backup_api_data["group_one"].id for item in response.json()
    )


@pytest.mark.django_db
def test_dispenser_cannot_access_backup_schedule(client, backup_api_data):
    authenticate(client, backup_api_data["dispenser"])

    response = client.get("/api/backups/schedule/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_can_delete_backup(client, backup_api_data):
    authenticate(client, backup_api_data["admin"])
    created = client.post(
        "/api/backups/runs/now/",
        {"group": backup_api_data["group_one"].id},
        format="json",
    )
    run_id = created.json()["id"]
    archive_path = backup_root() / BackupRun.objects.get(pk=run_id).file
    assert archive_path.exists()

    response = client.delete(f"/api/backups/runs/{run_id}/")

    assert response.status_code == 204
    assert not BackupRun.objects.filter(pk=run_id).exists()
    assert not archive_path.exists()


@pytest.mark.django_db
def test_non_admin_cannot_delete_backup(client, backup_api_data):
    authenticate(client, backup_api_data["admin"])
    created = client.post(
        "/api/backups/runs/now/",
        {"group": backup_api_data["group_one"].id},
        format="json",
    )
    run_id = created.json()["id"]

    authenticate(client, backup_api_data["pharmacist"])
    response = client.delete(f"/api/backups/runs/{run_id}/")

    assert response.status_code == 403
    assert BackupRun.objects.filter(pk=run_id).exists()


@pytest.mark.django_db
def test_pharmacist_cannot_target_other_group_backup(client, backup_api_data):
    # A pharmacist is scoped to their own group; passing another group's id must
    # not surface that group's backups.
    BackupRun.objects.create(
        group=backup_api_data["group_two"],
        status=BackupRunStatus.SUCCESS,
        file="other.zip",
    )
    authenticate(client, backup_api_data["pharmacist"])

    response = client.get(f"/api/backups/runs/?group={backup_api_data['group_two'].id}")

    assert response.status_code == 200
    assert all(
        item["group"] == backup_api_data["group_one"].id for item in response.json()
    )
