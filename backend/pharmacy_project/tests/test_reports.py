import csv
from datetime import date, timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.roles import PharmacyRole, assign_role
from auditlog.models import AuditEvent
from dosette.models import DosetteRecord
from inventory.models import Medication, StockBatch, Supplier
from notifications.models import Notification
from patients.models import Patient


def read_csv_response(response):
    return list(csv.DictReader(StringIO(response.content.decode("utf-8"))))


class ReportExportTest(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.manager = user_model.objects.create_user(
            username="report_manager",
            password="ReportTest123!",
        )
        assign_role(self.manager, PharmacyRole.MANAGER)
        self.pharmacist = user_model.objects.create_user(
            username="report_pharmacist",
            password="ReportTest123!",
        )
        assign_role(self.pharmacist, PharmacyRole.PHARMACIST)
        self.dispenser = user_model.objects.create_user(
            username="report_dispenser",
            password="ReportTest123!",
        )
        assign_role(self.dispenser, PharmacyRole.DISPENSER)
        self.stock_assistant = user_model.objects.create_user(
            username="report_stock_assistant",
            password="ReportTest123!",
        )
        assign_role(self.stock_assistant, PharmacyRole.STOCK_ASSISTANT)
        self.read_only = user_model.objects.create_user(
            username="report_read_only",
            password="ReportTest123!",
        )
        assign_role(self.read_only, PharmacyRole.READ_ONLY)

        self.patient = Patient.objects.create(
            first_name="Report",
            last_name="Patient",
            date_of_birth=date(1950, 1, 1),
        )
        self.supplier = Supplier.objects.create(name="Report Supplier")
        self.medication = Medication.objects.create(
            name="Report Medicine",
            strength="10mg",
            form="Tablet",
            minimum_stock_level=5,
            reorder_threshold=10,
            target_weeks_of_cover=4,
            preferred_supplier=self.supplier,
        )
        today = timezone.localdate()
        self.valid_batch = StockBatch.objects.create(
            medication=self.medication,
            batch_number="REPORT-VALID",
            quantity=2,
            expiry_date=today + timedelta(days=90),
            received_date=today,
            supplier="Local wholesaler",
        )
        self.expired_batch = StockBatch.objects.create(
            medication=self.medication,
            batch_number="REPORT-EXPIRED",
            quantity=500,
            expiry_date=today - timedelta(days=1),
            received_date=today,
            supplier="Old stock",
        )
        DosetteRecord.objects.create(
            patient=self.patient,
            medication=self.medication,
            morning_dose="1",
            is_active=True,
        )
        self.assigned_notice = Notification.objects.create(
            title="Pharmacist review",
            message="Visible to assigned pharmacist.",
            assigned_user=self.pharmacist,
            assigned_username=self.pharmacist.username,
        )
        self.unassigned_notice = Notification.objects.create(
            title="General operations notice",
            message="Visible to all authorised staff.",
        )
        self.hidden_notice = Notification.objects.create(
            title="Dispenser-only notice",
            message="Not visible to pharmacist report export.",
            assigned_user=self.dispenser,
            assigned_username=self.dispenser.username,
        )
        AuditEvent.objects.create(
            actor=self.manager,
            actor_username=self.manager.username,
            action=AuditEvent.Action.ACCESS,
            entity_type="SeedEvent",
            summary="Seed audit row for report testing.",
            request_path="/api/test/",
        )

    def authenticate(self, user):
        self.client.force_authenticate(user)

    def assert_csv_response(self, response, filename):
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", response["Content-Type"])
        self.assertIn(filename, response["Content-Disposition"])
        self.assertEqual(response["Cache-Control"], "no-store")

    def test_report_endpoints_require_authentication(self):
        urls = [
            reverse("report_picking_list_csv", args=[self.patient.id]),
            reverse("report_stock_csv"),
            reverse("report_expiry_csv"),
            reverse("report_forecast_csv"),
            reverse("report_audit_csv"),
            reverse("report_notification_csv"),
        ]

        for url in urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(
                    response.status_code,
                    status.HTTP_401_UNAUTHORIZED,
                )

    def test_manager_can_export_all_reports_and_exports_are_audited(self):
        self.authenticate(self.manager)
        expected_files = {
            reverse("report_picking_list_csv", args=[self.patient.id]): (
                f"picking-list-patient-{self.patient.id}.csv"
            ),
            reverse("report_stock_csv"): "stock-report.csv",
            reverse("report_expiry_csv"): "expiry-report.csv",
            reverse("report_forecast_csv"): "forecast-report.csv",
            reverse("report_audit_csv"): "audit-report.csv",
            reverse("report_notification_csv"): "notification-report.csv",
        }

        for url, filename in expected_files.items():
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assert_csv_response(response, filename)

        self.assertEqual(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.GENERATE,
                entity_type="ReportExport",
            ).count(),
            len(expected_files),
        )

    def test_forecast_report_excludes_expired_stock_from_safety_calculations(self):
        self.authenticate(self.manager)

        response = self.client.get(reverse("report_forecast_csv"))

        self.assert_csv_response(response, "forecast-report.csv")
        row = read_csv_response(response)[0]
        self.assertEqual(row["Current Stock"], "2")
        self.assertEqual(row["Predicted Weekly Demand"], "7")
        self.assertEqual(row["Risk Level"], "High")
        self.assertNotIn("500", row["Current Stock"])

    def test_picking_report_uses_non_expired_fefo_allocation_only(self):
        self.authenticate(self.pharmacist)

        response = self.client.get(
            reverse("report_picking_list_csv", args=[self.patient.id])
        )

        self.assert_csv_response(
            response,
            f"picking-list-patient-{self.patient.id}.csv",
        )
        row = read_csv_response(response)[0]
        self.assertEqual(row["Weekly Quantity"], "7")
        self.assertEqual(row["Shortfall"], "5")
        self.assertIn(self.valid_batch.batch_number, row["FEFO Allocation Summary"])
        self.assertNotIn(
            self.expired_batch.batch_number,
            row["FEFO Allocation Summary"],
        )

    def test_report_permissions_follow_existing_role_boundaries(self):
        restricted_expectations = [
            (self.pharmacist, "report_audit_csv"),
            (self.stock_assistant, "report_forecast_csv"),
            (self.stock_assistant, "report_audit_csv"),
            (self.read_only, "report_audit_csv"),
        ]
        allowed_expectations = [
            (self.pharmacist, "report_forecast_csv"),
            (self.stock_assistant, "report_stock_csv"),
            (self.stock_assistant, "report_expiry_csv"),
            (self.read_only, "report_stock_csv"),
            (self.read_only, "report_forecast_csv"),
            (self.read_only, "report_notification_csv"),
        ]

        for user, url_name in restricted_expectations:
            with self.subTest(user=user.username, url_name=url_name):
                self.authenticate(user)
                response = self.client.get(reverse(url_name))
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        for user, url_name in allowed_expectations:
            with self.subTest(user=user.username, url_name=url_name):
                self.authenticate(user)
                response = self.client.get(reverse(url_name))
                self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.authenticate(self.read_only)
        picking_response = self.client.get(
            reverse("report_picking_list_csv", args=[self.patient.id])
        )
        self.assertEqual(picking_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_notification_report_is_scoped_for_non_manager_roles(self):
        self.authenticate(self.pharmacist)

        response = self.client.get(reverse("report_notification_csv"))

        self.assert_csv_response(response, "notification-report.csv")
        rows = read_csv_response(response)
        titles = {row["Title"] for row in rows}
        self.assertEqual(
            titles,
            {self.assigned_notice.title, self.unassigned_notice.title},
        )
        self.assertNotIn(self.hidden_notice.title, titles)

        self.authenticate(self.manager)
        manager_rows = read_csv_response(
            self.client.get(reverse("report_notification_csv"))
        )
        manager_titles = {row["Title"] for row in manager_rows}
        self.assertIn(self.hidden_notice.title, manager_titles)

    def test_report_text_is_neutralised_against_spreadsheet_formulas(self):
        Notification.objects.create(
            title="=2+2",
            message="Formula-like text must remain plain text.",
            assigned_user=self.pharmacist,
            assigned_username=self.pharmacist.username,
        )
        self.authenticate(self.pharmacist)

        response = self.client.get(reverse("report_notification_csv"))

        self.assert_csv_response(response, "notification-report.csv")
        titles = {row["Title"] for row in read_csv_response(response)}
        self.assertIn("'=2+2", titles)
        self.assertNotIn("=2+2", titles)
