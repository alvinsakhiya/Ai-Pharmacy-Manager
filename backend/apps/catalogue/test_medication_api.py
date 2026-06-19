import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditAction, AuditEvent
from apps.tenancy.models import Group, Membership, Pharmacy, Role
from apps.tenancy.permissions import ROLE_CAPABILITIES, Action

from .models import Medication, MedicationForm
from .selectors import effective_group_ids

PASSWORD = "Initial-pass-123!"


@pytest.fixture
def client():
    return APIClient()


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


@pytest.fixture
def catalogue_api_data():
    group_one = Group.objects.create(name="Group One", slug="catalogue-api-one")
    group_two = Group.objects.create(name="Group Two", slug="catalogue-api-two")
    pharmacy_one = Pharmacy.objects.create(
        group=group_one,
        name="Pharmacy One",
        code="P1",
    )
    pharmacy_two = Pharmacy.objects.create(
        group=group_two,
        name="Pharmacy Two",
        code="P2",
    )
    medication_one = Medication.objects.create(
        group=group_one,
        name="Paracetamol",
        form=MedicationForm.TABLET,
        strength="500 mg",
    )
    medication_two = Medication.objects.create(
        group=group_two,
        name="Ibuprofen",
        form=MedicationForm.TABLET,
        strength="200 mg",
    )

    admin = make_user("catalogue-admin@example.com")
    superintendent = make_user("catalogue-superintendent@example.com")
    stock_employee = make_user("catalogue-stock@example.com")
    pharmacist = make_user("catalogue-pharmacist@example.com")
    dispenser = make_user("catalogue-dispenser@example.com")

    add_membership(admin, Role.ADMIN)
    add_membership(superintendent, Role.SUPERINTENDENT, group=group_one)
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group_one,
        pharmacies=(pharmacy_one,),
    )
    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy_one)
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy_one)

    return {
        "group_one": group_one,
        "group_two": group_two,
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "medication_one": medication_one,
        "medication_two": medication_two,
        "admin": admin,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
        "pharmacist": pharmacist,
        "dispenser": dispenser,
    }


def authenticate(client, user):
    client.force_login(user)


def medication_payload(group: Group, **overrides):
    payload = {
        "group": group.id,
        "name": "Amlodipine",
        "form": MedicationForm.TABLET,
        "strength": "5 mg",
        "manufacturer": "",
        "notes": "",
        "is_active": True,
    }
    payload.update(overrides)
    return payload


def ids_from_response(response):
    return {item["id"] for item in response.json()}


@pytest.mark.django_db
@pytest.mark.parametrize(
    "actor_key",
    ["admin", "superintendent", "stock_employee", "pharmacist", "dispenser"],
)
def test_roles_with_medication_view_can_list(
    client,
    catalogue_api_data,
    actor_key,
):
    authenticate(client, catalogue_api_data[actor_key])

    response = client.get("/api/catalogue/medications/")

    assert response.status_code == 200
    assert catalogue_api_data["medication_one"].id in ids_from_response(response)


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["admin", "superintendent", "pharmacist"])
def test_manage_roles_can_create_medications(client, catalogue_api_data, actor_key):
    authenticate(client, catalogue_api_data[actor_key])

    response = client.post(
        "/api/catalogue/medications/",
        medication_payload(catalogue_api_data["group_one"]),
        format="json",
    )

    assert response.status_code == 201
    assert Medication.objects.filter(
        group=catalogue_api_data["group_one"],
        name="Amlodipine",
        form=MedicationForm.TABLET,
        strength="5 mg",
    ).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["admin", "superintendent", "pharmacist"])
def test_manage_roles_can_patch_medications(client, catalogue_api_data, actor_key):
    authenticate(client, catalogue_api_data[actor_key])
    medication = catalogue_api_data["medication_one"]

    response = client.patch(
        f"/api/catalogue/medications/{medication.id}/",
        {"manufacturer": "Updated Manufacturer"},
        format="json",
    )

    assert response.status_code == 200
    medication.refresh_from_db()
    assert medication.manufacturer == "Updated Manufacturer"


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["stock_employee", "dispenser"])
def test_non_manage_roles_cannot_create_medications(
    client,
    catalogue_api_data,
    actor_key,
):
    authenticate(client, catalogue_api_data[actor_key])

    response = client.post(
        "/api/catalogue/medications/",
        medication_payload(catalogue_api_data["group_one"]),
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("actor_key", ["stock_employee", "dispenser"])
def test_non_manage_roles_cannot_patch_medications(
    client,
    catalogue_api_data,
    actor_key,
):
    authenticate(client, catalogue_api_data[actor_key])
    medication = catalogue_api_data["medication_one"]

    response = client.patch(
        f"/api/catalogue/medications/{medication.id}/",
        {"manufacturer": "Denied"},
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize(
    "actor_key",
    ["superintendent", "stock_employee", "pharmacist", "dispenser"],
)
def test_users_only_see_medications_in_effective_groups(
    client,
    catalogue_api_data,
    actor_key,
):
    authenticate(client, catalogue_api_data[actor_key])

    response = client.get("/api/catalogue/medications/")

    assert response.status_code == 200
    assert ids_from_response(response) == {catalogue_api_data["medication_one"].id}
    assert catalogue_api_data["medication_two"].id not in ids_from_response(response)


@pytest.mark.django_db
def test_pharmacy_scoped_roles_derive_catalogue_group_from_pharmacy(
    catalogue_api_data,
):
    expected_group_ids = frozenset({catalogue_api_data["group_one"].id})

    assert effective_group_ids(catalogue_api_data["pharmacist"]) == expected_group_ids
    assert effective_group_ids(catalogue_api_data["dispenser"]) == expected_group_ids


@pytest.mark.django_db
def test_stock_employee_derives_catalogue_group_from_selected_pharmacies(
    catalogue_api_data,
):
    assert effective_group_ids(catalogue_api_data["stock_employee"]) == frozenset(
        {catalogue_api_data["group_one"].id}
    )


@pytest.mark.django_db
def test_admin_sees_all_medication_groups(client, catalogue_api_data):
    authenticate(client, catalogue_api_data["admin"])

    response = client.get("/api/catalogue/medications/")

    assert response.status_code == 200
    assert ids_from_response(response) == {
        catalogue_api_data["medication_one"].id,
        catalogue_api_data["medication_two"].id,
    }


@pytest.mark.django_db
def test_detail_access_to_out_of_scope_medication_returns_404(
    client,
    catalogue_api_data,
):
    authenticate(client, catalogue_api_data["pharmacist"])

    response = client.get(
        f"/api/catalogue/medications/{catalogue_api_data['medication_two'].id}/",
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_duplicate_medication_tuple_returns_clean_400(client, catalogue_api_data):
    authenticate(client, catalogue_api_data["admin"])
    medication = catalogue_api_data["medication_one"]

    response = client.post(
        "/api/catalogue/medications/",
        medication_payload(
            catalogue_api_data["group_one"],
            name=medication.name,
            form=medication.form,
            strength=medication.strength,
        ),
        format="json",
    )

    assert response.status_code == 400
    assert "non_field_errors" in response.json()


@pytest.mark.django_db
def test_create_with_group_outside_effective_scope_returns_400(
    client,
    catalogue_api_data,
):
    authenticate(client, catalogue_api_data["pharmacist"])

    response = client.post(
        "/api/catalogue/medications/",
        medication_payload(catalogue_api_data["group_two"]),
        format="json",
    )

    assert response.status_code == 400
    assert "group" in response.json()


@pytest.mark.django_db
def test_patch_to_group_outside_effective_scope_returns_400(
    client,
    catalogue_api_data,
):
    authenticate(client, catalogue_api_data["pharmacist"])
    medication = catalogue_api_data["medication_one"]

    response = client.patch(
        f"/api/catalogue/medications/{medication.id}/",
        {"group": catalogue_api_data["group_two"].id},
        format="json",
    )

    assert response.status_code == 400
    assert "group" in response.json()


@pytest.mark.django_db
def test_patch_to_out_of_scope_medication_still_returns_404(
    client,
    catalogue_api_data,
):
    authenticate(client, catalogue_api_data["pharmacist"])

    response = client.patch(
        f"/api/catalogue/medications/{catalogue_api_data['medication_two'].id}/",
        {"manufacturer": "Hidden"},
        format="json",
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_create_medication_writes_audit_event(client, catalogue_api_data):
    authenticate(client, catalogue_api_data["admin"])

    response = client.post(
        "/api/catalogue/medications/",
        medication_payload(catalogue_api_data["group_one"]),
        format="json",
    )

    assert response.status_code == 201
    event = AuditEvent.objects.get(action=AuditAction.MEDICATION_CREATED)
    assert event.metadata == {
        "group_id": catalogue_api_data["group_one"].id,
        "name": "Amlodipine",
        "form": MedicationForm.TABLET,
        "strength": "5 mg",
    }
    assert event.group == catalogue_api_data["group_one"]


@pytest.mark.django_db
def test_update_medication_writes_audit_event(client, catalogue_api_data):
    authenticate(client, catalogue_api_data["admin"])
    medication = catalogue_api_data["medication_one"]

    response = client.patch(
        f"/api/catalogue/medications/{medication.id}/",
        {"name": "Paracetamol Caplets"},
        format="json",
    )

    assert response.status_code == 200
    event = AuditEvent.objects.get(action=AuditAction.MEDICATION_UPDATED)
    assert event.metadata == {
        "group_id": catalogue_api_data["group_one"].id,
        "name": "Paracetamol Caplets",
        "form": MedicationForm.TABLET,
        "strength": "500 mg",
    }
    assert event.group == catalogue_api_data["group_one"]


@pytest.mark.django_db
def test_create_rolls_back_when_audit_recording_fails(
    client,
    catalogue_api_data,
    monkeypatch,
):
    authenticate(client, catalogue_api_data["admin"])

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.catalogue.views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.post(
            "/api/catalogue/medications/",
            medication_payload(catalogue_api_data["group_one"]),
            format="json",
        )

    assert not Medication.objects.filter(name="Amlodipine").exists()


@pytest.mark.django_db
def test_update_rolls_back_when_audit_recording_fails(
    client,
    catalogue_api_data,
    monkeypatch,
):
    authenticate(client, catalogue_api_data["admin"])
    medication = catalogue_api_data["medication_one"]

    def failing_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.catalogue.views.record", failing_record)

    with pytest.raises(RuntimeError, match="audit failed"):
        client.patch(
            f"/api/catalogue/medications/{medication.id}/",
            {"name": "Rollback Name"},
            format="json",
        )

    medication.refresh_from_db()
    assert medication.name == "Paracetamol"


@pytest.mark.django_db
def test_delete_medication_is_not_allowed(client, catalogue_api_data):
    authenticate(client, catalogue_api_data["admin"])

    response = client.delete(
        f"/api/catalogue/medications/{catalogue_api_data['medication_one'].id}/",
    )

    assert response.status_code == 405


def test_medication_manage_capabilities_do_not_leak_to_read_only_roles():
    assert Action.MEDICATION_MANAGE not in ROLE_CAPABILITIES[Role.STOCK_EMPLOYEE]
    assert Action.MEDICATION_MANAGE not in ROLE_CAPABILITIES[Role.DISPENSER]
