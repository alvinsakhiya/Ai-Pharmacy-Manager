import pytest
from django.contrib import admin

from .admin import AuditEventAdmin
from .models import AuditEvent


@pytest.fixture
def audit_admin() -> AuditEventAdmin:
    return admin.site._registry[AuditEvent]


def test_audit_admin_disallows_add(audit_admin):
    assert audit_admin.has_add_permission(None) is False


def test_audit_admin_disallows_change(audit_admin):
    assert audit_admin.has_change_permission(None) is False


def test_audit_admin_disallows_delete(audit_admin):
    assert audit_admin.has_delete_permission(None) is False
