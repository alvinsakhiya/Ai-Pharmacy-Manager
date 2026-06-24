# Medication Catalogue Import

## Purpose

AI Pharmacy Manager uses a canonical medication catalogue so pharmacy staff do
not manually type medicine names, strengths, forms, manufacturers, or pack
sizes. Using catalogue products helps reduce spelling mistakes, wrong strength
text, duplicate medicines, and inconsistent stock or MDS/Dosette records.

## Demo Seed Versus Full Import

`seed_catalogue` provides a demo/offline subset of around 101 products. This is
enough for project demos, local development, and automated testing, but it is
not intended to represent the full UK medicines catalogue.

Run the demo seed with:

```bash
python manage.py seed_catalogue
```

## Optional dm+d Reference Catalogue Import

`import_dmd` imports a prepared dm+d-style JSON reference extract into the local
catalogue. This is an offline/imported reference catalogue snapshot. It does not
connect to NHS systems, does not perform clinical decision-making, and does not
automatically update medicines from the internet.

Run an import with:

```bash
python manage.py import_dmd path/to/catalogue.json
```

Preview an import without writing changes:

```bash
python manage.py import_dmd path/to/catalogue.json --dry-run
```

## Expected JSON Format

The command accepts either a JSON list:

```json
[
  {
    "dmd_code": "123456789",
    "display_name": "Amlodipine 5mg tablets",
    "ingredient": "Amlodipine",
    "strength": "5mg",
    "dose_form": "tablets",
    "pack_size": 28,
    "pack_unit": "tablets",
    "manufacturer": "Example Manufacturer"
  }
]
```

Or an object wrapper with a `products` list:

```json
{
  "products": [
    {
      "dmd_code": "123456789",
      "display_name": "Amlodipine 5mg tablets",
      "ingredient": "Amlodipine",
      "strength": "5mg",
      "dose_form": "tablets",
      "pack_size": 28,
      "pack_unit": "tablets",
      "manufacturer": "Example Manufacturer"
    }
  ]
}
```

## Import Behaviour

The import command upserts products by `dmd_code`. If a matching product exists,
it updates that catalogue product. If no matching product exists, it creates a
new catalogue product. Invalid rows are skipped safely with warning output, and
the command reports created, updated, and skipped counts.

The import does not create stock, patient records, or MDS/Dosette records. It
does not change inventory quantities.

## How The App Uses Catalogue Products

Inventory -> Add Stock uses the catalogue selector directly. MDS/Dosette
medication selection uses catalogue-backed medication records. Medication
Catalogue/Library is for administration and legacy review; daily users should
not manually create medicine names.

## Safety And Limitations

Imported data must be reviewed by an authorised user. Catalogue data supports
stock and operational workflows only. It does not provide clinical advice, does
not place automatic orders, and does not trigger automatic transfers. Human
review is required.

## Future Improvements

Future catalogue work may include full TRUD/dm+d parser support, an automated
validation report, an import preview UI, inactive/deprecated product handling,
stronger search indexing, and mapping legacy medication records to catalogue
products.
