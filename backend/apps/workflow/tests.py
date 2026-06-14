"""Workflow board tests — board grouping, transitions, RBAC, issues, AI."""
from datetime import date, timedelta

import pytest

from apps.patients.models import Patient
from apps.workflow.models import JobStatus, WorkflowJob


@pytest.fixture
def patient(db):
    return Patient.objects.create(
        patient_id="PT-WF1", first_name="Joan", last_name="Carter",
        date_of_birth=date(1947, 2, 3), postcode="LE1 1AA", is_dosette=True,
    )


def make_job(patient, **kw):
    kw.setdefault("job_type", "dosette")
    kw.setdefault("status", JobStatus.NEW)
    kw.setdefault("priority", "normal")
    return WorkflowJob.objects.create(patient=patient, **kw)


# ---------------------------------------------------------------- board

@pytest.mark.django_db
def test_board_groups_jobs_by_status_and_hides_collected(auth, patient):
    make_job(patient, status=JobStatus.NEW)
    make_job(patient, status=JobStatus.PICKING_REQUIRED)
    make_job(patient, status=JobStatus.COLLECTED)
    res = auth("dispenser").get("/api/workflow-jobs/board/")
    assert res.status_code == 200
    cols = {c["status"]: c for c in res.data["columns"]}
    assert cols["new"]["count"] == 1
    assert cols["picking_required"]["count"] == 1
    # collected excluded from the board total by default
    assert res.data["total"] == 2
    assert cols["collected"]["count"] == 0
    assert "ai_summary" in res.data


@pytest.mark.django_db
def test_all_roles_can_view_board(auth, patient):
    make_job(patient)
    for role in ("dispenser", "pharmacist", "administrator"):
        assert auth(role).get("/api/workflow-jobs/board/").status_code == 200


# ---------------------------------------------------------------- transitions

@pytest.mark.django_db
def test_dispenser_can_start_and_mark_picked(auth, patient):
    job = make_job(patient, status=JobStatus.PICKING_REQUIRED)
    c = auth("dispenser")
    r1 = c.post(f"/api/workflow-jobs/{job.id}/transition/",
                {"to_status": "picking_in_progress"}, format="json")
    assert r1.status_code == 200
    r2 = c.post(f"/api/workflow-jobs/{job.id}/transition/",
                {"to_status": "picked"}, format="json")
    assert r2.status_code == 200
    job.refresh_from_db()
    assert job.status == JobStatus.PICKED


@pytest.mark.django_db
def test_accuracy_check_is_pharmacist_only(auth, patient):
    job = make_job(patient, status=JobStatus.ACCURACY_CHECK)
    # Dispenser may NOT sign off the accuracy check.
    denied = auth("dispenser").post(
        f"/api/workflow-jobs/{job.id}/transition/", {"to_status": "ready"}, format="json")
    assert denied.status_code == 403
    job.refresh_from_db()
    assert job.status == JobStatus.ACCURACY_CHECK
    # Pharmacist can.
    ok = auth("pharmacist").post(
        f"/api/workflow-jobs/{job.id}/transition/", {"to_status": "ready"}, format="json")
    assert ok.status_code == 200
    job.refresh_from_db()
    assert job.status == JobStatus.READY


@pytest.mark.django_db
def test_invalid_transition_rejected(auth, patient):
    job = make_job(patient, status=JobStatus.NEW)
    r = auth("administrator").post(
        f"/api/workflow-jobs/{job.id}/transition/", {"to_status": "ready"}, format="json")
    assert r.status_code == 400  # new -> ready is not a valid step


@pytest.mark.django_db
def test_admin_can_complete_full_pipeline(auth, patient):
    job = make_job(patient, status=JobStatus.NEW)
    c = auth("administrator")
    for to in ["picking_required", "picking_in_progress", "picked",
               "accuracy_check", "ready", "collected"]:
        r = c.post(f"/api/workflow-jobs/{job.id}/transition/", {"to_status": to}, format="json")
        assert r.status_code == 200, (to, r.data)
    job.refresh_from_db()
    assert job.status == JobStatus.COLLECTED


# ---------------------------------------------------------------- assign

@pytest.mark.django_db
def test_assign_is_admin_only(auth, users, patient):
    job = make_job(patient)
    disp = users["dispenser"]
    body = {"assigned_to": disp.id}
    assert auth("dispenser").post(f"/api/workflow-jobs/{job.id}/assign/", body, format="json").status_code == 403
    assert auth("pharmacist").post(f"/api/workflow-jobs/{job.id}/assign/", body, format="json").status_code == 403
    ok = auth("administrator").post(f"/api/workflow-jobs/{job.id}/assign/", body, format="json")
    assert ok.status_code == 200
    job.refresh_from_db()
    assert job.assigned_to_id == disp.id


# ---------------------------------------------------------------- issues

@pytest.mark.django_db
def test_dispenser_raises_issue_pharmacist_resolves(auth, patient):
    job = make_job(patient, status=JobStatus.PICKING_IN_PROGRESS)
    raised = auth("dispenser").post(
        f"/api/workflow-jobs/{job.id}/raise-issue/",
        {"note": "Omeprazole stock below requirement"}, format="json")
    assert raised.status_code == 200
    job.refresh_from_db()
    assert job.status == JobStatus.ISSUE_FOUND
    assert "Omeprazole" in job.issue_notes
    # Dispenser cannot resolve an issue...
    denied = auth("dispenser").post(
        f"/api/workflow-jobs/{job.id}/resolve-issue/",
        {"to_status": "picking_required"}, format="json")
    assert denied.status_code == 403
    # ...pharmacist can.
    ok = auth("pharmacist").post(
        f"/api/workflow-jobs/{job.id}/resolve-issue/",
        {"to_status": "picking_required", "note": "Alternative batch used"}, format="json")
    assert ok.status_code == 200
    job.refresh_from_db()
    assert job.status == JobStatus.PICKING_REQUIRED
    assert job.issue_notes == ""


# ---------------------------------------------------------------- create / RBAC

@pytest.mark.django_db
def test_create_job_role_rules(auth, patient):
    body = {"patient": patient.id, "job_type": "dosette", "title": "Weekly pack", "priority": "high"}
    assert auth("dispenser").post("/api/workflow-jobs/", body, format="json").status_code == 403
    created = auth("pharmacist").post("/api/workflow-jobs/", body, format="json")
    assert created.status_code == 201
    assert created.data["status"] == "new"  # status not settable on create


# ---------------------------------------------------------------- history

@pytest.mark.django_db
def test_history_records_transitions(auth, patient):
    job = make_job(patient, status=JobStatus.PICKING_REQUIRED)
    auth("dispenser").post(f"/api/workflow-jobs/{job.id}/transition/",
                           {"to_status": "picking_in_progress", "note": "started"}, format="json")
    res = auth("dispenser").get(f"/api/workflow-jobs/{job.id}/history/")
    assert res.status_code == 200
    assert any(h["to_status"] == "picking_in_progress" for h in res.data)


# ---------------------------------------------------------------- AI

@pytest.mark.django_db
def test_ai_flags_overdue_job(auth, patient):
    job = make_job(patient, status=JobStatus.PICKING_REQUIRED,
                   due_date=date.today() - timedelta(days=3))
    res = auth("pharmacist").get(f"/api/workflow-jobs/{job.id}/")
    assert res.status_code == 200
    ai = res.data["ai"]
    assert ai is not None
    assert ai["suggested_action"] == "expedite"
    assert ai["confidence"] >= 0.9
    assert ai["job"] == job.id
    assert res.data["is_overdue"] is True


@pytest.mark.django_db
def test_ai_summary_counts_overdue(auth, patient):
    make_job(patient, status=JobStatus.PICKING_REQUIRED,
             due_date=date.today() - timedelta(days=1))
    res = auth("administrator").get("/api/workflow-jobs/board/")
    assert res.data["ai_summary"]["overdue"] >= 1
