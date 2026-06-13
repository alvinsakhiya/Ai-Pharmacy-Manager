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
