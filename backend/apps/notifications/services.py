"""Prototype in-app operational alerts.

These alerts are deterministic operational signals only. They do not perform
clinical decision-making, do not integrate with the NHS, and make no compliance
claim. Stock alerts contain no patient data.
"""

from django.utils import timezone

from apps.analytics.services import stock_overview_for
from apps.blister.models import CycleStatus, DosetteCycle
from apps.tenancy.permissions import Action, can

from .models import NotificationDismissal

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


class AlertNotVisible(ValueError):
    def __init__(self, fingerprint: str):
        self.fingerprint = fingerprint
        super().__init__(f"Alert is not visible: {fingerprint}")


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


def _computed_alerts_for(user, *, pharmacy_id: int | None = None) -> list[dict]:
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
    return alerts


def _dismissed_fingerprints_for(user) -> set[str]:
    return set(
        NotificationDismissal.objects.filter(user=user).values_list(
            "alert_fingerprint",
            flat=True,
        )
    )


def _alert_fingerprints(alerts: list[dict]) -> set[str]:
    return {alert["id"] for alert in alerts}


def _create_dismissals(user, fingerprints: set[str]) -> int:
    created_count = 0
    for fingerprint in sorted(fingerprints):
        _dismissal, created = NotificationDismissal.objects.get_or_create(
            user=user,
            alert_fingerprint=fingerprint,
        )
        if created:
            created_count += 1
    return created_count


def alerts_for(
    user,
    *,
    pharmacy_id: int | None = None,
    include_dismissed: bool = False,
) -> dict:
    alerts = _computed_alerts_for(user, pharmacy_id=pharmacy_id)

    if not include_dismissed:
        dismissed = _dismissed_fingerprints_for(user)
        alerts = [alert for alert in alerts if alert["id"] not in dismissed]

    return {
        "generated_at": timezone.now(),
        "summary": _summary(alerts),
        "alerts": alerts,
    }


def dismiss_alert(user, *, fingerprint: str) -> dict:
    current_alerts = _computed_alerts_for(user)
    if fingerprint not in _alert_fingerprints(current_alerts):
        raise AlertNotVisible(fingerprint)

    created_count = _create_dismissals(user, {fingerprint})
    visible = alerts_for(user)
    return {
        "fingerprint": fingerprint,
        "dismissed": True,
        "created": created_count == 1,
        "summary": visible["summary"],
    }


def clear_alerts(user, *, fingerprints: list[str] | None = None) -> dict:
    current_alerts = _computed_alerts_for(user)
    current_fingerprints = _alert_fingerprints(current_alerts)

    if fingerprints:
        requested = set(fingerprints)
        invalid = sorted(requested - current_fingerprints)
        if invalid:
            raise AlertNotVisible(invalid[0])
        to_dismiss = requested
    else:
        visible = alerts_for(user)
        to_dismiss = _alert_fingerprints(visible["alerts"])

    created_count = _create_dismissals(user, to_dismiss)
    visible_after = alerts_for(user)
    return {
        "dismissed_count": len(to_dismiss),
        "created_count": created_count,
        "summary": visible_after["summary"],
    }
