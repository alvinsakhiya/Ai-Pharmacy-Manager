from datetime import date

from django.core.exceptions import ValidationError
from django.db import models
from django.utils.dateparse import parse_date

from .crypto import decrypt_str, encrypt_str


class EncryptedTextField(models.TextField):
    description = "Encrypted text"

    def get_internal_type(self) -> str:
        return "TextField"

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value is None:
            return None
        return encrypt_str(str(value))

    def from_db_value(self, value, expression, connection):
        if value is None:
            return None
        return decrypt_str(value)

    def to_python(self, value):
        if value is None:
            return None
        return str(value)


class EncryptedDateField(models.TextField):
    description = "Encrypted date"

    def get_internal_type(self) -> str:
        return "TextField"

    def get_prep_value(self, value):
        value = self.to_python(value)
        if value is None:
            return None
        return encrypt_str(value.isoformat())

    def from_db_value(self, value, expression, connection):
        if value is None:
            return None
        return self.to_python(decrypt_str(value))

    def to_python(self, value):
        if value is None or isinstance(value, date):
            return value
        parsed = parse_date(str(value))
        if parsed is None:
            raise ValidationError("Enter a valid date.")
        return parsed
