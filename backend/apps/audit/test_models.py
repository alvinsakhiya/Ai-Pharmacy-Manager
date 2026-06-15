import pytest

from .models import AuditAction, AuditEvent


@pytest.mark.django_db
def test_audit_event_create_succeeds():
    event = AuditEvent.objects.create(action=AuditAction.LOGIN)

    assert event.pk is not None


@pytest.mark.django_db
def test_audit_event_cannot_be_updated_with_instance_save():
    event = AuditEvent.objects.create(action=AuditAction.LOGIN)
    event.action = AuditAction.LOGOUT

    with pytest.raises(ValueError, match="append-only"):
        event.save()


@pytest.mark.django_db
def test_audit_event_cannot_be_deleted_with_instance_delete():
    event = AuditEvent.objects.create(action=AuditAction.LOGIN)

    with pytest.raises(ValueError, match="append-only"):
        event.delete()


def test_append_only_limitation_is_documented():
    assert "QuerySet.update()" in (AuditEvent.__doc__ or "")
    assert "raw SQL" in (AuditEvent.__doc__ or "")
