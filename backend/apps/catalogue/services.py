from django.db import IntegrityError, transaction

from apps.tenancy.models import Group

from .models import CatalogueProduct, Medication, MedicationForm


def _medication_form_from_product(product: CatalogueProduct) -> str:
    dose_form = product.dose_form.lower()

    if "tablet" in dose_form or "caplet" in dose_form or "dispersible" in dose_form:
        return MedicationForm.TABLET
    if "capsule" in dose_form:
        return MedicationForm.CAPSULE
    if "inhaler" in dose_form:
        return MedicationForm.INHALER
    if "injection" in dose_form:
        return MedicationForm.INJECTION
    if "cream" in dose_form or "ointment" in dose_form or "gel" in dose_form:
        return MedicationForm.CREAM
    if "liquid" in dose_form or "solution" in dose_form or "suspension" in dose_form:
        return MedicationForm.LIQUID
    return MedicationForm.OTHER


def _medication_defaults_from_product(product: CatalogueProduct) -> dict[str, str]:
    return {
        "name": product.display_name,
        "form": _medication_form_from_product(product),
        "strength": product.strength,
        "manufacturer": product.manufacturer,
    }


def get_or_create_medication_from_product(
    group: Group,
    product: CatalogueProduct,
) -> Medication:
    defaults = _medication_defaults_from_product(product)

    try:
        with transaction.atomic():
            medication, _created = Medication.objects.get_or_create(
                group=group,
                catalogue_product=product,
                defaults=defaults,
            )
            return medication
    except IntegrityError:
        pass

    legacy_match = Medication.objects.filter(
        group=group,
        name=defaults["name"],
        form=defaults["form"],
        strength=defaults["strength"],
        catalogue_product__isnull=True,
    ).first()
    if legacy_match is not None:
        legacy_match.catalogue_product = product
        if not legacy_match.manufacturer and defaults["manufacturer"]:
            legacy_match.manufacturer = defaults["manufacturer"]
            legacy_match.save(
                update_fields=["catalogue_product", "manufacturer", "updated_at"]
            )
        else:
            legacy_match.save(update_fields=["catalogue_product", "updated_at"])
        return legacy_match

    return Medication.objects.get(group=group, catalogue_product=product)
