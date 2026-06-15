import pytest

from .models import User


@pytest.mark.django_db
def test_create_user_normalizes_email():
    user = User.objects.create_user("Person@EXAMPLE.COM", "test-password")

    assert user.email == "Person@example.com"


@pytest.mark.django_db
def test_create_user_hashes_password():
    user = User.objects.create_user("person@example.com", "test-password")

    assert user.password != "test-password"
    assert user.check_password("test-password")


@pytest.mark.django_db
def test_create_user_defaults():
    user = User.objects.create_user("person@example.com", "test-password")

    assert user.is_staff is False
    assert user.is_superuser is False
    assert user.must_change_password is True


@pytest.mark.django_db
def test_create_user_requires_email():
    with pytest.raises(ValueError, match="Users must have an email address."):
        User.objects.create_user("", "test-password")


@pytest.mark.django_db
def test_create_superuser_defaults():
    user = User.objects.create_superuser("admin@example.com", "test-password")

    assert user.is_staff is True
    assert user.is_superuser is True
    assert user.must_change_password is False


@pytest.mark.django_db
def test_create_superuser_requires_staff_status():
    with pytest.raises(ValueError, match="Superuser must have is_staff=True."):
        User.objects.create_superuser(
            "admin@example.com",
            "test-password",
            is_staff=False,
        )


@pytest.mark.django_db
def test_create_superuser_requires_superuser_status():
    with pytest.raises(ValueError, match="Superuser must have is_superuser=True."):
        User.objects.create_superuser(
            "admin@example.com",
            "test-password",
            is_superuser=False,
        )


def test_user_string_representation():
    user = User(email="person@example.com")

    assert str(user) == user.email


def test_user_uses_email_as_username():
    assert User.USERNAME_FIELD == "email"
