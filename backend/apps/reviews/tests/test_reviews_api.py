from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.audit.models import AuditAction, AuditEvent
from apps.blister.models import (
    CycleFrequency,
    CycleStatus,
    DosetteCycle,
    PatientMedication,
)
from apps.catalogue.models import Medication, MedicationForm
from apps.patients.models import Patient
from apps.reviews.models import ReviewPriority, ReviewRecord, ReviewStatus
from apps.tenancy.models import Group, Membership, Pharmacy, Role

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


def authenticate(client, user):
    client.force_login(user)


def make_patient(
    pharmacy: Pharmacy,
    reference: str,
    *,
    first_name: str = "PrivateFirst",
    last_name: str = "PrivateLast",
) -> Patient:
    return Patient.objects.create(
        pharmacy=pharmacy,
        patient_reference=reference,
        first_name=first_name,
        last_name=last_name,
        date_of_birth=date(1980, 1, 1),
        address=f"{reference} Private Address",
        postcode="TE1 1ST",
        phone="020 0000 1212",
        notes=f"{reference} patient private note",
    )


def make_cycle(patient: Patient, reference: str) -> DosetteCycle:
    return DosetteCycle.objects.create(
        patient=patient,
        reference=reference,
        frequency=CycleFrequency.WEEKLY,
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 7),
        status=CycleStatus.PREPARED,
    )


def make_review(patient: Patient, **overrides) -> ReviewRecord:
    data = {
        "patient": patient,
        "status": ReviewStatus.PENDING,
        "priority": ReviewPriority.ROUTINE,
        "notes": "Private review note",
    }
    data.update(overrides)
    return ReviewRecord.objects.create(**data)


@pytest.fixture
def review_data():
    group_one = Group.objects.create(name="Group One", slug="review-one")
    group_two = Group.objects.create(name="Group Two", slug="review-two")
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

    patient_one = make_patient(pharmacy_one, "P1-REVIEW-001")
    patient_two = make_patient(
        pharmacy_two,
        "P2-REVIEW-001",
        first_name="OtherFirst",
        last_name="OtherLast",
    )
    cycle_one = make_cycle(patient_one, "MDS-REVIEW-001")
    cycle_two = make_cycle(patient_two, "MDS-REVIEW-002")
    review_one = make_review(patient_one, dosette_cycle=cycle_one)
    review_two = make_review(patient_two, dosette_cycle=cycle_two)

    pharmacist = make_user("review-pharmacist@example.com")
    pharmacist_two = make_user("review-pharmacist-two@example.com")
    dispenser = make_user("review-dispenser@example.com")
    superintendent = make_user("review-superintendent@example.com")
    stock_employee = make_user("review-stock@example.com")
    admin = make_user("review-admin@example.com")
    assignee = make_user("review-assignee@example.com")

    add_membership(pharmacist, Role.PHARMACIST, pharmacy=pharmacy_one)
    add_membership(pharmacist_two, Role.PHARMACIST, pharmacy=pharmacy_two)
    add_membership(dispenser, Role.DISPENSER, pharmacy=pharmacy_one)
    add_membership(superintendent, Role.SUPERINTENDENT, group=group_one)
    add_membership(
        stock_employee,
        Role.STOCK_EMPLOYEE,
        group=group_one,
        pharmacies=(pharmacy_one,),
    )
    add_membership(admin, Role.ADMIN)

    medication = Medication.objects.create(
        group=group_one,
        name="Sensitive Dose Medication",
        form=MedicationForm.TABLET,
        strength="5 mg",
    )
    PatientMedication.objects.create(
        patient=patient_one,
        medication=medication,
        dose_instructions="Sensitive dose details",
        quantity_morning=1,
    )

    return {
        "group_one": group_one,
        "pharmacy_one": pharmacy_one,
        "pharmacy_two": pharmacy_two,
        "patient_one": patient_one,
        "patient_two": patient_two,
        "cycle_one": cycle_one,
        "cycle_two": cycle_two,
        "review_one": review_one,
        "review_two": review_two,
        "pharmacist": pharmacist,
        "pharmacist_two": pharmacist_two,
        "dispenser": dispenser,
        "superintendent": superintendent,
        "stock_employee": stock_employee,
        "admin": admin,
        "assignee": assignee,
    }


def list_url() -> str:
    return "/api/reviews/"


def detail_url(review: ReviewRecord) -> str:
    return f"/api/reviews/{review.id}/"


def complete_url(review: ReviewRecord) -> str:
    return f"/api/reviews/{review.id}/complete/"


def cancel_url(review: ReviewRecord) -> str:
    return f"/api/reviews/{review.id}/cancel/"


def create_payload(review_data, **overrides):
    payload = {
        "patient": review_data["patient_one"].id,
        "priority": ReviewPriority.ATTENTION,
        "due_date": "2026-07-15",
        "notes": "Review note content",
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
@pytest.mark.parametrize("role_key", ["pharmacist", "admin"])
def test_pharmacist_and_admin_can_manage_reviews(client, review_data, role_key):
    authenticate(client, review_data[role_key])

    create = client.post(list_url(), create_payload(review_data), format="json")
    assert create.status_code == 201
    review_id = create.json()["id"]

    detail = client.get(f"/api/reviews/{review_id}/")
    assert detail.status_code == 200

    patch = client.patch(
        f"/api/reviews/{review_id}/",
        {"priority": ReviewPriority.URGENT},
        format="json",
    )
    assert patch.status_code == 200
    assert patch.json()["priority"] == ReviewPriority.URGENT

    complete = client.post(f"/api/reviews/{review_id}/complete/")
    assert complete.status_code == 200
    assert complete.json()["status"] == ReviewStatus.COMPLETED

    cancel_candidate = make_review(review_data["patient_one"])
    cancel = client.post(cancel_url(cancel_candidate))
    assert cancel.status_code == 200
    assert cancel.json()["status"] == ReviewStatus.CANCELLED


@pytest.mark.django_db
def test_view_only_and_denied_roles(client, review_data):
    review = review_data["review_one"]

    authenticate(client, review_data["dispenser"])
    assert client.get(list_url()).status_code == 200
    assert client.get(detail_url(review)).status_code == 200
    assert (
        client.post(list_url(), create_payload(review_data), format="json").status_code
        == 403
    )
    assert (
        client.patch(
            detail_url(review), {"priority": ReviewPriority.URGENT}
        ).status_code
        == 403
    )
    assert client.post(complete_url(review)).status_code == 403
    assert client.post(cancel_url(review)).status_code == 403

    for key in ["superintendent", "stock_employee"]:
        client.logout()
        authenticate(client, review_data[key])
        assert client.get(list_url()).status_code == 403
        assert client.get(detail_url(review)).status_code == 403
        assert (
            client.post(
                list_url(), create_payload(review_data), format="json"
            ).status_code
            == 403
        )
        assert (
            client.patch(
                detail_url(review), {"priority": ReviewPriority.URGENT}
            ).status_code
            == 403
        )
        assert client.post(complete_url(review)).status_code == 403
        assert client.post(cancel_url(review)).status_code == 403


@pytest.mark.django_db
def test_tenant_scoping_hides_cross_tenant_reviews(client, review_data):
    authenticate(client, review_data["pharmacist"])

    list_response = client.get(list_url())
    assert list_response.status_code == 200
    ids = {item["id"] for item in list_response.json()}
    assert review_data["review_one"].id in ids
    assert review_data["review_two"].id not in ids

    assert client.get(detail_url(review_data["review_two"])).status_code == 404
    assert (
        client.patch(
            detail_url(review_data["review_two"]),
            {"priority": ReviewPriority.URGENT},
        ).status_code
        == 404
    )
    assert client.post(complete_url(review_data["review_two"])).status_code == 404
    assert client.post(cancel_url(review_data["review_two"])).status_code == 404


@pytest.mark.django_db
def test_create_review_validation(client, review_data):
    authenticate(client, review_data["pharmacist"])

    linked = client.post(
        list_url(),
        create_payload(review_data, dosette_cycle=review_data["cycle_one"].id),
        format="json",
    )
    mismatch = client.post(
        list_url(),
        create_payload(review_data, dosette_cycle=review_data["cycle_two"].id),
        format="json",
    )
    patient_out_of_scope = client.post(
        list_url(),
        create_payload(review_data, patient=review_data["patient_two"].id),
        format="json",
    )

    assert linked.status_code == 201
    assert linked.json()["cycle_reference"] == "MDS-REVIEW-001"
    assert mismatch.status_code == 400
    assert patient_out_of_scope.status_code == 400


@pytest.mark.django_db
def test_update_review_fields_status_and_terminal_protection(client, review_data):
    authenticate(client, review_data["pharmacist"])
    review = review_data["review_one"]

    response = client.patch(
        detail_url(review),
        {
            "priority": ReviewPriority.URGENT,
            "assigned_to": review_data["assignee"].id,
            "due_date": "2026-07-20",
            "notes": "Updated private review note",
            "status": ReviewStatus.IN_REVIEW,
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["priority"] == ReviewPriority.URGENT
    assert response.json()["assigned_to"] == review_data["assignee"].id
    assert response.json()["assigned_to_email"] == review_data["assignee"].email
    assert response.json()["status"] == ReviewStatus.IN_REVIEW
    assert response.json()["notes"] == "Updated private review note"

    review.refresh_from_db()
    review.status = ReviewStatus.COMPLETED
    review.save(update_fields=["status", "updated_at"])
    terminal = client.patch(detail_url(review), {"priority": ReviewPriority.ROUTINE})
    assert terminal.status_code == 400


@pytest.mark.django_db
def test_complete_and_cancel_transition_rules(client, review_data):
    authenticate(client, review_data["pharmacist"])
    pending_complete = make_review(review_data["patient_one"])
    in_review_complete = make_review(
        review_data["patient_one"],
        status=ReviewStatus.IN_REVIEW,
    )
    cancelled = make_review(
        review_data["patient_one"],
        status=ReviewStatus.CANCELLED,
    )

    response = client.post(complete_url(pending_complete))
    assert response.status_code == 200
    assert response.json()["status"] == ReviewStatus.COMPLETED
    assert response.json()["completed_at"] is not None

    response = client.post(complete_url(in_review_complete))
    assert response.status_code == 200
    assert response.json()["status"] == ReviewStatus.COMPLETED

    assert client.post(complete_url(cancelled)).status_code == 400
    assert client.post(complete_url(pending_complete)).status_code == 400

    pending_cancel = make_review(review_data["patient_one"])
    in_review_cancel = make_review(
        review_data["patient_one"],
        status=ReviewStatus.IN_REVIEW,
    )
    completed = make_review(
        review_data["patient_one"],
        status=ReviewStatus.COMPLETED,
    )

    assert (
        client.post(cancel_url(pending_cancel)).json()["status"]
        == ReviewStatus.CANCELLED
    )
    assert (
        client.post(cancel_url(in_review_cancel)).json()["status"]
        == ReviewStatus.CANCELLED
    )
    assert client.post(cancel_url(completed)).status_code == 400
    assert client.post(cancel_url(pending_cancel)).status_code == 400


@pytest.mark.django_db
def test_overdue_computation_and_filter(client, review_data):
    authenticate(client, review_data["pharmacist"])
    overdue = make_review(
        review_data["patient_one"],
        due_date=date.today() - timedelta(days=1),
    )
    future = make_review(
        review_data["patient_one"],
        due_date=date.today() + timedelta(days=1),
    )
    completed_overdue = make_review(
        review_data["patient_one"],
        status=ReviewStatus.COMPLETED,
        due_date=date.today() - timedelta(days=1),
    )

    assert client.get(detail_url(overdue)).json()["is_overdue"] is True
    assert client.get(detail_url(future)).json()["is_overdue"] is False
    assert client.get(detail_url(completed_overdue)).json()["is_overdue"] is False

    filtered = client.get(list_url(), {"overdue": "true"})
    ids = {item["id"] for item in filtered.json()}
    assert overdue.id in ids
    assert future.id not in ids
    assert completed_overdue.id not in ids


@pytest.mark.django_db
def test_audit_actions_metadata_and_rollback(client, review_data, monkeypatch):
    authenticate(client, review_data["pharmacist"])

    create = client.post(list_url(), create_payload(review_data), format="json")
    review_id = create.json()["id"]
    update = client.patch(
        f"/api/reviews/{review_id}/",
        {"priority": ReviewPriority.URGENT, "notes": "Private audit note"},
        format="json",
    )
    complete = client.post(f"/api/reviews/{review_id}/complete/")
    cancel_review = make_review(review_data["patient_one"])
    cancel = client.post(cancel_url(cancel_review))

    assert create.status_code == 201
    assert update.status_code == 200
    assert complete.status_code == 200
    assert cancel.status_code == 200
    for action in [
        AuditAction.REVIEW_CREATED,
        AuditAction.REVIEW_UPDATED,
        AuditAction.REVIEW_COMPLETED,
        AuditAction.REVIEW_CANCELLED,
    ]:
        assert AuditEvent.objects.filter(action=action).exists()

    event = AuditEvent.objects.get(action=AuditAction.REVIEW_UPDATED)
    assert event.metadata["changed_fields"] == ["notes", "priority"]
    assert "Private audit note" not in str(event.metadata)
    for forbidden in [
        "PrivateFirst",
        "PrivateLast",
        "date_of_birth",
        "phone",
        "diagnosis",
        "recommendation",
    ]:
        assert forbidden not in str(event.metadata)

    def fail_record(**kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("apps.reviews.views.record", fail_record)
    before_count = ReviewRecord.objects.count()
    with pytest.raises(RuntimeError):
        client.post(list_url(), create_payload(review_data), format="json")
    assert ReviewRecord.objects.count() == before_count


@pytest.mark.django_db
def test_serialized_payload_minimises_patient_data_and_no_clinical_fields(
    client,
    review_data,
):
    authenticate(client, review_data["pharmacist"])

    response = client.get(detail_url(review_data["review_one"]))

    assert response.status_code == 200
    payload = response.json()
    assert payload["patient"] == review_data["patient_one"].id
    assert payload["patient_reference"] == "P1-REVIEW-001"
    assert payload["cycle_reference"] == "MDS-REVIEW-001"
    assert payload["notes"] == "Private review note"

    payload_text = str(payload)
    for forbidden in [
        "diagnosis",
        "recommendation",
        "clinical_recommendation",
        "drug_interaction",
        "interaction",
        "clinical_decision",
        "nhs",
        "PrivateFirst",
        "PrivateLast",
        "1980",
        "Private Address",
        "020 0000 1212",
        "Sensitive dose details",
    ]:
        assert forbidden not in payload_text
