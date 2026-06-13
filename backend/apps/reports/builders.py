"""Report dataset builders. Each returns (title, subtitle, header, rows)."""
from datetime import date, timedelta

from django.db.models import Count, Q

from apps.dosette.models import DosetteCycle, DosettePlan
from apps.patients.models import Patient
from apps.stock.models import Medicine, StockBatch


def stock_valuation():
    rows, total = [], 0.0
    for m in Medicine.objects.filter(is_active=True):
        qty = m.quantity_on_hand()
        value = float(m.stock_value())
        total += value
        if qty:
            rows.append([m.label, qty, f"{float(m.unit_cost):.4f}", f"{value:.2f}"])
    rows.sort(key=lambda r: float(r[3]), reverse=True)
    return ("Stock Valuation Report", f"Total stock value: £{total:,.2f}",
            ["Medicine", "Units on hand", "Unit cost (£)", "Value (£)"], rows)


def expiry_report(days=180):
    cutoff = date.today() + timedelta(days=days)
    rows = []
    for b in (StockBatch.objects.filter(quantity_on_hand__gt=0, expiry_date__lte=cutoff)
              .select_related("medicine").order_by("expiry_date")):
        rows.append([b.medicine.label, b.batch_number, b.expiry_date.isoformat(),
                     b.days_to_expiry, b.quantity_on_hand, b.location or "-"])
    return (f"Expiry Report (next {days} days)", f"{len(rows)} batches expiring",
            ["Medicine", "Batch", "Expiry", "Days left", "Units", "Location"], rows)


def low_stock_report():
    rows = []
    for m in Medicine.objects.filter(is_active=True):
        if m.is_low_stock():
            rows.append([m.label, m.quantity_on_hand(), m.reorder_level, m.reorder_quantity,
                         m.default_supplier.name if m.default_supplier else "-"])
    return ("Low Stock Report", f"{len(rows)} medicines at or below reorder level",
            ["Medicine", "On hand", "Reorder level", "Reorder qty", "Supplier"], rows)


def dosette_workload():
    rows = []
    qs = (DosettePlan.objects.filter(is_active=True)
          .select_related("patient").annotate(n=Count("items")))
    for p in qs:
        rows.append([p.patient.full_name, p.patient.patient_id, p.get_frequency_display(),
                     p.n, p.review_date.isoformat() if p.review_date else "-",
                     "OVERDUE" if p.review_overdue else "ok"])
    upcoming = DosetteCycle.objects.filter(
        due_date__lte=date.today() + timedelta(days=7)).exclude(
        status=DosetteCycle.Status.SEALED).count()
    return ("Dosette Workload Report",
            f"{len(rows)} active plans · {upcoming} cycles due within 7 days",
            ["Patient", "Patient ID", "Frequency", "Medicines", "Review due", "Review"], rows)


def patient_summary():
    rows = []
    for p in Patient.objects.all().annotate(
            plans=Count("dosette_plans", filter=Q(dosette_plans__is_active=True))):
        rows.append([p.patient_id, p.full_name, p.get_status_display(),
                     "Yes" if p.is_dosette else "No", p.plans,
                     p.allergies[:40] or "-"])
    return ("Patient Summary Report", f"{len(rows)} patients (pseudo-anonymised)",
            ["Patient ID", "Name", "Status", "Dosette", "Active plans", "Allergies"], rows)


def forecasting_report(horizon=4):
    from apps.forecasting.engine import forecast_medicine
    rows = []
    for m in Medicine.objects.filter(is_active=True).select_related("default_supplier"):
        r = forecast_medicine(m, horizon)
        if not r.points:
            continue
        ro = r.reorder
        rows.append([m.label, r.method, round(r.avg_weekly_demand, 1),
                     round(r.trend_per_week, 2), ro["on_hand"],
                     ro["suggested_order_units"],
                     "ORDER" if ro["should_order"] else "ok"])
    rows.sort(key=lambda r: r[5], reverse=True)
    return ("Forecasting & Reorder Report",
            f"{horizon}-week horizon · {sum(1 for r in rows if r[6] == 'ORDER')} reorder recommendations",
            ["Medicine", "Method", "Avg/wk", "Trend/wk", "On hand", "Suggested order", "Action"],
            rows)


REPORTS = {
    "stock-valuation": stock_valuation,
    "expiry": expiry_report,
    "low-stock": low_stock_report,
    "dosette-workload": dosette_workload,
    "patient-summary": patient_summary,
    "forecasting": forecasting_report,
}
