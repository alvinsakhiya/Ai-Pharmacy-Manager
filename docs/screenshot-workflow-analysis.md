# Real-World Pharmacy System — Workflow & UX Analysis

> **Purpose.** This document records what was learned from studying a set of 154 screenshots of a
> real-world commercial UK community-pharmacy management system, captured with educational
> permission, and how those *workflows and interaction patterns* informed improvements to our own
> original system (Pharmacy Manager — AI-Enhanced Dosette & Stock Platform).
>
> It is a **workflow and UX reference**, not a reproduction. Findings are grouped by workflow, not by
> screenshot number.

---

## Legal & academic boundary

The screenshots were used strictly as **workflow and UX study material**. The analysis below deliberately
captures *what staff are trying to achieve* and *which interaction patterns make them efficient* — never
proprietary implementation.

**Not copied, by design:**

- **Branding & identity** — the third-party product name, vendor name (Cegedim), the green-cross logo,
  icon set, exact colour palette, window chrome, and screen layouts. Our UI keeps its own design tokens
  (`frontend/tailwind.config.js`) and the "Apple pro-tool + fluid" posture.
- **NHS / national-infrastructure specifics** — EPS, NCSO, PFS, FMD, eMAR registration keys, NCRS,
  Pharmacy First, BSA exemption flows, "Nomad"/cassette tray brand names. Our system has a deliberate
  **no-NHS, no-real-integration** constraint and uses simulated, pseudo-anonymised data only.
- **Proprietary source, database schema, report definitions, and exact field labels.** We model
  *equivalent* concepts with our own names and data shapes.
- **Real patient or pharmacy data.** All names, medicines, batches and dates in our system are invented.

**How our implementation stays original:** we re-express the *generic, non-proprietary* pharmacy workflow
(search → patient record → dosette/MDS → picking → check → print) in our own React/Tailwind design
language, our own data model, and add an explicit, explainable-AI layer that the reference system does not
have. Where the reference system is a thick-client Windows app, ours is a decoupled SPA + REST API.

---

## 1. Navigation & global shell

**What the screenshots show.** A persistent top bar with `File / Tools / Help`, a prominent **central
patient search** ("Search for a patient", scoped by a *Patient* selector), a global *Quick Actions*
launcher, a responsible-pharmacist (RP) indicator, an envelope (messages) icon, a PFS/Overdue status
cluster, and a left icon rail to the main modules. A persistent status bar shows the active tray
configuration, the last action, and the logged-in user.

**Staff goal.** Reach any patient or task in one or two interactions without browsing lists; always know
*who* the responsible pharmacist is and whether anything is overdue.

**Adapted into our project.** Our `Layout` already mirrors this: a global top-bar patient search, role
display, and module rail. Reinforced the principle that **search is the primary entry point**, not list
browsing.

**Not copied.** The exact icon rail, the green chrome, NHS/PFS status widgets.

---

## 2. Patient search

**What the screenshots show.** Typing into the top bar opens a **Find Patient** picker listing *multiple*
candidate matches — crucially including **similar-sounding / similar-spelled surnames** (e.g. a search
surfacing *Peachey, Peachey, Pearce, Pearson* together). Options to *extend search* and *show temporary*
patients. The system never silently opens the first result.

**Staff goal.** Find the right patient fast even with a misheard name, a partial spelling, or only a DOB —
and **consciously choose** between similar patients to avoid a dangerous mis-identification.

**Important data fields.** Full name, DOB, postcode, patient ID, status, GP/surgery.

**UI patterns worth adapting.** Multi-candidate result list; match by name / initials+surname / partial /
DOB / postcode / ID; *similar-spelling* matching; explicit selection (no auto-open).

**Adapted into our project.** Our `PatientSearchBar` already does multi-format, accessible, no-auto-open
search. **This analysis drove a concrete gap fix:** we added a **similar-spelling tier** (phonetic key +
edit-distance) so a near-miss surname still surfaces the patient, clearly labelled "similar match", and
added demo patients with neighbouring surnames to make the behaviour demonstrable. See
`frontend/src/services/patientData.js`.

**Not copied.** "Temporary patient", NHS-number lookups, the dialog's exact columns/labels.

---

## 3. Patient record workspace

**What the screenshots show.** Selecting a patient opens a tabbed **Patient Details** workspace:
`Patient · Doctor · Conditions · Medication · History · Other · Suppressions · Exemptions · Repeat Rx ·
ePrescription Updates · Message Dynamics`. The record is the central workspace; most actions are launched
from here. The History tab supports a date range + category filter and per-row actions
(Intervene / Audit / Reprint / Collect / Details).

**Staff goal.** Treat the patient record as the hub for everything about that patient — demographics,
prescriber, current medication, and a filterable history.

**Adapted into our project.** Our `PatientRecord` already uses a tabbed workspace (Patient / Doctor /
Medication / Dosette / Picking / History / Notes). Confirmed our tab set is appropriate; we keep ours
focused and drop NHS-only tabs (Exemptions, ePrescription Updates, Suppressions).

**Not copied.** NHS-specific tabs, the modal's button bar, exact field order.

---

## 4. Medication & dispensing history

**What the screenshots show.** A dispensary item screen with a dense per-item form — *Written on, PIP code,
Pack size, Used Today/Mtd, Min/Stock, Quantity, Dose, Directions, Cautions, Duration, Stock level,
Trade/Retail price, Ingredient cost* — and a right-hand **colour-coded medication card list** (each item a
card with the drug, quantity "1 of N", and the plain-English direction). A **Trusted Directions** picker
expands short dosage codes (e.g. typing a code → "ONE to be taken", "Take ONE OR TWO 5ml spoonsful") and
Latin-style abbreviations (BD, AD, etc.) into full instructions — a keystroke-reduction aid.

**Staff goal.** Dispense accurately and fast; reuse standard directions rather than retyping; see at a
glance what each item is and how it's taken.

**Important data fields.** Medication name, strength, form, dose per slot, quantity, last/previous/next
dispensed date, prescriber, status, who created/updated and when (audit), notes; appearance for
identification.

**UI patterns worth adapting.** Colour **plus text** on every item card (never colour alone); a
directions/sig-code → plain-English expander; an explicit medication **change history** (started, stopped,
dose changed, quantity changed, dispense recorded, note added).

**Adapted into our project.** Our medication model already carries last/previous/next dispensed, prescriber,
created/updated-by, and a typed change history (Started / Dose change / Quantity change). Recorded the
**sig-code expander** as a recommended next enhancement.

**Not copied.** PIP codes, pricing/endorsement fields, NHS reimbursement concepts.

---

## 5. Dosette / MDS (the core workflow)

**What the screenshots show.** A dedicated **MDS** module, mostly driven from inside the patient record:

- **MDS Info** header: patient, **Cycle Length** (1/2/3/4 weeks), **MAR Printed** date, **Cassette
  Printed**; tabs **Active Medication** and **MDS History**; `ADD/EDIT MEDICINE`, `SETTINGS`, `PRINT`.
- **MDS History**: a table of past cycles — *Date, Cycle Start, Cycle End, MAR Printed (✓), Cassette
  Printed, eMAR Sent* with per-row *View details*.
- **Community Patient Settings**: cycle length, patient group/week, **MAR type**, **administration time
  slots**.
- **Per-item settings**: schedules, **mid-cycle item** flag, **body diagram required**, print options
  (print non-cassette items, repeat-request form, body-diagram inline/separate).

**Staff goal.** Prepare a patient's compliance pack for a defined cycle, track which cycles were prepared
and printed, and configure how each item is laid out and printed.

**Important data fields.** Cycle length & start/end, administration time slots, per-item slot quantities,
mid-cycle flag, MAR/cassette printed status, cycle history.

**UI patterns worth adapting.** Cycle length as a first-class setting; **time-slot grid**; a **cycle
history** list; colour-band + icon + text per slot; print status tracking.

**Adapted into our project.** Our `DosetteTab` already has the Morning/Afternoon/Evening/Bedtime tray with
icon + colour band + text, an 8-state preparation workflow with timeline, repeat-cycle AI, and a printable
label. This analysis drove: (a) **fixing a crash** in the repeat-cycle suggestion, (b) **enriching the
printable tray label** with appearance and per-item instructions, and identified a **cycle-history panel**
(MDS-History equivalent) as a strong next addition.

**Not copied.** "Cassette/Nomad" tray brand, eMAR send, exact MAR templates.

---

## 6. Picking & dispensing pipeline

**What the screenshots show.** A **Dispensing** queue with pipeline tabs — **New / In Progress / Patient
Ready / To Claim** — each with a count, a filterable table (Patient, Dispense date, Items to check,
Locations, Owings, **Status** e.g. "Awaiting Accuracy Check") and per-row **Accuracy Check** / **View
details** actions.

**Staff goal.** See the whole dispensing workload as a pipeline; move items through states; run an
**accuracy/scan check** before handing out.

**UI patterns worth adapting.** A state-machine pipeline with per-state counts; an explicit accuracy-check
gate; shortfall/owings flags.

**Adapted into our project.** Our patient workflow already models 8 states (Not started → Picking
required → … → Ready / Issue found) with a per-patient picking list and FEFO batch/expiry warnings.
Recorded a **store-wide dispensing pipeline board** (counts per state across all patients) and a
**barcode/scan accuracy check** as recommended next steps (already on our roadmap).

**Not copied.** Owings/claim (NHS reimbursement) semantics, exact column set.

---

## 7. Stock, batch, expiry & FEFO

**What the screenshots show.** Item entry surfaces *pack size, used today/month, min/stock, stock level*;
bulk-operations tools (remove unused drugs, reset pack-dispensing policies, fix repeats); low/dead/excess
stock and stock-adjustment reports.

**Staff goal.** Keep accurate stock with batch/expiry control and reconcile movements.

**Adapted into our project.** Our stock app already models medicines, pack sizes, suppliers, batches,
expiry, FEFO allocation, an append-only movement ledger, and expiry windows — well aligned. No change
needed beyond confirming the FEFO + expiry-warning surfacing in the per-patient picking list.

**Not copied.** Vendor bulk-operation wording, pricing fields.

---

## 8. Alerts, messages & responsible pharmacist

**What the screenshots show.** An **eMessages** centre (filter by patient, "only show messages awaiting
current action", action-by horizon); a **Responsible Pharmacist** dialog logging RP sessions (date,
from/to times, who, and gaps with "no records"); an "Overdue" status indicator.

**Staff goal.** Action the right messages first; maintain a complete RP audit; never miss an overdue task.

**UI patterns worth adapting.** "Awaiting my action" filtering; an RP/audit session log; an overdue
indicator. Our **notification centre** and **immutable audit log** already cover the spirit of this.

**Not copied.** NHS message types, the RP legal register format.

---

## 9. Reporting

**What the screenshots show.** A large **Reports** catalogue (intervention, low/dead/excess stock, MUR,
patient history, prescriber, throughput, repeat Rx, responsible pharmacist, stock adjustments, supplier
usage, top-N usage, etc.) with category filter, audit/data-export toggles, Preview/Run.

**Staff goal.** Run standard operational and clinical reports with export.

**Adapted into our project.** Our reports module already offers stock-valuation, expiry, low-stock,
dosette-workload, forecasting and patient-summary reports with PDF/CSV export — a focused, original subset.

**Not copied.** NHS/MUR/NMS report definitions, the vendor's report names.

---

## 10. Settings & accessibility

**What the screenshots show.** A deep **Pharmacy Details** settings surface (Dispensing, Charging,
Checking, Products, Ordering, Scanner, Repeat Rx, Responsible Pharmacist, Realtime Backup, Patient Alerts,
Keystroke Reduction, Security, Accuracy Check, …) and a home dashboard with widgets (Pharmacy First
referrals, notes, calendar, **fridge temperatures**, nominated-patient counts, useful links).

**Staff goal.** Configure the pharmacy once; keep an at-a-glance operational dashboard.

**Adapted into our project.** We keep a **focused** settings surface and a KPI dashboard rather than
replicating the breadth. Reinforced our **accessibility** commitments: keyboard navigation, ARIA roles on
the search combobox and tabs, status shown by **icon + text, never colour alone**, reduced-motion support,
and large click targets.

**Not copied.** Vendor setting categories, fridge-temperature/branch-ops modules, licence/registration keys.

---

## Summary: what this analysis changed in our codebase

| Insight (from screenshots) | Change made |
|---|---|
| Find-Patient surfaces *similar-spelled* surnames together (Peachey/Pearce/Pearson) | Added a **similar-spelling tier** (phonetic key + edit-distance) to patient search, with fuzzy matches labelled, plus demo patients with neighbouring surnames |
| Printable MAR/label carries clear, patient-friendly medication detail | **Enriched the printable dosette tray label** with medication **appearance** (colour/shape/imprint) and per-item instruction |
| (Found while exercising the dosette workflow) | **Fixed a crash** in the repeat-cycle AI suggestion (`m.audit` → `m.changes`) |
| MDS History tracks past cycles; dispensing is a state pipeline; sig-code expander | Documented as **recommended next steps** (cycle-history panel, store-wide pipeline board, directions expander, barcode accuracy check) |

All changes use our own design language and simulated data, and preserve the no-NHS / no-real-integration
constraint.
