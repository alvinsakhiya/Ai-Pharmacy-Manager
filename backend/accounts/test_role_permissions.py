from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.roles import PharmacyRole, assign_role, get_user_roles
from dosette.models import DosetteRecord
from inventory.models import Medication, StockBatch
from patients.models import Patient


class PharmacyRolePermissionTest(APITestCase):
    def setUp(self):
        self.patient = Patient.objects.create(
            first_name="Role",
            last_name="Patient",
            date_of_birth=date(1950, 1, 1),
        )
        self.medication = Medication.objects.create(
            name="Role Medicine",
            strength="10mg",
            form="Tablet",
        )
        self.batch = StockBatch.objects.create(
            medication=self.medication,
            batch_number="ROLE-001",
            quantity=100,
            expiry_date=timezone.now().date() + timedelta(days=90),
            received_date=timezone.now().date(),
        )
        self.dosette = DosetteRecord.objects.create(
            patient=self.patient,
            medication=self.medication,
            morning_dose="1",
            is_active=True,
        )

    def authenticate_as(self, role_name):
        user = get_user_model().objects.create_user(
            username=role_name.lower().replace(" ", "_").replace("-", "_"),
            password="RoleTestPassword123!",
        )
        assign_role(user, role_name)
        self.client.force_authenticate(user)
        return user

    def assert_status(self, method, url, expected_status, data=None):
        response = getattr(self.client, method)(
            url,
            data or {},
            format="json",
        )
        self.assertEqual(
            response.status_code,
            expected_status,
            response.data,
        )
        return response

    def test_role_groups_exist(self):
        self.assertEqual(
            set(
                Group.objects.filter(name__in=PharmacyRole.ALL).values_list(
                    "name",
                    flat=True,
                )
            ),
            set(PharmacyRole.ALL),
        )

    def test_manager_has_full_existing_workflow_access(self):
        self.authenticate_as(PharmacyRole.MANAGER)

        readable_urls = [
            reverse("dashboard_stats"),
            reverse("patients-list"),
            reverse("medications-list"),
            reverse("stock-batches-list"),
            reverse("dosette-records-list"),
            reverse("patient_picking_list", args=[self.patient.id]),
            reverse("expiry_alerts"),
            reverse("medication_forecasts"),
            reverse("audit-events-list"),
        ]
        for url in readable_urls:
            with self.subTest(url=url):
                self.assert_status("get", url, status.HTTP_200_OK)

        self.assert_status(
            "post",
            reverse("patients-list"),
            status.HTTP_201_CREATED,
            {
                "first_name": "Manager",
                "last_name": "Created",
                "date_of_birth": "1960-01-01",
            },
        )
        self.assert_status(
            "patch",
            reverse("stock-batches-detail", args=[self.batch.id]),
            status.HTTP_200_OK,
            {"quantity": 90},
        )

    def test_pharmacist_can_manage_patient_care_but_not_stock_or_audit(self):
        self.authenticate_as(PharmacyRole.PHARMACIST)

        self.assert_status("get", reverse("patients-list"), status.HTTP_200_OK)
        self.assert_status(
            "patch",
            reverse("patients-detail", args=[self.patient.id]),
            status.HTTP_200_OK,
            {"contact_number": "01234567890"},
        )
        self.assert_status(
            "patch",
            reverse("dosette-records-detail", args=[self.dosette.id]),
            status.HTTP_200_OK,
            {"evening_dose": "1"},
        )
        self.assert_status(
            "get",
            reverse("patient_picking_list", args=[self.patient.id]),
            status.HTTP_200_OK,
        )
        self.assert_status(
            "get",
            reverse("medication_forecasts"),
            status.HTTP_200_OK,
        )
        self.assert_status(
            "post",
            reverse("medications-list"),
            status.HTTP_403_FORBIDDEN,
            {
                "name": "Denied Medicine",
                "strength": "5mg",
                "form": "Tablet",
            },
        )
        self.assert_status(
            "get",
            reverse("audit-events-list"),
            status.HTTP_403_FORBIDDEN,
        )

    def test_dispenser_can_update_dosette_and_generate_picking_lists(self):
        self.authenticate_as(PharmacyRole.DISPENSER)

        self.assert_status("get", reverse("patients-list"), status.HTTP_200_OK)
        self.assert_status(
            "post",
            reverse("patients-list"),
            status.HTTP_403_FORBIDDEN,
            {
                "first_name": "Denied",
                "last_name": "Patient",
                "date_of_birth": "1960-01-01",
            },
        )
        self.assert_status(
            "patch",
            reverse("dosette-records-detail", args=[self.dosette.id]),
            status.HTTP_200_OK,
            {"afternoon_dose": "1"},
        )
        self.assert_status(
            "post",
            reverse("dosette-records-list"),
            status.HTTP_403_FORBIDDEN,
            {
                "patient": self.patient.id,
                "medication": self.medication.id,
            },
        )
        self.assert_status(
            "delete",
            reverse("dosette-records-detail", args=[self.dosette.id]),
            status.HTTP_403_FORBIDDEN,
        )
        self.assert_status(
            "get",
            reverse("patient_picking_list", args=[self.patient.id]),
            status.HTTP_200_OK,
        )
        self.assert_status(
            "get",
            reverse("medication_forecasts"),
            status.HTTP_403_FORBIDDEN,
        )

    def test_stock_assistant_controls_inventory_and_expiry_workflows(self):
        self.authenticate_as(PharmacyRole.STOCK_ASSISTANT)

        self.assert_status("get", reverse("medications-list"), status.HTTP_200_OK)
        self.assert_status(
            "patch",
            reverse("stock-batches-detail", args=[self.batch.id]),
            status.HTTP_200_OK,
            {"quantity": 80},
        )
        self.assert_status(
            "get",
            reverse("expiry_alerts"),
            status.HTTP_200_OK,
        )
        self.assert_status(
            "get",
            reverse("patients-list"),
            status.HTTP_403_FORBIDDEN,
        )
        self.assert_status(
            "get",
            reverse("dosette-records-list"),
            status.HTTP_403_FORBIDDEN,
        )
        self.assert_status(
            "get",
            reverse("medication_forecasts"),
            status.HTTP_403_FORBIDDEN,
        )

    def test_read_only_user_can_view_but_cannot_change_records(self):
        self.authenticate_as(PharmacyRole.READ_ONLY)

        readable_urls = [
            reverse("dashboard_stats"),
            reverse("patients-list"),
            reverse("medications-list"),
            reverse("stock-batches-list"),
            reverse("dosette-records-list"),
            reverse("expiry_alerts"),
            reverse("medication_forecasts"),
        ]
        for url in readable_urls:
            with self.subTest(url=url):
                self.assert_status("get", url, status.HTTP_200_OK)

        self.assert_status(
            "patch",
            reverse("patients-detail", args=[self.patient.id]),
            status.HTTP_403_FORBIDDEN,
            {"contact_number": "Denied"},
        )
        self.assert_status(
            "patch",
            reverse("stock-batches-detail", args=[self.batch.id]),
            status.HTTP_403_FORBIDDEN,
            {"quantity": 70},
        )
        self.assert_status(
            "patch",
            reverse("dosette-records-detail", args=[self.dosette.id]),
            status.HTTP_403_FORBIDDEN,
            {"bedtime_dose": "1"},
        )
        self.assert_status(
            "get",
            reverse("patient_picking_list", args=[self.patient.id]),
            status.HTTP_403_FORBIDDEN,
        )
        self.assert_status(
            "get",
            reverse("audit-events-list"),
            status.HTTP_403_FORBIDDEN,
        )

    def test_unassigned_account_defaults_to_read_only_access(self):
        user = get_user_model().objects.create_user(
            username="unassigned_user",
            password="RoleTestPassword123!",
        )
        self.client.force_authenticate(user)

        self.assertEqual(get_user_roles(user), [PharmacyRole.READ_ONLY])
        profile_response = self.assert_status(
            "get",
            reverse("current_user"),
            status.HTTP_200_OK,
        )
        self.assertEqual(
            profile_response.data["primary_role"],
            PharmacyRole.READ_ONLY,
        )
        self.assert_status(
            "get",
            reverse("dashboard_stats"),
            status.HTTP_200_OK,
        )
        self.assert_status(
            "post",
            reverse("patients-list"),
            status.HTTP_403_FORBIDDEN,
            {
                "first_name": "Denied",
                "last_name": "Creation",
                "date_of_birth": "1960-01-01",
            },
        )
