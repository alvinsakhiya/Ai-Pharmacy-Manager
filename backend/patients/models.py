from django.conf import settings
from django.db import models


class Patient(models.Model):
    first_name = models.CharField(max_length=100)

    last_name = models.CharField(max_length=100)

    date_of_birth = models.DateField()

    contact_number = models.CharField(
        max_length=20,
        blank=True
    )

    notes = models.TextField(
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class ClinicalReviewNote(models.Model):
    class Category(models.TextChoices):
        GENERAL_REVIEW = "GENERAL_REVIEW", "General review"
        DOSETTE_REVIEW = "DOSETTE_REVIEW", "Dosette review"
        MEDICATION_CONCERN = "MEDICATION_CONCERN", "Medication concern"
        STOCK_RELATED = "STOCK_RELATED", "Stock-related note"
        FOLLOW_UP_REQUIRED = "FOLLOW_UP_REQUIRED", "Follow-up required"

    class FollowUpStatus(models.TextChoices):
        NOT_REQUIRED = "NOT_REQUIRED", "Not required"
        REQUIRED = "REQUIRED", "Required"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        COMPLETED = "COMPLETED", "Completed"

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="clinical_review_notes",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="authored_clinical_review_notes",
    )
    author_username = models.CharField(max_length=150, blank=True)
    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        db_index=True,
    )
    note_text = models.TextField()
    review_date = models.DateField(null=True, blank=True, db_index=True)
    follow_up_status = models.CharField(
        max_length=20,
        choices=FollowUpStatus.choices,
        default=FollowUpStatus.NOT_REQUIRED,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(
                fields=["patient", "-created_at"],
                name="clinical_patient_time",
            ),
        ]

    def __str__(self):
        return (
            f"{self.get_category_display()} for {self.patient} "
            f"({self.created_at:%Y-%m-%d})"
        )
