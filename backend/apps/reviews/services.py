"""Operational review transition services.

These helpers enforce workflow state changes only. They do not perform
clinical decision-making, diagnosis, automated recommendations, NHS
integration, or make any compliance claim.
"""

from django.utils import timezone
from rest_framework import serializers

from .models import ReviewRecord, ReviewStatus

ACTIVE_STATUSES = {ReviewStatus.PENDING, ReviewStatus.IN_REVIEW}
TERMINAL_STATUSES = {ReviewStatus.COMPLETED, ReviewStatus.CANCELLED}
UPDATE_ALLOWED_FIELDS = {"priority", "assigned_to", "due_date", "notes", "status"}


def _assert_active(review: ReviewRecord) -> None:
    if review.status in TERMINAL_STATUSES:
        raise serializers.ValidationError(
            {"detail": ["Completed or cancelled reviews cannot be edited."]}
        )


def update_review(review: ReviewRecord, validated_data: dict, actor) -> ReviewRecord:
    _assert_active(review)

    disallowed = set(validated_data) - UPDATE_ALLOWED_FIELDS
    if disallowed:
        raise serializers.ValidationError(
            {"detail": ["Unsupported review update field."]}
        )

    requested_status = validated_data.get("status")
    if requested_status is not None:
        if (
            review.status != ReviewStatus.PENDING
            or requested_status != ReviewStatus.IN_REVIEW
        ):
            raise serializers.ValidationError(
                {"status": ["Only pending reviews can move to in review."]}
            )

    for field, value in validated_data.items():
        setattr(review, field, value)
    review.save()
    return review


def complete_review(review: ReviewRecord, actor) -> ReviewRecord:
    if review.status not in ACTIVE_STATUSES:
        raise serializers.ValidationError(
            {"detail": ["Only pending or in-review records can be completed."]}
        )

    review.status = ReviewStatus.COMPLETED
    review.completed_at = timezone.now()
    review.save(update_fields=["status", "completed_at", "updated_at"])
    return review


def cancel_review(review: ReviewRecord, actor) -> ReviewRecord:
    if review.status not in ACTIVE_STATUSES:
        raise serializers.ValidationError(
            {"detail": ["Only pending or in-review records can be cancelled."]}
        )

    review.status = ReviewStatus.CANCELLED
    review.save(update_fields=["status", "updated_at"])
    return review
