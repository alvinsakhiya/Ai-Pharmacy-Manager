from django.core.management.base import BaseCommand

from apps.catalogue.models import CatalogueProduct, CatalogueProductSource

SEED_PRODUCTS = [
    ("Amlodipine", "5mg", "tablets", 28, ""),
    ("Amlodipine", "10mg", "tablets", 28, ""),
    ("Paracetamol", "500mg", "tablets", 100, ""),
    ("Paracetamol", "500mg", "caplets", 32, ""),
    ("Ibuprofen", "200mg", "tablets", 48, ""),
    ("Ibuprofen", "400mg", "tablets", 48, ""),
    ("Atorvastatin", "10mg", "tablets", 28, ""),
    ("Atorvastatin", "20mg", "tablets", 28, ""),
    ("Atorvastatin", "40mg", "tablets", 28, ""),
    ("Atorvastatin", "80mg", "tablets", 28, ""),
    ("Simvastatin", "10mg", "tablets", 28, ""),
    ("Simvastatin", "20mg", "tablets", 28, ""),
    ("Simvastatin", "40mg", "tablets", 28, ""),
    ("Ramipril", "1.25mg", "capsules", 28, ""),
    ("Ramipril", "2.5mg", "capsules", 28, ""),
    ("Ramipril", "5mg", "capsules", 28, ""),
    ("Ramipril", "10mg", "capsules", 28, ""),
    ("Lansoprazole", "15mg", "capsules", 28, ""),
    ("Lansoprazole", "30mg", "capsules", 28, ""),
    ("Omeprazole", "10mg", "capsules", 28, ""),
    ("Omeprazole", "20mg", "capsules", 28, ""),
    ("Omeprazole", "40mg", "capsules", 28, ""),
    ("Metformin", "500mg", "tablets", 56, ""),
    ("Metformin", "850mg", "tablets", 56, ""),
    ("Metformin", "1g", "tablets", 56, ""),
    ("Levothyroxine", "25mcg", "tablets", 28, ""),
    ("Levothyroxine", "50mcg", "tablets", 28, ""),
    ("Levothyroxine", "100mcg", "tablets", 28, ""),
    ("Sertraline", "50mg", "tablets", 28, ""),
    ("Sertraline", "100mg", "tablets", 28, ""),
    ("Salbutamol", "100mcg", "inhaler", 1, ""),
    ("Furosemide", "20mg", "tablets", 28, ""),
    ("Furosemide", "40mg", "tablets", 28, ""),
    ("Aspirin", "75mg", "dispersible tablets", 28, ""),
    ("Bisoprolol", "1.25mg", "tablets", 28, ""),
    ("Bisoprolol", "2.5mg", "tablets", 28, ""),
    ("Bisoprolol", "5mg", "tablets", 28, ""),
    ("Bisoprolol", "10mg", "tablets", 28, ""),
    ("Losartan", "25mg", "tablets", 28, ""),
    ("Losartan", "50mg", "tablets", 28, ""),
    ("Losartan", "100mg", "tablets", 28, ""),
    ("Candesartan", "4mg", "tablets", 28, ""),
    ("Candesartan", "8mg", "tablets", 28, ""),
    ("Candesartan", "16mg", "tablets", 28, ""),
    ("Doxazosin", "1mg", "tablets", 28, ""),
    ("Doxazosin", "2mg", "tablets", 28, ""),
    ("Doxazosin", "4mg", "tablets", 28, ""),
    ("Gliclazide", "40mg", "tablets", 56, ""),
    ("Gliclazide", "80mg", "tablets", 56, ""),
    ("Empagliflozin", "10mg", "tablets", 28, ""),
    ("Empagliflozin", "25mg", "tablets", 28, ""),
    ("Sitagliptin", "100mg", "tablets", 28, ""),
    ("Amitriptyline", "10mg", "tablets", 28, ""),
    ("Amitriptyline", "25mg", "tablets", 28, ""),
    ("Citalopram", "10mg", "tablets", 28, ""),
    ("Citalopram", "20mg", "tablets", 28, ""),
    ("Fluoxetine", "20mg", "capsules", 30, ""),
    ("Mirtazapine", "15mg", "tablets", 28, ""),
    ("Mirtazapine", "30mg", "tablets", 28, ""),
    ("Codeine phosphate", "15mg", "tablets", 28, ""),
    ("Codeine phosphate", "30mg", "tablets", 28, ""),
    ("Co-codamol", "8mg/500mg", "tablets", 100, ""),
    ("Co-codamol", "30mg/500mg", "tablets", 100, ""),
    ("Naproxen", "250mg", "tablets", 56, ""),
    ("Naproxen", "500mg", "tablets", 56, ""),
    ("Diclofenac", "1%", "gel", 100, "g"),
    ("Loratadine", "10mg", "tablets", 30, ""),
    ("Cetirizine", "10mg", "tablets", 30, ""),
    ("Fexofenadine", "120mg", "tablets", 30, ""),
    ("Fexofenadine", "180mg", "tablets", 30, ""),
    ("Prednisolone", "5mg", "tablets", 28, ""),
    ("Amoxicillin", "250mg", "capsules", 21, ""),
    ("Amoxicillin", "500mg", "capsules", 21, ""),
    ("Phenoxymethylpenicillin", "250mg", "tablets", 28, ""),
    ("Doxycycline", "100mg", "capsules", 8, ""),
    ("Trimethoprim", "200mg", "tablets", 6, ""),
    ("Nitrofurantoin", "50mg", "capsules", 28, ""),
    ("Nitrofurantoin", "100mg", "capsules", 6, ""),
    ("Clopidogrel", "75mg", "tablets", 28, ""),
    ("Apixaban", "2.5mg", "tablets", 56, ""),
    ("Apixaban", "5mg", "tablets", 56, ""),
    ("Rivaroxaban", "10mg", "tablets", 28, ""),
    ("Rivaroxaban", "20mg", "tablets", 28, ""),
    ("Warfarin", "1mg", "tablets", 28, ""),
    ("Warfarin", "3mg", "tablets", 28, ""),
    ("Warfarin", "5mg", "tablets", 28, ""),
    ("Ferrous sulfate", "200mg", "tablets", 28, ""),
    ("Folic acid", "5mg", "tablets", 28, ""),
    ("Colecalciferol", "800unit", "capsules", 30, ""),
    ("Adcal-D3", "1.5g/400unit", "chewable tablets", 56, ""),
    ("Senna", "7.5mg", "tablets", 60, ""),
    ("Lactulose", "3.1g/5ml", "solution", 500, "ml"),
    ("Movicol", "13.8g", "sachets", 30, ""),
    ("Carbocisteine", "375mg", "capsules", 120, ""),
    ("Beclometasone", "100mcg", "inhaler", 1, ""),
    ("Beclometasone", "200mcg", "inhaler", 1, ""),
    ("Tiotropium", "18mcg", "inhalation capsules", 30, ""),
    ("Gabapentin", "100mg", "capsules", 100, ""),
    ("Gabapentin", "300mg", "capsules", 100, ""),
    ("Pregabalin", "75mg", "capsules", 56, ""),
    ("Pregabalin", "150mg", "capsules", 56, ""),
]


class Command(BaseCommand):
    help = "Seed a realistic demo subset of canonical medication products."

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        # Full dm+d reference catalogue loads use the separate import_dmd command.
        for index, (ingredient, strength, dose_form, pack_size, pack_unit) in enumerate(
            SEED_PRODUCTS,
            start=1,
        ):
            dmd_code = f"SEED-{index:04d}"
            display_name = f"{ingredient} {strength} {dose_form}"
            product, created = CatalogueProduct.objects.update_or_create(
                dmd_code=dmd_code,
                defaults={
                    "source": CatalogueProductSource.SEED,
                    "vmp_name": display_name,
                    "amp_name": "",
                    "display_name": display_name,
                    "ingredient": ingredient,
                    "strength": strength,
                    "dose_form": dose_form,
                    "pack_size": pack_size,
                    "pack_unit": pack_unit,
                    "manufacturer": "",
                    "appearance_colour": "",
                    "appearance_shape": "",
                    "appearance_form": dose_form,
                    "is_active": True,
                },
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        total = CatalogueProduct.objects.filter(
            source=CatalogueProductSource.SEED,
            dmd_code__startswith="SEED-",
        ).count()
        self.stdout.write(
            self.style.SUCCESS(
                "Seeded catalogue products: "
                f"{created_count} created, {updated_count} updated, {total} total."
            )
        )
