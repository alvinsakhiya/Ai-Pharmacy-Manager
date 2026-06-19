from django.db import migrations

import apps.patients.fields

SENSITIVE_PATIENT_FIELDS = (
    "first_name",
    "last_name",
    "date_of_birth",
    "address",
    "postcode",
    "phone",
    "notes",
)


def encrypt_patient_fields(apps, schema_editor) -> None:
    from apps.patients.crypto import encrypt_str

    Patient = apps.get_model("patients", "Patient")
    for patient in Patient.objects.all().iterator():
        updates = {}
        for field_name in SENSITIVE_PATIENT_FIELDS:
            value = getattr(patient, field_name)
            updates[field_name] = None if value is None else encrypt_str(str(value))
        Patient.objects.filter(pk=patient.pk).update(**updates)


def decrypt_patient_fields(apps, schema_editor) -> None:
    """Best-effort rollback; key loss or key rotation makes this impossible."""
    from apps.patients.crypto import decrypt_str

    Patient = apps.get_model("patients", "Patient")
    for patient in Patient.objects.all().iterator():
        updates = {}
        for field_name in SENSITIVE_PATIENT_FIELDS:
            value = getattr(patient, field_name)
            updates[field_name] = None if value is None else decrypt_str(str(value))
        Patient.objects.filter(pk=patient.pk).update(**updates)


class Migration(migrations.Migration):
    dependencies = [
        ("patients", "0002_patient_fields_to_text"),
    ]

    operations = [
        migrations.RunPython(encrypt_patient_fields, decrypt_patient_fields),
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name="patient",
                    name="first_name",
                    field=apps.patients.fields.EncryptedTextField(max_length=100),
                ),
                migrations.AlterField(
                    model_name="patient",
                    name="last_name",
                    field=apps.patients.fields.EncryptedTextField(max_length=100),
                ),
                migrations.AlterField(
                    model_name="patient",
                    name="date_of_birth",
                    field=apps.patients.fields.EncryptedDateField(),
                ),
                migrations.AlterField(
                    model_name="patient",
                    name="address",
                    field=apps.patients.fields.EncryptedTextField(blank=True),
                ),
                migrations.AlterField(
                    model_name="patient",
                    name="postcode",
                    field=apps.patients.fields.EncryptedTextField(
                        blank=True,
                        max_length=20,
                    ),
                ),
                migrations.AlterField(
                    model_name="patient",
                    name="phone",
                    field=apps.patients.fields.EncryptedTextField(
                        blank=True,
                        max_length=32,
                    ),
                ),
                migrations.AlterField(
                    model_name="patient",
                    name="notes",
                    field=apps.patients.fields.EncryptedTextField(blank=True),
                ),
            ],
        ),
    ]
