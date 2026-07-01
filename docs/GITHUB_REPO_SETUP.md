# GitHub Repository Setup

Suggestions for presenting the repository on GitHub. Nothing here is applied
automatically — apply the parts you want manually in the GitHub UI or with the
`gh` CLI once you are authenticated.

## About description

> Secure pharmacy operations system for stock control, MDS/dosette workflows,
> expiry review, audit logging, and explainable stock intelligence.

## Topics

```
django
react
typescript
postgresql
pharmacy-management
inventory-management
healthcare-operations
docker
vite
tailwindcss
rest-api
```

## Website

Leave blank unless a deployed URL exists.

## Release notes template

Use for a tagged release (e.g. `v1.0.0`). Tagging is a manual step — this is a
template only.

```markdown
# v1.0.0 — Final COM668 demo build

## Highlights
- Role-based pharmacy operations: dashboard, inventory (batches/FEFO),
  patients, dosette/MDS workflow, reports, and explainable stock intelligence.
- Security: session auth, RBAC with tenant scoping, audit logging,
  application-level patient field encryption at rest, and AES-256-GCM
  encrypted group backups.
- PostgreSQL runtime; Docker Compose for local development.

## Setup
- `cp .env.example .env`, then `docker compose up --build`.
- `docker compose exec backend python manage.py migrate`
- `docker compose exec backend python manage.py seed_demo` (fictional data).
- Frontend: http://localhost:5173 · Backend: http://localhost:8000

## Known limitations
- Development-oriented Docker setup (Django runserver, Vite dev server); a
  production profile needs a WSGI/ASGI server and a built static frontend.
- Intelligence is explainable, deterministic arithmetic (moving-average
  forecasting, FEFO expiry, deterministic MDS demand, additive review scoring,
  transfer-opportunity review) — advisory only; human review is required and
  nothing is ordered, transferred, or dispensed automatically.
- Fictional/synthetic data only; no regulatory or compliance claims.
```

## Packages

No packages are published. The Docker images are built locally by
`docker compose` and are not pushed to a registry, and nothing is published to
npm or PyPI. Only publish images/packages if you deliberately set up a registry
and release pipeline.

## Tags and history

Inspect existing tags and history before creating a release (read-only):

```bash
git tag --list --sort=-creatordate
git log --oneline --decorate --graph --all --max-count=40
# If gh is authenticated:
gh release list
```

Do **not** delete or rewrite existing tags without explicit approval.

## Suggested repository files (already present)

- `README.md` — project overview and setup
- `docs/` — the documentation set (project map, API, schema, deployment,
  security, backups, forecasting, diagrams)
- `.env.example` — environment template
- `.github/workflows/` — CI (lint, type-check, tests) and E2E workflows
