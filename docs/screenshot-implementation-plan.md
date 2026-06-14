# Implementation Plan — from the 154-screenshot study

> Derived from [`screenshot-inventory.md`](screenshot-inventory.md) (per-screen) and
> [`real-world-workflow-analysis.md`](real-world-workflow-analysis.md) (grouped). Everything here is an
> **original** re-expression in our React/Vite/Tailwind + Django REST stack — **no NHS/EPS/MUR/FMD**, no
> branding, no proprietary code or data.

Legend: ✅ done · 🟡 in progress · ⬜ planned. Effort: S (hours) · M (1–2 days) · L (multi-day).

---

## Quick wins (S)

| # | Item | Source | Status |
|---|---|---|---|
| Q1 | **Role-based sidebar** — hide Patients & Dosette from the sidebar for Pharmacist/Dispenser (top-bar search only); keep for Admin | 6, 14, 68 | 🟡 this iteration |
| Q2 | **Similar-spelling patient search** (phonetic + edit-distance), labelled "Similar spelling" | 68–70 | ✅ shipped |
| Q3 | **Fix repeat-dosette crash** (`m.audit` → `m.changes`) | exercised via 29–39 | ✅ shipped |
| Q4 | **Enrich printable tray label** — per-item directions + appearance (colour/shape/marking) | 36–37, 90 | ✅ shipped |
| Q5 | Status legend with **icon + text** on the tray/cycle (never colour alone) | 39 | ⬜ |
| Q6 | "Awaiting my action" + due-horizon (Today/3d/7d) filter on Notifications | 10, 61 | ⬜ |

## Medium improvements (M)

| # | Item | Source | Status |
|---|---|---|---|
| M1 | **MDS cycle-history panel** in DosetteTab (date, cycle start/end, prepared/checked/printed) | 30 | ⬜ |
| M2 | **Stock-health KPIs** — add Excess/Dead-stock alongside Low-stock; Packs/Units toggle | 21 | ⬜ |
| M3 | **Patient History filter** (date range + category) on the record History tab | 75 | ⬜ |
| M4 | **Allergies/ADR & sensitivities** section on the patient record (feeds AI clinical-safety) | 73 | ⬜ |
| M5 | **Admin user-management UI** (role, active/inactive, last login) — RBAC already exists | 86, 118 | ⬜ |
| M6 | **RP-on-duty indicator** + audit entry; filterable audit-log viewer | 59–60, 96 | ⬜ |
| M7 | **Per-user accessibility preferences** (high-contrast cues, confirm-before-delete, alert set) | 116–117 | ⬜ |

## Major features (L)

| # | Item | Source | Status |
|---|---|---|---|
| L1 | **Store-wide dispensing pipeline board** — status columns across all patients, AI prompts, role-gated transitions, job history | 13–17 | ✅ shipped — [docs](pipeline-board.md) |
| L2 | **Barcode/QR accuracy check** — scan picked stock vs expected item, pass/fail screen (+ picking-list label) | 15, 98, 115 | ⬜ (roadmap #1) |
| L3 | **Trusted-Directions / sig-code builder** — type a code → plain-English directions; seed our own library | 49, 108, 123–154 | ⬜ |
| L4 | **PO generation + book-in → batches** (reorder recs → order → receive into stock) | 20, 24, 94 | ⬜ (roadmap #4) |
| L5 | **AI review-due & non-compliance detection** — patients due for review; unusual dispensing cadence | 43, 79, 100, 117 | ⬜ |

---

## Database changes (Django models)

Most quick wins are frontend-only (the patient workspace is a simulation in `frontend/src/services/patientData.js`).
Deeper items need backend models:

- **Dosette cycle history** (M1): a `DosetteCycle` record (plan FK, start, end, length, prepared_by/at,
  checked_by/at, printed flags) — extends the existing dosette app.
- **ADR / sensitivities** (M4): `PatientCondition` / `PatientSensitivity` (patient FK, type, severity,
  comment) — extends patients app; surfaced to AI clinical-safety.
- **Dispensing pipeline** (L1): formalise per-patient/per-cycle `WorkflowState` transitions (we already
  model 8 states in the frontend; promote to the dosette/picking app with an audited transition log).
- **Accuracy check** (L2): `AccuracyCheck` (cycle/item FK, scanned GTIN/batch, expected, result, checked_by/at).
- **Directions library** (L3): `TrustedDirection` (code, plain_text, category) — new small app/table.
- **Purchase orders** (L4): `PurchaseOrder` + `PurchaseOrderLine`, and a book-in action creating `StockBatch`.
- Indices for FEFO/expiry already exist; add indexes on new FK + status columns.

All new tables keep the **no-NHS / simulated-data** constraint and append-only audit where relevant.

## Backend changes (DRF)

- New endpoints follow existing conventions (e.g. `/api/dosette/cycles/`, `/api/patients/<id>/conditions/`,
  `/api/dispensing/pipeline/`, `/api/accuracy-checks/`, `/api/directions/`, `/api/orders/`).
- Reuse our **forecasting** + **reporting** patterns; the pipeline board is an aggregation endpoint
  (counts per state) + a list endpoint.
- AI review-due/non-compliance (L5) reuses the explainable-engine style of `forecasting/` (return reasons +
  confidence; never auto-act).
- Permissions: enforce RBAC (Administrator/Pharmacist/Dispenser) on every new endpoint; Dispenser is
  read-only on records.

## Frontend changes (React)

- Q1: gate sidebar items by role in `components/Layout.jsx` (Patients/Dosette hidden unless Admin); patient
  access remains the top-bar `PatientSearchBar`.
- M1/M5/M6/M7: new panels/pages using existing primitives (`Card`, `StatusChip`, `DataTable`, `Modal`,
  `Select`) and the design tokens in `tailwind.config.js`.
- L1: a pipeline board page (tabbed counts + filterable `DataTable`, row → patient record).
- L3: a directions builder component (combobox over the seeded library) used in the dosette item + label.
- Keep all new UI keyboard-navigable, ARIA-labelled, and status shown by **icon + text**.

## AI feature opportunities (explainable, human-confirmed)

- **Daily task recommendations** & **priority ranking** (dosette cycles due, items due, reviews due) — from
  the Repeat-Rx/review windows (screenshot 100) + our forecasting.
- **Stock shortage / expiry-waste prediction** & **reorder suggestions** — we already have forecasting +
  FEFO; surface as ranked, explained suggestions with confidence.
- **Non-compliance / unusual-usage detection** (screenshot 79/117) — compare dispensed cadence to expected.
- **Patients due for review** reminders (screenshot 43/100).
- Every recommendation carries **reasoning + confidence**; **AI never makes clinical changes automatically**.

## Accessibility plan (applies to every item)

- Keyboard navigation + visible focus on all new controls; ARIA roles on combobox/tabs/modals (as the
  search bar already does).
- **Colour-blind-safe**: status by icon + text, never colour alone (screenshot 39 lesson).
- High-contrast/readable type via existing tokens; respect reduced-motion.
- Large click targets; accessible tables (header scope), modals (focus trap), tabs (roving tabindex).
- **Print accessibility**: the dosette label is large, high-contrast, text-first (already), with appearance
  text for identification.

## Testing plan

- **Backend (pytest)**: model invariants + RBAC on every new endpoint; pipeline aggregation counts;
  accuracy-check pass/fail; directions-library lookups; AI engines return reasons/confidence and never
  mutate clinical data. Follow the existing `apps/*/tests.py` + forecasting backtest style.
- **Frontend (vitest)**: role-based sidebar visibility; search (already covered, incl. similar-spelling);
  repeat-cycle/tray data (already covered); directions-builder expansion; pipeline filtering.
- **Manual/verify**: run the app and confirm sidebar gating per role, search picker, dosette print preview.
- **CI** (roadmap #14): GitHub Actions running pytest (Postgres service) + frontend lint/build on every PR.
- Never break existing tests; add tests with each change.

---

## Sequencing recommendation

1. **Now:** Q1 (role-based sidebar) — small, high-visibility, directly requested.
2. Next: M1 (cycle-history) + Q5/Q6 (legend, action filters) — round out the dosette/notifications story.
3. Then: L1 (pipeline board) + L2 (accuracy check) — the biggest realism gains.
4. Then: L3 (directions builder) + M4 (ADR) — feed AI clinical-safety.
5. Ongoing: L5 (AI review/non-compliance), M2/M3/M5/M6/M7, CI/CD.
