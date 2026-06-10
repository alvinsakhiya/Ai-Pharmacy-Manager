from django.db import models


class Patient(models.Model):
    first_name = models.CharField(max_length=100)

    last_name = models.CharField(max_length=100)

    date_of_birth = models.DateField()

    contact_number = models.CharField(
        max_length=20,
        blank=True
    )

    notes = models.TextField(
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"