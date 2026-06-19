from datetime import date
from string import hexdigits

import pytest
from cryptography.fernet import Fernet, InvalidToken
from django.db import connection
from django.test import override_settings

from apps.tenancy.models import Group, Pharmacy

from .crypto import blind_index, decrypt_str
from .models import Patient


def make_pharmacy() -> Pharmacy:
    group = Group.objects.create(name="Encryption Group", slug="encryption-group")
    return Pharmacy.objects.create(group=group, name="Encryption Pharmacy", code="ENC")


def make_patient() -> Patient:
    return Patient.objects.create(
        pharmacy=make_pharmacy(),
        patient_reference="ENC-001",
        first_name="PlainFirst",
        last_name="PlainLast",
        date_of_birth=date(1982, 7, 15),
        address="1 Plain Street",
        postcode="PL1 1AA",
        phone="020 0000 0555",
        notes="Plain sensitive notes",
    )


@pytest.mark.django_db
def test_sensitive_patient_fields_round_trip():
    patient = make_patient()

    refetched = Patient.objects.get(pk=patient.pk)

    assert refetched.first_name == "PlainFirst"
    assert refetched.last_name == "PlainLast"
    assert refetched.date_of_birth == date(1982, 7, 15)
    assert refetched.address == "1 Plain Street"
    assert refetched.postcode == "PL1 1AA"
    assert refetched.phone == "020 0000 0555"
    assert refetched.notes == "Plain sensitive notes"


@pytest.mark.django_db
def test_raw_database_storage_does_not_contain_plaintext():
    patient = make_patient()

    with connection.cursor() as cursor:
        cursor.execute(
            (
                f"SELECT first_name, last_name, notes "
                f"FROM {Patient._meta.db_table} WHERE id = %s"
            ),
            [patient.pk],
        )
        raw_first_name, raw_last_name, raw_notes = cursor.fetchone()

    assert raw_first_name != "PlainFirst"
    assert raw_last_name != "PlainLast"
    assert raw_notes != "Plain sensitive notes"
    assert "PlainFirst" not in raw_first_name
    assert "PlainLast" not in raw_last_name
    assert "Plain sensitive notes" not in raw_notes
    assert decrypt_str(raw_first_name) == "PlainFirst"
    assert decrypt_str(raw_last_name) == "PlainLast"
    assert decrypt_str(raw_notes) == "Plain sensitive notes"


@pytest.mark.django_db
def test_wrong_patient_field_key_cannot_decrypt_stored_token():
    patient = make_patient()

    with connection.cursor() as cursor:
        cursor.execute(
            f"SELECT first_name FROM {Patient._meta.db_table} WHERE id = %s",
            [patient.pk],
        )
        (raw_first_name,) = cursor.fetchone()

    wrong_key = Fernet.generate_key().decode()
    with override_settings(PATIENT_FIELD_KEY=wrong_key), pytest.raises(InvalidToken):
        decrypt_str(raw_first_name)


def test_patient_default_ordering_uses_plaintext_reference():
    assert Patient._meta.ordering == ["patient_reference"]


@pytest.mark.django_db
def test_last_name_blind_index_is_generated():
    patient = make_patient()

    assert len(patient.last_name_index) == 64
    assert all(char in hexdigits for char in patient.last_name_index)
    assert patient.last_name_index != "PlainLast"
    assert patient.last_name_index == blind_index(patient.last_name)


@pytest.mark.django_db
def test_raw_last_name_blind_index_is_stored_without_plaintext():
    patient = make_patient()

    with connection.cursor() as cursor:
        cursor.execute(
            f"SELECT last_name_index FROM {Patient._meta.db_table} WHERE id = %s",
            [patient.pk],
        )
        (raw_last_name_index,) = cursor.fetchone()

    assert len(raw_last_name_index) == 64
    assert all(char in hexdigits for char in raw_last_name_index)
    assert raw_last_name_index != "PlainLast"
    assert raw_last_name_index == blind_index("PlainLast")
