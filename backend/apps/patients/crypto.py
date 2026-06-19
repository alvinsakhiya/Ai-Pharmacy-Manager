from cryptography.fernet import Fernet
from django.conf import settings


def _patient_field_key() -> bytes:
    key = settings.PATIENT_FIELD_KEY
    if isinstance(key, bytes):
        return key
    return str(key).encode()


def encrypt_str(value: str) -> str:
    return Fernet(_patient_field_key()).encrypt(value.encode()).decode()


def decrypt_str(token: str) -> str:
    return Fernet(_patient_field_key()).decrypt(token.encode()).decode()
