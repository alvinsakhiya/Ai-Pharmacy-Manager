"""Authenticated encryption for backup archives.

Backup ``data.json`` payloads contain decrypted patient and stock records (the
``EncryptedTextField`` columns are decrypted on read before Django serialises
them). To keep those archives safe at rest we wrap the whole zip payload in
AES-256-GCM, an authenticated cipher: the 128-bit GCM tag means a wrong key or a
tampered file fails to decrypt instead of returning garbage.

The key is supplied through the ``BACKUP_ENCRYPTION_KEY`` environment variable
and is never written into the archive, the manifest, or the logs. Generate one
with ``python manage.py generate_backup_key``.
"""

from __future__ import annotations

import base64
import binascii
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings

# Magic header stored in clear so read paths can tell an encrypted archive from a
# legacy plain zip without needing the key first.
MAGIC = b"AIPMB1"
NONCE_SIZE = 12
KEY_SIZE = 32  # AES-256
ALGORITHM = "AES-256-GCM"


class BackupEncryptionError(Exception):
    """Base class for backup encryption problems."""


class BackupKeyError(BackupEncryptionError):
    """The configured key is missing or malformed."""


class BackupDecryptionError(BackupEncryptionError):
    """Payload could not be authenticated (wrong key or corrupt/tampered file)."""


def generate_key() -> str:
    """Return a fresh base64 32-byte key suitable for ``BACKUP_ENCRYPTION_KEY``."""
    return base64.urlsafe_b64encode(os.urandom(KEY_SIZE)).decode()


def _pad(value: str) -> str:
    return value + "=" * (-len(value) % 4)


def _load_key() -> bytes | None:
    """Return the configured 32-byte key, or ``None`` when unset.

    Accepts standard or URL-safe base64. Raises :class:`BackupKeyError` when a
    value is present but cannot decode to exactly 32 bytes.
    """
    raw = (getattr(settings, "BACKUP_ENCRYPTION_KEY", "") or "").strip()
    if not raw:
        return None
    key: bytes | None = None
    for decoder in (base64.urlsafe_b64decode, base64.b64decode):
        try:
            key = decoder(_pad(raw))
            break
        except (binascii.Error, ValueError):
            continue
    if key is None:
        raise BackupKeyError("BACKUP_ENCRYPTION_KEY is not valid base64.")
    if len(key) != KEY_SIZE:
        raise BackupKeyError(
            "BACKUP_ENCRYPTION_KEY must decode to 32 bytes for AES-256."
        )
    return key


def encryption_required() -> bool:
    return bool(getattr(settings, "BACKUP_ENCRYPTION_REQUIRED", False))


def encryption_available() -> bool:
    """True when a usable key is configured (never raises)."""
    try:
        return _load_key() is not None
    except BackupKeyError:
        return False


def encryption_available_or_raise() -> bool:
    """True when a usable key is configured, False when no key is set.

    Raises :class:`BackupKeyError` when a key is present but malformed, so a bad
    key can never silently downgrade a backup to plaintext.
    """
    return _load_key() is not None


def is_encrypted_payload(blob: bytes) -> bool:
    return blob[: len(MAGIC)] == MAGIC


def encrypt(plaintext: bytes) -> bytes:
    key = _load_key()
    if key is None:
        raise BackupKeyError("BACKUP_ENCRYPTION_KEY is not configured.")
    nonce = os.urandom(NONCE_SIZE)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext, None)
    return MAGIC + nonce + ciphertext


def decrypt(blob: bytes) -> bytes:
    key = _load_key()
    if key is None:
        raise BackupKeyError("BACKUP_ENCRYPTION_KEY is not configured.")
    # Reject anything too short to contain a full nonce (a truncated file would
    # otherwise make AESGCM raise a bare ValueError for the short nonce).
    if not is_encrypted_payload(blob) or len(blob) < len(MAGIC) + NONCE_SIZE:
        raise BackupDecryptionError("Payload is not a valid encrypted backup archive.")
    nonce = blob[len(MAGIC) : len(MAGIC) + NONCE_SIZE]
    ciphertext = blob[len(MAGIC) + NONCE_SIZE :]
    try:
        return AESGCM(key).decrypt(nonce, ciphertext, None)
    except (InvalidTag, ValueError) as exc:
        raise BackupDecryptionError(
            "Backup could not be decrypted. The encryption key is wrong "
            "or the archive is corrupt."
        ) from exc
