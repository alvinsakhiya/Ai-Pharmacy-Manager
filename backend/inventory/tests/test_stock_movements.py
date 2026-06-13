from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.roles import PharmacyRole, assign_role
from auditlog.models import AuditEvent
from dosette.models import DosetteRecord
from inventory.models import Medication, StockBatch, StockMovement
from inventory.utils import allocate_stock_fefo
from patients.models import Patient


class StockMovementTest(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="stock_governance_manager",
            password="StockGovernancePassword123!",
        )
        assign_role(self.user, PharmacyRole.MANAGER)
        self.client.force_authenticate(self.user)

        self.medication = Medication.objects.create(
            name="Governance Medicine",
            strength="10mg",
            form="Tablet",
        )
        self.batch = StockBatch.objects.create(
            medication=self.medication,
            batch_number="GOV-001",
            quantity=100,
            expiry_date=date.today() + timedelta(days=90),
            received_date=date.today(),
        )

    def adjustment_payload(self, **overrides):
        payload = {
            "movement_type": StockMovement.MovementType.ADJUSTMENT,
            "quantity_change": -10,
            "reason": "Confirmed physical stock count.",
        }
        payload.update(overrides)
        return payload

    def test_batch_creation_records_received_stock(self):
        response = self.client.post(
            reverse("stock-batches-list"),
            {
                "medication": self.medication.id,
                "batch_number": "GOV-RECEIPT",
                "quantity": 40,
                "expiry_date": date.today() + timedelta(days=180),
                "received_date": date.today(),
                "supplier": "Test Supplier",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        movement = StockMovement.objects.get(
            stock_batch_identifier=str(response.data["id"])
        )
        self.assertEqual(
            movement.movement_type,
            StockMovement.MovementType.RECEIVED,
        )
        self.assertEqual(movement.quantity_change, 40)
        self.assertEqual(movement.quantity_before, 0)
        self.assertEqual(movement.quantity_after, 40)
        self.assertEqual(movement.actor, self.user)

    def test_controlled_adjustment_records_before_after_reason_and_audit(self):
        response = self.client.post(
            reverse("stock-batches-adjust", args=[self.batch.id]),
            self.adjustment_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.quantity, 90)

        movement = StockMovement.objects.get(
            stock_batch_identifier=str(self.batch.id)
        )
        self.assertEqual(movement.quantity_before, 100)
        self.assertEqual(movement.quantity_change, -10)
        self.assertEqual(movement.quantity_after, 90)
        self.assertEqual(movement.reason, "Confirmed physical stock count.")
        self.assertEqual(movement.actor_username, self.user.username)
        self.assertTrue(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.UPDATE,
                entity_type="StockBatch",
                entity_identifier=str(self.batch.id),
            ).exists()
        )

    def test_direct_quantity_update_is_rejected(self):
        response = self.client.patch(
            reverse("stock-batches-detail", args=[self.batch.id]),
            {"quantity": 50},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("quantity", response.data)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.quantity, 100)
        self.assertFalse(
            StockMovement.objects.filter(
                stock_batch_identifier=str(self.batch.id)
            ).exists()
        )

    def test_reason_zero_change_and_underflow_are_rejected_atomically(self):
        invalid_payloads = [
            self.adjustment_payload(reason=""),
            self.adjustment_payload(quantity_change=0),
            self.adjustment_payload(quantity_change=-101),
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post(
                    reverse("stock-batches-adjust", args=[self.batch.id]),
                    payload,
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )

        self.batch.refresh_from_db()
        self.assertEqual(self.batch.quantity, 100)
        self.assertEqual(StockMovement.objects.count(), 0)

    def test_movement_direction_rules_and_expired_picking_safety(self):
        received_response = self.client.post(
            reverse("stock-batches-adjust", args=[self.batch.id]),
            self.adjustment_payload(
                movement_type=StockMovement.MovementType.RECEIVED,
                quantity_change=-1,
            ),
            format="json",
        )
        waste_response = self.client.post(
            reverse("stock-batches-adjust", args=[self.batch.id]),
            self.adjustment_payload(
                movement_type=StockMovement.MovementType.WASTE_QUARANTINE,
                quantity_change=1,
            ),
            format="json",
        )

        expired_batch = StockBatch.objects.create(
            medication=self.medication,
            batch_number="GOV-EXPIRED",
            quantity=20,
            expiry_date=date.today() - timedelta(days=1),
            received_date=date.today() - timedelta(days=30),
        )
        picking_response = self.client.post(
            reverse("stock-batches-adjust", args=[expired_batch.id]),
            self.adjustment_payload(
                movement_type=StockMovement.MovementType.PICKING_ALLOCATION,
                quantity_change=-5,
            ),
            format="json",
        )

        self.assertEqual(
            received_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            waste_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            picking_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        expired_batch.refresh_from_db()
        self.assertEqual(expired_batch.quantity, 20)

    def test_adjusted_quantity_is_used_by_fefo_without_changing_algorithm(self):
        response = self.client.post(
            reverse("stock-batches-adjust", args=[self.batch.id]),
            self.adjustment_payload(
                movement_type=StockMovement.MovementType.CORRECTION,
                quantity_change=-75,
            ),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        allocation = allocate_stock_fefo(self.medication, 30)

        self.assertEqual(allocation["allocated"][0]["quantity"], 25)
        self.assertEqual(allocation["shortfall"], 5)

    def test_picking_list_generation_does_not_consume_recommended_stock(self):
        patient = Patient.objects.create(
            first_name="Picking",
            last_name="Recommendation",
            date_of_birth=date(1950, 1, 1),
        )
        DosetteRecord.objects.create(
            patient=patient,
            medication=self.medication,
            morning_dose="1",
            is_active=True,
        )

        response = self.client.get(
            reverse("patient_picking_list", args=[patient.id])
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.quantity, 100)
        self.assertFalse(
            StockMovement.objects.filter(
                movement_type=StockMovement.MovementType.PICKING_ALLOCATION
            ).exists()
        )

    def test_stock_movement_api_is_filtered_read_only_and_role_protected(self):
        self.client.post(
            reverse("stock-batches-adjust", args=[self.batch.id]),
            self.adjustment_payload(),
            format="json",
        )

        response = self.client.get(
            reverse("stock-movements-list"),
            {
                "movement_type": StockMovement.MovementType.ADJUSTMENT,
                "stock_batch": self.batch.id,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            response.data["results"][0]["quantity_after"],
            90,
        )

        write_response = self.client.post(
            reverse("stock-movements-list"),
            {},
            format="json",
        )
        self.assertEqual(
            write_response.status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )

        pharmacist = get_user_model().objects.create_user(
            username="movement_pharmacist",
            password="StockGovernancePassword123!",
        )
        assign_role(pharmacist, PharmacyRole.PHARMACIST)
        self.client.force_authenticate(pharmacist)
        forbidden_response = self.client.get(reverse("stock-movements-list"))
        self.assertEqual(
            forbidden_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_stock_movements_are_immutable(self):
        response = self.client.post(
            reverse("stock-batches-adjust", args=[self.batch.id]),
            self.adjustment_payload(),
            format="json",
        )
        movement = StockMovement.objects.get(
            pk=response.data["movement"]["id"]
        )
        movement.reason = "Changed"

        with self.assertRaises(ValidationError):
            movement.save()

        with self.assertRaises(ValidationError):
            movement.delete()

        with self.assertRaises(ValidationError):
            StockMovement.objects.filter(pk=movement.pk).update(
                reason="Changed"
            )

        with self.assertRaises(ValidationError):
            StockMovement.objects.filter(pk=movement.pk).delete()
