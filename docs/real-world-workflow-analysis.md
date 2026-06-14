# Real-World Pharmacy Workflow Analysis (grouped)

> Companion to [`screenshot-inventory.md`](screenshot-inventory.md) (the per-screenshot record of all 154
> screens). This document groups those screens into **workflows** and, for each, explains how the
> real-world system works, what staff are achieving, the information shown, the actions available, the
> reusable pattern, what must **not** be copied, and how we build an **original** version.
>
> **Boundary.** Screens studied with educational permission as workflow/UX reference only. The reference
> product (Cegedim Pharmacy Manager) is **not** reproduced — no proprietary code, branding, logos, exact
> wording, NHS/EPS/MUR/FMD specifics, tray brand names, or real data. Our system stays original, no-NHS,
> simulated-data-only, in our own React/Tailwind design language.

---

## A. Patient search  · screenshots 62, 68–70

**How it works.** The top bar searches `Patient` (or `Product`). Typing opens a **Find Patient** dialog
that matches on Name / Street / Postcode / DOB and offers **"Extend search to similar sounding names"** —
so *Jade Peachey* surfaces *Peachey, Pearce, Pearson* together (screenshot 70). Results list Last/First
name, Sex, ID, Address, DOB. The system never auto-opens the first match.

**Staff goal.** Reach the right patient fast despite a misheard/mistyped name; consciously disambiguate
between similar patients to avoid mis-identification.

**Information shown.** Full name, DOB, postcode, ID, address, sex, status.

**Actions.** Find, select, Add (new), Details, OK/Cancel; toggles for similar-sounding names and temporary
patients.

**Reusable pattern.** Multi-field + **phonetic** matching; an explicit multi-result picker; no auto-open.

**Do NOT copy.** "Temporary patient"/NHS-number lookups; the dialog's exact columns/labels.

**Original implementation.** Our `PatientSearchBar` already does accessible, multi-format, no-auto-open
search; we **shipped** a similar-spelling tier (phonetic key + edit-distance) with a Connor/Conner/Connors
demo cluster. Next: optional Street/DOB fields and a Patient/Product scope toggle.

---

## B. Patient record workspace  · screenshots 71–83

**How it works.** Selecting a patient opens a tabbed **Patient Details** record: Patient · Doctor ·
Conditions · Medication · History · Other · (NHS-only: Suppressions/Exemptions/Repeat Rx/ePrescription
Updates/Message Dynamics). Conditions holds allergies/sensitivities/ADRs; Medication lists items with
compliance tracking; History is date/category-filterable with reprint/collect/audit.

**Staff goal.** Use the record as the hub for everything about a patient.

**Information shown.** Demographics (DOB, age, sex, postcode, phone, email), GP/practice, conditions/ADRs,
medication list, activity history, dispensing preferences (large labels, child-resistant).

**Actions.** Edit demographics, manage conditions/ADRs, view/repeat medication, filter history, set
preferences; per-item compliance + accuracy-check fields.

**Reusable pattern.** Tabbed record; clinical-safety context (allergies/ADRs); filterable history;
accessibility-relevant dispensing prefs (large labels).

**Do NOT copy.** NHS-only tabs, exact field order/labels.

**Original implementation.** Our `PatientRecord` already uses Patient/Doctor/Medication/Dosette/Picking/
History/Notes tabs. Next: an allergies/ADR section feeding AI clinical-safety; date/category history
filter; per-user accessibility prefs.

---

## C. Medication & dispensing history  · screenshots 1–5, 18, 66, 74, 77–84

**How it works.** Each item carries Written-as/Dispense-as, directions, quantity, pack size, stock level,
last/previous/next dispensed, prescriber, and a change history; appearance (colour/shape/markings) is
captured for identification (screenshot 36). A **Patient Medication History** dialog lets staff repeat a
prior item. Compliance is tracked (times dispensed vs non-compliances).

**Staff goal.** Dispense accurately and fast; reuse prior items; see what each medicine is and how it's
taken; spot non-adherence.

**Information shown.** Drug/strength/form, dose per slot, quantity, dates, prescriber, who created/updated,
appearance, compliance.

**Actions.** Add/repeat item, edit directions, record dispense, accuracy-check (checked-by + date).

**Reusable pattern.** Typed change history (started/stopped/dose-changed/quantity-changed/dispense/note);
appearance for identification; **non-compliance detection**.

**Do NOT copy.** PIP codes, pricing/endorsement/tariff fields, dm+d/DM+D codes.

**Original implementation.** Our medication model already has dates, prescriber, created/updated-by, typed
change history, and appearance. Next: AI **non-compliance / unusual-usage** detection; "repeat from
history".

---

## D. Dosette / MDS  · screenshots 28–39

**How it works.** MDS is driven from the patient: an **MDS Info** screen shows cycle length (1–4 weeks),
MAR/Cassette printed status, and **Active Medication** + **MDS History** tabs (a list of past cycles with
start/end/printed flags). Settings define cycle length, **administration time slots** (MORN/BFST/NOON/TEA/
BED/LATE), MAR type, per-item schedule, mid-cycle flag, and print options. The **Patient Cycle Screen**
assembles the week's meds with per-line in-stock.

**Staff goal.** Prepare a compliance pack for a defined cycle; track which cycles were prepared/printed;
control how each item is laid out.

**Information shown.** Cycle dates, time-slot grid, per-item quantities + appearance + "in cassette" flag,
cycle history, print status, in-stock per line.

**Actions.** Add/edit medicine, generate/repeat cycle, preview MAR, print, mark dispensed.

**Reusable pattern.** Cycle length as a setting; time-slot grid with **icon + colour + text** (never colour
alone); **cycle history**; print-status tracking.

**Do NOT copy.** "Cassette/Nomad/Manrex" tray brands; eMAR send; exact MAR templates.

**Original implementation.** Our `DosetteTab` already has the Morning/Afternoon/Evening/Bedtime tray (icon
+ colour band + text), an 8-state preparation workflow with timeline, repeat-cycle AI (human-confirmed),
per-cycle picking list, and a printable tray label (now enriched with appearance + directions). We **fixed
a crash** in the repeat-cycle AI. Next: an **MDS cycle-history panel**, per-item schedule + in-pack flag,
configurable/extra time slots.

---

## E. Picking & dispensing pipeline  · screenshots 13–17, 39

**How it works.** Dispensing is a **state pipeline** — New → In Progress → Patient Ready → To Claim — each
with a count and a filterable table (patient, items-to-check, location, status, owings) and per-row
actions including an **accuracy check** before "ready". The MDS picking view shows in-stock per line.

**Staff goal.** See the whole workload as a pipeline; move items through states; verify accuracy before
handout.

**Information shown.** Per-state counts, items to check, shelf location, status, owings/shortfalls.

**Actions.** Filter, accuracy-check, collect, view details, batch actions.

**Reusable pattern.** State-machine board with per-state counts; explicit **accuracy/scan gate**;
shortfall/location flags.

**Do NOT copy.** Owings/claim (NHS reimbursement) semantics; exact columns.

**Original implementation.** Our patient workflow already models 8 states with a per-patient FEFO picking
list and shortfall/expiry warnings. Next: a **store-wide pipeline board** (counts across all patients) and
a **barcode/QR accuracy check** (roadmap #1).

---

## F. Stock, batch, expiry & FEFO  · screenshots 18–26, 94–95

**How it works.** Stock & Order Management shows the whole catalogue with **Low / Excess / Dead / Often-Owed**
KPIs, pack size, total stock, on-order, currently-owed; ordering builds POs against usage and **books in**
deliveries; product rules map a product to an order set/supplier.

**Staff goal.** Keep accurate batch/expiry-controlled stock and reconcile movements/orders.

**Information shown.** Pack size, stock level, on-order, owed, usage, order set; expiry at point of pick.

**Actions.** Search/filter, export PDF/CSV, place/partial order, book-in, adjust.

**Reusable pattern.** Stock-health KPIs (low/excess/dead); FEFO + expiry warning at pick; PO generation +
book-in → batches.

**Do NOT copy.** Vendor bulk-operation wording, pricing fields, NHS tariff.

**Original implementation.** Our stock app already models medicines, pack sizes, suppliers, batches,
expiry, FEFO allocation, an append-only movement ledger, and expiry windows, with PDF/CSV export. Next:
**Excess/Dead-stock KPIs**, a Packs/Units toggle, and PO-generation + book-in (roadmap #4).

---

## G. Alerts, messages & responsible pharmacist  · screenshots 10–12, 46–61, 96, 103, 107, 117

**How it works.** An **eMessages** worklist filters by "awaiting my action" and a due-horizon (Today/3d/7d);
a **Notification Centre** slide-out shows alerts; a **Responsible Pharmacist** dialog logs RP sessions and
gaps; an **Events** tab is a login/audit log; patient/dispensing alerts (interactions, non-compliance,
batch-required) are configurable per user.

**Staff goal.** Action the right items first; maintain a complete RP/audit record; never miss an alert.

**Information shown.** Action-by date, status, priority, RP sessions, event log, alert prompts.

**Reusable pattern.** "Awaiting my action" + due-horizon filters; RP/audit session log; **icon + text**
alerts (never colour alone); user-defined patient alerts.

**Do NOT copy.** NHS message types, the RP legal register format, external SMS integration.

**Original implementation.** Our **notification centre** and **immutable audit log** cover the spirit. Next:
"awaiting my action"/due-horizon filters; an RP-on-duty indicator; a filterable audit-log viewer;
user-defined patient-alert banners.

---

## H. Reports  · screenshots 44–45

**How it works.** A large reports catalogue (intervention, low/dead/excess stock, MUR, patient history,
prescriber, throughput, repeat, responsible-pharmacist, stock adjustments, supplier usage, top-N) with
category filter, audit/data-export toggles, and Preview/Run.

**Staff goal.** Run standard operational/clinical/audit reports with export.

**Reusable pattern.** Categorised report catalogue with preview + export.

**Do NOT copy.** NHS/MUR/NMS report definitions; vendor report names.

**Original implementation.** Our reports module offers a focused, original subset (stock-valuation, expiry,
low-stock, dosette-workload, forecasting, patient-summary) with PDF/CSV. Next: a "patient history" and
"top-N usage" report.

---

## I. Settings & accessibility  · screenshots 86–118, 7–9

**How it works.** A deep **Pharmacy Details** surface (~28 tabs: Dispensing, Charging, Checking, Products,
Ordering, Scanner, Repeat Rx, Responsible Pharmacist, Security, Accuracy Check, FMD, …), per-user
preferences (input colours, confirm-before-delete, alert sets), user management (roles, active/inactive,
last login), data-retention/backup, and a widgetised home (referrals, notes, calendar, **fridge
temperatures**, nominated-patient counts).

**Staff goal.** Configure once; personalise per user; keep an at-a-glance operational home.

**Reusable pattern.** Focused settings; **per-user accessibility preferences**; dual alert channel
(onscreen + print); **icon+text never colour-only**; admin user-management; data-retention; a fridge-temp
compliance widget.

**Do NOT copy.** Vendor setting categories, licence/registration keys, NHS service config, password
plaintext handling.

**Original implementation.** We keep a focused Settings page + KPI dashboard, RBAC (Administrator/
Pharmacist/Dispenser), and reinforce accessibility (keyboard nav, ARIA roles on combobox/tabs, status by
icon+text, reduced motion, large targets). Next: admin user-management UI, per-user accessibility prefs, an
optional fridge-temp/home-widget board.

---

## J. Efficiency: Trusted Directions (sig-code builder)  · screenshots 49, 108, 122–154

**How it works.** Staff type a short **dosage code** (or Latin abbreviation like BD/AC/PC) and it expands to
clear, patient-friendly directions ("One to be taken each morning", "Shake well before use", "For external
use only"). A large library covers quantity, frequency, route, formulation, and cautionary phrases. A
setting can alert when a trusted direction isn't set.

**Staff goal.** Enter accurate directions fast without retyping or risking ambiguous Latin on labels.

**Reusable pattern.** A **sig-code → plain-English builder** with quantity/frequency/route/caution presets;
keyboard-driven; avoids ambiguous abbreviations on patient labels (safety + accessibility).

**Do NOT copy.** Vendor code values/exact wording verbatim — author our own neutral library.

**Original implementation.** Not yet built. Strong candidate: a **Trusted-Directions/sig-code builder** for
dosette items and our printable label, seeded with our own plain-English library. Pairs with auto-fill
directions and the directions field on dosette items.

---

## Cross-cutting decisions

- **Search-first patient access.** Real staff reach patients via the top search, not a sidebar list. → We
  **hide Patients/Dosette from the sidebar for Pharmacist/Dispenser** (top-bar search only) and keep them
  for Admin.
- **Colour + text everywhere.** Status is always icon/text-labelled, never colour alone (accessibility,
  colour-blind-safe).
- **AI as decision support.** Where the reference system automates clinical checks/notifications, our AI
  layer stays **explainable and human-confirmed** — it never makes clinical changes automatically.
