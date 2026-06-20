"""Prototype in-app operational alerts.

These alerts are deterministic operational signals only. They do not perform
clinical decision-making, do not integrate with the NHS, and make no compliance
claim. Stock alerts contain no patient data.
"""

from django.utils import timezone

from apps.analytics.services import stock_overview_for
from apps.blister.models import CycleStatus, DosetteCycle
from apps.tenancy.permissions import Action, can

SEVERITY_RANK = {
    "critical": 0,
    "warning": 1,
    "info": 2,
}

STOCK_FLAG_ALERTS = [
    ("stockout", "stockout", "critical", "Stockout"),
    ("low_stock", "low_stock", "warning", "Low stock"),
    ("near_expiry", "near_expiry", "warning", "Near expiry"),
    ("dead_stock", "dead_stock", "info", "Dead stock"),
    ("slow_moving", "slow_moving", "info", "Slow moving"),
]


def _reason_for(item: dict, title: str) -> str | None:
    prefix = f"{title}:"
    return next(
        (reason for reason in item["reasons"] if reason.startswith(prefix)),
        None,
    )


def _stock_message(item: dict, alert_type: str, title: str) -> str:
    if alert_type == "stockout":
        return f"{item['quantity_on_hand']} units on hand."

    return _reason_for(item, title) or f"{title} alert."


def _stock_alerts(user, *, pharmacy_id: int | None = None) -> list[dict]:
    overview = stock_overview_for(user, pharmacy_id=pharmacy_id)
    alerts = []

    for item in overview["items"]:
        for flag_key, alert_type, severity, title in STOCK_FLAG_ALERTS:
            if not item["flags"][flag_key]:
                continue

            alerts.append(
                {
                    "id": f"stock:{alert_type}:{item['stock_item_id']}",
                    "category": "stock",
                    "type": alert_type,
                    "severity": severity,
                    "title": f"{title}: {item['medication_name']}",
                    "message": _stock_message(item, alert_type, title),
                    "pharmacy_id": item["pharmacy_id"],
                    "subject": {
                        "stock_item_id": item["stock_item_id"],
                        "medication_id": item["medication_id"],
                        "medication_name": item["medication_name"],
                    },
                }
            )

    return alerts


def _dosette_alerts(user) -> list[dict]:
    cycles = (
        DosetteCycle.scoped.for_user(user)
        .filter(status=CycleStatus.PREPARED, stock_deducted=False)
        .select_related("patient", "patient__pharmacy")
    )

    return [
        {
            "id": f"dosette:prepared_not_deducted:{cycle.id}",
            "category": "dosette",
            "type": "prepared_not_deducted",
            "severity": "warning",
            "title": "Prepared cycle awaiting stock deduction",
            "message": (
                f"Cycle {cycle.reference} is prepared but stock has not been deducted."
            ),
            "pharmacy_id": cycle.patient.pharmacy_id,
            "subject": {
                "dosette_cycle_id": cycle.id,
                "cycle_reference": cycle.reference,
                "patient_id": cycle.patient_id,
                "patient_reference": cycle.patient.patient_reference,
            },
        }
        for cycle in cycles
    ]


def _summary(alerts: list[dict]) -> dict:
    return {
        "total": len(alerts),
        "critical": sum(1 for alert in alerts if alert["severity"] == "critical"),
        "warning": sum(1 for alert in alerts if alert["severity"] == "warning"),
        "info": sum(1 for alert in alerts if alert["severity"] == "info"),
        "by_category": {
            "stock": sum(1 for alert in alerts if alert["category"] == "stock"),
            "dosette": sum(1 for alert in alerts if alert["category"] == "dosette"),
        },
    }


def alerts_for(user, *, pharmacy_id: int | None = None) -> dict:
    alerts = []

    if can(user, Action.STOCK_VIEW):
        alerts.extend(_stock_alerts(user, pharmacy_id=pharmacy_id))
    if can(user, Action.BLISTER_VIEW):
        alerts.extend(_dosette_alerts(user))

    alerts.sort(
        key=lambda alert: (
            SEVERITY_RANK[alert["severity"]],
            alert["category"],
            alert["title"],
        )
    )

    return {
        "generated_at": timezone.now(),
        "summary": _summary(alerts),
        "alerts": alerts,
    }
