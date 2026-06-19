from django.db import migrations, models


def backfill_last_name_index(apps, schema_editor) -> None:
    from apps.patients.crypto import blind_index

    Patient = apps.get_model("patients", "Patient")
    for patient in Patient.objects.all().iterator():
        Patient.objects.filter(pk=patient.pk).update(
            last_name_index=blind_index(patient.last_name)
        )


class Migration(migrations.Migration):
    dependencies = [
        ("patients", "0003_encrypt_patient_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="patient",
            name="last_name_index",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                max_length=64,
            ),
        ),
        migrations.RunPython(backfill_last_name_index, migrations.RunPython.noop),
    ]
