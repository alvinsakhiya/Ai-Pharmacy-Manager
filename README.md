# AI-Enhanced Pharmacy Stock Optimisation and Patient Dosette Management System

An original final-year Computing project exploring pharmacy stock optimisation,
expiry waste reduction, forecasting, and dosette patient workflows. It is an
academic prototype and does not integrate with NHS services or reproduce
proprietary pharmacy software.

## Clean-Slate Rebuild

This repository is being rebuilt from a deliberately clean foundation while
preserving the earlier work in Git history. The
`rebuild/at3-at4-foundation` branch establishes the AT3/AT4 project structure
before any pharmacy business features are introduced.

## Technology Stack

- Django 5 and Django REST Framework
- PostgreSQL
- React, TypeScript, and Vite
- Tailwind CSS
- Docker Compose for local development
- Ruff, pytest, ESLint, and pre-commit for quality checks

## Local Setup

Prerequisites: Python 3.12+, Node.js 22+, npm, and PostgreSQL.

```bash
cp .env.example .env

cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python manage.py migrate
python manage.py runserver
```

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

The frontend is available at `http://localhost:5173`, the API at
`http://localhost:8000`, and the health endpoint at
`http://localhost:8000/api/health/`.

For local development outside Docker, update `DATABASE_URL` so its hostname
points to your PostgreSQL server, usually `localhost`.

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

The Compose stack starts PostgreSQL, Django, and Vite with source directories
mounted for development. Stop it with `docker compose down`. Database data is
kept in the named `postgres_data` volume.

## Quality Checks

```bash
cd backend
ruff check .
ruff format --check .
pytest

cd ../frontend
npm run lint
npm run build
```

Install the optional Git hooks with `pre-commit install`.

## Phase 0 Scope

Phase 0 contains only the monorepo scaffold, environment-driven configuration,
database connection foundation, session/CSRF-ready settings, a health endpoint,
the placeholder frontend shell, local containers, and quality tooling.

Accounts, custom users, tenancy, auditing, medicines, stock, patients, dosette
or blister-pack workflows, forecasting, analytics, dashboards, reports, and
business settings are intentionally not implemented yet.
