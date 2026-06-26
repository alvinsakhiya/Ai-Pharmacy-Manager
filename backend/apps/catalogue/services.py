from django.db import IntegrityError, transaction

from apps.tenancy.models import Group

from .models import CatalogueProduct, Medication, MedicationForm


def _medication_form_from_product(product: CatalogueProduct) -> str:
    dose_form = product.dose_form.lower()

    if "tablet" in dose_form or "caplet" in dose_form or "dispersible" in dose_form:
        form = MedicationForm.TABLET
    elif "capsule" in dose_form:
        form = MedicationForm.CAPSULE
    elif "inhaler" in dose_form:
        form = MedicationForm.INHALER
    elif "injection" in dose_form:
        form = MedicationForm.INJECTION
    elif "cream" in dose_form or "ointment" in dose_form or "gel" in dose_form:
        form = MedicationForm.CREAM
    elif "liquid" in dose_form or "solution" in dose_form or "suspension" in dose_form:
        form = MedicationForm.LIQUID
    else:
        form = MedicationForm.OTHER

    return str(form)


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

    matching_medication = Medication.objects.filter(
        group=group,
        name=defaults["name"],
        form=defaults["form"],
        strength=defaults["strength"],
    ).first()
    if matching_medication is not None:
        if matching_medication.catalogue_product_id is None:
            matching_medication.catalogue_product = product
            if not matching_medication.manufacturer and defaults["manufacturer"]:
                matching_medication.manufacturer = defaults["manufacturer"]
                matching_medication.save(
                    update_fields=["catalogue_product", "manufacturer", "updated_at"]
                )
            else:
                matching_medication.save(
                    update_fields=["catalogue_product", "updated_at"]
                )
        elif not matching_medication.manufacturer and defaults["manufacturer"]:
            matching_medication.manufacturer = defaults["manufacturer"]
            matching_medication.save(update_fields=["manufacturer", "updated_at"])
        return matching_medication

    # If a concurrent request created the group/product row after our failed
    # insert, reuse it.
    return Medication.objects.get(group=group, catalogue_product=product)
