# Role-Based Access Control

The API uses Django authentication groups as pharmacy staff roles. React hides
irrelevant navigation, but every access decision is enforced again by Django
REST Framework.

## Roles

| Role | Main responsibilities |
| --- | --- |
| Manager | Full access, including audit history |
| Pharmacist | Patient and dosette management, picking lists, forecasts and safety alerts |
| Dispenser | Patient and dosette viewing, dosette updates and picking lists |
| Stock Assistant | Medication, batch and expiry-alert workflows |
| Read-only User | Dashboard and permitted read-only operational views |

Inventory records remain readable to patient-care roles because dosette and
picking workflows need medication context. Stock changes are restricted to
Managers and Stock Assistants. These roles can also review the immutable stock
movement ledger and record controlled adjustments.

## Account Assignment

Run `python manage.py migrate` after deployment. The role migration creates all
five groups and assigns existing active users to `Manager`, preserving access
for an existing installation.

Assign new users through Django Admin:

1. Open **Authentication and Authorization > Users**.
2. Select the staff account.
3. Add exactly one pharmacy role under **Groups**.
4. Save and ask the user to sign in again.

An authenticated account without a recognised pharmacy group receives the
least-privileged `Read-only User` access until a role is assigned. Superusers
are treated as Managers.

## Enforcement

The centralized permission classes in `backend/accounts/permissions.py`
control each HTTP method. A hidden React link is only a usability improvement;
direct API requests outside the staff member's role return HTTP `403`.
