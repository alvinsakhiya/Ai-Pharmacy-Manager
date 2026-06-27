# TRUD dm+d Reference Data Import

This workflow imports a TRUD dm+d reference release into the local medicine
catalogue. It is an admin-reviewed reference import for catalogue maintenance,
not an external service connection or runtime clinical feature.

Downloaded release ZIP files and any extracted working files must stay under
`backend/tmp/trud/`. Do not commit TRUD release ZIPs, extracted XML, logs with
keys, or local environment files containing real keys.

## Environment

Set these values locally before using `--latest`:

```bash
TRUD_API_KEY=
TRUD_DMD_ITEM_ID=24
TRUD_DMD_RELEASE_FILE=nhsbsa_dmd_6.3.0_20260622000001.zip
```

`TRUD_API_KEY` must be a local secret. Rotate the key if it is exposed in a
terminal log, shared file, screenshot, or commit.

## Commands

From `backend/`, run a local ZIP dry-run:

```bash
python manage.py import_trud_dmd --file tmp/trud/nhsbsa_dmd_6.3.0_20260622000001.zip --dry-run
```

Import from a local ZIP:

```bash
python manage.py import_trud_dmd --file tmp/trud/nhsbsa_dmd_6.3.0_20260622000001.zip
```

Download the configured TRUD reference release and dry-run it:

```bash
python manage.py import_trud_dmd --latest --dry-run
```

Download and import the configured TRUD reference release:

```bash
python manage.py import_trud_dmd --latest
```

For a small test import, add `--limit 1000`. To import only selected product
classes, repeat `--type`, for example `--type VMP --type AMP`.

The command reports parsed, created, updated, unchanged, skipped, and invalid
counts. Dry-runs do not write catalogue rows. Re-running an import upserts by
dm+d code and should not create duplicates.

## Catalogue Mapping

The import maps VMP, AMP, VMPP, and AMPP rows into `CatalogueProduct` with:

- dm+d code and product type
- display name from the dm+d product name/description
- parent dm+d code when present
- structured strength, pack size, pack unit, and supplier where safely available
- TRUD release file/version metadata
- active/discontinued flags only when represented by clear release fields

When structured strength, form, pack, unit, or supplier details are not present,
the importer leaves those fields blank rather than deriving unreliable values
from free text. Search remains anchored on the imported display name and dm+d
code.

This import is for admin/reference maintenance only. Catalogue rows should be
reviewed before being used for local pharmacy workflows.
