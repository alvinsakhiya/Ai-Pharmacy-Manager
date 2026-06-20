"""Prototype operational stock reports only.

Reports in this module are read-only exports derived from inventory analytics.
They do not query or return patient data, do not perform clinical
decision-making, and make no compliance claim.
"""

from apps.analytics.services import stock_overview_for

ALLOWED_STOCK_ATTENTION_FLAGS = {
    "near_expiry",
    "low_stock",
    "stockout",
    "dead_stock",
    "slow_moving",
}


class InvalidStockAttentionFlag(ValueError):
    def __init__(self, flag: str):
        self.flag = flag
        super().__init__(f"Invalid stock attention flag: {flag}")


def _has_any_attention_flag(row: dict) -> bool:
    return any(row["flags"].values())


def stock_attention_report(
    user,
    *,
    pharmacy_id: int | None = None,
    flag: str | None = None,
    needs_attention: bool = False,
) -> dict:
    overview = stock_overview_for(user, pharmacy_id=pharmacy_id)
    rows = list(overview["items"])

    if flag is not None:
        if flag not in ALLOWED_STOCK_ATTENTION_FLAGS:
            raise InvalidStockAttentionFlag(flag)
        rows = [row for row in rows if row["flags"][flag] is True]

    if needs_attention:
        rows = [row for row in rows if _has_any_attention_flag(row)]

    return {
        "report": "stock_attention",
        "generated_at": overview["generated_at"],
        "thresholds": overview["thresholds"],
        "filters": {
            "pharmacy_id": pharmacy_id,
            "flag": flag,
            "needs_attention": needs_attention,
        },
        "summary": overview["summary"],
        "row_count": len(rows),
        "rows": rows,
    }
