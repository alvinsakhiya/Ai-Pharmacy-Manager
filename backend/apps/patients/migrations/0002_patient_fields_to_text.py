from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("patients", "0001_initial"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="patient",
            options={"ordering": ["patient_reference"]},
        ),
        migrations.AlterField(
            model_name="patient",
            name="first_name",
            field=models.TextField(max_length=100),
        ),
        migrations.AlterField(
            model_name="patient",
            name="last_name",
            field=models.TextField(max_length=100),
        ),
        migrations.AlterField(
            model_name="patient",
            name="date_of_birth",
            field=models.TextField(),
        ),
        migrations.AlterField(
            model_name="patient",
            name="postcode",
            field=models.TextField(blank=True, max_length=20),
        ),
        migrations.AlterField(
            model_name="patient",
            name="phone",
            field=models.TextField(blank=True, max_length=32),
        ),
    ]
