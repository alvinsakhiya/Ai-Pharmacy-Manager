from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.roles import PharmacyRole, assign_role
from auditlog.models import AuditEvent
from dosette.models import DosetteRecord
from inventory.models import (
    DraftPurchaseOrder,
    DraftPurchaseOrderItem,
    Medication,
    StockBatch,
    Supplier,
)
from patients.models import Patient


class SupplierOrderingTest(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="ordering_manager",
            password="OrderingWorkflow123!",
        )
        assign_role(self.user, PharmacyRole.MANAGER)
        self.client.force_authenticate(self.user)
        self.supplier = Supplier.objects.create(
            name="Community Wholesale",
            contact_name="Stock Desk",
            email="stock@example.test",
            lead_time_days=2,
        )
        self.other_supplier = Supplier.objects.create(
            name="Alternative Wholesale",
        )
        self.medication = Medication.objects.create(
            name="Ordering Medicine",
            strength="10mg",
            form="Tablet",
            minimum_stock_level=10,
            reorder_threshold=15,
            target_weeks_of_cover=4,
            preferred_supplier=self.supplier,
        )
        today = timezone.localdate()
        StockBatch.objects.create(
            medication=self.medication,
            batch_number="ORDER-001",
            quantity=5,
            expiry_date=today + timedelta(days=365),
            received_date=today,
        )
        patient = Patient.objects.create(
            first_name="Order",
            last_name="Demand",
            date_of_birth=date(1950, 1, 1),
        )
        DosetteRecord.objects.create(
            patient=patient,
            medication=self.medication,
            morning_dose="1",
            is_active=True,
        )

    def test_supplier_directory_and_preferred_supplier_are_audited(self):
        create_response = self.client.post(
            reverse("suppliers-list"),
            {
                "name": "  Local Supplier  ",
                "contact_name": "  Purchasing Team  ",
                "email": "orders@example.test",
                "lead_time_days": 3,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        supplier_id = create_response.data["id"]
        self.assertEqual(create_response.data["name"], "Local Supplier")
        self.assertEqual(
            create_response.data["contact_name"],
            "Purchasing Team",
        )

        medication_response = self.client.patch(
            reverse("medications-detail", args=[self.medication.id]),
            {"preferred_supplier": supplier_id},
            format="json",
        )
        self.assertEqual(
            medication_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            medication_response.data["preferred_supplier_name"],
            "Local Supplier",
        )

        supplier_response = self.client.get(
            reverse("suppliers-detail", args=[supplier_id])
        )
        self.assertEqual(
            supplier_response.data["preferred_medication_count"],
            1,
        )
        self.assertTrue(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.CREATE,
                entity_type="Supplier",
                entity_identifier=str(supplier_id),
            ).exists()
        )
        self.assertTrue(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.UPDATE,
                entity_type="Medication",
                entity_identifier=str(self.medication.id),
            ).exists()
        )

        duplicate_response = self.client.post(
            reverse("suppliers-list"),
            {"name": "local supplier"},
            format="json",
        )
        self.assertEqual(
            duplicate_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("name", duplicate_response.data)

        delete_response = self.client.delete(
            reverse("suppliers-detail", args=[supplier_id])
        )
        self.assertEqual(
            delete_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_reorder_suggestion_uses_existing_stock_intelligence(self):
        response = self.client.get(
            reverse("draft-purchase-orders-suggestions")
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_suggestions"], 1)
        suggestion = response.data["items"][0]
        self.assertEqual(suggestion["medication_id"], self.medication.id)
        self.assertEqual(suggestion["recommended_quantity"], 23)
        self.assertEqual(suggestion["open_order_quantity"], 0)
        self.assertEqual(suggestion["outstanding_quantity"], 23)
        self.assertEqual(suggestion["supplier_status"], "READY")
        self.assertEqual(
            suggestion["preferred_supplier_name"],
            self.supplier.name,
        )
        self.assertTrue(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.ACCESS,
                entity_type="ReorderSuggestion",
            ).exists()
        )

    def test_draft_creation_is_audited_and_prevents_duplicate_suggestions(self):
        response = self.client.post(
            reverse("draft-purchase-orders-create-from-suggestions"),
            {
                "supplier": self.supplier.id,
                "medication_ids": [self.medication.id],
                "notes": "Internal review draft only.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "DRAFT")
        self.assertEqual(response.data["total_units"], 23)
        self.assertEqual(len(response.data["items"]), 1)
        order = DraftPurchaseOrder.objects.get(pk=response.data["id"])
        item = DraftPurchaseOrderItem.objects.get(purchase_order=order)
        self.assertEqual(item.quantity, 23)
        self.assertEqual(item.current_stock, 5)
        self.assertEqual(item.target_stock, 28)
        self.assertEqual(order.created_by, self.user)
        self.assertEqual(order.created_by_username, self.user.username)
        self.assertTrue(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.CREATE,
                entity_type="DraftPurchaseOrder",
                entity_identifier=str(order.id),
            ).exists()
        )

        suggestions = self.client.get(
            reverse("draft-purchase-orders-suggestions")
        )
        self.assertEqual(suggestions.data["items"], [])

        archived = self.client.patch(
            reverse("draft-purchase-orders-detail", args=[order.id]),
            {"status": DraftPurchaseOrder.Status.ARCHIVED},
            format="json",
        )
        self.assertEqual(archived.status_code, status.HTTP_200_OK)

        restored = self.client.get(
            reverse("draft-purchase-orders-suggestions")
        )
        self.assertEqual(
            restored.data["items"][0]["outstanding_quantity"],
            23,
        )

        archived_edit = self.client.patch(
            reverse("draft-purchase-orders-detail", args=[order.id]),
            {"notes": "Must not change."},
            format="json",
        )
        self.assertEqual(
            archived_edit.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_supplier_assignment_attention_and_mismatch_are_rejected(self):
        self.medication.preferred_supplier = None
        self.medication.save(update_fields=["preferred_supplier", "updated_at"])

        attention = self.client.get(
            reverse("draft-purchase-orders-suggestions")
        )
        self.assertEqual(
            attention.data["items"][0]["supplier_status"],
            "SUPPLIER_REQUIRED",
        )

        missing_supplier_draft = self.client.post(
            reverse("draft-purchase-orders-create-from-suggestions"),
            {
                "supplier": self.supplier.id,
                "medication_ids": [self.medication.id],
            },
            format="json",
        )
        self.assertEqual(
            missing_supplier_draft.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.medication.preferred_supplier = self.other_supplier
        self.medication.save(update_fields=["preferred_supplier", "updated_at"])
        mismatch = self.client.post(
            reverse("draft-purchase-orders-create-from-suggestions"),
            {
                "supplier": self.supplier.id,
                "medication_ids": [self.medication.id],
            },
            format="json",
        )
        self.assertEqual(mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(DraftPurchaseOrder.objects.count(), 0)

    def test_inactive_supplier_cannot_receive_a_draft(self):
        self.supplier.is_active = False
        self.supplier.save(update_fields=["is_active", "updated_at"])

        suggestions = self.client.get(
            reverse("draft-purchase-orders-suggestions")
        )
        self.assertEqual(
            suggestions.data["items"][0]["supplier_status"],
            "SUPPLIER_INACTIVE",
        )

        response = self.client.post(
            reverse("draft-purchase-orders-create-from-suggestions"),
            {
                "supplier": self.supplier.id,
                "medication_ids": [self.medication.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(DraftPurchaseOrder.objects.count(), 0)
