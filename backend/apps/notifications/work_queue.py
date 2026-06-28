"""Read-only operational pharmacy work queue.

The work queue surfaces deterministic operational tasks only. It does not make
clinical recommendations, create cycles, order stock, transfer stock, or perform
any other mutation.
"""

from datetime import date
from typing import Any

from django.utils import timezone

from apps.blister.models import (
    CycleFrequency,
    CycleStatus,
    DosetteCycle,
    DosettePeriod,
    DosettePeriodStatus,
)
from apps.reviews.models import ReviewPriority, ReviewRecord, ReviewStatus
from apps.tenancy.models import Pharmacy
from apps.tenancy.permissions import Action, can

from .services import alerts_for

PREPARE_SOON_DAYS = 3

SUPPLY_PERIOD_LABELS = {
    CycleFrequency.WEEKLY: "1-week supply",
    CycleFrequency.FORTNIGHTLY: "2-week supply",
    CycleFrequency.FOUR_WEEKLY: "4-week supply",
    CycleFrequency.MONTHLY: "Monthly supply",
}

ACTIVE_CYCLE_STATUSES = {
    CycleStatus.DRAFT,
    CycleStatus.NEEDS_CHANGES,
    CycleStatus.PREPARED,
    CycleStatus.CHECKED,
}

SUMMARY_KEYS = (
    "urgent",
    "due_soon",
    "waiting_check",
    "stock_action",
    "reviews",
)

PRIORITY_RANK = {
    "urgent": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
}


def _format_cycle_date(value: date) -> str:
    return value.strftime("%d %b %Y")


def _cycle_supply_period_label(cycle: DosetteCycle) -> str:
    return SUPPLY_PERIOD_LABELS.get(
        cycle.frequency,
        str(cycle.frequency).replace("_", " ").title(),
    )


def _cycle_display_label(cycle: DosetteCycle) -> str:
    return (
        f"{cycle.patient.patient_reference} · {_cycle_supply_period_label(cycle)} · "
        f"{_format_cycle_date(cycle.start_date)} - {_format_cycle_date(cycle.end_date)}"
    )


def _cycle_action_label(user, *, verb: str) -> str:
    if verb == "deduct" and can(user, Action.BLISTER_DEDUCT):
        return "Open Dosette"
    if verb in {"prepare", "check"} and (
        can(user, Action.BLISTER_MARK_PREPARED) or can(user, Action.BLISTER_MANAGE)
    ):
        return "Open Dosette"
    return "Open record"


def _cycle_task(
    *,
    cycle: DosetteCycle,
    group: str,
    priority: str,
    task_type: str,
    title: str,
    reason: str,
    status: str,
    due_date: date,
    action_label: str,
) -> dict[str, Any]:
    return {
        "id": f"{task_type.lower()}-{cycle.id}",
        "type": task_type,
        "group": group,
        "priority": priority,
        "title": title,
        "reason": reason,
        "pharmacy_id": cycle.patient.pharmacy_id,
        "pharmacy_name": cycle.patient.pharmacy.name,
        "patient_reference": cycle.patient.patient_reference,
        "cycle_id": cycle.id,
        "cycle_reference": cycle.reference,
        "cycle_display_label": _cycle_display_label(cycle),
        "cycle_start_date": cycle.start_date,
        "cycle_end_date": cycle.end_date,
        "due_date": due_date,
        "status": status,
        "action_label": action_label,
        "action_href": f"/patients/{cycle.patient_id}/dosette",
    }


def _preparation_title(user) -> str:
    if can(user, Action.BLISTER_MARK_PREPARED) or can(user, Action.BLISTER_MANAGE):
        return "Prepare Dosette cycle"
    return "Dosette cycle needs attention"


def _waiting_check_title(user) -> str:
    if can(user, Action.BLISTER_MARK_PREPARED):
        return "Check prepared cycle"
    return "Prepared cycle needs attention"


def _stock_action_title(user) -> str:
    if can(user, Action.BLISTER_DEDUCT):
        return "Deduct stock"
    return "Checked cycle needs attention"


def _cycle_tasks(user, *, pharmacy_id: int | None, today: date) -> list[dict[str, Any]]:
    if not can(user, Action.BLISTER_VIEW):
        return []

    cycles = (
        DosetteCycle.scoped.for_user(user)
        .filter(status__in=ACTIVE_CYCLE_STATUSES)
        .select_related("patient", "patient__pharmacy")
    )
    if pharmacy_id is not None:
        cycles = cycles.filter(patient__pharmacy_id=pharmacy_id)

    tasks: list[dict[str, Any]] = []
    for cycle in cycles:
        if cycle.status in {CycleStatus.DRAFT, CycleStatus.NEEDS_CHANGES}:
            days_until_start = (cycle.start_date - today).days
            if cycle.end_date < today:
                tasks.append(
                    _cycle_task(
                        cycle=cycle,
                        group="urgent",
                        priority="urgent",
                        task_type="MDS_OVERDUE",
                        title=_preparation_title(user),
                        reason=("Cycle date range has passed; human review required."),
                        status="OVERDUE",
                        due_date=cycle.end_date,
                        action_label=_cycle_action_label(user, verb="prepare"),
                    )
                )
            elif cycle.start_date <= today <= cycle.end_date:
                tasks.append(
                    _cycle_task(
                        cycle=cycle,
                        group="urgent",
                        priority="high",
                        task_type="MDS_NEEDS_PREPARATION",
                        title=_preparation_title(user),
                        reason=(
                            "Cycle is within its planned date range and needs "
                            "attention."
                        ),
                        status="NEEDS_ATTENTION",
                        due_date=cycle.start_date,
                        action_label=_cycle_action_label(user, verb="prepare"),
                    )
                )
            elif 0 <= days_until_start <= PREPARE_SOON_DAYS:
                tasks.append(
                    _cycle_task(
                        cycle=cycle,
                        group="due_soon",
                        priority="high",
                        task_type="MDS_DUE_SOON",
                        title=_preparation_title(user),
                        reason=("Suggested preparation window: due within 3 days."),
                        status="DUE_SOON",
                        due_date=cycle.start_date,
                        action_label=_cycle_action_label(user, verb="prepare"),
                    )
                )

        if cycle.status == CycleStatus.PREPARED:
            tasks.append(
                _cycle_task(
                    cycle=cycle,
                    group="waiting_check",
                    priority="high",
                    task_type="MDS_WAITING_CHECK",
                    title=_waiting_check_title(user),
                    reason="Prepared, awaiting pharmacist check.",
                    status="WAITING_CHECK",
                    due_date=cycle.end_date,
                    action_label=_cycle_action_label(user, verb="check"),
                )
            )

        if cycle.status == CycleStatus.CHECKED and not cycle.stock_deducted:
            tasks.append(
                _cycle_task(
                    cycle=cycle,
                    group="stock_action",
                    priority="high",
                    task_type="MDS_STOCK_DEDUCTION",
                    title=_stock_action_title(user),
                    reason=(
                        "Checked cycle has not had stock deducted; human review "
                        "required."
                    ),
                    status="STOCK_ACTION",
                    due_date=cycle.end_date,
                    action_label=_cycle_action_label(user, verb="deduct"),
                )
            )

    return tasks


def _period_due_reason(period: DosettePeriod, today: date) -> str:
    next_due_date = period.next_due_date
    if period.collected_on is None or next_due_date is None:
        return "Review next dosette due date. Human review required."

    collected_on = _format_cycle_date(period.collected_on)
    days_until_due = (next_due_date - today).days
    if days_until_due < 0:
        overdue_days = abs(days_until_due)
        return (
            f"Patient ID {period.patient.patient_reference} collected their dosette "
            f"on {collected_on}. Next dosette is {overdue_days} "
            f"day{'s' if overdue_days != 1 else ''} overdue. Prepare the next "
            "dosette."
        )
    return (
        f"Patient ID {period.patient.patient_reference} collected their dosette on "
        f"{collected_on}. Next dosette is due in {days_until_due} "
        f"day{'s' if days_until_due != 1 else ''}. Prepare the next dosette."
    )


def _period_task(
    *,
    period: DosettePeriod,
    priority: str,
    group: str,
    status: str,
    today: date,
) -> dict[str, Any]:
    next_due_date = period.next_due_date
    return {
        "id": f"dosette-period-due-{period.id}",
        "type": "MDS_PERIOD_DUE",
        "group": group,
        "priority": priority,
        "title": "Prepare next Dosette",
        "reason": _period_due_reason(period, today),
        "pharmacy_id": period.patient.pharmacy_id,
        "pharmacy_name": period.patient.pharmacy.name,
        "patient_reference": period.patient.patient_reference,
        "cycle_id": None,
        "cycle_reference": "",
        "cycle_display_label": "",
        "cycle_start_date": None,
        "cycle_end_date": None,
        "due_date": next_due_date,
        "status": status,
        "action_label": "Open Dosette",
        "action_href": f"/patients/{period.patient_id}/dosette",
    }


def _period_tasks(
    user, *, pharmacy_id: int | None, today: date
) -> list[dict[str, Any]]:
    if not can(user, Action.BLISTER_VIEW):
        return []

    periods = (
        DosettePeriod.scoped.for_user(user)
        .filter(
            status=DosettePeriodStatus.COLLECTED,
            collected_on__isnull=False,
        )
        .select_related("patient", "patient__pharmacy")
    )
    if pharmacy_id is not None:
        periods = periods.filter(patient__pharmacy_id=pharmacy_id)

    tasks = []
    for period in periods:
        next_due_date = period.next_due_date
        reminder_date = period.reminder_date
        if next_due_date is None or reminder_date is None or today < reminder_date:
            continue

        if today > next_due_date:
            tasks.append(
                _period_task(
                    period=period,
                    priority="urgent",
                    group="urgent",
                    status="OVERDUE",
                    today=today,
                )
            )
        else:
            tasks.append(
                _period_task(
                    period=period,
                    priority="high",
                    group="due_soon",
                    status="DUE_SOON",
                    today=today,
                )
            )

    return tasks


def _review_priority(review: ReviewRecord, today: date) -> str:
    if review.due_date is not None and review.due_date < today:
        return "urgent"
    if review.priority == ReviewPriority.URGENT:
        return "urgent"
    if review.priority == ReviewPriority.ATTENTION:
        return "high"
    return "medium"


def _review_reason(review: ReviewRecord, today: date) -> str:
    if review.due_date is not None and review.due_date < today:
        return "Review due date has passed; human review required."
    return "Pharmacist review pending."


def _review_tasks(
    user, *, pharmacy_id: int | None, today: date
) -> list[dict[str, Any]]:
    if not can(user, Action.REVIEW_VIEW):
        return []

    reviews = (
        ReviewRecord.scoped.for_user(user)
        .filter(status=ReviewStatus.PENDING)
        .select_related("patient", "patient__pharmacy", "dosette_cycle")
    )
    if pharmacy_id is not None:
        reviews = reviews.filter(patient__pharmacy_id=pharmacy_id)

    tasks = []
    for review in reviews:
        cycle = review.dosette_cycle
        tasks.append(
            {
                "id": f"review-pending-{review.id}",
                "type": "REVIEW_PENDING",
                "group": "reviews",
                "priority": _review_priority(review, today),
                "title": "Review pending",
                "reason": _review_reason(review, today),
                "pharmacy_id": review.patient.pharmacy_id,
                "pharmacy_name": review.patient.pharmacy.name,
                "patient_reference": review.patient.patient_reference,
                "cycle_id": cycle.id if cycle else None,
                "cycle_reference": cycle.reference if cycle else None,
                "cycle_display_label": _cycle_display_label(cycle) if cycle else "",
                "cycle_start_date": cycle.start_date if cycle else None,
                "cycle_end_date": cycle.end_date if cycle else None,
                "due_date": review.due_date,
                "status": review.status,
                "action_label": "Open reviews",
                "action_href": "/reviews",
            }
        )

    return tasks


def _stock_priority(severity: str) -> str:
    if severity == "critical":
        return "urgent"
    if severity == "warning":
        return "high"
    return "low"


def _stock_tasks(user, *, pharmacy_id: int | None) -> list[dict[str, Any]]:
    if not can(user, Action.STOCK_VIEW):
        return []

    alerts = alerts_for(user, pharmacy_id=pharmacy_id)["alerts"]
    pharmacy_ids = {
        alert["pharmacy_id"] for alert in alerts if alert["category"] == "stock"
    }
    pharmacies = Pharmacy.objects.in_bulk(pharmacy_ids)
    tasks = []
    for alert in alerts:
        if alert["category"] != "stock":
            continue
        subject = alert["subject"]
        stock_item_id = subject.get("stock_item_id")
        pharmacy = pharmacies.get(alert["pharmacy_id"])
        tasks.append(
            {
                "id": f"stock-alert-{alert['type']}-{stock_item_id}",
                "type": f"STOCK_{str(alert['type']).upper()}",
                "group": "stock_action",
                "priority": _stock_priority(alert["severity"]),
                "title": alert["title"],
                "reason": f"{alert['message']} Human review required.",
                "pharmacy_id": alert["pharmacy_id"],
                "pharmacy_name": (
                    pharmacy.name
                    if pharmacy is not None
                    else f"Pharmacy {alert['pharmacy_id']}"
                ),
                "patient_reference": "",
                "cycle_id": None,
                "cycle_reference": "",
                "cycle_display_label": "",
                "cycle_start_date": None,
                "cycle_end_date": None,
                "due_date": None,
                "status": str(alert["severity"]).upper(),
                "action_label": "Open inventory",
                "action_href": (
                    f"/inventory/{stock_item_id}" if stock_item_id else "/inventory"
                ),
            }
        )

    return tasks


def _summary(items: list[dict[str, Any]]) -> dict[str, int]:
    summary = {key: 0 for key in SUMMARY_KEYS}
    for item in items:
        group = item["group"]
        if group in summary:
            summary[group] += 1
    summary["total"] = len(items)
    return summary


def work_queue_for(user, *, pharmacy_id: int | None = None) -> dict[str, Any]:
    today = timezone.localdate()
    generated_at = timezone.now()
    items = [
        *_cycle_tasks(user, pharmacy_id=pharmacy_id, today=today),
        *_period_tasks(user, pharmacy_id=pharmacy_id, today=today),
        *_review_tasks(user, pharmacy_id=pharmacy_id, today=today),
        *_stock_tasks(user, pharmacy_id=pharmacy_id),
    ]
    if pharmacy_id is not None:
        items = [item for item in items if item["pharmacy_id"] == pharmacy_id]

    items.sort(
        key=lambda item: (
            PRIORITY_RANK.get(item["priority"], 99),
            item["due_date"] or date.max,
            item["pharmacy_name"],
            item["title"],
            item["id"],
        )
    )

    return {
        "generated_at": generated_at,
        "items": items,
        "summary": _summary(items),
    }
