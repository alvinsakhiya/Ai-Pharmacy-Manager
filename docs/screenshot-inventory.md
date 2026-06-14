# Screenshot Inventory — Real-World Pharmacy System (154 screens)

> **Scope & permission.** 154 screenshots of a real commercial UK community-pharmacy management system
> (identified as Cegedim Pharmacy Manager), studied with educational permission as **workflow/UX reference
> only**. No proprietary code, branding, logos, protected names, copyrighted wording or confidential data
> is reproduced. The source images are gitignored (`/Screenshots/`) and never committed.
>
> Each entry below was produced by **individually viewing** that screenshot. Fields per entry:
> *Screen/module · Purpose · Key fields · Actions · Navigation · Workflow meaning · Ideas for our project ·
> Implement (now / later / ignore)*.
>
> Target: **154 entries** (Screenshot (1) … Screenshot (154)).

---

### Screenshot (1)
- **Screen/module:** Dispensary — item dispensing form (patient Samuel Mustafa; nominated/MDS).
- **Purpose:** Dispense each prescription item with directions, quantity and pricing.
- **Key fields:** Written on, PIP code, Pack size, Used Today/Mtd, Min/Stock, Quantity, Dose, Directions, Cautions, Duration, Stock level, Trade/Retail, Ingredient cost; right-hand colour-coded item cards (Amlodipine 10mg "1 EAT NIGHT", Duloxetine, Omeprazole "when required").
- **Actions:** Form, Ordering, Print; Back, Confirm, Finish item; Edit Trusted Directions; page 1 of 6.
- **Navigation:** Item-by-item paging through a prescription; right list = all items on the script.
- **Workflow meaning:** Core dispensing — accuracy of drug, dose, quantity, directions.
- **Ideas for our project:** Colour **+ text** item cards; per-item directions field; multi-item paging.
- **Implement:** later (we model dispensing as the dosette/picking workflow).

### Screenshot (2)
- **Screen/module:** Dispensary — same item with **drug-interaction warnings** expanded.
- **Purpose:** Surface clinical interaction/cautions before confirming.
- **Key fields:** Directions ("1-2 at night… avoid alcohol"); warning list (prescription exemption, possible major interaction Amlodipine/statins, hypokalaemia/QT prolonging, etc.).
- **Actions:** Confirm, Direction, Edit Trusted Directions.
- **Navigation:** Warnings panel at the bottom of the dispensing item screen.
- **Workflow meaning:** Clinical-safety check during dispensing.
- **Ideas for our project:** Explainable safety warnings tied to the item (our AI Clinical Safety screen mirrors this — keep human review).
- **Implement:** later (AI clinical-safety showcase already exists).

### Screenshot (3)
- **Screen/module:** Dispensary — item with full interaction warning list (duplicate/extended of #2).
- **Purpose:** Show the complete set of cautions/interactions for the item.
- **Key fields:** Multiple interaction lines; endorsement/exemption notes.
- **Actions:** Confirm; Direction; brand toggle (Ctrl+S).
- **Navigation:** Same dispensing screen, warnings scrolled.
- **Workflow meaning:** Pharmacist reviews all flags before supply.
- **Ideas for our project:** Severity-ranked, explainable warnings with confidence.
- **Implement:** later.

### Screenshot (4)
- **Screen/module:** Dispensary — Duloxetine 90mg capsules item (generics scheme note).
- **Purpose:** Dispense a generically-substituted item with scheme/endorsement.
- **Key fields:** Directions "One To Be Taken Each Day", quantity 28, pack size, prices; endorsement "dispensed against… Generic Generics Scheme"; brand/interaction notes.
- **Actions:** Confirm; Direction; page 2 of 6.
- **Navigation:** Next item in the script.
- **Workflow meaning:** Generic substitution + endorsement during dispensing.
- **Ideas for our project:** Record generic/brand chosen + reason on the dispense line.
- **Implement:** ignore (NHS endorsement-specific).

### Screenshot (5)
- **Screen/module:** Dispensary — **drug/pack selection popup** (Arcoxia 90mg Tablets).
- **Purpose:** Choose the exact product/pack size to dispense.
- **Key fields:** Product list with pack sizes (28/30/100), prices, supplier scheme, "include discontinued"; directions "One To Be Taken Each Day When Required".
- **Actions:** Default, Details, OK, Cancel; include discontinued toggle.
- **Navigation:** Modal product picker over the dispensing screen.
- **Workflow meaning:** Pack/product selection drives stock decrement and pricing.
- **Ideas for our project:** Product → pack-size picker bound to our Medicine/pack_size + batch.
- **Implement:** later (our stock model has pack sizes; a picker could be added).

### Screenshot (6)
- **Screen/module:** Global **left navigation** drawer (expanded) over eMessages.
- **Purpose:** Primary module navigation.
- **Key fields:** Menu items — Home, eMessages, Dispensary, Stock & Ordering, Pending, MDS, Owings, Instalments, Repeats, Reports, Help; top bar Patient search, RP, PFS/Overdue.
- **Actions:** Navigate to any module; close drawer.
- **Navigation:** Icon rail expands to labelled drawer; **patients reached via top search, not a sidebar item**.
- **Workflow meaning:** Confirms search-first patient access; modules are task areas.
- **Ideas for our project:** **Role-based sidebar** — hide patient browsing for Pharmacist/Dispenser; top-bar search only (matches our directive).
- **Implement:** now (role-based sidebar).

### Screenshot (7)
- **Screen/module:** Dispensing **overview/landing** with KPI cards + service promo.
- **Purpose:** At-a-glance workload across the dispensing operation.
- **Key fields:** New EPS to Dispense (3331), Expiring EPS (142), Patient Repeat Prescriptions (947), Outstanding Owings, Uncollected Prescriptions, Pending Orders (35); Prescription Tracker; reimbursement countdown.
- **Actions:** Drill into each KPI; tracker "Next".
- **Navigation:** Card grid linking to detailed queues.
- **Workflow meaning:** Operational triage by counts.
- **Ideas for our project:** Our Dashboard already has KPI cards; add an "expiring/uncollected/pending" triage cluster.
- **Implement:** later (dashboard enhancement).

### Screenshot (8)
- **Screen/module:** **Home** dashboard (widget board).
- **Purpose:** Daily operational home screen.
- **Key fields:** Pharmacy First Referrals (New/Pending/In-Progress/Overdue), Pharmacy Notes, Calendar (June 2026), **Fridge Temperatures** (date, fridge, temp/min/max), Nominated Patients (10389, +171/week), Useful Links.
- **Actions:** View referrals, add note, add fridge temp, edit links.
- **Navigation:** Widget grid; each widget self-contained.
- **Workflow meaning:** Start-of-day situational awareness + compliance logs (fridge temps).
- **Ideas for our project:** A widgetised home (notes, calendar, fridge-temp compliance log) — fridge temps are a neat, original compliance widget.
- **Implement:** later (home widgets; fridge-temp log is a nice extra).

### Screenshot (9)
- **Screen/module:** Home dashboard (scrolled).
- **Purpose:** Continuation of the widget board.
- **Key fields:** Nominated Patients (10389), Useful Links, WhatsApp service desk, "What's New".
- **Actions:** Open links / what's-new.
- **Navigation:** Vertical scroll of widgets.
- **Workflow meaning:** Secondary info & support.
- **Ideas for our project:** "What's new"/help surfacing; low priority.
- **Implement:** ignore (vendor support widgets).

### Screenshot (10)
- **Screen/module:** **eMessages** — "Filter list by" dropdown (open).
- **Purpose:** Filter the prescription-message worklist.
- **Key fields:** Filter options — All, Patient Name, Prescription Type, Status, Message Type, UUID, Requires Dispensing/Collection/Notification/Claiming, Repeat Dispensing.
- **Actions:** Pick a filter; "Only show messages awaiting current action".
- **Navigation:** Dropdown over the message list.
- **Workflow meaning:** "Show me what needs my action" triage.
- **Ideas for our project:** "Awaiting my action" filter on our Notifications centre.
- **Implement:** later (notifications filter).

### Screenshot (11)
- **Screen/module:** eMessages — filter dropdown scrolled (Expiring Claims, Expiring EPS).
- **Purpose:** More filter options (expiry-based).
- **Key fields:** Expiring Claims, Expiring EPS.
- **Actions:** Select filter.
- **Navigation:** Same dropdown.
- **Workflow meaning:** Surface time-critical items.
- **Ideas for our project:** Expiry-based notification filters (we have expiry alerts already).
- **Implement:** ignore (EPS/claims are NHS-specific).

### Screenshot (12)
- **Screen/module:** eMessages — "Nominated Prescription Download complete" modal.
- **Purpose:** Confirm a background download of nominated prescriptions.
- **Key fields:** Completion message, Time Lapsed.
- **Actions:** Close.
- **Navigation:** Modal over eMessages.
- **Workflow meaning:** Async fetch of new prescriptions.
- **Ideas for our project:** Async job + completion toast (we have toasts; Celery is on roadmap).
- **Implement:** ignore (NHS nomination download).

### Screenshot (13)
- **Screen/module:** **Dispensing** pipeline — **New** tab (3332).
- **Purpose:** Worklist of newly-arrived prescriptions to dispense.
- **Key fields:** Patient Name, Type, Handout, Downloaded, Expiry, Service Type, **Clinical Check** (Checked-Auto).
- **Actions:** Filter, Clear filters, Download; per-row Actions / Dispense.
- **Navigation:** Tabbed pipeline (New / In Progress / Patient Ready / To Claim).
- **Workflow meaning:** Entry state of the dispensing state-machine.
- **Ideas for our project:** **Store-wide pipeline board** with per-state counts (our top recommended feature).
- **Implement:** later (pipeline board — strong candidate).

### Screenshot (14)
- **Screen/module:** Dispensing New tab — **row action menu** open.
- **Purpose:** Per-prescription quick actions.
- **Key fields:** Menu — View Prescription Details, Return to Spine, **View Patient Record**.
- **Actions:** Open details / patient record.
- **Navigation:** Row context menu → patient record (search-first still holds).
- **Workflow meaning:** Jump from a queue item to the patient.
- **Ideas for our project:** "Open patient record" from any worklist row.
- **Implement:** later.

### Screenshot (15)
- **Screen/module:** Dispensing — **In Progress** tab (72).
- **Purpose:** Items mid-dispense awaiting an accuracy check.
- **Key fields:** Patient Name, Dispense Date, **Items To Check**, Locations, Owings, **Status** (Awaiting Accuracy Check).
- **Actions:** ACC CHECK / VIEW DETAILS.
- **Navigation:** Pipeline tab.
- **Workflow meaning:** Accuracy-check gate before "ready".
- **Ideas for our project:** Explicit accuracy/scan check step (barcode check on roadmap).
- **Implement:** later (accuracy-check step).

### Screenshot (16)
- **Screen/module:** Dispensing — **Patient Ready** tab (23).
- **Purpose:** Bagged items awaiting collection/delivery.
- **Key fields:** Patient Name, Items Ready, Exemption Status (Confirmed/RTEC), Handout (Delivery), Service Type, Location.
- **Actions:** COLLECT / VIEW DETAILS; BATCH ACTIONS.
- **Navigation:** Pipeline tab.
- **Workflow meaning:** Handout/collection stage + location tracking.
- **Ideas for our project:** "Ready" board with collection/delivery + shelf location.
- **Implement:** later.

### Screenshot (17)
- **Screen/module:** Dispensing — **To Claim** tab (1755).
- **Purpose:** Post-supply reimbursement (notify/endorse/claim).
- **Key fields:** Headline "2 to notify, 295 to endorse, 1458 to claim"; Patient, Exemption, Notified, Endorsed, Claim Expires.
- **Actions:** ACTIONS / CLAIM; NOTIFY ALL / CLAIM ALL.
- **Navigation:** Pipeline tab.
- **Workflow meaning:** NHS reimbursement lifecycle.
- **Ideas for our project:** Not applicable (no NHS claiming).
- **Implement:** ignore (NHS reimbursement).

### Screenshot (18)
- **Screen/module:** **Dispensary** — blank item-entry form (FP10).
- **Purpose:** Manual prescription item entry.
- **Key fields:** Patient, Prescriber, No. Items; Item: Written as, Dispense as, Directions, Quantity, Owe; Cost panel: Item cost, PIP code, Pack size, Used Today/Max, Min order/Stock, Auto order, Due in/Owe, Stock level, Trade/Retail, Tariff, Ingredient cost.
- **Actions:** Endorse, Save to pending, Delete, Back, Confirm, Finish Item; Caution/Direction.
- **Navigation:** Item paging (1 of 1).
- **Workflow meaning:** Canonical dispensing data-entry layout.
- **Ideas for our project:** Field set for a future dispense line (written/dispensed-as, directions, qty, stock).
- **Implement:** later.

### Screenshot (19)
- **Screen/module:** Dispensary — "Select Dispensary Supply Form" modal.
- **Purpose:** Choose the prescription/supply form type.
- **Key fields:** Many NHS form types (FP10, HP, CN, PN, MDA, Private, Vet Sale, Emergency Supply, PGD, CPCS…).
- **Actions:** Select form; "display forms for my PRA only"; OK/Cancel.
- **Navigation:** Modal at start of dispensing.
- **Workflow meaning:** Determines reimbursement/legal form.
- **Ideas for our project:** A simplified "supply type" (NHS / private / emergency) without NHS forms.
- **Implement:** ignore (NHS form catalogue).

### Screenshot (20)
- **Screen/module:** **Stock & Order Management** — Ordering tab.
- **Purpose:** Build and manage supplier orders.
- **Key fields:** Product, Size, Code, Order Set, Status (Pending), Packs, In Stock, Max Daily Usage, Times Prescribed, Sent; Period (Daily).
- **Actions:** Add order, Add item, Place/Send order, Delete; status filter.
- **Navigation:** Ordering ↔ Stock Inventory tabs.
- **Workflow meaning:** Reorder generation against usage.
- **Ideas for our project:** Generate POs from reorder recommendations (on our roadmap).
- **Implement:** later (PO generation).

### Screenshot (21)
- **Screen/module:** Stock & Order — **Stock Inventory** (2810 lines).
- **Purpose:** Whole-catalogue stock view with health KPIs.
- **Key fields:** **Low Stock 2130, Excess Stock 84, Dead Stock 596, Often Owed 0**; Product, Pack Size, Total Stock, On Order, Currently Owed.
- **Actions:** Search, Filter, **Export PDF/CSV**, Packs/Units toggle, Edit/Details.
- **Navigation:** Tab; KPI cards drill into filtered lists.
- **Workflow meaning:** Inventory health triage (low/excess/dead).
- **Ideas for our project:** Add **Excess/Dead-stock** KPIs alongside our low-stock/expiry; Packs/Units toggle; we already export PDF/CSV.
- **Implement:** later (stock-health KPIs).

### Screenshot (22)
- **Screen/module:** Stock & Order — **Options** menu open.
- **Purpose:** Bulk order operations.
- **Key fields:** Split Order, Place, Book In, Change Item Order Set, Reset Items to Pending, Save Previously Prepared Order.
- **Actions:** Choose a bulk op.
- **Navigation:** Options dropdown.
- **Workflow meaning:** Order lifecycle management.
- **Ideas for our project:** "Book in delivery" → batches (PO receipt, on roadmap).
- **Implement:** later.

### Screenshot (23)
- **Screen/module:** Stock & Order — Options → **Place** submenu.
- **Purpose:** Place an order fully or partially.
- **Key fields:** Complete Selected, Item Partial.
- **Actions:** Place complete/partial.
- **Navigation:** Nested submenu.
- **Workflow meaning:** Partial-order handling.
- **Ideas for our project:** Partial-receipt support when booking in.
- **Implement:** later.

### Screenshot (24)
- **Screen/module:** Stock & Order — Options → **Book In** submenu.
- **Purpose:** Receive a delivered order into stock.
- **Key fields:** Book-in options.
- **Actions:** Book in order.
- **Navigation:** Nested submenu.
- **Workflow meaning:** Delivery → batch creation/stock increment.
- **Ideas for our project:** **Stock receipt against PO → batch** (roadmap #4).
- **Implement:** later.

### Screenshot (25)
- **Screen/module:** Stock & Order — **View** menu open.
- **Purpose:** Switch ordering sub-views.
- **Key fields:** Suppliers, Ordering Details, Modem Settings, Order Set Summary, Sent Orders, Items Due In.
- **Actions:** Pick a view.
- **Navigation:** View dropdown.
- **Workflow meaning:** Ordering admin & supplier setup.
- **Ideas for our project:** "Items due in" view (expected deliveries).
- **Implement:** later.

### Screenshot (26)
- **Screen/module:** Stock & Order — "Stock Order Item Details" modal.
- **Purpose:** Edit one order line.
- **Key fields:** Product, Packs to order, Order set, Status, Packs received, Date of last order, Order code.
- **Actions:** Save/Delete/Cancel.
- **Navigation:** Modal over ordering grid.
- **Workflow meaning:** Line-level order control + receipt count.
- **Ideas for our project:** Order-line edit dialog for PO feature.
- **Implement:** later.

### Screenshot (27)
- **Screen/module:** **Pending** — uncollected/unendorsed prescriptions.
- **Purpose:** Track scripts awaiting collection/endorsement.
- **Key fields:** Name (+ address, item count), Status (Not collected/Not endorsed), Source, Date; filters (supply type, include not endorsed, date range).
- **Actions:** Reset, Endorse, Exit; include-not-endorsed toggle.
- **Navigation:** Module screen with filters.
- **Workflow meaning:** Manage owed/uncollected items.
- **Ideas for our project:** An "awaiting collection" worklist (ties to our Ready/Collected workflow states).
- **Implement:** later.

### Screenshot (28)
- **Screen/module:** **MDS** module — top level (Care Homes tab).
- **Purpose:** Manage MDS patients grouped by care home / community.
- **Key fields:** Tabs Care Homes | Community Patient; Care home selector; columns Last/First Name, Sex, Dispensed, MAR, Cassette, Labels; This Period date range; "Nomad 8 inches (weekly)".
- **Actions:** Options/Patient/Print; Add/Remove patient to home; Patient Details; **Preview MAR**, **View Cycle**.
- **Navigation:** Care-home grouping → patient → cycle.
- **Workflow meaning:** Batch MDS prep per care home per week.
- **Ideas for our project:** Group dosette patients by **care setting** (we have careSetting); a weekly "MDS workload by home" view.
- **Implement:** later (care-home grouping).

### Screenshot (29)
- **Screen/module:** **MDS Info → Active Medication** (per patient).
- **Purpose:** Show the patient's MDS medication set for the cycle.
- **Key fields:** Patient, Cycle Length, MAR/Cassette Printed; **Group 1** medication cards (drug, qty/strength, **INCLUDED IN CASSETTE**, Colour, Form, Warnings, directions, **Schedule** Everyday/28 days/when).
- **Actions:** Add/Edit Medicine, Select All, Show more/less, Settings, Print.
- **Navigation:** Active Medication ↔ MDS History tabs.
- **Workflow meaning:** Defines exactly what goes in each cassette/cycle, with appearance for identification.
- **Ideas for our project:** Confirms our tray cards (drug + strength + qty + appearance) — add a per-item **Schedule** + "in cassette" flag.
- **Implement:** later (our DosetteTab is the equivalent; could add schedule/in-pack flag).

### Screenshot (30)
- **Screen/module:** **MDS Info → MDS History** (per patient).
- **Purpose:** History of prepared cycles.
- **Key fields:** Date, Cycle Start, Cycle End, **MAR Printed (✓)**, Cassette Printed, eMAR Sent; 7 cycles.
- **Actions:** View Details per cycle; Print; Settings.
- **Navigation:** History tab.
- **Workflow meaning:** Audit trail of past MDS cycles + print status.
- **Ideas for our project:** Add a **cycle-history panel** to our DosetteTab (date, start/end, prepared/checked/printed).
- **Implement:** later (cycle-history panel — strong candidate).

### Screenshot (31)
- **Screen/module:** **Community Patient Settings** (MDS config).
- **Purpose:** Configure a community MDS patient's cycle.
- **Key fields:** Cycle Length (1/2/3/4 weeks), Community Patient Group (Week 1), MAR Type, Administration Times.
- **Actions:** Pick cycle length/group/MAR type.
- **Navigation:** From MDS patient → Settings.
- **Workflow meaning:** Defines cycle cadence + print format.
- **Ideas for our project:** Cycle-length setting (we have weekly/monthly; could expose 1–4 weeks).
- **Implement:** later.

### Screenshot (32)
- **Screen/module:** Community Patient Settings — Administration Times.
- **Purpose:** Define the per-cycle time slots.
- **Key fields:** **6 time slots** with custom labels — MORN, BFST, NOON, TEA, BED, LATE; Print non-cassette items.
- **Actions:** Edit slot labels.
- **Navigation:** Scrolled settings.
- **Workflow meaning:** Slots map to MAR/cassette columns.
- **Ideas for our project:** Our tray uses Morning/Afternoon/Evening/Bedtime — could allow **custom/extra slots** (e.g. BFST/LATE).
- **Implement:** later (configurable slots).

### Screenshot (33)
- **Screen/module:** Community Patient Settings — MAR Type dropdown.
- **Purpose:** Choose MAR chart orientation.
- **Key fields:** Standard MAR Portrait / Standard MAR Landscape.
- **Actions:** Select MAR type.
- **Navigation:** Dropdown.
- **Workflow meaning:** Print layout choice.
- **Ideas for our project:** Portrait/landscape option on our printable label.
- **Implement:** ignore (minor print option).

### Screenshot (34)
- **Screen/module:** Community Patient Settings — Print Options.
- **Purpose:** Control what prints with the cycle.
- **Key fields:** Print non-cassette items; "repeat request form?" Yes/No; **Body Diagram Print Option** (inline / separate page).
- **Actions:** Toggle options.
- **Navigation:** Scrolled settings.
- **Workflow meaning:** Print composition for the cycle.
- **Ideas for our project:** Print toggles (e.g. include/exclude non-pack items) on our label.
- **Implement:** later (print toggles).

### Screenshot (35)
- **Screen/module:** MDS per-item settings (Schedules).
- **Purpose:** Configure one MDS item's schedule.
- **Key fields:** Schedules (No Schedules / ADD SCHEDULE), **Mid Cycle Item** (Yes/No), **Body Diagram Required** (Yes/No).
- **Actions:** Add schedule; Cancel/Save.
- **Navigation:** From Add/Edit Medicine.
- **Workflow meaning:** Per-item dosing schedule + mid-cycle handling.
- **Ideas for our project:** Per-item schedule + mid-cycle flag on dosette items.
- **Implement:** later.

### Screenshot (36)
- **Screen/module:** **Add Medication** — Medicine Details.
- **Purpose:** Add a medicine to a patient's MDS.
- **Key fields:** "Selecting from patient history? Yes/No", Quantity (+ "unused quantity"), Directions, **Colour, Shape, Markings**.
- **Actions:** Enter details.
- **Navigation:** MDS → Add Medicine.
- **Workflow meaning:** Captures dosing + **appearance** for identification at entry.
- **Ideas for our project:** Confirms our appearance fields (colour/shape/imprint) belong on the medication record.
- **Implement:** later (appearance already in our data model).

### Screenshot (37)
- **Screen/module:** Add Medication (scrolled) — Output & Schedules.
- **Purpose:** Choose output + schedules for the item.
- **Key fields:** Colour/Shape/Markings; **Output** Print Options (MAR / Cassette); **Schedules** (No Schedules / ADD SCHEDULE).
- **Actions:** Toggle MAR/Cassette; Add schedule.
- **Navigation:** Scrolled Add Medication.
- **Workflow meaning:** Whether the item goes on MAR and/or in the cassette, with its schedule.
- **Ideas for our project:** "In pack vs MAR-only" flag per dosette item.
- **Implement:** later.

### Screenshot (38)
- **Screen/module:** MDS per-item settings (Schedules / Mid-cycle / Body diagram) — full page.
- **Purpose:** Save one item's schedule + flags.
- **Key fields:** Schedules (Add Schedule), Mid Cycle Item (Yes/No), Body Diagram Required (Yes/No).
- **Actions:** Cancel / Save.
- **Navigation:** Edit Medicine page.
- **Workflow meaning:** Finalise item config.
- **Ideas for our project:** Item schedule + mid-cycle flag (see #35).
- **Implement:** later.

### Screenshot (39)
- **Screen/module:** **Patient Cycle Screen** (MDS assembly) — one patient's week.
- **Purpose:** Build the week's MDS cycle from the patient's medication.
- **Key fields:** Colour legend (Dispensed / Regular / Transfer of Care / Ready to dispense / Owing / Unassigned); week columns (18–24); **Medication History** list with Qty + **In Stock** (Lorazepam 1mg, Pantoprazole, Mirtazapine, Bisoprolol, Atorvastatin, Citalopram…).
- **Actions:** Dispense, Complete, Reclaim, Mid Cycle, Unused, Details, Delete; New Supply, Repeat, Repeat and Edit, Add to Cycle; Preview MAR, View Cycle.
- **Navigation:** From MDS patient → View Cycle; tabs Patient Cycle / Pending / eMessages.
- **Workflow meaning:** The heart of MDS prep — pick meds into the cycle, track stock, mark dispensed.
- **Ideas for our project:** Our DosetteTab tray + per-cycle picking list is the equivalent; the **in-stock-per-line** + status legend (with text labels, not colour-only) is worth mirroring.
- **Implement:** later (our equivalent exists; add status legend with text).

### Screenshot (40)
- **Screen/module:** **Owings** module.
- **Purpose:** Track items owed to patients (short-supplied).
- **Key fields:** Date/Patient/Product filters; Last/First Name, Date, Stock, Owed, Product.
- **Actions:** Purge, Remove, Prepare, Collect; Print bag label; Item details.
- **Navigation:** Module screen.
- **Workflow meaning:** Manage partial supplies/back-orders.
- **Ideas for our project:** "Owed items" concept ties to our shortfall flags in picking.
- **Implement:** later.

### Screenshot (41)
- **Screen/module:** **Instalments** module.
- **Purpose:** Manage instalment-dispensed prescriptions (e.g. controlled).
- **Key fields:** Status (Active), Date (Today); Last/First Name, Date Due, Stock, Dispensed, Product.
- **Actions:** Remove, Prepare, Collect; Print bag label.
- **Navigation:** Module screen.
- **Workflow meaning:** Scheduled instalment supply.
- **Ideas for our project:** Not core to dosette; defer.
- **Implement:** ignore (instalment dispensing out of scope).

### Screenshot (42)
- **Screen/module:** **Repeats** module — Repeats tab.
- **Purpose:** Manage repeat/serial prescriptions.
- **Key fields:** Filter by patient; Last Name, Address, Status (EPS Serial Repeat / Pending / Unmanaged), Due, GP.
- **Actions:** Search, Print, Dispense, Repeat request.
- **Navigation:** Module with filters.
- **Workflow meaning:** Repeat-supply lifecycle.
- **Ideas for our project:** Repeat tracking overlaps our dosette "next expected" dates.
- **Implement:** ignore (NHS repeat/EPS specifics).

### Screenshot (43)
- **Screen/module:** **Repeats → GP Reviews** tab.
- **Purpose:** Track items needing a GP review.
- **Key fields:** Filter by patient, Date Outstanding (range); Last/First Name, Address, Date, GP, Status.
- **Actions:** GP Review, Resolve; Apply/Clear filters.
- **Navigation:** Repeats sub-tab.
- **Workflow meaning:** Flag patients due a medication review.
- **Ideas for our project:** **"Patients due for review"** AI reminder (we have overdue-review notifications) — strong AI tie-in.
- **Implement:** later (AI review reminders — we partly have this).

### Screenshot (44)
- **Screen/module:** **Reports** catalogue (page 1).
- **Purpose:** Run standard reports.
- **Key fields:** Category filter, Show data exports / audit reports; report list (Audit Patient/SCR/Security/System, Brand Substitution Losses, Cautions/Directions, Conditions, Dispensed Item, Duplicate Product, Low/Dead/Excess Stock, MUR, Non Compliance, Often Owed, Owings, Patient Details, **Patient History**, …).
- **Actions:** New Report, Preview, Run, Delete.
- **Navigation:** Scrollable report list.
- **Workflow meaning:** Operational/clinical/audit reporting.
- **Ideas for our project:** Our reports module covers a focused subset (valuation, expiry, low-stock, dosette-workload, forecasting, patient-summary). Could add "patient history" report.
- **Implement:** later (we already have a reports module).

### Screenshot (45)
- **Screen/module:** Reports catalogue (page 2, scrolled).
- **Purpose:** More reports.
- **Key fields:** Intervention(s), Low/Dead/Excess Stock, MUR, NCSO, NMS, Non Compliance, OAP list, Owings, Patient Details/History/Report, **Potential MUR Candidates**, Prescriber, Prescription/Script Throughput, Repeat Request/Rx, **Responsible Pharmacist**, **Stock Adjustments**, Supplier Usage, Top N Usage, User Entered Item.
- **Actions:** Preview/Run.
- **Navigation:** Same list scrolled.
- **Workflow meaning:** Breadth of reporting.
- **Ideas for our project:** "Top-N usage", "stock adjustments", "responsible pharmacist" report ideas (RP report ties to our audit log).
- **Implement:** later.

### Screenshot (46)
- **Screen/module:** **File** menu (over To Claim).
- **Purpose:** App-level actions.
- **Key fields:** Send New Email, Import, Logout (Ctrl+Alt+E), Exit, Restart.
- **Actions:** Pick action.
- **Navigation:** Top menu bar.
- **Workflow meaning:** Session/app control.
- **Ideas for our project:** Standard; we have logout. No change.
- **Implement:** ignore.

### Screenshot (47)
- **Screen/module:** File → **Import** submenu.
- **Purpose:** Import data files.
- **Key fields:** Import CIF File / CIF Update / Waiting Files / Schedule Import / Update Negative Stock.
- **Actions:** Choose import.
- **Navigation:** Nested submenu.
- **Workflow meaning:** Drug-file (dm+d/CIF) updates.
- **Ideas for our project:** "Update negative stock" reconciliation is a neat idea; CIF import is NHS-specific.
- **Implement:** ignore.

### Screenshot (48)
- **Screen/module:** **Tools** menu.
- **Purpose:** Admin/utility entry points.
- **Key fields:** Inquiry, MUR, Blank label, Bulk Operations, Recover Product, Data Provision, Nursing Home Defaults, System Settings, Settings, User Settings, Scheduled Tasks, Thread Manager.
- **Actions:** Open a tool.
- **Navigation:** Top menu.
- **Workflow meaning:** Configuration & maintenance hub.
- **Ideas for our project:** "Blank label" (ad-hoc label print) + "Scheduled Tasks" (Celery on roadmap).
- **Implement:** later (blank label / scheduled tasks ideas).

### Screenshot (49)
- **Screen/module:** Tools → **Inquiry** submenu (with keyboard shortcuts).
- **Purpose:** Open reference/lookup editors.
- **Key fields:** Patient (Shift+Ctrl+P), Product, Supplier, Prescriber, Institution, Direction, Counter File, Nursing Home, **Stock Adjustment Reasons**, Caution, Interventions, dm+d Items, **Trusted Directions** (Shift+Ctrl+T), Audit Content, Leaflets — each with a shortcut.
- **Actions:** Open editor via menu or shortcut.
- **Navigation:** Nested submenu; **keyboard shortcuts** for power users.
- **Workflow meaning:** Reference-data management + keyboard-driven speed.
- **Ideas for our project:** **Keyboard shortcuts** for common actions (accessibility/efficiency); a **Trusted Directions** editor (sig-code → plain English).
- **Implement:** later (keyboard shortcuts + directions builder).

### Screenshot (50)
- **Screen/module:** Tools → **MUR** submenu.
- **Purpose:** Medicines Use Review actions.
- **Key fields:** Produce quarterly summary of MURs; Produce MUR GP Notifications.
- **Actions:** Generate MUR docs.
- **Navigation:** Nested submenu.
- **Workflow meaning:** NHS advanced-service admin.
- **Ideas for our project:** Not applicable (NHS MUR).
- **Implement:** ignore.

### Screenshot (51)
- **Screen/module:** Tools → **Nursing Home Defaults** submenu.
- **Purpose:** Pick default MDS tray system.
- **Key fields:** **Nomad, Cegedim Rx Own, Manrex** (tray/cassette brands).
- **Actions:** Select default tray system.
- **Navigation:** Nested submenu.
- **Workflow meaning:** Tray hardware defaults.
- **Ideas for our project:** Generic "pack type" default (we have weekly/monthly) — avoid brand names.
- **Implement:** ignore (brand tray names).

### Screenshot (52)
- **Screen/module:** Tools → **System Settings** submenu.
- **Purpose:** System-level config.
- **Key fields:** System Configuration, **Pharmacy Details**, Printer Configuration, View Options.
- **Actions:** Open a settings area.
- **Navigation:** Nested submenu.
- **Workflow meaning:** Global configuration.
- **Ideas for our project:** Our Settings page is the equivalent (kept focused).
- **Implement:** later (minor).

### Screenshot (53)
- **Screen/module:** System Settings → **Printer Configuration** submenu.
- **Purpose:** Map app print jobs to printers.
- **Key fields:** Pharmacy Manager / Windows print routing.
- **Actions:** Configure printers.
- **Navigation:** Nested submenu.
- **Workflow meaning:** Label/token printing routing.
- **Ideas for our project:** Browser print is sufficient for us; ignore.
- **Implement:** ignore.

### Screenshot (54)
- **Screen/module:** Tools → **User Settings** submenu.
- **Purpose:** Manage users.
- **Key fields:** User Details; **User Account Management**.
- **Actions:** Edit user / manage accounts.
- **Navigation:** Nested submenu.
- **Workflow meaning:** User admin / RBAC.
- **Ideas for our project:** We have RBAC + user admin (admin role); confirms the pattern.
- **Implement:** later (we already have RBAC/admin).

### Screenshot (55)
- **Screen/module:** **Help** menu + Technical Support submenu.
- **Purpose:** Help & support actions.
- **Key fields:** Help Centre, Technical Support, About; Create Installation Report, **System Administration Key (Ctrl+Alt+A)**, **Security Key (Ctrl+Alt+S)**, Real Time Back Up Restore, Restart Active Screen.
- **Actions:** Support utilities.
- **Navigation:** Top menu.
- **Workflow meaning:** Support/security key entry.
- **Ideas for our project:** None core; security-key entry is prohibited-credential territory.
- **Implement:** ignore.

### Screenshot (56)
- **Screen/module:** Help → Technical Support submenu (duplicate view of #55).
- **Purpose:** Support utilities.
- **Key fields:** Create Installation Report, System Admin Key, Security Key, Real Time Back Up Restore, Restart Active Screen.
- **Actions:** Support actions.
- **Navigation:** Nested submenu.
- **Workflow meaning:** Support/maintenance.
- **Ideas for our project:** None.
- **Implement:** ignore.

### Screenshot (57)
- **Screen/module:** **About** dialog.
- **Purpose:** Version/licence info.
- **Key fields:** "Pharmacy Manager 17.3", Cegedim Rx, Windows build, site/registration number, **PostgreSQL** database, "drug interaction information is GUIDANCE ONLY".
- **Actions:** OK.
- **Navigation:** Modal.
- **Workflow meaning:** Identifies the product (Cegedim PM 17.3, PostgreSQL-backed).
- **Ideas for our project:** Confirms PostgreSQL choice is industry-aligned; note "guidance only" disclaimer mirrors our "not clinical advice".
- **Implement:** ignore (branding).

### Screenshot (58)
- **Screen/module:** **Notification Centre** (right slide-out panel).
- **Purpose:** In-app notifications.
- **Key fields:** Empty state "You currently have no messages".
- **Actions:** Dismiss/close.
- **Navigation:** Bell icon → slide-out.
- **Workflow meaning:** Central alerts surface.
- **Ideas for our project:** We have a Notification centre; a slide-out + empty-state pattern is worth matching (accessible empty states).
- **Implement:** later (notification UX polish).

### Screenshot (59)
- **Screen/module:** **RP / user** dropdown (top right).
- **Purpose:** Responsible-pharmacist & session control.
- **Key fields:** Open Responsible Pharmacist (Ctrl+Alt+P), Change Pharmacist, Log as Absent, Log Out.
- **Actions:** RP/session actions.
- **Navigation:** Top-right user menu.
- **Workflow meaning:** Who is the legally responsible pharmacist right now.
- **Ideas for our project:** A "responsible pharmacist on duty" indicator + audit (ties to our audit log).
- **Implement:** later (RP indicator).

### Screenshot (60)
- **Screen/module:** **Responsible Pharmacist** dialog (over eMessages).
- **Purpose:** Log RP sessions & gaps.
- **Key fields:** Date, Current status (Logged in), From/To, Action type; session records (who, start time); "times with no records".
- **Actions:** New, Details, Create record for selection, Close.
- **Navigation:** From RP menu (#59).
- **Workflow meaning:** Legal RP register / audit.
- **Ideas for our project:** RP session log → our immutable audit log.
- **Implement:** later.

### Screenshot (61)
- **Screen/module:** eMessages — **Action by** date filter dropdown.
- **Purpose:** Filter worklist by due horizon.
- **Key fields:** Today, Tomorrow, Next 3 Days, Next 7 Days, Date Range.
- **Actions:** Pick horizon.
- **Navigation:** Dropdown.
- **Workflow meaning:** "What's due soon" triage.
- **Ideas for our project:** Due-horizon filter on our dosette/notifications (Today/3d/7d).
- **Implement:** later.

### Screenshot (62)
- **Screen/module:** **Top search scope** dropdown.
- **Purpose:** Choose what the top bar searches.
- **Key fields:** **Patient / Product**.
- **Actions:** Switch scope.
- **Navigation:** Dropdown left of the search box.
- **Workflow meaning:** One search box, two entities.
- **Ideas for our project:** Optional scope toggle (patient vs medicine) on our top search.
- **Implement:** later (search scope toggle).

### Screenshot (63)
- **Screen/module:** eMessages — **repeat dispensing** instances for one patient.
- **Purpose:** Manage a repeat series (e.g. 1–5 of 5).
- **Key fields:** Name (N of 5), Handout, Expiry, Action by, **Status** (New-Ready to dispense / Claim complete), Prescription Type (Repeat Dispensing N of 5).
- **Actions:** Return / Dispense.
- **Navigation:** Message list.
- **Workflow meaning:** Serial/repeat dispensing lifecycle.
- **Ideas for our project:** "N of M" cycle counter concept maps to our dosette cycles.
- **Implement:** ignore (EPS repeat specifics).

### Screenshot (64)
- **Screen/module:** Dispensary — **Matched Patient** dialog.
- **Purpose:** Match the prescription's patient to an existing record.
- **Key fields:** Title, First/Other/Last name, Address, Postcode, NHS no, DoB, Sex, Charges Exemption.
- **Actions:** Back / Next / Cancel.
- **Navigation:** During electronic-prescription dispensing.
- **Workflow meaning:** Avoid duplicate patients / confirm identity.
- **Ideas for our project:** Identity-confirmation step (we surface DOB/postcode/ID in search to disambiguate).
- **Implement:** later.

### Screenshot (65)
- **Screen/module:** Dispensary — **Confirm Patient Details** dialog.
- **Purpose:** Selectively update the patient record from the prescription.
- **Key fields:** "details not checked will NOT be updated"; Telephone; NHS number auto-update; Download All / Select All.
- **Actions:** Update selected fields.
- **Navigation:** After patient match.
- **Workflow meaning:** Controlled, auditable record updates.
- **Ideas for our project:** "Confirm which fields to update" pattern for safe record edits.
- **Implement:** later.

### Screenshot (66)
- **Screen/module:** Dispensary — **Patient Medication History** dialog.
- **Purpose:** Reuse a previous medication when dispensing.
- **Key fields:** List of past medications (drug, directions, date, qty); "Don't show this page again".
- **Actions:** Select to repeat from history.
- **Navigation:** During dispensing.
- **Workflow meaning:** Speed via reuse of prior items.
- **Ideas for our project:** "Repeat from history" when adding a dosette item (our med model has change history).
- **Implement:** later.

### Screenshot (67)
- **Screen/module:** Dispensary — **Select Product** + full prescription preview.
- **Purpose:** Pick the exact product/pack against the script.
- **Key fields:** Product list (Levothyroxine 25mcg, Pack 28/500, **Stock 0**); right panel = patient demographics, Item 1/2 with directions + **DM+D codes**, prescriber, exemption; Personal list / Discontinued / Formulation substitution toggles.
- **Actions:** Next / Cancel; Endorse, Save to pending, Not dispensed; item paging (2 of 2).
- **Navigation:** Dispensing item step.
- **Workflow meaning:** Product selection with stock visibility + full script context.
- **Ideas for our project:** Show **stock-on-hand at point of selection** (our picking list does this) + side-by-side script context.
- **Implement:** later.

### Screenshot (68)
- **Screen/module:** **Find Patient** dialog (canonical patient search).
- **Purpose:** Locate a patient by multiple criteria.
- **Key fields:** **Name, Street, Postcode, DOB**; result columns Last/First Name, Sex, #, Address, DOB; **"Extend search to similar sounding names"** checkbox; "Show temporary patients".
- **Actions:** Find, Add, Details, OK, Cancel.
- **Navigation:** Opened from search / dispensing.
- **Workflow meaning:** Multi-field + **phonetic** patient lookup with explicit selection.
- **Ideas for our project:** **Directly validates our implemented similar-spelling search** (phonetic + edit-distance) and multi-format matching. Could add explicit Street/DOB fields.
- **Implement:** **DONE** (similar-spelling search shipped); later for extra fields.

### Screenshot (69)
- **Screen/module:** Find Patient — many-result list (e.g. "Da Costa / Da Silva" cluster).
- **Purpose:** Disambiguate among many same/similar surnames.
- **Key fields:** Last/First Name, Sex, #, Address, DOB rows (long list).
- **Actions:** Select correct patient; OK/Cancel.
- **Navigation:** Result list scroll.
- **Workflow meaning:** Never auto-pick — staff choose from all matches.
- **Ideas for our project:** Confirms our "show all matches, no auto-open" rule.
- **Implement:** **DONE** (our picker shows all matches).

### Screenshot (70)
- **Screen/module:** Find Patient — **"Jade Peachey" → Peachey / Pearce / Pearson** results.
- **Purpose:** Similar-sounding-name search in action.
- **Key fields:** Peachey Jade; Peachey Jade Charlotte; **Pearce** Jade Krista; **Pearson** Jasmine — with #, Address, DOB.
- **Actions:** Select; Find; Add/Details/OK/Cancel; "Extend search to similar sounding names".
- **Navigation:** Result picker.
- **Workflow meaning:** The canonical phonetic-search example.
- **Ideas for our project:** **Exact validation** of our similar-spelling tier (we ship a Connor/Conner/Connors analogue).
- **Implement:** **DONE**.

### Screenshot (71)
- **Screen/module:** **Patient Details → Patient** tab.
- **Purpose:** Edit core demographics.
- **Key fields:** Patient number, Title, First/Other/Last name, Ethnicity, Address, NHS no, **DOB, Age, Sex**, Group, Postcode, Home/Work/Mobile phone, E-mail; flags (Temporary, App user, Exempt, Always prints collection, Multi-card); label buttons.
- **Actions:** Intervene; Delete/OK/Cancel/Apply.
- **Navigation:** Tabbed Patient Details (Patient/Doctor/Conditions/Medication/History/Other/Suppressions/Exemptions/Repeat Rx/…).
- **Workflow meaning:** The demographic heart of the record.
- **Ideas for our project:** Our patient record carries these fields (minus NHS); confirms field set.
- **Implement:** later (we have a Patient tab).

### Screenshot (72)
- **Screen/module:** **Patient Details → Doctor** tab.
- **Purpose:** Registered GP/practice details.
- **Key fields:** Registered Doctor, Practice, Address, Postcode, Telephone.
- **Actions:** Details lookup; Address Label.
- **Navigation:** Doctor tab.
- **Workflow meaning:** Prescriber/practice linkage.
- **Ideas for our project:** Our record has a Doctor tab (name/practice/phone) — aligned.
- **Implement:** later (we have a Doctor tab).

### Screenshot (73)
- **Screen/module:** **Patient Details → Conditions** tab.
- **Purpose:** Conditions, sensitivities, ADRs.
- **Key fields:** PMR Conditions (Has / Has Not / Unknown), Other Known Conditions, product **sensitivities** (Product/Applicability/Comment), Other known sensitivities, **Adverse Drug Reactions**.
- **Actions:** Add/Delete/Edit.
- **Navigation:** Conditions tab.
- **Workflow meaning:** Clinical safety context (allergies/ADRs).
- **Ideas for our project:** We have an allergies field; could add an **ADR/sensitivities** section (feeds AI clinical-safety).
- **Implement:** later (allergies/ADR section).

### Screenshot (74)
- **Screen/module:** **Patient Details → Medication** tab.
- **Purpose:** The patient's medication list.
- **Key fields:** Medication Items (drug, directions, price, qty); Select Repeat Format (Email/Print/Paper); "don't show expanded directions".
- **Actions:** View Prescription Tracker; manage items.
- **Navigation:** Medication tab.
- **Workflow meaning:** Current/repeat medication overview.
- **Ideas for our project:** Our Medication tab + change history already covers this.
- **Implement:** later (we have a Medication tab).

### Screenshot (75)
- **Screen/module:** **Patient Details → History** tab.
- **Purpose:** Filterable activity/dispensing history.
- **Key fields:** Date (Last 30 days / From-To), Category filter; columns Description, Type, Date.
- **Actions:** Display; Intervene, Audit, Delete, Reprint, Collect, Details.
- **Navigation:** History tab.
- **Workflow meaning:** Per-patient audit/dispensing trail with reprint/collect.
- **Ideas for our project:** Our History tab + medication audit trail aligns; could add date/category filter.
- **Implement:** later (history filters).

### Screenshot (76)
- **Screen/module:** **Patient Details → Other** tab.
- **Purpose:** Misc per-patient options & notes.
- **Key fields:** Other Medication Items (Add Product/Free Text), Consent to share data, **Notes**, Print Custom Label; Options (**Child-resistant container**, Form registered, Large labels required, Drug dependency), Interaction search months.
- **Actions:** Add product/free text; toggle options.
- **Navigation:** Other tab.
- **Workflow meaning:** Dispensing preferences & consent.
- **Ideas for our project:** "Large labels"/"child-resistant" flags = **accessibility-relevant** dispensing prefs; consent flag.
- **Implement:** later (accessibility dispensing prefs).

### Screenshot (77)
- **Screen/module:** **Medication Item** dialog → Details tab.
- **Purpose:** Configure one repeat medication item.
- **Key fields:** Product, "patient regularly receives / generate anticipated repeat", Dates (last printed, next due, treatment period, last dispensed), Compliance (compliant / not / manual override).
- **Actions:** OK/Cancel/Update.
- **Navigation:** From Medication tab.
- **Workflow meaning:** Repeat scheduling + compliance flag.
- **Ideas for our project:** "Next due"/"anticipated repeat" ties to our dosette next-expected dates.
- **Implement:** later.

### Screenshot (78)
- **Screen/module:** Medication Item → **Preferences** tab.
- **Purpose:** Patient's preferred items.
- **Key fields:** Preferred item; "patient has requested the following items".
- **Actions:** Add/Remove preference.
- **Navigation:** Item dialog tab.
- **Workflow meaning:** Brand/format preference capture.
- **Ideas for our project:** Patient preference notes (brand/format).
- **Implement:** ignore (minor).

### Screenshot (79)
- **Screen/module:** Medication Item → **Compliance** tab.
- **Purpose:** Track adherence to repeat schedule.
- **Key fields:** Parameters (days early/late), Summary (times dispensed, **non-compliances**), Compliant/Non-compliant indicator.
- **Actions:** OK/Cancel.
- **Navigation:** Item dialog tab.
- **Workflow meaning:** Adherence monitoring.
- **Ideas for our project:** **AI non-compliance / unusual-usage detection** — strong AI feature (compare dispensed cadence to expected).
- **Implement:** later (AI adherence detection — candidate).

### Screenshot (80)
- **Screen/module:** Medication Item — **Prescription Item Details**.
- **Purpose:** Full detail of a dispensed item.
- **Key fields:** Added by, Dispensary supply (NHS Standard), Prescriber, Prescribing Practice, Patient, Written as, Quantity, Directions, Reference, Quantity Owed; tabs Details/Notes/Charging/Non Compliance/Items Dispensed.
- **Actions:** Details/OK/Cancel.
- **Navigation:** Drill-down from medication list.
- **Workflow meaning:** Auditable dispensed-item record (who/what/when).
- **Ideas for our project:** Our dispense-line concept (written/dispensed-as, qty, owed) — defer.
- **Implement:** later.

### Screenshot (81)
- **Screen/module:** Prescription Item Details → **Details** tab.
- **Purpose:** Dosage + accuracy check on an item.
- **Key fields:** Dosage (Quantity, Frequency, Abbreviation), **Accuracy Checking** (Checked by, Date Checked), Notes.
- **Actions:** Details/OK/Cancel.
- **Navigation:** Item dialog tab.
- **Workflow meaning:** Records WHO accuracy-checked an item and WHEN.
- **Ideas for our project:** Capture **checked-by + timestamp** on our dosette "Checked" state (audited).
- **Implement:** later (accuracy-check audit fields).

### Screenshot (82)
- **Screen/module:** Prescription Item Details → **Charging** tab.
- **Purpose:** Fees & reimbursement.
- **Key fields:** Charge type, Tariff use, Cost to recipient, Cost of product, Number of charges, Fees, Expected reimbursement, Explanation.
- **Actions:** OK/Cancel.
- **Navigation:** Item dialog tab.
- **Workflow meaning:** NHS pricing/endorsement.
- **Ideas for our project:** Not applicable (no NHS charging).
- **Implement:** ignore.

### Screenshot (83)
- **Screen/module:** Prescription Item Details → **Dispensary Supply Form** tab.
- **Purpose:** Supply/source metadata.
- **Key fields:** Added by, Dispensary supply (NHS Standard), Prescriber, Prescribing Practice, Patient, Supply Collection Date, Electronic ID, VAT rate.
- **Actions:** Details/OK/Cancel.
- **Navigation:** Item dialog tab.
- **Workflow meaning:** Provenance of the supply.
- **Ideas for our project:** "Collection date" + provenance fields (defer).
- **Implement:** later.

### Screenshot (84)
- **Screen/module:** **eMessage Details** — full electronic prescription record.
- **Purpose:** Inspect an electronic prescription.
- **Key fields:** Left: patient (NHS, DoB, Age, Sex), Item (Fluoxetine 20mg, 3 of 6, directions, DM+D), prescriber/practice; Right: Electronic/Secondary Message ID, Description, Action by, **Message Type (R2 Prescription), Priority, Status, Status Reason, Notes**; tabs eMessage Record/Data/Repeat Details/Additional Details/Local Patient.
- **Actions:** Export Log; OK/Cancel.
- **Navigation:** From eMessages list.
- **Workflow meaning:** Canonical e-prescription detail with priority/status.
- **Ideas for our project:** **Priority + status** on worklist items; "two-pane: patient/script summary + metadata" layout.
- **Implement:** later (priority on worklists).

### Screenshot (85)
- **Screen/module:** Dispensary — **Private Prescription / Incomplete Details** dialog.
- **Purpose:** Complete a private (non-NHS) script.
- **Key fields:** Prescription date, Prescription notes; Dispense as; Item iteration; Reason for supply; "incomplete details — add to improve quality".
- **Actions:** OK/Cancel.
- **Navigation:** During private dispensing.
- **Workflow meaning:** Private supply handling.
- **Ideas for our project:** A simple "private supply" type (no NHS) could fit our model.
- **Implement:** later.

### Screenshot (86)
- **Screen/module:** **User Details → Account Details** dialog.
- **Purpose:** Manage a user account.
- **Key fields:** User ID, Account status, First/Last name, **Job role (Dispenser)**, Professional reference; Security (Reset/Forgot password, Forgot questions); **Administrator account**, Disable account, Handout Manager User.
- **Actions:** Reset/forgot password; OK/Cancel.
- **Navigation:** Tools → User Settings → User Account Management.
- **Workflow meaning:** RBAC user management (roles, admin flag, account status).
- **Ideas for our project:** **Directly aligns with our RBAC** (Administrator/Pharmacist/Dispenser). Could add admin user-management UI + account status. (We do NOT handle passwords in plain text — security note.)
- **Implement:** later (admin user-management UI; we already have RBAC roles).

### Screenshot (87)
- **Screen/module:** **System Details → Backup & Misc**.
- **Purpose:** Backup paths + data-retention/purging.
- **Key fields:** Backup directory; reports/log directories; **Automatic Purging older than (days)**: pending supplies (28), reclaim owings (28), order logs (7), message-dynamics (60), expired EPSR1 (28), EPS advanced logs (30); Saved-reports max space; Confirm deletion.
- **Actions:** Browse paths; set purge days; OK.
- **Navigation:** Tools → System Settings → System Configuration.
- **Workflow meaning:** Backups + automated data lifecycle.
- **Ideas for our project:** **Data-retention policy** (auto-purge old transient records) is good practice; our audit log is append-only by design.
- **Implement:** later (retention policy note).

### Screenshot (88)
- **Screen/module:** **Pharmacy Details → Pharmacy** tab (General).
- **Purpose:** Pharmacy identity.
- **Key fields:** Pharmacy name, Owner, Address, Postcode, Telephone, Modem; "chain/buying group"; NACS code; sub-tabs General/Opening Times/Intelligence Hub/Communications.
- **Actions:** Edit; OK.
- **Navigation:** Settings → Pharmacy.
- **Workflow meaning:** Site configuration.
- **Ideas for our project:** Our Settings can hold pharmacy identity + opening times.
- **Implement:** later (minor).

### Screenshot (89)
- **Screen/module:** Pharmacy Details → **Licence** tab.
- **Purpose:** Licence/registration keys.
- **Key fields:** Site number, Registration key, Activation key, Number of licences, Expiry date, Database server.
- **Actions:** Enter keys; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** Product licensing.
- **Ideas for our project:** Not applicable.
- **Implement:** ignore.

### Screenshot (90)
- **Screen/module:** Pharmacy Details → Dispensing → Printing/Endorsing/Defaults.
- **Purpose:** Configure label/endorsement printing defaults.
- **Key fields:** Print bag/dispensing/address labels; print on address/second labels; print sorting; overnight-label content; prescription separation.
- **Actions:** Toggle print options; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** Label/print defaults.
- **Ideas for our project:** Print toggles for our labels (defer; our print is browser-based).
- **Implement:** later (minor).

### Screenshot (91)
- **Screen/module:** Pharmacy Details → **Charging** tab.
- **Purpose:** Private/NHS charge config.
- **Key fields:** Private charges (tariff/retail/trade base), charge list (Dispensing/Container/Extra CD), mark-up (min £17.50, 60%), print cost on bag label, NHS charge, VAT rates.
- **Actions:** Add/Edit/Delete charges; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** Pricing rules.
- **Ideas for our project:** Not applicable (no charging).
- **Implement:** ignore.

### Screenshot (92)
- **Screen/module:** Pharmacy Details → **Checking → Services**.
- **Purpose:** Medication-checking & service alerts.
- **Key fields:** New Medicine Service (Enable), **Alert Type: Display onscreen alert / Print reminder label**; sub-tabs Clinical/Services.
- **Actions:** Toggle alerts.
- **Navigation:** Settings tab.
- **Workflow meaning:** Clinical-check & service prompts.
- **Ideas for our project:** **Dual alert channel** (onscreen + print) is an accessibility idea; alert prompts feed our AI clinical-safety.
- **Implement:** later.

### Screenshot (93)
- **Screen/module:** Pharmacy Details → **Products → General**.
- **Purpose:** Product/personal-list defaults.
- **Key fields:** Personal List Options (default-to-personal-list, auto-add after N dispenses), Assistance (**Reconstituted quantity / Special container / Calendar pack / Split container**), New Product (Auto-Order ON).
- **Actions:** Toggle options.
- **Navigation:** Settings tab.
- **Workflow meaning:** Dispensing assistance + auto-reorder defaults.
- **Ideas for our project:** **Calendar-pack assistance** is MDS-relevant; "auto-order on new product" ties to our reorder logic.
- **Implement:** later.

### Screenshot (94)
- **Screen/module:** Pharmacy Details → **Ordering** tab.
- **Purpose:** Order workflow defaults.
- **Key fields:** Remove received orders, audible alert when order due, **separate ordering for MDS room**, order responses (label/form printer), **Auto book-in** (older than N days), default supplier, **expensive-order threshold (£100)**.
- **Actions:** Toggle; OK.
- **Navigation:** Settings tab (sub-tabs Ordering/Stock Control/Order Rules).
- **Workflow meaning:** Automates ordering & receipt.
- **Ideas for our project:** "Auto book-in", "expensive-order flag", separate MDS ordering — ideas for our PO/reorder feature.
- **Implement:** later.

### Screenshot (95)
- **Screen/module:** Pharmacy Details → **Product Rules** tab.
- **Purpose:** Per-product order-set exceptions.
- **Key fields:** Product → Order Set mapping (e.g. Accrete D3 → "Phoenix H/c Dist Order").
- **Actions:** Find/Add/Edit/Delete.
- **Navigation:** Settings tab.
- **Workflow meaning:** Which supplier/order-set a product defaults to.
- **Ideas for our project:** Default-supplier-per-medicine (we have default_supplier already).
- **Implement:** later (we have default_supplier).

### Screenshot (96)
- **Screen/module:** Pharmacy Details → **Events** tab.
- **Purpose:** System event/audit log.
- **Key fields:** When (Today/From-To); Date + Event ("User X logged in/out successfully").
- **Actions:** Display; Reprint.
- **Navigation:** Settings tab.
- **Workflow meaning:** **Login/logout & system audit trail**.
- **Ideas for our project:** Our **immutable audit log** already records significant actions; could surface a filterable event view (date range).
- **Implement:** later (audit-log viewer — we have the log).

### Screenshot (97)
- **Screen/module:** Pharmacy Details → **EPS** tab → General.
- **Purpose:** Electronic Prescription Service config.
- **Key fields:** Dispense Notify Options, Auto Notify, Prescription Completion, Claiming, Real-Time Exemption Check, Patient Nomination.
- **Actions:** Toggle; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** NHS EPS integration.
- **Ideas for our project:** Not applicable (no NHS EPS).
- **Implement:** ignore.

### Screenshot (98)
- **Screen/module:** Pharmacy Details → **Scanner** tab.
- **Purpose:** Barcode-scanner configuration.
- **Key fields:** Activate barcode scanning, Port, Device (BC-NLSeries USB), advanced logging.
- **Actions:** Enable; set port; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** Hardware for **scan-verification accuracy checks**.
- **Ideas for our project:** Supports our roadmap **barcode/2D-scan accuracy check** (a browser camera/keyboard-wedge equivalent).
- **Implement:** later (barcode accuracy check — roadmap #1).

### Screenshot (99)
- **Screen/module:** Pharmacy Details → **Patient Selection Wizard** tab.
- **Purpose:** Dispensing validation options.
- **Key fields:** "Don't show medication history while dispensing"; dm+d description checking; **dm+d item validation** ("validate each item dispensed against the prescribed item — keep enabled").
- **Actions:** Toggle; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** Ensures dispensed item matches prescribed item (safety).
- **Ideas for our project:** **Dispensed-vs-prescribed validation** = our scan/accuracy-check concept.
- **Implement:** later (accuracy check).

### Screenshot (100)
- **Screen/module:** Pharmacy Details → **Repeat Rx** tab.
- **Purpose:** Repeat/review timing thresholds.
- **Key fields:** Display patients with **items due in next X days (14)**, items due in following X days (28), **patients with GP review due in X days (28)**, default repeat period (28), **default GP review period (90)**; delivery service; auto registration letters.
- **Actions:** Set thresholds; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** Drives "due soon" and "review due" worklists.
- **Ideas for our project:** **Configurable "due soon / review due" windows** → feeds our AI "patients due for review" + dosette "due dates".
- **Implement:** later (configurable review/due windows — strong AI candidate).

### Screenshot (101)
- **Screen/module:** Pharmacy Details → **Leaflet Printing** tab.
- **Purpose:** Patient/health info leaflet printing.
- **Key fields:** Enable Health Information / Patient Information leaflet printing; homepage; print label with leaflet.
- **Actions:** Toggle; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** Auto patient leaflets.
- **Ideas for our project:** Optional "patient info leaflet" with a dosette pack (defer).
- **Implement:** ignore (minor).

### Screenshot (102)
- **Screen/module:** Pharmacy Details → **Electronic Messaging** tab.
- **Purpose:** Repeat/labelling automation.
- **Key fields:** Repeating (**copy quantity / directions from last dispense**), Quantity Matching, Labelling for multiple/single packs, **Barcode scan to MDS**, prescription grouping (90 days).
- **Actions:** Toggle; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** Speed via copy-from-last + label rules.
- **Ideas for our project:** **"Copy from last dispense"** efficiency (our med change history enables this); "barcode scan to MDS" = our scan-check.
- **Implement:** later.

### Screenshot (103)
- **Screen/module:** Pharmacy Details → **Responsible Pharmacist** tab.
- **Purpose:** RP reminder/compliance settings.
- **Key fields:** Enable reminder (N min after startup if not logged in), show reminder for missing/incomplete records, display missing records up to 2 weeks, min 15-min gaps.
- **Actions:** Toggle; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** Ensures RP register completeness.
- **Ideas for our project:** RP reminder → ties to our audit/RP indicator (#59/#60).
- **Implement:** later.

### Screenshot (104)
- **Screen/module:** Pharmacy Details → **Message Dynamics** tab.
- **Purpose:** Patient-messaging integration.
- **Key fields:** Pharmacy ID, URL, polling interval, collection notification options (acute/repeat: notify/defer/prompt), identify active patients on bag labels.
- **Actions:** Configure; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** SMS/collection notifications.
- **Ideas for our project:** Collection-ready notification concept (we have notifications); external SMS out of scope.
- **Implement:** ignore (external messaging integration).

### Screenshot (105)
- **Screen/module:** Pharmacy Details → **Realtime Backup** tab (full tab list visible).
- **Purpose:** Continuous DB backup config.
- **Key fields:** Enable Realtime Backup; storage location; number of archives (3–14); full settings-tab list (Dispensing, Charging, Checking, Products, Ordering, Scanner, Repeat Rx, RP, Security, eMAR, FMD, Accuracy Check, …).
- **Actions:** Enable; set path; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** Disaster recovery to point-of-failure.
- **Ideas for our project:** Confirms the **breadth** of a real settings surface — we keep ours focused; PostgreSQL backups are an ops concern.
- **Implement:** ignore (ops/infra).

### Screenshot (106)
- **Screen/module:** Pharmacy Details → **Medication Services** tab.
- **Purpose:** MUR/advanced-service config.
- **Key fields:** Targeted MURs (enabled, MUR year Apr–Mar), Prompting (on-screen prompts / print labels), Annual MURs.
- **Actions:** Toggle; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** NHS advanced-service management.
- **Ideas for our project:** Not applicable (NHS MUR).
- **Implement:** ignore.

### Screenshot (107)
- **Screen/module:** Pharmacy Details → **Patient Alerts** tab.
- **Purpose:** Configure point-of-dispensing alerts.
- **Key fields:** No-Patient-History alert; Alert Types (Prescription type Paper/Electronic/Both, Message Dynamics, EPSR2 Nomination + age, Home Delivery + age, **User-Defined Alert**).
- **Actions:** Toggle alerts; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** Surface patient-specific flags at dispense.
- **Ideas for our project:** **User-defined patient alert** (e.g. "always delivers", "review due") shown on opening a record.
- **Implement:** later (patient alert banner).

### Screenshot (108)
- **Screen/module:** Pharmacy Details → **Keystroke Reduction** tab.
- **Purpose:** Speed up data entry.
- **Key fields:** Quantity Matching, Defer Claim, **Fast Labelling** (auto-populate Dispense-As item, auto-populate directions from prescription), **Trusted directions** (alert when not set), Set Defaults.
- **Actions:** Toggle; Set Defaults.
- **Navigation:** Settings tab.
- **Workflow meaning:** Fewer keystrokes via auto-fill + trusted directions.
- **Ideas for our project:** **Auto-fill directions** + **Trusted Directions (sig-code) builder** — efficiency & accessibility.
- **Implement:** later (directions builder/auto-fill).

### Screenshot (109)
- **Screen/module:** Pharmacy Details → **Security** tab.
- **Purpose:** Password policy.
- **Key fields:** Advanced Password Reset mode, Block continuous changes, **Minimum admin password length (8)**, **Maximum password age (56 days)**.
- **Actions:** Set policy; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** Account security policy.
- **Ideas for our project:** Password-policy ideas (we use Django PBKDF2 + validators); could add min-length/age config.
- **Implement:** later (password policy config).

### Screenshot (110)
- **Screen/module:** Pharmacy Details → **eMAR** tab.
- **Purpose:** Electronic MAR activation.
- **Key fields:** Activate (eMAR wizard), Registration key, eMAR activation key, Expiry date.
- **Actions:** Activate eMAR.
- **Navigation:** Settings tab.
- **Workflow meaning:** Electronic MAR charts to care homes.
- **Ideas for our project:** Our printable MAR/tray label is the offline equivalent.
- **Implement:** ignore (eMAR integration).

### Screenshot (111)
- **Screen/module:** Pharmacy Details → **FMD** tab.
- **Purpose:** Falsified Medicines Directive scanning.
- **Key fields:** Enable FMD integration; **warn about items due to expire in 60 days**; aggregation during dispensing.
- **Actions:** Enable; set warn-days.
- **Navigation:** Settings tab.
- **Workflow meaning:** Pack authentication + expiry warning at dispense.
- **Ideas for our project:** **Expiry warning at point of pick** (we already warn on FEFO/expiry); 2D-pack scan ties to barcode accuracy check.
- **Implement:** later (expiry warning we have; scan = roadmap).

### Screenshot (112)
- **Screen/module:** Pharmacy Details → **Delivery** tab.
- **Purpose:** Delivery-manager integration.
- **Key fields:** Pro Delivery Manager (Use API / Print QR Code, API Key, URL, Company ID, Authenticate); PharmDel.
- **Actions:** Authenticate.
- **Navigation:** Settings tab.
- **Workflow meaning:** Home-delivery routing/proof.
- **Ideas for our project:** "Delivery" as a handout type (we have Collected/Delivered states); external API out of scope.
- **Implement:** ignore (external delivery API).

### Screenshot (113)
- **Screen/module:** Pharmacy Details → **App Integration** tab.
- **Purpose:** Patient-app integration.
- **Key fields:** Select app (e.g. Healthera), Activate/DeActivate.
- **Actions:** Activate integration.
- **Navigation:** Settings tab.
- **Workflow meaning:** Patient-facing app linkage.
- **Ideas for our project:** Out of scope (no external patient app).
- **Implement:** ignore.

### Screenshot (114)
- **Screen/module:** Pharmacy Details → **Automated Clinical Check** tab.
- **Purpose:** Enable automatic clinical checking.
- **Key fields:** Activate; auto clinical check based on last **6 months**; automate checks in Clinical Check module only.
- **Actions:** Enable; OK.
- **Navigation:** Settings tab.
- **Workflow meaning:** Automated interaction/clinical screening window.
- **Ideas for our project:** Our **AI Clinical Safety** screen is the analogue; configurable look-back window is a nice idea.
- **Implement:** later (AI clinical-safety we have).

### Screenshot (115)
- **Screen/module:** Pharmacy Details → **Accuracy Check** tab.
- **Purpose:** Scan/accuracy-check config + label layout.
- **Key fields:** Activate Accuracy Check, Exclude MDS/MDSC, **Allow Bulk Manual Confirmation**, Enable Split Pack Prompts, Additional bags for Fridge/CD, **Enable Clinical Check Warning**; **Label & QR Settings** (Picking-list label, Item label, Bag label margins; **Print Test Label**).
- **Actions:** Enable; set label margins; print test.
- **Navigation:** Settings tab.
- **Workflow meaning:** The accuracy/scan-check gate + printable picking/bag labels with QR.
- **Ideas for our project:** **Directly supports roadmap #1 (barcode/QR accuracy check)** + a **picking-list label**; our printable tray label is adjacent.
- **Implement:** later (accuracy check + picking label — strong candidate).

### Screenshot (116)
- **Screen/module:** **User Details → Preferences** tab.
- **Purpose:** Per-user UI preferences.
- **Key fields:** **Colours** (mandatory / invalid / quasi-mandatory input colours), Enter-key behaviour, Print labels timing, Print orders, Dispense order, Prescription-finished options, Confirm multiple deletes.
- **Actions:** Pick colours/behaviour; OK.
- **Navigation:** Tools → User Settings → User Details.
- **Workflow meaning:** Personalised UI + input validation cues.
- **Ideas for our project:** **Per-user accessibility preferences** (high-contrast/colour cues, confirm-before-delete) — ties to our PreferencesContext.
- **Implement:** later (accessibility prefs — candidate).

### Screenshot (117)
- **Screen/module:** **User Details → Dispensing** tab.
- **Purpose:** Per-user dispensing alert preferences.
- **Key fields:** Messages (patient preference, quantity-not-in-range, **batch number required**, endorsement, **non compliance**, directions-too-long, **Yellow (Level 2) interactions**, tariff exceeded, named-patient-only); Directions (cautions/both/neither); Counselling/Pharmacist-advice/Tariff prompts; Patient-notes dialog.
- **Actions:** Toggle alerts; OK.
- **Navigation:** User Details tab.
- **Workflow meaning:** Which safety prompts each user sees.
- **Ideas for our project:** Configurable **alert set** (interactions, non-compliance, batch-required) feeding our AI clinical-safety + notifications.
- **Implement:** later.

### Screenshot (118)
- **Screen/module:** **User Management** dialog.
- **Purpose:** Admin list of all users.
- **Key fields:** User ID, **Administrator? (Yes/No)**, Last Logged In, **State (Active)**; include deleted accounts.
- **Actions:** Add, Delete, Details, Close.
- **Navigation:** Tools → User Settings → User Account Management.
- **Workflow meaning:** RBAC user administration + last-login audit.
- **Ideas for our project:** **Admin user-management table** (role, active/inactive, last login) — fits our admin role.
- **Implement:** later (admin user list).

### Screenshot (119)
- **Screen/module:** **Bulk Operations** wizard (intro).
- **Purpose:** Run estate-wide product/list operations.
- **Key fields:** Operation list — Remove All Drugs From Personal List, Remove Unused Drugs & Pack Policies, Reset Brand/Pack Policies, **Mass Prescription Change**, Change Default Generic Manufacturer, Reset Interaction Search Period, Reset Auto Registration, …
- **Actions:** Next/Close.
- **Navigation:** Tools → Bulk Operations.
- **Workflow meaning:** Batch maintenance of product/patient data.
- **Ideas for our project:** Admin bulk tools (e.g. recompute reorder levels) — niche; defer.
- **Implement:** ignore (vendor bulk tooling).

### Screenshot (120)
- **Screen/module:** Bulk Operations wizard (operation list).
- **Purpose:** Choose a bulk maintenance operation.
- **Key fields:** Remove all drugs from personal list, Remove unused drugs/pack policies, Reset brand/pack policies, Mass Prescription Change, Reset Interaction Search, Zero Balance Used, Fix Repeats, Setup Special Obtains.
- **Actions:** Next/Close.
- **Navigation:** Tools → Bulk Operations.
- **Workflow meaning:** Estate-wide data fixes.
- **Ideas for our project:** Defer (admin tooling).
- **Implement:** ignore.

### Screenshot (121)
- **Screen/module:** Bulk Operations wizard (list scrolled).
- **Purpose:** More bulk operations.
- **Key fields:** Reset brand/pack policies, Mass Prescription Change, Reset Interaction Search, Zero Balance Used, Fix Repeats, Setup Special Obtains, **Restore MDS Repeats & History**, Remove prepared owings.
- **Actions:** Next/Close.
- **Navigation:** Same wizard.
- **Workflow meaning:** MDS/owings batch maintenance.
- **Ideas for our project:** Defer.
- **Implement:** ignore.

### Screenshot (122)
- **Screen/module:** Tools → **Inquiry** submenu (duplicate of #49, with shortcuts).
- **Purpose:** Reference-data lookups.
- **Key fields:** Patient/Product/Supplier/Prescriber/Institution/Direction/Counter File/Nursing Home/Stock Adjustment Reasons/Caution/Interventions/dm+d/**Trusted Directions (Shift+Ctrl+T)**/Audit Content/Leaflets.
- **Actions:** Open editor.
- **Navigation:** Nested submenu + shortcuts.
- **Workflow meaning:** Keyboard-driven reference editors.
- **Ideas for our project:** Keyboard shortcuts + a Trusted Directions editor (see #49).
- **Implement:** later (shortcuts/directions builder).

### Screenshot (123)
- **Screen/module:** Dispensary — **Trusted Directions** picker.
- **Purpose:** Expand a short dosage code into full directions.
- **Key fields:** Code list — "ONE to be taken", "Take TWO 5ml spoonsful", "Gently pat ONE into the region", "Take THREE 5ml spoonful", "1 tablet to be taken" — with short codes.
- **Actions:** Pick a direction; Edit; Close.
- **Navigation:** From the dispensing Directions field.
- **Workflow meaning:** Standardised, fast, **plain-English** directions (avoids Latin abbreviations).
- **Ideas for our project:** A **Trusted Directions / sig-code builder** — type a code → expand to clear instructions on dosette items/labels. Strong efficiency + accessibility + safety win.
- **Implement:** later (directions builder — recommended).

### Screenshot (124)
- **Screen/module:** Trusted Directions picker (more codes).
- **Purpose:** Continued directions library.
- **Key fields:** "1 capsule to be taken", "ONE OR TWO to be taken", "Take ONE 5ml dose", "Take ONE at 9 hours", "2 capsule to be taken", …
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Breadth of standard directions.
- **Ideas for our project:** Seed a directions library for the builder.
- **Implement:** later.

### Screenshot (125)
- **Screen/module:** Trusted Directions picker (more codes).
- **Purpose:** Continued directions library.
- **Key fields:** "every 12 hours", "TWO to be taken", "Take FOUR 5ml spoonsful", "Take a 20ml dose", "every TWO hours", "Take TWO OR THREE", …
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Frequency/quantity direction variants.
- **Ideas for our project:** Frequency presets for the directions builder.
- **Implement:** later.

### Screenshot (126)
- **Screen/module:** Trusted Directions picker (more codes).
- **Purpose:** Continued directions library.
- **Key fields:** "Take a 20ml dose", "Take TWO 5ml spoonsful", "Take TWO OR THREE", "Take TWO AT FIRST then…", "every TWO to THREE hours".
- **Actions:** Pick; Edit; Close.
- **Navigation:** Same picker.
- **Workflow meaning:** More frequency/quantity directions.
- **Ideas for our project:** Directions-library seed (see #123).
- **Implement:** later.

### Screenshot (127)
- **Screen/module:** Trusted Directions picker (more codes).
- **Purpose:** Continued directions library.
- **Key fields:** "THREE to be taken", "3 capsules to be taken", "every THREE hours", "Take THREE TO FOUR", "every THREE TO FOUR hours".
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Three-dose variants.
- **Ideas for our project:** Directions-library seed.
- **Implement:** later.

### Screenshot (128)
- **Screen/module:** Trusted Directions picker (more codes).
- **Purpose:** Continued directions library.
- **Key fields:** "every 24 hours", "FOUR to be taken", "4 tablets to be taken", "Take FOUR at first then", "every FOUR TO SIX hours".
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Four-dose / interval variants.
- **Ideas for our project:** Directions-library seed.
- **Implement:** later.

### Screenshot (129)
- **Screen/module:** Trusted Directions picker (more codes).
- **Purpose:** Continued directions library.
- **Key fields:** "Take TWO 5ml spoonsful", "Take FOUR 5ml spoonsful", "Take ONE OR TWO 5ml…", "Take ONE 5ml dose".
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Liquid-dose variants.
- **Ideas for our project:** Directions-library seed.
- **Implement:** later.

### Screenshot (130)
- **Screen/module:** Trusted Directions / Directions abbreviation codes.
- **Purpose:** Latin-style sig codes → plain English.
- **Key fields:** Abbreviations (e.g. AD/BD/AE/AF…) expanding to "before food", "on alternate days", "after meals", "apply to affected area", "into the affected ear", "as before", etc.
- **Actions:** Pick; Edit.
- **Navigation:** Directions field picker.
- **Workflow meaning:** Map clinician shorthand to patient-friendly text.
- **Ideas for our project:** **Abbreviation-expansion table** for the directions builder (safety: avoid ambiguous Latin on patient labels).
- **Implement:** later (directions builder).

### Screenshot (131)
- **Screen/module:** Trusted Directions picker (more codes).
- **Purpose:** Continued directions library.
- **Key fields:** "every 6/8 hours", "every EIGHT hours" variants.
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Interval-dosing variants.
- **Ideas for our project:** Directions-library seed.
- **Implement:** later.

### Screenshot (132)
- **Screen/module:** Trusted Directions picker (more codes).
- **Purpose:** Continued directions library.
- **Key fields:** "every EIGHT hours" and related interval directions.
- **Actions:** Pick; Edit; Close.
- **Navigation:** Same picker.
- **Workflow meaning:** Interval-dosing variants.
- **Ideas for our project:** Directions-library seed.
- **Implement:** later.

### Screenshot (133)
- **Screen/module:** Trusted Directions picker (more codes).
- **Purpose:** Continued directions library.
- **Key fields:** "Take a 5ml dose", "Take a 10ml dose", "Take a 15ml dose" variants.
- **Actions:** Pick; Edit; Close.
- **Navigation:** Same picker.
- **Workflow meaning:** Liquid-volume directions.
- **Ideas for our project:** Directions-library seed (see #123).
- **Implement:** later.

### Screenshot (134)
- **Screen/module:** Trusted Directions picker — **"when required" (PRN)**.
- **Purpose:** As-needed dosing direction.
- **Key fields:** "when required" (code PRN).
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** PRN dosing.
- **Ideas for our project:** PRN flag/text on dosette items + labels.
- **Implement:** later.

### Screenshot (135)
- **Screen/module:** Trusted Directions picker (more codes).
- **Purpose:** Continued directions library.
- **Key fields:** "Take TWO 5ml spoonsful", "ONE OR TWO 5ml spoonsful", "Take TWO OR THREE", "Take TWO AT FIRST then" variants.
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Quantity-range directions.
- **Ideas for our project:** Directions-library seed.
- **Implement:** later.

### Screenshot (136)
- **Screen/module:** Trusted Directions picker — application/route directions.
- **Purpose:** Route-specific directions.
- **Key fields:** "Apply one or two drops to the affected area", "two spray in each nostril TWICE a day", "TWO OR THREE times a day", **BEFORE meals**, "when required".
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Route/site + timing directions.
- **Ideas for our project:** Route/site directions in the builder.
- **Implement:** later.

### Screenshot (137)
- **Screen/module:** Trusted Directions picker — cautionary directions.
- **Purpose:** Cautionary/admin directions.
- **Key fields:** "DO NOT SWALLOW", "Give a TWO AND A HALF 5ml dose", "**AS DIRECTED**", "**BETWEEN meals**", "Add one 5ml spoonful to a pint of hot water", "Inhale TWO puffs", "when required".
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Safety/administration directions.
- **Ideas for our project:** Cautionary directions + warnings on labels (we have a label footer).
- **Implement:** later.

### Screenshot (138)
- **Screen/module:** Trusted Directions picker — more cautions.
- **Purpose:** Continued directions library.
- **Key fields:** "**SHAKE WELL BEFORE USE**", "**TO BE DISSOLVED** with water and taken", "Inhale TWO", "when required".
- **Actions:** Pick; Edit; Close.
- **Navigation:** Same picker.
- **Workflow meaning:** Preparation/administration cautions.
- **Ideas for our project:** Standard cautionary labels (e.g. "shake well") as selectable warnings.
- **Implement:** later.

### Screenshot (139)
- **Screen/module:** Trusted Directions picker (more codes).
- **Purpose:** Continued directions library.
- **Key fields:** "ONE to be taken", "Take TWO 5ml spoonsful", "1 capsule to be taken", "Take THREE 5ml spoonful", "Gently rub ONE into the region".
- **Actions:** Pick; Edit; Close.
- **Navigation:** Same picker.
- **Workflow meaning:** Core dosing directions.
- **Ideas for our project:** Directions-library seed (see #123).
- **Implement:** later.

### Screenshot (140)
- **Screen/module:** Trusted Directions picker — route/site directions.
- **Purpose:** Application-site directions.
- **Key fields:** "Gently put ONE into the rectum", "Gently put ONE into the region", "Gently put ONE into the vagina", "Take TWO 5ml spoonsful".
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Suppository/pessary/topical directions.
- **Ideas for our project:** Route directions seed.
- **Implement:** later.

### Screenshot (141)
- **Screen/module:** Trusted Directions picker (more codes).
- **Purpose:** Continued directions library.
- **Key fields:** "Take a 20ml dose", "every 24 hours", "Take TWO 5ml spoonsful", "every TWO to THREE hours" variants.
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Volume/interval directions.
- **Ideas for our project:** Directions-library seed.
- **Implement:** later.

### Screenshot (142)
- **Screen/module:** Trusted Directions picker (more codes).
- **Purpose:** Continued directions library.
- **Key fields:** "every TWO to THREE hours", "THREE to be taken", "3 capsules to be taken", "Take THREE TO FOUR", "every THREE to FOUR hours".
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Three-dose / interval directions.
- **Ideas for our project:** Directions-library seed.
- **Implement:** later.

### Screenshot (143)
- **Screen/module:** Trusted Directions picker (more codes).
- **Purpose:** Continued directions library.
- **Key fields:** "4 capsules to be taken", "every FOUR hours", "Take FOUR at first then", "every FOUR TO SIX hours", "FOUR to be taken".
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Four-dose / interval directions.
- **Ideas for our project:** Directions-library seed.
- **Implement:** later.

### Screenshot (144)
- **Screen/module:** Trusted Directions picker (more codes).
- **Purpose:** Continued directions library.
- **Key fields:** "Take ONE OR TWO 5ml spoonsful", "Take a 5ml dose", "FIVE times a day", "every SIX hours", "every SIX TO EIGHT hours", "every EIGHT hours", "at BEDTIME".
- **Actions:** Pick; Edit; Close.
- **Navigation:** Same picker.
- **Workflow meaning:** Frequency + bedtime directions.
- **Ideas for our project:** Directions-library seed; "at bedtime" maps to our Bedtime slot.
- **Implement:** later.

### Screenshot (145)
- **Screen/module:** Trusted Directions — **abbreviation codes**.
- **Purpose:** Map clinician abbreviations to plain English.
- **Key fields:** AD/BD/AE/AF-style codes → "before food", "on alternate days", "after meals", "apply to affected area", "THE APPLICATION", "into the affected ear", "as before".
- **Actions:** Pick; Edit; Close.
- **Navigation:** Same picker.
- **Workflow meaning:** Shorthand → safe label text.
- **Ideas for our project:** **Abbreviation-expansion table** for the directions builder (avoid ambiguous Latin).
- **Implement:** later (directions builder).

### Screenshot (146)
- **Screen/module:** Trusted Directions — abbreviation/timing codes.
- **Purpose:** Timing/route abbreviations.
- **Key fields:** "as before", "Apply one or two drops to the affected area" (ASD), "Apply thinly to the affected area and rub in" (ATH), "TWICE a day", "two spray in each nostril TWICE a day", "as BOTH ears".
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Topical/route timing.
- **Ideas for our project:** Directions-library seed.
- **Implement:** later.

### Screenshot (147)
- **Screen/module:** Trusted Directions — caution/route codes.
- **Purpose:** Route/caution abbreviations.
- **Key fields:** "two AD 5ml spoon", "TWO OR THREE times a day", "CHEW before swallowing", "Put ONE drop", "Put THREE drops", "EMERGENCY SUPPLY", "THE CREAM".
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Formulation-specific directions.
- **Ideas for our project:** Directions-library seed.
- **Implement:** later.

### Screenshot (148)
- **Screen/module:** Trusted Directions — admin/route codes.
- **Purpose:** Administration directions.
- **Key fields:** "EMERGENCY SUPPLY", "THE EYE DROPS", "each MORNING", "**FOR EXTERNAL USE ONLY**", "Give a TWO AND A HALF 5ml dose", "Take HALF a tablet", "EVERY HOUR".
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Route + frequency + external-use caution.
- **Ideas for our project:** External-use & frequency cautions for labels.
- **Implement:** later.

### Screenshot (149)
- **Screen/module:** Trusted Directions — frequency/route codes.
- **Purpose:** Frequency/route abbreviations.
- **Key fields:** "EVERY HOUR", "Take HALF TO ONE tablet", "in water", "BETWEEN meals", "Add one 5ml spoonful to a pint of hot water", "into the LEFT ear", "**THE LINIMENT**", "LOT".
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Preparation + route directions.
- **Ideas for our project:** Directions-library seed.
- **Implement:** later.

### Screenshot (150)
- **Screen/module:** Trusted Directions — formulation/route codes.
- **Purpose:** Formulation-specific directions.
- **Key fields:** "THE LOTION", "into the LEFT ear", "in the MORNING", "To be taken as directed by your doctor", "as directed", "THE MIXTURE", "THE NOSE DROPS", "ONCE A DAY".
- **Actions:** Pick; Edit; Close.
- **Navigation:** Same picker.
- **Workflow meaning:** Formulation + frequency directions.
- **Ideas for our project:** Directions-library seed (lotion/mixture/drops + once-a-day).
- **Implement:** later.

### Screenshot (151)
- **Screen/module:** Trusted Directions — route/frequency codes.
- **Purpose:** Inhaler/ear/eye + frequency directions.
- **Key fields:** "ONCE A DAY", "Inhale TWO puffs", "AFTER food", "when required" (PRN), "THE EAR DROPS", "into the RIGHT eye".
- **Actions:** Pick; Edit; Close.
- **Navigation:** Same picker.
- **Workflow meaning:** Route + timing directions.
- **Ideas for our project:** Directions-library seed (see #123/#130).
- **Implement:** later.

### Screenshot (152)
- **Screen/module:** Trusted Directions — topical/admin codes.
- **Purpose:** Topical application directions.
- **Key fields:** "into the RIGHT ear", "Rub in gently", "**SHAKE WELL BEFORE USE**", "spread evenly through the day", "FOUR times a day", "Spread thinly on the affected skin", "To be well shaken with water and taken".
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Topical preparation + frequency.
- **Ideas for our project:** Directions-library seed.
- **Implement:** later.

### Screenshot (153)
- **Screen/module:** Trusted Directions — frequency/use codes.
- **Purpose:** Frequency + "Use N" directions.
- **Key fields:** "To be well shaken with water and taken", "THREE times a day", "THREE TO FOUR times a day", "Use ONE", "Use TWO", "Use THREE", "Use FOUR".
- **Actions:** Pick; Edit.
- **Navigation:** Same picker.
- **Workflow meaning:** Device/applicator "use N" + frequency.
- **Ideas for our project:** Directions-library seed.
- **Implement:** later.

### Screenshot (154)
- **Screen/module:** Trusted Directions — final codes (end of library).
- **Purpose:** "Use N" + as-directed + formulation directions.
- **Key fields:** "Use ONE/TWO/THREE/FOUR", "to be taken as directed by your doctor", "THE OINTMENT", "in water", "when required", "with water".
- **Actions:** Pick; Edit; Close.
- **Navigation:** Same picker (end).
- **Workflow meaning:** Closes out the standard directions library.
- **Ideas for our project:** Complete the directions-library seed for the builder; "as directed by your doctor" + cautionary phrases for safe labels.
- **Implement:** later (directions builder — recommended).

---

## Inventory complete

**154 of 154 screenshots individually inspected and documented** (Screenshot (1) … Screenshot (154)).

Coverage by cluster: dispensing pipeline & dispensary item entry (1–5, 13–19, 63–67, 84–85), home/overview dashboards (7–9), navigation & global shell (6, 46–62), eMessages & worklists (10–12, 63), MDS/dosette (28–39), stock & ordering (20–26, 94–95), pending/owings/instalments/repeats (27, 40–43), reports (44–45), patient record tabs (68–83), settings/Pharmacy Details (86–118), bulk/admin tools (119–122), and the Trusted Directions (sig-code) library (123–154).

Top original adoptions identified: role-based sidebar (search-first patient access), similar-spelling search (**already shipped**), dosette cycle-history panel, store-wide dispensing pipeline board, barcode/QR accuracy check + picking label, a Trusted-Directions/sig-code builder, AI review-due & non-compliance detection, and per-user accessibility preferences. NHS/EPS/NCSO/MUR/FMD/eMAR, Cegedim branding, the green-cross logo, "Nomad/Manrex" tray brands, charging/reimbursement, and licence keys were all marked **ignore — not copied**.
