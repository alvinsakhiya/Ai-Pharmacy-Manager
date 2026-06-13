"""PDF generation with ReportLab. Neutral branding only (no external marks)."""
from datetime import date
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ACCENT = colors.HexColor("#4F46E5")
TEXT = colors.HexColor("#111418")
SUBTLE = colors.HexColor("#E6E8EC")


def _doc(title: str):
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=title,
                            topMargin=18 * mm, bottomMargin=18 * mm,
                            leftMargin=16 * mm, rightMargin=16 * mm)
    styles = getSampleStyleSheet()
    styles["Title"].textColor = TEXT
    styles["Title"].fontSize = 18
    return buf, doc, styles


def _table(header, rows, col_widths=None):
    data = [header] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F8FA")]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, SUBTLE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return t


def _render(buf, doc, story):
    doc.build(story)
    pdf = buf.getvalue()
    buf.close()
    return pdf


def picking_list_pdf(picking_list) -> bytes:
    buf, doc, styles = _doc(picking_list.name)
    story = [
        Paragraph("Weekly Picking List", styles["Title"]),
        Paragraph(f"{picking_list.name} &nbsp;·&nbsp; {picking_list.period_start} to "
                  f"{picking_list.period_end}", styles["Normal"]),
        Spacer(1, 8 * mm),
    ]
    header = ["Medicine", "Required", "On hand", "Patients", "Status"]
    rows = []
    for item in picking_list.items.select_related("medicine").all():
        rows.append([
            item.medicine.label,
            str(item.quantity_required),
            str(item.quantity_available),
            str(item.patient_count),
            "SHORT" if item.is_short else ("Picked" if item.is_picked else "To pick"),
        ])
    story.append(_table(header, rows, col_widths=[70 * mm, 22 * mm, 22 * mm, 22 * mm, 26 * mm]))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        f"Generated {date.today():%d %b %Y} · Simulated data · Not for clinical use.",
        styles["Italic"]))
    return _render(buf, doc, story)


def dosette_summary_pdf(plan) -> bytes:
    """Patient-facing compliance-pack medication summary: a day x time-slot grid
    in plain language (Mon..Sun x Morning/Afternoon/Evening/Bedtime)."""
    from apps.dosette.models import DAYS, SLOTS, SLOT_LABELS

    day_labels = {"mon": "Mon", "tue": "Tue", "wed": "Wed", "thu": "Thu",
                  "fri": "Fri", "sat": "Sat", "sun": "Sun"}
    patient = plan.patient
    buf, doc, styles = _doc(f"Dosette summary — {patient.full_name}")
    small = styles["Normal"].clone("small"); small.fontSize = 8; small.leading = 9

    story = [
        Paragraph("Compliance Pack — Medication Summary", styles["Title"]),
        Paragraph(
            f"<b>{patient.full_name}</b> &nbsp; · &nbsp; Patient ID {patient.patient_id} &nbsp; · &nbsp; "
            f"{plan.get_frequency_display()}"
            + (f" &nbsp; · &nbsp; Review due {plan.review_date}" if plan.review_date else ""),
            styles["Normal"]),
        Spacer(1, 6 * mm),
    ]

    items = list(plan.items.select_related("medicine").all())
    header = ["Time"] + [day_labels[d] for d in DAYS]
    rows = []
    for slot in SLOTS:
        row = [SLOT_LABELS[slot]]
        for day in DAYS:
            meds = [it for it in items if slot in (it.schedule.get(day) or [])]
            cell = "<br/>".join(
                f"{it.medicine.label}" + (f" ×{it.dose_quantity}" if it.dose_quantity > 1 else "")
                for it in meds
            )
            row.append(Paragraph(cell, small) if cell else "")
        rows.append(row)

    col = [24 * mm] + [(178 / 7) * mm] * 7
    story.append(_table(header, rows, col_widths=col))
    story.append(Spacer(1, 6 * mm))

    if items:
        story.append(Paragraph("Medicines in this pack", styles["Heading4"]))
        med_rows = [[it.medicine.label, f"×{it.dose_quantity} per dose", it.instructions or "—"]
                    for it in items]
        story.append(_table(["Medicine", "Dose", "Instructions"], med_rows,
                            col_widths=[80 * mm, 35 * mm, 67 * mm]))

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        f"Generated {date.today():%d %b %Y} · Simulated data · Not for clinical use.",
        styles["Italic"]))
    return _render(buf, doc, story)


def generic_report_pdf(title: str, subtitle: str, header, rows) -> bytes:
    buf, doc, styles = _doc(title)
    story = [Paragraph(title, styles["Title"])]
    if subtitle:
        story.append(Paragraph(subtitle, styles["Normal"]))
    story.append(Spacer(1, 8 * mm))
    story.append(_table([str(h) for h in header], [[str(c) for c in r] for r in rows]))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        f"Generated {date.today():%d %b %Y} · Simulated data · Not for clinical use.",
        styles["Italic"]))
    return _render(buf, doc, story)
