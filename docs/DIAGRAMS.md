# Diagrams

Visual overviews of AI Pharmacy Manager, rendered with Mermaid. These reflect the
implemented system; for detail see [PROJECT_MAP.md](PROJECT_MAP.md),
[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md), and
[FORECASTING_AND_INTELLIGENCE.md](FORECASTING_AND_INTELLIGENCE.md).

## System architecture

```mermaid
flowchart LR
    User["Pharmacy staff<br/>(browser)"]
    subgraph Frontend["Frontend — React + Vite + Tailwind"]
        SPA["Single-page app<br/>role-based screens"]
    end
    subgraph Backend["Backend — Django + DRF"]
        API["REST API /api/*<br/>views + services"]
        RBAC["Auth, RBAC &<br/>tenant scoping"]
        Audit["Audit log"]
    end
    DB[("PostgreSQL 17")]
    Backups[["Encrypted backups<br/>(AES-256-GCM)"]]

    User --> SPA
    SPA -->|"session cookie + CSRF, JSON"| API
    API --> RBAC
    RBAC --> API
    API --> Audit
    API --> DB
    API --> Backups
    Backups -. "restore (admin)" .-> DB
```

## Container diagram (Docker Compose)

```mermaid
flowchart TB
    subgraph Compose["docker compose (development)"]
        FE["frontend<br/>Vite dev server<br/>:5173"]
        BE["backend<br/>Django runserver<br/>:8000"]
        DBS["db<br/>postgres:17-alpine<br/>db:5432"]
    end
    FE -->|"/api proxy"| BE
    BE -->|"DATABASE_URL"| DBS
    DBS --- VOL[("postgres_data volume")]
```

## Entity-relationship overview

```mermaid
erDiagram
    GROUP ||--o{ PHARMACY : has
    GROUP ||--o{ MEMBERSHIP : scopes
    USER ||--o{ MEMBERSHIP : "has active"
    GROUP ||--o{ MEDICATION : owns
    CATALOGUE_PRODUCT ||--o{ MEDICATION : "reference for"
    PHARMACY ||--o{ PATIENT : registers
    PHARMACY ||--o{ STOCK_ITEM : holds
    MEDICATION ||--o{ STOCK_ITEM : "stocked as"
    STOCK_ITEM ||--o{ STOCK_BATCH : "batched into"
    STOCK_ITEM ||--o{ STOCK_MOVEMENT : "ledger of"
    PATIENT ||--o{ PATIENT_MEDICATION : "takes"
    PATIENT ||--o{ DOSETTE_PERIOD : requests
    DOSETTE_PERIOD ||--o{ DOSETTE_CYCLE : "split into"
    PATIENT ||--o{ DOSETTE_CYCLE : "for"
    PATIENT ||--o{ REVIEW_RECORD : "reviewed by"
    GROUP ||--o{ FORECAST_RUN : "analytics"
    FORECAST_RUN ||--o{ FORECAST_ITEM : contains
    GROUP ||--o{ TRANSFER_SUGGESTION : "suggests"
```

Patient identity fields and note bodies are stored **encrypted at rest**; see
[SECURITY_AND_DATA_PROTECTION.md](SECURITY_AND_DATA_PROTECTION.md).

## Role / scope access flow

```mermaid
flowchart TD
    Req["Request for an action on a target"]
    Member{"Active membership?"}
    Admin{"Role = ADMIN?"}
    Cap{"Role has capability<br/>for this action?"}
    Scope{"Target in caller's<br/>group/pharmacy scope?"}
    Allow(["Allow"])
    Deny(["Deny (403)"])

    Req --> Member
    Member -- no --> Deny
    Member -- yes --> Admin
    Admin -- "yes (global)" --> Allow
    Admin -- no --> Cap
    Cap -- no --> Deny
    Cap -- yes --> Scope
    Scope -- no --> Deny
    Scope -- yes --> Allow
```

## MDS / dosette workflow

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> PREPARED : prepare (pharmacist)
    DRAFT --> NEEDS_CHANGES : mark needs changes
    NEEDS_CHANGES --> PREPARED : prepare
    PREPARED --> CHECKED : check (pharmacist)
    PREPARED --> NEEDS_CHANGES : mark needs changes
    CHECKED --> COLLECTED : collected
    CHECKED --> DELIVERED : delivered
    note right of CHECKED
        Stock deduction is a separate,
        explicit human step on a CHECKED cycle.
        Never automatic.
    end note
    COLLECTED --> [*]
    DELIVERED --> [*]
```

## Stock receive / batch / movement flow

```mermaid
flowchart LR
    Recv["Receive stock<br/>(pharmacist / stock)"]
    Batch["StockBatch<br/>batch no. + expiry"]
    Item["StockItem<br/>on-hand balance"]
    Move["StockMovement<br/>append-only ledger"]
    FEFO["FEFO surfacing<br/>soonest expiry first"]

    Recv --> Batch
    Batch --> Item
    Recv --> Move
    Item --> Move
    Batch --> FEFO
    Move -->|"adjust / transfer / deduct"| Item
```

## Stock intelligence flow (read-only signals)

```mermaid
flowchart TD
    Movements["Stock movements<br/>+ batches + cycles"]
    Forecast["Moving-average forecast<br/>(baseline-1)"]
    Expiry["FEFO expiry buckets"]
    MDS["Deterministic MDS<br/>demand signal"]
    Transfer["Transfer opportunity<br/>suggestions"]
    Score["Stock review score<br/>(0-100, additive rules)"]
    Queue["Work queue &<br/>Stock Intelligence screens"]
    Human(["Human review<br/>required before any action"])

    Movements --> Forecast
    Movements --> Expiry
    Movements --> MDS
    Movements --> Transfer
    Forecast --> Score
    Expiry --> Score
    MDS --> Score
    Score --> Queue
    Transfer --> Queue
    Queue --> Human
```

Nothing here orders, transfers, or dispenses automatically.

## Backup and restore flow

```mermaid
flowchart TD
    Trigger["Create backup<br/>(manual / scheduled)"]
    Serialize["Serialize group-scoped data<br/>(no users / secrets)"]
    Manifest["Build manifest<br/>+ sha256 checksum"]
    Encrypt{"BACKUP_ENCRYPTION_KEY set?"}
    EncFile[["group-...zip.enc<br/>AES-256-GCM"]]
    PlainFile[["group-...zip<br/>(dev only, logged)"]]
    Refuse(["Refuse<br/>(if encryption required)"])

    Trigger --> Serialize --> Manifest --> Encrypt
    Encrypt -- yes --> EncFile
    Encrypt -- "no, not required" --> PlainFile
    Encrypt -- "no, required" --> Refuse

    Restore["Restore (ADMIN, type RESTORE)"]
    ReadMan["Decrypt + validate manifest<br/>(wrong key aborts here)"]
    PreBackup["Pre-restore safety backup"]
    Replace["Delete + reload group data<br/>(atomic; catalogue skipped)"]

    EncFile -. select .-> Restore
    Restore --> ReadMan --> PreBackup --> Replace
```

## Deployment flow

```mermaid
flowchart LR
    Env["cp .env.example .env<br/>set secrets + keys"]
    Build["docker compose up --build"]
    Migrate["manage.py migrate"]
    Seed["manage.py seed_demo<br/>(fictional data)"]
    Use["Use at localhost:5173"]

    Env --> Build --> Migrate --> Seed --> Use

    Prod["Production"]
    ProdSettings["config.settings.prod<br/>TLS, HSTS, secure cookies,<br/>required keys + encrypted backups"]
    Serve["WSGI/ASGI server + reverse proxy<br/>built static frontend"]
    Prod --> ProdSettings --> Serve
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for the production checklist.
