# Architecture

## Overview

Pharmacy Manager is a **decoupled single-page application + REST API**. The React SPA owns all
presentation and client-side routing; the Django REST Framework API owns business logic, data
integrity, authentication and the forecasting engine. They communicate over JSON with stateless
JWT authentication, which keeps the API horizontally scalable and lets the frontend be served as
static assets from a CDN/nginx.

```mermaid
flowchart LR
    subgraph Client
        SPA["React SPA<br/>Vite · Tailwind · Recharts<br/>(served by nginx in prod)"]
    end

    subgraph API["Django REST Framework"]
        AUTH["accounts<br/>JWT · RBAC · audit"]
        CORE["core<br/>base models · audit · middleware"]
        PAT["patients"]
        DIR["directions<br/>approved label phrases"]
        STK["stock<br/>FEFO · batches · movements · usage"]
        DOS["dosette<br/>plans · cycles · due dates"]
        PCK["picking<br/>lists · generation"]
        FC["forecasting<br/>numpy / statsmodels engine"]
        NOT["notifications"]
        REP["reports<br/>dashboard · PDF/CSV"]
        WRK["workflow<br/>dispensing pipeline · audit"]
    end

    DB[("PostgreSQL")]
    RDS[("Redis<br/>(future jobs)")]

    SPA -->|"HTTPS / JSON · Bearer JWT"| AUTH
    SPA --> PAT & DIR & STK & DOS & PCK & FC & NOT & REP & WRK
    AUTH --- CORE
    PAT & DIR & STK & DOS & PCK & NOT & REP & WRK --> DB
    FC --> STK
    REP --> FC
    PCK --> DOS
    NOT --> STK & DOS
    API -.->|"roadmap"| RDS
```

## Layered design (backend)

Each domain app follows the same vertical slice so the codebase is predictable:

```
models.py        →  data + invariants (e.g. FEFO ordering, cycle generation)
services.py      →  cross-model business operations (FEFO allocation, picking generation,
                    notification scanning) kept out of views for testability
serializers.py   →  API representation & validation
views.py         →  thin DRF ViewSets/APIViews wiring permissions + serializers + services
permissions.py   →  (core) reusable RBAC gates
urls.py          →  router registration
```

**Why services are separate from views:** business rules (FEFO allocation, forecasting, cycle
generation) are pure and unit-testable without HTTP, and are reused by management commands (seed),
the notification scanner and the reporting layer.

## Authentication & RBAC

- Login (`/api/auth/login/`) returns an **access** token (30 min) and a **refresh** token (1 day);
  the role is embedded as a JWT claim.
- The SPA stores tokens and transparently refreshes on `401` via a single-flight interceptor
  (`frontend/src/api/client.js`).
- Authorisation is centralised in `apps/core/permissions.py`. `RolePermission` reads `allowed_roles`
  (write) and `read_roles` (safe methods) off each ViewSet; administrators bypass all gates.
  Safety-critical actions (pack **final check**) use the stricter `IsPharmacistOrAdmin`.

## Audit logging

Request-handling code passes the authenticated user explicitly to `apps.core.audit.record()`.
This keeps JWT attribution reliable and makes service-layer actor ownership visible at each call
site. Audit entries snapshot the actor label so the trail survives user deletion.

## Forecasting

`apps/forecasting/engine.py` builds a contiguous, zero-filled **weekly** demand series from
`stock.MedicineUsage`, then selects a method by data volume:

```mermaid
flowchart TD
    A["Weekly demand series"] --> B{"weeks of history?"}
    B -->|"< 6"| C["Moving average"]
    B -->|"6–11"| D["Holt linear trend"]
    B -->|"≥ 12"| E["Holt-Winters<br/>(trend + seasonality)"]
    C & D & E --> F["95% CI from residual σ,<br/>widened by √horizon"]
    F --> G["Reorder recommendation<br/>(lead-time demand + safety stock)"]
    F --> H["Explanation string"]
```

statsmodels is optional: if import or fitting fails, the engine falls back to a NumPy
least-squares trend so the API never hard-fails.

## Frontend composition

```
main.jsx → BrowserRouter → AuthProvider → ToastProvider → App
App.jsx  → <Protected> route guard → Layout (sidebar + topbar) → page Outlet
pages/*  → use useFetch() for loading/empty/error/success states
components/ui.jsx → house vocabulary: Button, Card, StatusChip, Modal, Toast, Skeleton, inputs
components/DataTable.jsx → sortable, sticky-header, tabular-figure data tables
```

Every data-backed view renders all four states (loading skeletons, empty, error-with-retry,
populated), per the design-system requirement for a pro tool.

The operational stock, dosette, picking, forecasting, reports, notification, workflow and
trusted-direction pages use the REST API. The rich top-bar patient record and the optional AI showcase currently use deterministic
simulated fixtures and label that source in the interface. They are presentation prototypes, not a
second source of truth; connecting medication history and `/api/ai/*` endpoints is documented as
remaining work in the engineering audit.

## Deployment topology

In production, `frontend` (nginx) serves the built SPA and reverse-proxies `/api/` to the
`backend` (gunicorn) service; `backend` talks to `db` (PostgreSQL). Redis is provisioned for the
roadmap's background-jobs work. See [`deployment.md`](deployment.md).
