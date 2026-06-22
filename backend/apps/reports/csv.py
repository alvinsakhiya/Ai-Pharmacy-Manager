import csv
from datetime import datetime
from io import StringIO

from django.utils import timezone

CSV_COLUMNS = [
    "stock_item_id",
    "medication_id",
    "medication_name",
    "pharmacy_id",
    "quantity_on_hand",
    "reorder_level",
    "earliest_expiry",
    "days_to_expiry",
    "consumption_window",
    "near_expiry",
    "low_stock",
    "stockout",
    "dead_stock",
    "slow_moving",
    "attention_score",
    "suggested_reorder_quantity",
    "reasons",
]

MOVEMENT_CSV_COLUMNS = [
    "movement_id",
    "created_at",
    "stock_item_id",
    "medication_id",
    "medication_name",
    "pharmacy_id",
    "batch_id",
    "batch_number",
    "movement_type",
    "quantity_delta",
    "balance_after",
    "reference",
]

EXPIRY_CSV_COLUMNS = [
    "pharmacy_id",
    "pharmacy_name",
    "medication_label",
    "batch_number",
    "expiry_date",
    "quantity",
    "days_until_expiry",
    "severity",
]

DEAD_STOCK_CSV_COLUMNS = [
    "pharmacy_id",
    "medication_label",
    "quantity_on_hand",
    "days_since_last_outbound",
    "status",
    "suggested_action",
]

FORECAST_REORDER_CSV_COLUMNS = [
    "pharmacy_id",
    "pharmacy_name",
    "medication_label",
    "predicted_usage_units",
    "current_stock_units",
    "suggested_reorder_units",
    "suggested_reorder_packs",
    "confidence",
    "explanation_summary",
    "human_review_required",
    "forecast_run_id",
    "forecast_created_at",
]

TRANSFER_SUGGESTIONS_CSV_COLUMNS = [
    "group_id",
    "group_name",
    "source_pharmacy_id",
    "source_pharmacy_name",
    "destination_pharmacy_id",
    "destination_pharmacy_name",
    "medication_label",
    "suggested_quantity_units",
    "suggested_quantity_packs",
    "confidence",
    "status",
    "reason",
    "created_at",
    "human_review_required",
]

MDS_WORKLOAD_CSV_COLUMNS = [
    "pharmacy_id",
    "pharmacy_name",
    "cycle_status",
    "due_count",
    "overdue_count",
    "upcoming_cycles",
]


def _format_date(value) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return timezone.localtime(value).isoformat()
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _format_bool(value: bool) -> str:
    return "true" if value else "false"


def stock_attention_report_csv(report: dict) -> str:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_COLUMNS)
    writer.writeheader()

    for row in report["rows"]:
        flags = row["flags"]
        writer.writerow(
            {
                "stock_item_id": row["stock_item_id"],
                "medication_id": row["medication_id"],
                "medication_name": row["medication_name"],
                "pharmacy_id": row["pharmacy_id"],
                "quantity_on_hand": row["quantity_on_hand"],
                "reorder_level": row["reorder_level"],
                "earliest_expiry": _format_date(row["earliest_expiry"]),
                "days_to_expiry": (
                    "" if row["days_to_expiry"] is None else row["days_to_expiry"]
                ),
                "consumption_window": row["consumption_window"],
                "near_expiry": _format_bool(flags["near_expiry"]),
                "low_stock": _format_bool(flags["low_stock"]),
                "stockout": _format_bool(flags["stockout"]),
                "dead_stock": _format_bool(flags["dead_stock"]),
                "slow_moving": _format_bool(flags["slow_moving"]),
                "attention_score": row["attention_score"],
                "suggested_reorder_quantity": row["suggested_reorder_quantity"],
                "reasons": "; ".join(row["reasons"]),
            }
        )

    return output.getvalue()


def stock_movements_report_csv(report: dict) -> str:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=MOVEMENT_CSV_COLUMNS)
    writer.writeheader()

    for row in report["rows"]:
        writer.writerow(
            {
                "movement_id": row["movement_id"],
                "created_at": _format_date(row["created_at"]),
                "stock_item_id": row["stock_item_id"],
                "medication_id": row["medication_id"],
                "medication_name": row["medication_name"],
                "pharmacy_id": row["pharmacy_id"],
                "batch_id": "" if row["batch_id"] is None else row["batch_id"],
                "batch_number": row["batch_number"] or "",
                "movement_type": row["movement_type"],
                "quantity_delta": row["quantity_delta"],
                "balance_after": row["balance_after"],
                "reference": row["reference"],
            }
        )

    return output.getvalue()


def _rows_to_csv(report: dict, columns: list[str]) -> str:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()

    for row in report["rows"]:
        writer.writerow(
            {column: _format_csv_value(row.get(column)) for column in columns}
        )

    return output.getvalue()


def _format_csv_value(value) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return _format_bool(value)
    if isinstance(value, datetime) or hasattr(value, "isoformat"):
        return _format_date(value)
    return str(value)


def expiry_report_csv(report: dict) -> str:
    return _rows_to_csv(report, EXPIRY_CSV_COLUMNS)


def dead_stock_report_csv(report: dict) -> str:
    return _rows_to_csv(report, DEAD_STOCK_CSV_COLUMNS)


def forecast_reorder_report_csv(report: dict) -> str:
    return _rows_to_csv(report, FORECAST_REORDER_CSV_COLUMNS)


def transfer_suggestions_report_csv(report: dict) -> str:
    return _rows_to_csv(report, TRANSFER_SUGGESTIONS_CSV_COLUMNS)


def mds_workload_report_csv(report: dict) -> str:
    return _rows_to_csv(report, MDS_WORKLOAD_CSV_COLUMNS)
