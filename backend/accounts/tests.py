from datetime import date

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.roles import PharmacyRole, assign_role
from patients.models import Patient


class ApiAuthenticationTest(APITestCase):
    def setUp(self):
        self.password = "SecureTestPassword123!"
        self.user = get_user_model().objects.create_user(
            username="test_pharmacist",
            password=self.password,
        )
        assign_role(self.user, PharmacyRole.MANAGER)
        self.patient = Patient.objects.create(
            first_name="Test",
            last_name="Patient",
            date_of_birth=date(1950, 1, 1),
        )

        self.protected_urls = [
            reverse("dashboard_stats"),
            reverse("patients-list"),
            reverse("medications-list"),
            reverse("stock-batches-list"),
            reverse("stock-movements-list"),
            reverse("dosette-records-list"),
            reverse("patient_picking_list", args=[self.patient.id]),
            reverse("expiry_alerts"),
            reverse("medication_forecasts"),
            reverse("audit-events-list"),
            reverse("clinical-reviews-list"),
            reverse("current_user"),
        ]

    def login(self):
        return self.client.post(
            reverse("token_obtain_pair"),
            {
                "username": self.user.username,
                "password": self.password,
            },
            format="json",
        )

    def test_login_endpoint_is_public(self):
        response = self.login()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(
            response.data["user"]["primary_role"],
            PharmacyRole.MANAGER,
        )

    def test_refresh_endpoint_is_public(self):
        login_response = self.login()

        response = self.client.post(
            reverse("token_refresh"),
            {"refresh": login_response.data["refresh"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_sensitive_endpoints_reject_unauthenticated_requests(self):
        for url in self.protected_urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_sensitive_endpoints_accept_valid_access_token(self):
        login_response = self.login()
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )

        for url in self.protected_urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_patient_creation_requires_authentication(self):
        response = self.client.post(
            reverse("patients-list"),
            {
                "first_name": "Unauthorised",
                "last_name": "Request",
                "date_of_birth": "1960-01-01",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
