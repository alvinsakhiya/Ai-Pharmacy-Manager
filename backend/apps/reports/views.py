import csv
from datetime import date, timedelta

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import AuditLog
from apps.dosette.models import DosetteCycle, DosettePlan
from apps.notifications.models import Notification
from apps.patients.models import Patient
from apps.stock.models import Medicine, StockBatch, StockMovement

from .builders import REPORTS
from .pdf import generic_report_pdf


class DashboardView(APIView):
    """Aggregated headline metrics, alert counts and recent activity."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        today = date.today()
        d30 = today + timedelta(days=30)
        d90 = today + timedelta(days=90)
        d180 = today + timedelta(days=180)

        medicines = list(
            Medicine.objects.with_stock_totals().filter(is_active=True)
        )
        low_stock = sum(1 for m in medicines if m.is_low_stock())
        total_value = sum(float(m.stock_value()) for m in medicines)

        batches = StockBatch.objects.filter(quantity_on_hand__gt=0)
        expiring = {
            "within_30": batches.filter(expiry_date__gte=today, expiry_date__lte=d30).count(),
            "within_90": batches.filter(expiry_date__gte=today, expiry_date__lte=d90).count(),
            "within_180": batches.filter(expiry_date__gte=today, expiry_date__lte=d180).count(),
            "expired": batches.filter(expiry_date__lt=today).count(),
        }

        cycles_due = (DosetteCycle.objects
                      .filter(due_date__lte=today + timedelta(days=7))
                      .exclude(status=DosetteCycle.Status.SEALED).count())

        recent = [
            {"id": a.id, "actor": a.actor_label, "action": a.action,
             "summary": a.summary, "timestamp": a.timestamp}
            for a in AuditLog.objects.all()[:8]
        ]

        return Response({
            "patients": {
                "total": Patient.objects.count(),
                "active": Patient.objects.filter(status="active").count(),
                "dosette": Patient.objects.filter(is_dosette=True, status="active").count(),
            },
            "stock": {
                "medicines": len(medicines),
                "low_stock": low_stock,
                "total_value": round(total_value, 2),
                "units_on_hand": batches.aggregate(t=Sum("quantity_on_hand"))["t"] or 0,
            },
            "expiry": expiring,
            "dosette": {
                "active_plans": DosettePlan.objects.filter(is_active=True).count(),
                "cycles_due_7d": cycles_due,
                "reviews_overdue": DosettePlan.objects.filter(
                    is_active=True, review_date__lt=today).count(),
            },
            "alerts": {
                "unread": Notification.objects.filter(is_read=False).count(),
            },
            "recent_activity": recent,
        })


class StockTrendQuerySerializer(serializers.Serializer):
    days = serializers.IntegerField(default=90, min_value=1, max_value=365)


class StockTrendView(APIView):
    """Daily dispensed-units trend (last N days) for the dashboard chart."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[StockTrendQuerySerializer],
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request):
        from apps.stock.models import MedicineUsage
        query = StockTrendQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        days = query.validated_data["days"]
        start = date.today() - timedelta(days=days)
        rows = (MedicineUsage.objects.filter(date__gte=start)
                .values("date").annotate(total=Sum("quantity")).order_by("date"))
        return Response(list(rows))


class ReportView(APIView):
    """GET /api/reports/<key>/?format=json|csv|pdf"""

    permission_classes = [IsAuthenticated]

    @extend_schema(operation_id="report_detail", responses=OpenApiTypes.OBJECT)
    def get(self, request, key):
        builder = REPORTS.get(key)
        if not builder:
            return Response({"detail": "Unknown report."}, status=404)
        title, subtitle, header, rows = builder()
        fmt = request.query_params.get("format", "json")

        if fmt == "csv":
            resp = HttpResponse(content_type="text/csv")
            resp["Content-Disposition"] = f'attachment; filename="{key}.csv"'
            writer = csv.writer(resp)
            writer.writerow(header)
            writer.writerows(rows)
            return resp

        if fmt == "pdf":
            pdf = generic_report_pdf(title, subtitle, header, rows)
            resp = HttpResponse(pdf, content_type="application/pdf")
            resp["Content-Disposition"] = f'attachment; filename="{key}.pdf"'
            return resp

        return Response({
            "key": key, "title": title, "subtitle": subtitle,
            "columns": header,
            "rows": [dict(zip(header, r)) for r in rows],
            "row_count": len(rows),
        })


class ReportIndexView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(operation_id="report_index", responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response({"reports": list(REPORTS.keys())})
