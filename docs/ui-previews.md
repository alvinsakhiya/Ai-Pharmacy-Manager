# UI Previews

The UI implements the house design DNA — **Apple pro-tool calm** (precise, dense, trustworthy
surfaces) with **consumer-app life** (fluid motion, instant feedback, one confident indigo accent).
All tokens live in [`../frontend/tailwind.config.js`](../frontend/tailwind.config.js).

A self-contained, rendered preview of the dashboard ships alongside this doc:
**[`preview-dashboard.html`](preview-dashboard.html)** — open it directly in any browser (no build
needed). To capture screenshots of the full, live application, run the stack (`docker compose up`)
or the dev servers and visit each route.

## Screen-by-screen

### Login (`/login`)
Split-screen: an indigo brand/value panel (the three pillars — RBAC + audit, FEFO inventory,
explainable forecasting) beside a focused sign-in form with one-click demo-account buttons.

### Dashboard (`/`)
Eight KPI stat-cards (patients, dosette patients, medicines, stock value, low-stock, expiring ≤30d,
predicted shortages, cycles due) above a 90-day dispensing-demand area chart, an expiry-exposure bar
chart coloured by the FEFO heat scale, and a recent-activity feed from the audit log. Cards are
clickable and navigate to their module.

### Patients (`/patients`)
Searchable, filterable table (status, dosette). Row click opens a drawer-style modal with
demographics, allergy/instruction boxes and a timestamped history list.

### Dosette (`/dosette`)
Active-plans table beside an upcoming-cycles panel (colour-coded by days-to-due / overdue). The
detail modal renders the **signature day × time-slot pack grid** (Mon–Sun × Morning/Noon/Evening/
Night) with one colour per medicine and a legend — the product's centrepiece visualisation.

### Picking lists (`/picking`)
Lists with an animated progress bar and status chips; "Generate weekly list" aggregates all active
plans. The detail modal offers per-line pick toggling (with strike-through), shortfall flags and
**PDF export**.

### Stock (`/stock`)
Dense inventory table with on-hand, reorder level, low-stock chips and stock value; "Low stock only"
toggle and search. Row click reveals FEFO-ordered batches with expiry-heat chips.

### Expiry (`/expiry`)
1/3/6-month window toggle, an expired-stock alert banner, and a FEFO-heat batch table.

### Forecasting (`/forecasting`)
Medicine + horizon selectors drive a composed chart: actual usage (solid), forecast mean (dashed)
and a shaded **95% confidence band**. A plain-language explanation, signal metrics (avg demand,
trend, volatility) and a reorder-recommendation card accompany a predicted-shortages table.

### Reports (`/reports`)
Six report cards, each with View / PDF / CSV actions; View opens a tabular modal.

### Notifications (`/notifications`)
Categorised, level-coloured alerts with unread highlighting, mark-read / mark-all-read and a
re-scan ("Refresh alerts") action; the sidebar shows a live unread badge.

### Audit log (`/audit`, pharmacist/admin)
Full action trail with action-type chips, actor, summary and timestamp; filterable by action.

## Design tokens at a glance

- **Accent** `#4F46E5` (deliberately not an identity blue) · **app bg** `#F7F8FA` · near-black text
  `#111418`.
- **Semantic** success/danger/warning/info always pair colour with icon/label (colour-blind safe).
- **FEFO heat** expired → ≤30d → 31–90d → 91–180d → >180d.
- **Motion** 120–320 ms ease-out; press-scale on tappables; slide/fade for modals, drawers, toasts;
  honours `prefers-reduced-motion`.
- **Type** Inter, 14px base, tabular figures for all numeric columns.
