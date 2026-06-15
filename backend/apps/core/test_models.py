from .models import SoftDeleteModel, TenantScopedQuerySet, TimeStampedModel


def test_timestamped_model_is_abstract():
    assert TimeStampedModel._meta.abstract is True


def test_soft_delete_model_is_abstract():
    assert SoftDeleteModel._meta.abstract is True


def test_timestamped_model_exposes_timestamp_fields():
    assert TimeStampedModel._meta.get_field("created_at")
    assert TimeStampedModel._meta.get_field("updated_at")


def test_soft_delete_model_exposes_soft_delete_fields():
    assert SoftDeleteModel._meta.get_field("is_active")
    assert SoftDeleteModel._meta.get_field("deleted_at")


def test_tenant_scoped_queryset_exposes_for_user():
    assert hasattr(TenantScopedQuerySet, "for_user")
