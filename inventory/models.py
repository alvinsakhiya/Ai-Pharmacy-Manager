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

class StockBatch(models.Model):
    medication = models.ForeignKey(
        Medication,
        on_delete=models.CASCADE,
        related_name="stock_batches"
    )

    batch_number = models.CharField(max_length=100)
    expiry_date = models.DateField()
    quantity = models.PositiveIntegerField(default=0)

    received_date = models.DateField()
    supplier = models.CharField(max_length=150, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["expiry_date"]
        unique_together = ("medication", "batch_number")

    def __str__(self):
        return f"{self.medication} | Batch: {self.batch_number} | Exp: {self.expiry_date}"