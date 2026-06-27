from django.db import models
from django.db.models import Q

from apps.core.models import TimeStampedModel


class CatalogueProductSource(models.TextChoices):
    DMD = "DMD", "dm+d"
    TRUD_DMD = "TRUD_DMD", "TRUD dm+d"
    SEED = "SEED", "Seed"
    MANUAL = "MANUAL", "Manual"


class CatalogueProductDmdType(models.TextChoices):
    VMP = "VMP", "Virtual medicinal product"
    AMP = "AMP", "Actual medicinal product"
    VMPP = "VMPP", "Virtual medicinal product pack"
    AMPP = "AMPP", "Actual medicinal product pack"


class CatalogueProduct(TimeStampedModel):
    dmd_code = models.CharField(max_length=64, blank=True, db_index=True)
    source = models.CharField(
        max_length=16,
        choices=CatalogueProductSource.choices,
        default=CatalogueProductSource.SEED,
    )
    dmd_type = models.CharField(
        max_length=8,
        choices=CatalogueProductDmdType.choices,
        blank=True,
        db_index=True,
    )
    parent_dmd_code = models.CharField(max_length=64, blank=True, db_index=True)
    vmp_name = models.CharField(max_length=255, blank=True)
    amp_name = models.CharField(max_length=255, blank=True)
    display_name = models.CharField(max_length=255)
    ingredient = models.CharField(max_length=255, blank=True)
    strength = models.CharField(max_length=64, blank=True)
    dose_form = models.CharField(max_length=64, blank=True)
    pack_size = models.PositiveIntegerField(null=True, blank=True)
    pack_unit = models.CharField(max_length=64, blank=True)
    manufacturer = models.CharField(max_length=255, blank=True)
    release_version = models.CharField(max_length=64, blank=True)
    release_file = models.CharField(max_length=255, blank=True)
    appearance_colour = models.CharField(max_length=64, blank=True)
    appearance_shape = models.CharField(max_length=64, blank=True)
    appearance_form = models.CharField(max_length=64, blank=True)
    search_text = models.TextField(blank=True, db_index=True)
    is_active = models.BooleanField(default=True)
    is_discontinued = models.BooleanField(default=False)

    objects = models.Manager()

    class Meta:
        ordering = ["display_name", "pack_size"]
        indexes = [
            models.Index(fields=["display_name"], name="catalogue_product_name_idx"),
            models.Index(fields=["ingredient"], name="catalogue_product_ing_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["dmd_code"],
                condition=~Q(dmd_code=""),
                name="unique_catalogue_product_dmd_code",
            ),
        ]

    def __str__(self) -> str:
        return self.full_label

    @property
    def full_label(self) -> str:
        label = self.display_name.strip()
        if self.pack_size is None:
            return label

        pack = f"pack of {self.pack_size}"
        if self.pack_unit:
            pack = f"{pack} {self.pack_unit.strip()}"
        return f"{label} \u2014 {pack}"

    def build_search_text(self) -> str:
        values = [
            self.dmd_code,
            self.dmd_type,
            self.parent_dmd_code,
            self.vmp_name,
            self.amp_name,
            self.display_name,
            self.ingredient,
            self.strength,
            self.dose_form,
            str(self.pack_size or ""),
            self.pack_unit,
            self.manufacturer,
            self.appearance_colour,
            self.appearance_shape,
            self.appearance_form,
            self.release_version,
            self.release_file,
            self.full_label,
        ]
        return " ".join(value.strip().lower() for value in values if value).strip()

    def save(self, *args, **kwargs):
        self.search_text = self.build_search_text()
        super().save(*args, **kwargs)


class MedicationForm(models.TextChoices):
    TABLET = "TABLET", "Tablet"
    CAPSULE = "CAPSULE", "Capsule"
    LIQUID = "LIQUID", "Liquid"
    CREAM = "CREAM", "Cream"
    INHALER = "INHALER", "Inhaler"
    INJECTION = "INJECTION", "Injection"
    OTHER = "OTHER", "Other"


class Medication(TimeStampedModel):
    tenant_group_id_field = "group"

    group = models.ForeignKey(
        "tenancy.Group",
        on_delete=models.PROTECT,
        related_name="medications",
    )
    catalogue_product = models.ForeignKey(
        CatalogueProduct,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="medications",
    )
    name = models.CharField(max_length=255)
    form = models.CharField(max_length=32, choices=MedicationForm.choices)
    strength = models.CharField(max_length=64)
    manufacturer = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    objects = models.Manager()

    class Meta:
        ordering = ["name", "strength"]
        constraints = [
            models.UniqueConstraint(
                fields=["group", "name", "form", "strength"],
                name="unique_medication_per_group",
            ),
            models.UniqueConstraint(
                fields=["group", "catalogue_product"],
                condition=Q(catalogue_product__isnull=False),
                name="unique_medication_catalogue_product_per_group",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} {self.strength}"
