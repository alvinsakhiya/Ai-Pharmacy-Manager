from django.db import models


class Medication(models.Model):
    FORM_CHOICES = [
        ("Tablet", "Tablet"),
        ("Capsule", "Capsule"),
        ("Liquid", "Liquid"),
        ("Cream", "Cream"),
        ("Inhaler", "Inhaler"),
        ("Injection", "Injection"),
        ("Other", "Other"),
    ]

    name = models.CharField(max_length=150)
    strength = models.CharField(max_length=50)

    form = models.CharField(
        max_length=20,
        choices=FORM_CHOICES
    )

    manufacturer = models.CharField(
        max_length=100,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} {self.strength} {self.form}"