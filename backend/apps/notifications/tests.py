"""Notification API permission and immutability tests."""
import pytest

from apps.notifications.models import Notification


@pytest.fixture
def notification(db):
    return Notification.objects.create(
        level="warning",
        category="low_stock",
        title="Low stock test",
    )


@pytest.mark.django_db
def test_notification_records_cannot_be_created_or_deleted_directly(
    auth, notification
):
    client = auth("administrator")
    assert client.post(
        "/api/notifications/",
        {
            "level": "info",
            "category": "announcement",
            "title": "Injected",
        },
        format="json",
    ).status_code == 405
    assert client.delete(
        f"/api/notifications/{notification.id}/"
    ).status_code == 405


@pytest.mark.django_db
def test_dispenser_cannot_refresh_system_notifications(auth):
    assert auth("dispenser").post("/api/notifications/refresh/").status_code == 403
    assert auth("pharmacist").post("/api/notifications/refresh/").status_code == 200
