import hashlib
import hmac

from cryptography.fernet import Fernet
from django.conf import settings


def _patient_field_key() -> bytes:
    key = settings.PATIENT_FIELD_KEY
    if isinstance(key, bytes):
        return key
    return str(key).encode()


def _patient_index_key() -> bytes:
    key = settings.PATIENT_INDEX_KEY
    if isinstance(key, bytes):
        return key
    return str(key).encode()


def encrypt_str(value: str) -> str:
    return Fernet(_patient_field_key()).encrypt(value.encode()).decode()


def decrypt_str(token: str) -> str:
    return Fernet(_patient_field_key()).decrypt(token.encode()).decode()


def normalize_name(value: str) -> str:
    return " ".join(str(value).split()).casefold()


def blind_index(value: str) -> str:
    normalized = normalize_name(value)
    if not normalized:
        return ""
    return hmac.new(
        _patient_index_key(),
        normalized.encode(),
        hashlib.sha256,
    ).hexdigest()
