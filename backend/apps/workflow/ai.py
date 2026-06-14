"""Explainable AI suggestions for the dispensing workflow board.

Heuristic, deterministic decision-support — NOT a clinical decision-maker. Every
suggestion carries a reason, a confidence score and a suggested action, and the AI
never changes a job automatically; staff always act. Mirrors the explainable style
of the forecasting engine.
"""
from datetime import date

from .models import JobStatus

# Severity drives ordering and colour; higher index = more urgent.
SEVERITY_ORDER = {"info": 0, "warning": 1, "danger": 2}


def _stock_short(job) -> bool:
    """Does any medicine this dosette job needs fall at/under its reorder level?

    Cheap, guarded check — used only for dosette jobs with a linked cycle.
    """
    cycle = job.dosette_cycle
    if not cycle:
        return False
    try:
        items = cycle.plan.items.select_related("medicine")
        return any(m.medicine.is_low_stock() for m in items)
    except Exception:  # pragma: no cover - defensive; never break the board
        return False


def _expiry_risk(job) -> bool:
    """Does a needed medicine have its earliest in-date batch expiring before due?"""
    cycle = job.dosette_cycle
    if not cycle or not job.due_date:
        return False
    try:
        for it in cycle.plan.items.select_related("medicine"):
            batch = (
                it.medicine.batches.filter(quantity_on_hand__gt=0,
                                           expiry_date__gte=date.today())
                .order_by("expiry_date").first()
            )
            if batch and batch.expiry_date < job.due_date:
                return True
    except Exception:  # pragma: no cover - defensive
        return False
    return False


def suggest(job) -> dict | None:
    """Return the single most important suggestion for a job, or None.

    Shape: {reason, confidence, suggested_action, severity, job}. `job` is the
    linkage back to the job id so the UI can deep-link.
    """
    candidates = []

    if job.is_overdue:
        days = abs(job.days_to_due or 0)
        candidates.append({
            "severity": "danger",
            "confidence": 0.95,
            "suggested_action": "expedite",
            "reason": (
                f"Overdue by {days} day{'s' if days != 1 else ''} "
                f"(due {job.due_date:%d %b}). Prioritise this job now."
            ),
        })

    if job.status == JobStatus.ISSUE_FOUND:
        candidates.append({
            "severity": "danger",
            "confidence": 0.92,
            "suggested_action": "resolve_issue",
            "reason": "An issue was raised — needs a pharmacist to review and resolve.",
        })

    if _stock_short(job):
        candidates.append({
            "severity": "danger",
            "confidence": 0.8,
            "suggested_action": "order_stock",
            "reason": "A required medicine is at/under its reorder level — order before picking.",
        })

    if _expiry_risk(job):
        candidates.append({
            "severity": "warning",
            "confidence": 0.78,
            "suggested_action": "use_alternative_batch",
            "reason": "Earliest in-date batch expires before the due date — use an alternative batch (FEFO).",
        })

    if job.status == JobStatus.ACCURACY_CHECK:
        candidates.append({
            "severity": "warning",
            "confidence": 0.9,
            "suggested_action": "pharmacist_accuracy_check",
            "reason": "Awaiting a pharmacist accuracy check before it can be marked ready.",
        })

    if not job.is_overdue and job.due_date is not None:
        days = job.days_to_due
        if days is not None and 0 <= days <= 2 and not job.is_terminal:
            candidates.append({
                "severity": "info",
                "confidence": 0.82,
                "suggested_action": "prepare_soon",
                "reason": f"Due in {days} day{'s' if days != 1 else ''} — prepare soon.",
            })

    if not candidates:
        return None

    best = max(
        candidates,
        key=lambda c: (SEVERITY_ORDER[c["severity"]], c["confidence"]),
    )
    best["job"] = job.id
    return best


def board_summary(jobs) -> dict:
    """AI-style headline counts across the (filtered) jobs on the board."""
    overdue = needs_pharmacist = stock_warnings = due_soon = 0
    for job in jobs:
        s = suggest(job)
        if not s:
            continue
        action = s["suggested_action"]
        if job.is_overdue:
            overdue += 1
        if action in {"resolve_issue", "pharmacist_accuracy_check"}:
            needs_pharmacist += 1
        if action in {"order_stock", "use_alternative_batch"}:
            stock_warnings += 1
        if action == "prepare_soon":
            due_soon += 1
    return {
        "overdue": overdue,
        "needs_pharmacist": needs_pharmacist,
        "stock_warnings": stock_warnings,
        "due_soon": due_soon,
    }
