# Entity-Relationship Diagram & Data Model

```mermaid
erDiagram
    USER ||--o{ AUDITLOG : "actor"
    USER ||--o{ PATIENTNOTE : "author"

    PATIENT ||--o{ PATIENTNOTE : has
    PATIENT ||--o{ DOSETTEPLAN : has

    DOSETTEPLAN ||--o{ DOSETTEITEM : contains
    DOSETTEPLAN ||--o{ DOSETTECYCLE : generates
    DOSETTEITEM }o--|| MEDICINE : schedules

    SUPPLIER ||--o{ MEDICINE : "default supplier"
    MANUFACTURER ||--o{ MEDICINE : makes
    MEDICINE ||--o{ STOCKBATCH : "stocked as"
    MEDICINE ||--o{ MEDICINEUSAGE : "usage history"
    SUPPLIER ||--o{ STOCKBATCH : supplies
    STOCKBATCH ||--o{ STOCKMOVEMENT : ledger

    PICKINGLIST ||--o{ PICKINGITEM : contains
    PICKINGITEM }o--|| MEDICINE : "to pick"

    USER {
        int id PK
        string username
        string role "administrator|pharmacist|dispenser"
        string job_title
        string gphc_number "simulated"
    }
    PATIENT {
        int id PK
        string patient_id UK "neutral, e.g. PT-10428"
        string first_name
        string last_name
        date date_of_birth
        string gp_practice "simulated"
        text allergies
        string status "active|inactive"
        bool is_dosette
    }
    DOSETTEPLAN {
        int id PK
        int patient_id FK
        string frequency "weekly|monthly"
        date start_date
        date review_date
        bool is_active
    }
    DOSETTEITEM {
        int id PK
        int plan_id FK
        int medicine_id FK
        int dose_quantity
        json schedule "day -> [slots]"
    }
    DOSETTECYCLE {
        int id PK
        int plan_id FK
        date cycle_start
        date cycle_end
        date due_date
        string status "scheduled|in_prep|assembled|checked|sealed"
    }
    MEDICINE {
        int id PK
        string name
        string strength
        string form
        int pack_size
        int reorder_level
        int reorder_quantity
        decimal unit_cost
    }
    STOCKBATCH {
        int id PK
        int medicine_id FK
        int supplier_id FK
        string batch_number
        date expiry_date
        int quantity_on_hand
        string location
        decimal unit_cost
    }
    STOCKMOVEMENT {
        int id PK
        int batch_id FK
        string kind "receipt|dispense|adjust|waste|return"
        int quantity "signed"
        int actor_id FK
    }
    MEDICINEUSAGE {
        int id PK
        int medicine_id FK
        date date
        int quantity
    }
    PICKINGLIST {
        int id PK
        string name
        date period_start
        date period_end
        string status
    }
    PICKINGITEM {
        int id PK
        int picking_list_id FK
        int medicine_id FK
        int quantity_required
        int quantity_available
        bool is_picked
    }
    NOTIFICATION {
        int id PK
        string level
        string category
        string title
        string dedupe_key
        bool is_read
    }
    AUDITLOG {
        int id PK
        int actor_id FK
        string action
        string entity
        string summary
        json detail
        datetime timestamp
    }
    SUPPLIER {
        int id PK
        string name
        int lead_time_days
    }
    MANUFACTURER {
        int id PK
        string name
    }
```

## Design notes

- **No national health identifier.** Patients are keyed by a neutral internal `patient_id`. There is
  deliberately no field for, or integration with, any external healthcare identifier or service.
- **Batch is the FEFO unit.** Quantities live on `StockBatch` (not `Medicine`), so expiry, location
  and First-Expired-First-Out allocation are exact. `StockMovement` is an append-only ledger.
- **Schedule as JSON.** `DosetteItem.schedule` maps each day to its time-slots
  (`{"mon": ["morning","night"], …}`), which maps cleanly to the printed pack label and the UI grid
  without an explosion of rows.
- **Usage time series.** `MedicineUsage` (one row per medicine per day) is the forecasting input,
  decoupled from the movement ledger so history can be seeded and queried efficiently.
- **Idempotent notifications.** `dedupe_key` lets the scanner upsert one alert per logical condition.
