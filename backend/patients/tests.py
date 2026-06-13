from datetime import date

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.roles import PharmacyRole, assign_role
from auditlog.models import AuditEvent

from .models import ClinicalReviewNote, Patient


class ClinicalReviewNoteApiTest(APITestCase):
    def setUp(self):
        self.manager = get_user_model().objects.create_user(
            username="clinical_manager",
            password="ClinicalTestPassword123!",
        )
        assign_role(self.manager, PharmacyRole.MANAGER)
        self.pharmacist = get_user_model().objects.create_user(
            username="clinical_pharmacist",
            password="ClinicalTestPassword123!",
        )
        assign_role(self.pharmacist, PharmacyRole.PHARMACIST)
        self.patient = Patient.objects.create(
            first_name="Review",
            last_name="Patient",
            date_of_birth=date(1955, 4, 12),
        )
        self.other_patient = Patient.objects.create(
            first_name="Second",
            last_name="Patient",
            date_of_birth=date(1960, 7, 20),
        )
        self.url = reverse("clinical-reviews-list")
        self.client.force_authenticate(self.manager)

    def create_note(self, **overrides):
        payload = {
            "patient": self.patient.id,
            "category": ClinicalReviewNote.Category.GENERAL_REVIEW,
            "note_text": "Routine medication review completed.",
            "review_date": "2026-07-01",
            "follow_up_status": (
                ClinicalReviewNote.FollowUpStatus.NOT_REQUIRED
            ),
        }
        payload.update(overrides)
        return self.client.post(self.url, payload, format="json")

    def test_create_assigns_author_and_writes_content_safe_audit_event(self):
        sensitive_text = "Private clinical detail must stay out of audit logs."

        response = self.create_note(note_text=f"  {sensitive_text}  ")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        note = ClinicalReviewNote.objects.get(pk=response.data["id"])
        self.assertEqual(note.author, self.manager)
        self.assertEqual(note.author_username, self.manager.username)
        self.assertEqual(note.note_text, sensitive_text)
        self.assertEqual(note.review_date, date(2026, 7, 1))
        self.assertEqual(response.data["author_display"], self.manager.username)
        self.assertEqual(response.data["review_date"], "2026-07-01")

        event = AuditEvent.objects.get(
            action=AuditEvent.Action.CREATE,
            entity_type="ClinicalReviewNote",
            entity_identifier=str(note.id),
        )
        self.assertEqual(event.actor, self.manager)
        self.assertNotIn(sensitive_text, event.summary)
        self.assertNotIn("Private clinical", event.summary)

    def test_update_preserves_original_author_and_audits_field_names_only(self):
        create_response = self.create_note()
        note_id = create_response.data["id"]
        self.client.force_authenticate(self.pharmacist)
        sensitive_update = "Follow-up detail that must remain private."

        response = self.client.patch(
            reverse("clinical-reviews-detail", args=[note_id]),
            {
                "note_text": sensitive_update,
                "follow_up_status": (
                    ClinicalReviewNote.FollowUpStatus.IN_PROGRESS
                ),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        note = ClinicalReviewNote.objects.get(pk=note_id)
        self.assertEqual(note.author, self.manager)
        self.assertEqual(note.author_username, self.manager.username)
        self.assertEqual(response.data["author_display"], self.manager.username)
        event = AuditEvent.objects.get(
            action=AuditEvent.Action.UPDATE,
            entity_type="ClinicalReviewNote",
            entity_identifier=str(note_id),
        )
        self.assertIn("follow_up_status", event.summary)
        self.assertIn("note_text", event.summary)
        self.assertNotIn(sensitive_update, event.summary)

    def test_note_text_and_choice_validation(self):
        blank_response = self.create_note(note_text="   ")
        invalid_category_response = self.create_note(category="UNKNOWN")
        invalid_status_response = self.create_note(
            follow_up_status="UNKNOWN"
        )
        long_response = self.create_note(note_text="x" * 5001)

        self.assertEqual(
            blank_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            invalid_category_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            invalid_status_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            long_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_list_is_paginated_searchable_and_filterable(self):
        first_response = self.create_note(
            note_text="Routine review alpha marker.",
        )
        second_response = self.create_note(
            patient=self.other_patient.id,
            category=ClinicalReviewNote.Category.MEDICATION_CONCERN,
            note_text="Medication concern beta marker.",
            follow_up_status=ClinicalReviewNote.FollowUpStatus.REQUIRED,
        )
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_201_CREATED)

        patient_response = self.client.get(
            self.url,
            {"patient": self.other_patient.id},
        )
        category_response = self.client.get(
            self.url,
            {"category": ClinicalReviewNote.Category.MEDICATION_CONCERN},
        )
        status_response = self.client.get(
            self.url,
            {"follow_up_status": ClinicalReviewNote.FollowUpStatus.REQUIRED},
        )
        search_response = self.client.get(self.url, {"search": "alpha"})

        for response in (
            patient_response,
            category_response,
            status_response,
            search_response,
        ):
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["count"], 1)
            self.assertEqual(len(response.data["results"]), 1)

        self.assertEqual(
            patient_response.data["results"][0]["patient"],
            self.other_patient.id,
        )
        self.assertEqual(
            search_response.data["results"][0]["id"],
            first_response.data["id"],
        )

    def test_invalid_filter_values_return_clear_bad_request(self):
        invalid_patient = self.client.get(self.url, {"patient": "not-an-id"})
        invalid_category = self.client.get(
            self.url,
            {"category": "unknown"},
        )
        invalid_status = self.client.get(
            self.url,
            {"follow_up_status": "unknown"},
        )

        self.assertEqual(
            invalid_patient.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            invalid_category.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            invalid_status.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
