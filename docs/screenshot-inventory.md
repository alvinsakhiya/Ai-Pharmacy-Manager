# Screenshot Inventory — Real-World Pharmacy System (154 screens)

> **Scope & permission.** 154 screenshots of a real commercial UK community-pharmacy management system
> (identified as Cegedim Pharmacy Manager), studied with educational permission as **workflow/UX reference
> only**. No proprietary code, branding, logos, protected names, copyrighted wording or confidential data
> is reproduced. The source images are gitignored (`/Screenshots/`) and never committed.
>
> Each entry below was produced by **individually viewing** that screenshot during the
> 14 June 2026 review. Every entry records the requested fields: *screen/module,
> layout details, visible fields, buttons/actions, workflow purpose, UI behaviour
> to reproduce, functionality to implement, and implementation status*.
>
> Target: **154 entries** (Screenshot (1) … Screenshot (154)).
>
> Status vocabulary: **Implemented** means an equivalent original workflow exists
> in this repository; **Partial** means the important interaction exists but not
> every vendor-specific field; **Planned** is a useful future enhancement; and
> **Out of scope** covers external healthcare integrations, reimbursement,
> proprietary branding, or vendor administration that this academic prototype
> must not reproduce.

---

### Screenshot (1)
- **Screen/module:** Dispensary — item dispensing form (reference patient; nominated/MDS).
- **Layout details:** Item-by-item paging through a prescription; right list = all items on the script.
- **Visible fields:** Written on, PIP code, Pack size, Used Today/Mtd, Min/Stock, Quantity, Dose, Directions, Cautions, Duration, Stock level, Trade/Retail, Ingredient cost; right-hand colour-coded item cards (Amlodipine 10mg "1 EAT NIGHT", Duloxetine, Omeprazole "when required").
- **Buttons/actions:** Form, Ordering, Print; Back, Confirm, Finish item; Edit Trusted Directions; page 1 of 6.
- **Workflow purpose:** Dispense each prescription item with directions, quantity and pricing.
- **UI behaviour to reproduce:** Core dispensing — accuracy of drug, dose, quantity, directions.
- **Functionality to implement:** Colour **+ text** item cards; per-item directions field; multi-item paging.
- **Implementation status:** Partial (covered by the original dispensing workspace; external or vendor-specific fields remain excluded).

### Screenshot (2)
- **Screen/module:** Dispensary — same item with **drug-interaction warnings** expanded.
- **Layout details:** Warnings panel at the bottom of the dispensing item screen.
- **Visible fields:** Directions ("1-2 at night… avoid alcohol"); warning list (prescription exemption, possible major interaction Amlodipine/statins, hypokalaemia/QT prolonging, etc.).
- **Buttons/actions:** Confirm, Direction, Edit Trusted Directions.
- **Workflow purpose:** Surface clinical interaction/cautions before confirming.
- **UI behaviour to reproduce:** Clinical-safety check during dispensing.
- **Functionality to implement:** Explainable safety warnings tied to the item (our AI Clinical Safety screen mirrors this — keep human review).
- **Implementation status:** Partial (covered by the original dispensing workspace; external or vendor-specific fields remain excluded).

### Screenshot (3)
- **Screen/module:** Dispensary — item with full interaction warning list (duplicate/extended of #2).
- **Layout details:** Same dispensing screen, warnings scrolled.
- **Visible fields:** Multiple interaction lines; endorsement/exemption notes.
- **Buttons/actions:** Confirm; Direction; brand toggle (Ctrl+S).
- **Workflow purpose:** Show the complete set of cautions/interactions for the item.
- **UI behaviour to reproduce:** Pharmacist reviews all flags before supply.
- **Functionality to implement:** Severity-ranked, explainable warnings with confidence.
- **Implementation status:** Partial (covered by the original dispensing workspace; external or vendor-specific fields remain excluded).

### Screenshot (4)
- **Screen/module:** Dispensary — Duloxetine 90mg capsules item (generics scheme note).
- **Layout details:** Next item in the script.
- **Visible fields:** Directions "One To Be Taken Each Day", quantity 28, pack size, prices; endorsement "dispensed against… Generic Generics Scheme"; brand/interaction notes.
- **Buttons/actions:** Confirm; Direction; page 2 of 6.
- **Workflow purpose:** Dispense a generically-substituted item with scheme/endorsement.
- **UI behaviour to reproduce:** Generic substitution + endorsement during dispensing.
- **Functionality to implement:** Record generic/brand chosen + reason on the dispense line.
- **Implementation status:** Out of scope (NHS endorsement-specific).

### Screenshot (5)
- **Screen/module:** Dispensary — **drug/pack selection popup** (Arcoxia 90mg Tablets).
- **Layout details:** Modal product picker over the dispensing screen.
- **Visible fields:** Product list with pack sizes (28/30/100), prices, supplier scheme, "include discontinued"; directions "One To Be Taken Each Day When Required".
- **Buttons/actions:** Default, Details, OK, Cancel; include discontinued toggle.
- **Workflow purpose:** Choose the exact product/pack size to dispense.
- **UI behaviour to reproduce:** Pack/product selection drives stock decrement and pricing.
- **Functionality to implement:** Product → pack-size picker bound to our Medicine/pack_size + batch.
- **Implementation status:** Partial (covered by the original dispensing workspace; external or vendor-specific fields remain excluded).

### Screenshot (6)
- **Screen/module:** Global **left navigation** drawer (expanded) over eMessages.
- **Layout details:** Icon rail expands to labelled drawer; **patients reached via top search, not a sidebar item**.
- **Visible fields:** Menu items — Home, eMessages, Dispensary, Stock & Ordering, Pending, MDS, Owings, Instalments, Repeats, Reports, Help; top bar Patient search, RP, PFS/Overdue.
- **Buttons/actions:** Navigate to any module; close drawer.
- **Workflow purpose:** Primary module navigation.
- **UI behaviour to reproduce:** Confirms search-first patient access; modules are task areas.
- **Functionality to implement:** **Role-based sidebar** — hide patient browsing for Pharmacist/Dispenser; top-bar search only (matches our directive).
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (7)
- **Screen/module:** Dispensing **overview/landing** with KPI cards + service promo.
- **Layout details:** Card grid linking to detailed queues.
- **Visible fields:** New EPS to Dispense (3331), Expiring EPS (142), Patient Repeat Prescriptions (947), Outstanding Owings, Uncollected Prescriptions, Pending Orders (35); Prescription Tracker; reimbursement countdown.
- **Buttons/actions:** Drill into each KPI; tracker "Next".
- **Workflow purpose:** At-a-glance workload across the dispensing operation.
- **UI behaviour to reproduce:** Operational triage by counts.
- **Functionality to implement:** Our Dashboard already has KPI cards; add an "expiring/uncollected/pending" triage cluster.
- **Implementation status:** Planned (dashboard enhancement).

### Screenshot (8)
- **Screen/module:** **Home** dashboard (widget board).
- **Layout details:** Widget grid; each widget self-contained.
- **Visible fields:** Pharmacy First Referrals (New/Pending/In-Progress/Overdue), Pharmacy Notes, Calendar (June 2026), **Fridge Temperatures** (date, fridge, temp/min/max), Nominated Patients (10389, +171/week), Useful Links.
- **Buttons/actions:** View referrals, add note, add fridge temp, edit links.
- **Workflow purpose:** Daily operational home screen.
- **UI behaviour to reproduce:** Start-of-day situational awareness + compliance logs (fridge temps).
- **Functionality to implement:** A widgetised home (notes, calendar, fridge-temp compliance log) — fridge temps are a neat, original compliance widget.
- **Implementation status:** Planned (home widgets; fridge-temp log is a nice extra).

### Screenshot (9)
- **Screen/module:** Home dashboard (scrolled).
- **Layout details:** Vertical scroll of widgets.
- **Visible fields:** Nominated Patients (10389), Useful Links, WhatsApp service desk, "What's New".
- **Buttons/actions:** Open links / what's-new.
- **Workflow purpose:** Continuation of the widget board.
- **UI behaviour to reproduce:** Secondary info & support.
- **Functionality to implement:** "What's new"/help surfacing; low priority.
- **Implementation status:** Out of scope (vendor support widgets).

### Screenshot (10)
- **Screen/module:** **eMessages** — "Filter list by" dropdown (open).
- **Layout details:** Dropdown over the message list.
- **Visible fields:** Filter options — All, Patient Name, Prescription Type, Status, Message Type, UUID, Requires Dispensing/Collection/Notification/Claiming, Repeat Dispensing.
- **Buttons/actions:** Pick a filter; "Only show messages awaiting current action".
- **Workflow purpose:** Filter the prescription-message worklist.
- **UI behaviour to reproduce:** "Show me what needs my action" triage.
- **Functionality to implement:** "Awaiting my action" filter on our Notifications centre.
- **Implementation status:** Planned (notifications filter).

### Screenshot (11)
- **Screen/module:** eMessages — filter dropdown scrolled (Expiring Claims, Expiring EPS).
- **Layout details:** Same dropdown.
- **Visible fields:** Expiring Claims, Expiring EPS.
- **Buttons/actions:** Select filter.
- **Workflow purpose:** More filter options (expiry-based).
- **UI behaviour to reproduce:** Surface time-critical items.
- **Functionality to implement:** Expiry-based notification filters (we have expiry alerts already).
- **Implementation status:** Out of scope (EPS/claims are NHS-specific).

### Screenshot (12)
- **Screen/module:** eMessages — "Nominated Prescription Download complete" modal.
- **Layout details:** Modal over eMessages.
- **Visible fields:** Completion message, Time Lapsed.
- **Buttons/actions:** Close.
- **Workflow purpose:** Confirm a background download of nominated prescriptions.
- **UI behaviour to reproduce:** Async fetch of new prescriptions.
- **Functionality to implement:** Async job + completion toast (we have toasts; Celery is on roadmap).
- **Implementation status:** Out of scope (NHS nomination download).

### Screenshot (13)
- **Screen/module:** **Dispensing** pipeline — **New** tab (3332).
- **Layout details:** Tabbed pipeline (New / In Progress / Patient Ready / To Claim).
- **Visible fields:** Patient Name, Type, Handout, Downloaded, Expiry, Service Type, **Clinical Check** (Checked-Auto).
- **Buttons/actions:** Filter, Clear filters, Download; per-row Actions / Dispense.
- **Workflow purpose:** Worklist of newly-arrived prescriptions to dispense.
- **UI behaviour to reproduce:** Entry state of the dispensing state-machine.
- **Functionality to implement:** **Store-wide pipeline board** with per-state counts (our top recommended feature).
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (14)
- **Screen/module:** Dispensing New tab — **row action menu** open.
- **Layout details:** Row context menu → patient record (search-first still holds).
- **Visible fields:** Menu — View Prescription Details, Return to Spine, **View Patient Record**.
- **Buttons/actions:** Open details / patient record.
- **Workflow purpose:** Per-prescription quick actions.
- **UI behaviour to reproduce:** Jump from a queue item to the patient.
- **Functionality to implement:** "Open patient record" from any worklist row.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (15)
- **Screen/module:** Dispensing — **In Progress** tab (72).
- **Layout details:** Pipeline tab.
- **Visible fields:** Patient Name, Dispense Date, **Items To Check**, Locations, Owings, **Status** (Awaiting Accuracy Check).
- **Buttons/actions:** ACC CHECK / VIEW DETAILS.
- **Workflow purpose:** Items mid-dispense awaiting an accuracy check.
- **UI behaviour to reproduce:** Accuracy-check gate before "ready".
- **Functionality to implement:** Explicit accuracy/scan check step (barcode check on roadmap).
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (16)
- **Screen/module:** Dispensing — **Patient Ready** tab (23).
- **Layout details:** Pipeline tab.
- **Visible fields:** Patient Name, Items Ready, Exemption Status (Confirmed/RTEC), Handout (Delivery), Service Type, Location.
- **Buttons/actions:** COLLECT / VIEW DETAILS; BATCH ACTIONS.
- **Workflow purpose:** Bagged items awaiting collection/delivery.
- **UI behaviour to reproduce:** Handout/collection stage + location tracking.
- **Functionality to implement:** "Ready" board with collection/delivery + shelf location.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (17)
- **Screen/module:** Dispensing — **To Claim** tab (1755).
- **Layout details:** Pipeline tab.
- **Visible fields:** Headline "2 to notify, 295 to endorse, 1458 to claim"; Patient, Exemption, Notified, Endorsed, Claim Expires.
- **Buttons/actions:** ACTIONS / CLAIM; NOTIFY ALL / CLAIM ALL.
- **Workflow purpose:** Post-supply reimbursement (notify/endorse/claim).
- **UI behaviour to reproduce:** NHS reimbursement lifecycle.
- **Functionality to implement:** Not applicable (no NHS claiming).
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (18)
- **Screen/module:** **Dispensary** — blank item-entry form (FP10).
- **Layout details:** Item paging (1 of 1).
- **Visible fields:** Patient, Prescriber, No. Items; Item: Written as, Dispense as, Directions, Quantity, Owe; Cost panel: Item cost, PIP code, Pack size, Used Today/Max, Min order/Stock, Auto order, Due in/Owe, Stock level, Trade/Retail, Tariff, Ingredient cost.
- **Buttons/actions:** Endorse, Save to pending, Delete, Back, Confirm, Finish Item; Caution/Direction.
- **Workflow purpose:** Manual prescription item entry.
- **UI behaviour to reproduce:** Canonical dispensing data-entry layout.
- **Functionality to implement:** Field set for a future dispense line (written/dispensed-as, directions, qty, stock).
- **Implementation status:** Planned.

### Screenshot (19)
- **Screen/module:** Dispensary — "Select Dispensary Supply Form" modal.
- **Layout details:** Modal at start of dispensing.
- **Visible fields:** Many NHS form types (FP10, HP, CN, PN, MDA, Private, Vet Sale, Emergency Supply, PGD, CPCS…).
- **Buttons/actions:** Select form; "display forms for my PRA only"; OK/Cancel.
- **Workflow purpose:** Choose the prescription/supply form type.
- **UI behaviour to reproduce:** Determines reimbursement/legal form.
- **Functionality to implement:** A simplified "supply type" (NHS / private / emergency) without NHS forms.
- **Implementation status:** Out of scope (NHS form catalogue).

### Screenshot (20)
- **Screen/module:** **Stock & Order Management** — Ordering tab.
- **Layout details:** Ordering ↔ Stock Inventory tabs.
- **Visible fields:** Product, Size, Code, Order Set, Status (Pending), Packs, In Stock, Max Daily Usage, Times Prescribed, Sent; Period (Daily).
- **Buttons/actions:** Add order, Add item, Place/Send order, Delete; status filter.
- **Workflow purpose:** Build and manage supplier orders.
- **UI behaviour to reproduce:** Reorder generation against usage.
- **Functionality to implement:** Generate POs from reorder recommendations (on our roadmap).
- **Implementation status:** Planned (PO generation).

### Screenshot (21)
- **Screen/module:** Stock & Order — **Stock Inventory** (2810 lines).
- **Layout details:** Tab; KPI cards drill into filtered lists.
- **Visible fields:** **Low Stock 2130, Excess Stock 84, Dead Stock 596, Often Owed 0**; Product, Pack Size, Total Stock, On Order, Currently Owed.
- **Buttons/actions:** Search, Filter, **Export PDF/CSV**, Packs/Units toggle, Edit/Details.
- **Workflow purpose:** Whole-catalogue stock view with health KPIs.
- **UI behaviour to reproduce:** Inventory health triage (low/excess/dead).
- **Functionality to implement:** Add **Excess/Dead-stock** KPIs alongside our low-stock/expiry; Packs/Units toggle; we already export PDF/CSV.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (22)
- **Screen/module:** Stock & Order — **Options** menu open.
- **Layout details:** Options dropdown.
- **Visible fields:** Split Order, Place, Book In, Change Item Order Set, Reset Items to Pending, Save Previously Prepared Order.
- **Buttons/actions:** Choose a bulk op.
- **Workflow purpose:** Bulk order operations.
- **UI behaviour to reproduce:** Order lifecycle management.
- **Functionality to implement:** "Book in delivery" → batches (PO receipt, on roadmap).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (23)
- **Screen/module:** Stock & Order — Options → **Place** submenu.
- **Layout details:** Nested submenu.
- **Visible fields:** Complete Selected, Item Partial.
- **Buttons/actions:** Place complete/partial.
- **Workflow purpose:** Place an order fully or partially.
- **UI behaviour to reproduce:** Partial-order handling.
- **Functionality to implement:** Partial-receipt support when booking in.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (24)
- **Screen/module:** Stock & Order — Options → **Book In** submenu.
- **Layout details:** Nested submenu.
- **Visible fields:** Book-in options.
- **Buttons/actions:** Book in order.
- **Workflow purpose:** Receive a delivered order into stock.
- **UI behaviour to reproduce:** Delivery → batch creation/stock increment.
- **Functionality to implement:** **Stock receipt against PO → batch** (roadmap #4).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (25)
- **Screen/module:** Stock & Order — **View** menu open.
- **Layout details:** View dropdown.
- **Visible fields:** Suppliers, Ordering Details, Modem Settings, Order Set Summary, Sent Orders, Items Due In.
- **Buttons/actions:** Pick a view.
- **Workflow purpose:** Switch ordering sub-views.
- **UI behaviour to reproduce:** Ordering admin & supplier setup.
- **Functionality to implement:** "Items due in" view (expected deliveries).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (26)
- **Screen/module:** Stock & Order — "Stock Order Item Details" modal.
- **Layout details:** Modal over ordering grid.
- **Visible fields:** Product, Packs to order, Order set, Status, Packs received, Date of last order, Order code.
- **Buttons/actions:** Save/Delete/Cancel.
- **Workflow purpose:** Edit one order line.
- **UI behaviour to reproduce:** Line-level order control + receipt count.
- **Functionality to implement:** Order-line edit dialog for PO feature.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (27)
- **Screen/module:** **Pending** — uncollected/unendorsed prescriptions.
- **Layout details:** Module screen with filters.
- **Visible fields:** Name (+ address, item count), Status (Not collected/Not endorsed), Source, Date; filters (supply type, include not endorsed, date range).
- **Buttons/actions:** Reset, Endorse, Exit; include-not-endorsed toggle.
- **Workflow purpose:** Track scripts awaiting collection/endorsement.
- **UI behaviour to reproduce:** Manage owed/uncollected items.
- **Functionality to implement:** An "awaiting collection" worklist (ties to our Ready/Collected workflow states).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (28)
- **Screen/module:** **MDS** module — top level (Care Homes tab).
- **Layout details:** Care-home grouping → patient → cycle.
- **Visible fields:** Tabs Care Homes | Community Patient; Care home selector; columns Last/First Name, Sex, Dispensed, MAR, Cassette, Labels; This Period date range; "Nomad 8 inches (weekly)".
- **Buttons/actions:** Options/Patient/Print; Add/Remove patient to home; Patient Details; **Preview MAR**, **View Cycle**.
- **Workflow purpose:** Manage MDS patients grouped by care home / community.
- **UI behaviour to reproduce:** Batch MDS prep per care home per week.
- **Functionality to implement:** Group dosette patients by **care setting** (we have careSetting); a weekly "MDS workload by home" view.
- **Implementation status:** Planned (care-home grouping).

### Screenshot (29)
- **Screen/module:** **MDS Info → Active Medication** (per patient).
- **Layout details:** Active Medication ↔ MDS History tabs.
- **Visible fields:** Patient, Cycle Length, MAR/Cassette Printed; **Group 1** medication cards (drug, qty/strength, **INCLUDED IN CASSETTE**, Colour, Form, Warnings, directions, **Schedule** Everyday/28 days/when).
- **Buttons/actions:** Add/Edit Medicine, Select All, Show more/less, Settings, Print.
- **Workflow purpose:** Show the patient's MDS medication set for the cycle.
- **UI behaviour to reproduce:** Defines exactly what goes in each cassette/cycle, with appearance for identification.
- **Functionality to implement:** Confirms our tray cards (drug + strength + qty + appearance) — add a per-item **Schedule** + "in cassette" flag.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (30)
- **Screen/module:** **MDS Info → MDS History** (per patient).
- **Layout details:** History tab.
- **Visible fields:** Date, Cycle Start, Cycle End, **MAR Printed (✓)**, Cassette Printed, eMAR Sent; 7 cycles.
- **Buttons/actions:** View Details per cycle; Print; Settings.
- **Workflow purpose:** History of prepared cycles.
- **UI behaviour to reproduce:** Audit trail of past MDS cycles + print status.
- **Functionality to implement:** Add a **cycle-history panel** to our DosetteTab (date, start/end, prepared/checked/printed).
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (31)
- **Screen/module:** **Community Patient Settings** (MDS config).
- **Layout details:** From MDS patient → Settings.
- **Visible fields:** Cycle Length (1/2/3/4 weeks), Community Patient Group (Week 1), MAR Type, Administration Times.
- **Buttons/actions:** Pick cycle length/group/MAR type.
- **Workflow purpose:** Configure a community MDS patient's cycle.
- **UI behaviour to reproduce:** Defines cycle cadence + print format.
- **Functionality to implement:** Cycle-length setting (we have weekly/monthly; could expose 1–4 weeks).
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (32)
- **Screen/module:** Community Patient Settings — Administration Times.
- **Layout details:** Scrolled settings.
- **Visible fields:** **6 time slots** with custom labels — MORN, BFST, NOON, TEA, BED, LATE; Print non-cassette items.
- **Buttons/actions:** Edit slot labels.
- **Workflow purpose:** Define the per-cycle time slots.
- **UI behaviour to reproduce:** Slots map to MAR/cassette columns.
- **Functionality to implement:** Our tray uses Morning/Afternoon/Evening/Bedtime — could allow **custom/extra slots** (e.g. BFST/LATE).
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (33)
- **Screen/module:** Community Patient Settings — MAR Type dropdown.
- **Layout details:** Dropdown.
- **Visible fields:** Standard MAR Portrait / Standard MAR Landscape.
- **Buttons/actions:** Select MAR type.
- **Workflow purpose:** Choose MAR chart orientation.
- **UI behaviour to reproduce:** Print layout choice.
- **Functionality to implement:** Portrait/landscape option on our printable label.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (34)
- **Screen/module:** Community Patient Settings — Print Options.
- **Layout details:** Scrolled settings.
- **Visible fields:** Print non-cassette items; "repeat request form?" Yes/No; **Body Diagram Print Option** (inline / separate page).
- **Buttons/actions:** Toggle options.
- **Workflow purpose:** Control what prints with the cycle.
- **UI behaviour to reproduce:** Print composition for the cycle.
- **Functionality to implement:** Print toggles (e.g. include/exclude non-pack items) on our label.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (35)
- **Screen/module:** MDS per-item settings (Schedules).
- **Layout details:** From Add/Edit Medicine.
- **Visible fields:** Schedules (No Schedules / ADD SCHEDULE), **Mid Cycle Item** (Yes/No), **Body Diagram Required** (Yes/No).
- **Buttons/actions:** Add schedule; Cancel/Save.
- **Workflow purpose:** Configure one MDS item's schedule.
- **UI behaviour to reproduce:** Per-item dosing schedule + mid-cycle handling.
- **Functionality to implement:** Per-item schedule + mid-cycle flag on dosette items.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (36)
- **Screen/module:** **Add Medication** — Medicine Details.
- **Layout details:** MDS → Add Medicine.
- **Visible fields:** "Selecting from patient history? Yes/No", Quantity (+ "unused quantity"), Directions, **Colour, Shape, Markings**.
- **Buttons/actions:** Enter details.
- **Workflow purpose:** Add a medicine to a patient's MDS.
- **UI behaviour to reproduce:** Captures dosing + **appearance** for identification at entry.
- **Functionality to implement:** Confirms our appearance fields (colour/shape/imprint) belong on the medication record.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (37)
- **Screen/module:** Add Medication (scrolled) — Output & Schedules.
- **Layout details:** Scrolled Add Medication.
- **Visible fields:** Colour/Shape/Markings; **Output** Print Options (MAR / Cassette); **Schedules** (No Schedules / ADD SCHEDULE).
- **Buttons/actions:** Toggle MAR/Cassette; Add schedule.
- **Workflow purpose:** Choose output + schedules for the item.
- **UI behaviour to reproduce:** Whether the item goes on MAR and/or in the cassette, with its schedule.
- **Functionality to implement:** "In pack vs MAR-only" flag per dosette item.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (38)
- **Screen/module:** MDS per-item settings (Schedules / Mid-cycle / Body diagram) — full page.
- **Layout details:** Edit Medicine page.
- **Visible fields:** Schedules (Add Schedule), Mid Cycle Item (Yes/No), Body Diagram Required (Yes/No).
- **Buttons/actions:** Cancel / Save.
- **Workflow purpose:** Save one item's schedule + flags.
- **UI behaviour to reproduce:** Finalise item config.
- **Functionality to implement:** Item schedule + mid-cycle flag (see #35).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (39)
- **Screen/module:** **Patient Cycle Screen** (MDS assembly) — one patient's week.
- **Layout details:** From MDS patient → View Cycle; tabs Patient Cycle / Pending / eMessages.
- **Visible fields:** Colour legend (Dispensed / Regular / Transfer of Care / Ready to dispense / Owing / Unassigned); week columns (18–24); **Medication History** list with Qty + **In Stock** (Lorazepam 1mg, Pantoprazole, Mirtazapine, Bisoprolol, Atorvastatin, Citalopram…).
- **Buttons/actions:** Dispense, Complete, Reclaim, Mid Cycle, Unused, Details, Delete; New Supply, Repeat, Repeat and Edit, Add to Cycle; Preview MAR, View Cycle.
- **Workflow purpose:** Build the week's MDS cycle from the patient's medication.
- **UI behaviour to reproduce:** The heart of MDS prep — pick meds into the cycle, track stock, mark dispensed.
- **Functionality to implement:** Our DosetteTab tray + per-cycle picking list is the equivalent; the **in-stock-per-line** + status legend (with text labels, not colour-only) is worth mirroring.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (40)
- **Screen/module:** **Owings** module.
- **Layout details:** Module screen.
- **Visible fields:** Date/Patient/Product filters; Last/First Name, Date, Stock, Owed, Product.
- **Buttons/actions:** Purge, Remove, Prepare, Collect; Print bag label; Item details.
- **Workflow purpose:** Track items owed to patients (short-supplied).
- **UI behaviour to reproduce:** Manage partial supplies/back-orders.
- **Functionality to implement:** "Owed items" concept ties to our shortfall flags in picking.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (41)
- **Screen/module:** **Instalments** module.
- **Layout details:** Module screen.
- **Visible fields:** Status (Active), Date (Today); Last/First Name, Date Due, Stock, Dispensed, Product.
- **Buttons/actions:** Remove, Prepare, Collect; Print bag label.
- **Workflow purpose:** Manage instalment-dispensed prescriptions (e.g. controlled).
- **UI behaviour to reproduce:** Scheduled instalment supply.
- **Functionality to implement:** Not core to dosette; defer.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (42)
- **Screen/module:** **Repeats** module — Repeats tab.
- **Layout details:** Module with filters.
- **Visible fields:** Filter by patient; Last Name, Address, Status (EPS Serial Repeat / Pending / Unmanaged), Due, GP.
- **Buttons/actions:** Search, Print, Dispense, Repeat request.
- **Workflow purpose:** Manage repeat/serial prescriptions.
- **UI behaviour to reproduce:** Repeat-supply lifecycle.
- **Functionality to implement:** Repeat tracking overlaps our dosette "next expected" dates.
- **Implementation status:** Out of scope (NHS repeat/EPS specifics).

### Screenshot (43)
- **Screen/module:** **Repeats → GP Reviews** tab.
- **Layout details:** Repeats sub-tab.
- **Visible fields:** Filter by patient, Date Outstanding (range); Last/First Name, Address, Date, GP, Status.
- **Buttons/actions:** GP Review, Resolve; Apply/Clear filters.
- **Workflow purpose:** Track items needing a GP review.
- **UI behaviour to reproduce:** Flag patients due a medication review.
- **Functionality to implement:** **"Patients due for review"** AI reminder (we have overdue-review notifications) — strong AI tie-in.
- **Implementation status:** Planned (AI review reminders — we partly have this).

### Screenshot (44)
- **Screen/module:** **Reports** catalogue (page 1).
- **Layout details:** Scrollable report list.
- **Visible fields:** Category filter, Show data exports / audit reports; report list (Audit Patient/SCR/Security/System, Brand Substitution Losses, Cautions/Directions, Conditions, Dispensed Item, Duplicate Product, Low/Dead/Excess Stock, MUR, Non Compliance, Often Owed, Owings, Patient Details, **Patient History**, …).
- **Buttons/actions:** New Report, Preview, Run, Delete.
- **Workflow purpose:** Run standard reports.
- **UI behaviour to reproduce:** Operational/clinical/audit reporting.
- **Functionality to implement:** Our reports module covers a focused subset (valuation, expiry, low-stock, dosette-workload, forecasting, patient-summary). Could add "patient history" report.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (45)
- **Screen/module:** Reports catalogue (page 2, scrolled).
- **Layout details:** Same list scrolled.
- **Visible fields:** Intervention(s), Low/Dead/Excess Stock, MUR, NCSO, NMS, Non Compliance, OAP list, Owings, Patient Details/History/Report, **Potential MUR Candidates**, Prescriber, Prescription/Script Throughput, Repeat Request/Rx, **Responsible Pharmacist**, **Stock Adjustments**, Supplier Usage, Top N Usage, User Entered Item.
- **Buttons/actions:** Preview/Run.
- **Workflow purpose:** More reports.
- **UI behaviour to reproduce:** Breadth of reporting.
- **Functionality to implement:** "Top-N usage", "stock adjustments", "responsible pharmacist" report ideas (RP report ties to our audit log).
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (46)
- **Screen/module:** **File** menu (over To Claim).
- **Layout details:** Top menu bar.
- **Visible fields:** Send New Email, Import, Logout (Ctrl+Alt+E), Exit, Restart.
- **Buttons/actions:** Pick action.
- **Workflow purpose:** App-level actions.
- **UI behaviour to reproduce:** Session/app control.
- **Functionality to implement:** Standard; we have logout. No change.
- **Implementation status:** Out of scope.

### Screenshot (47)
- **Screen/module:** File → **Import** submenu.
- **Layout details:** Nested submenu.
- **Visible fields:** Import CIF File / CIF Update / Waiting Files / Schedule Import / Update Negative Stock.
- **Buttons/actions:** Choose import.
- **Workflow purpose:** Import data files.
- **UI behaviour to reproduce:** Drug-file (dm+d/CIF) updates.
- **Functionality to implement:** "Update negative stock" reconciliation is a neat idea; CIF import is NHS-specific.
- **Implementation status:** Out of scope.

### Screenshot (48)
- **Screen/module:** **Tools** menu.
- **Layout details:** Top menu.
- **Visible fields:** Inquiry, MUR, Blank label, Bulk Operations, Recover Product, Data Provision, Nursing Home Defaults, System Settings, Settings, User Settings, Scheduled Tasks, Thread Manager.
- **Buttons/actions:** Open a tool.
- **Workflow purpose:** Admin/utility entry points.
- **UI behaviour to reproduce:** Configuration & maintenance hub.
- **Functionality to implement:** "Blank label" (ad-hoc label print) + "Scheduled Tasks" (Celery on roadmap).
- **Implementation status:** Planned (blank label / scheduled tasks ideas).

### Screenshot (49)
- **Screen/module:** Tools → **Inquiry** submenu (with keyboard shortcuts).
- **Layout details:** Nested submenu; **keyboard shortcuts** for power users.
- **Visible fields:** Patient (Shift+Ctrl+P), Product, Supplier, Prescriber, Institution, Direction, Counter File, Nursing Home, **Stock Adjustment Reasons**, Caution, Interventions, dm+d Items, **Trusted Directions** (Shift+Ctrl+T), Audit Content, Leaflets — each with a shortcut.
- **Buttons/actions:** Open editor via menu or shortcut.
- **Workflow purpose:** Open reference/lookup editors.
- **UI behaviour to reproduce:** Reference-data management + keyboard-driven speed.
- **Functionality to implement:** **Keyboard shortcuts** for common actions (accessibility/efficiency); a **Trusted Directions** editor (sig-code → plain English).
- **Implementation status:** Planned (keyboard shortcuts + directions builder).

### Screenshot (50)
- **Screen/module:** Tools → **MUR** submenu.
- **Layout details:** Nested submenu.
- **Visible fields:** Produce quarterly summary of MURs; Produce MUR GP Notifications.
- **Buttons/actions:** Generate MUR docs.
- **Workflow purpose:** Medicines Use Review actions.
- **UI behaviour to reproduce:** NHS advanced-service admin.
- **Functionality to implement:** Not applicable (NHS MUR).
- **Implementation status:** Out of scope.

### Screenshot (51)
- **Screen/module:** Tools → **Nursing Home Defaults** submenu.
- **Layout details:** Nested submenu.
- **Visible fields:** **Nomad, Cegedim Rx Own, Manrex** (tray/cassette brands).
- **Buttons/actions:** Select default tray system.
- **Workflow purpose:** Pick default MDS tray system.
- **UI behaviour to reproduce:** Tray hardware defaults.
- **Functionality to implement:** Generic "pack type" default (we have weekly/monthly) — avoid brand names.
- **Implementation status:** Out of scope (brand tray names).

### Screenshot (52)
- **Screen/module:** Tools → **System Settings** submenu.
- **Layout details:** Nested submenu.
- **Visible fields:** System Configuration, **Pharmacy Details**, Printer Configuration, View Options.
- **Buttons/actions:** Open a settings area.
- **Workflow purpose:** System-level config.
- **UI behaviour to reproduce:** Global configuration.
- **Functionality to implement:** Our Settings page is the equivalent (kept focused).
- **Implementation status:** Planned (minor).

### Screenshot (53)
- **Screen/module:** System Settings → **Printer Configuration** submenu.
- **Layout details:** Nested submenu.
- **Visible fields:** Pharmacy Manager / Windows print routing.
- **Buttons/actions:** Configure printers.
- **Workflow purpose:** Map app print jobs to printers.
- **UI behaviour to reproduce:** Label/token printing routing.
- **Functionality to implement:** Browser print is sufficient for us; ignore.
- **Implementation status:** Out of scope.

### Screenshot (54)
- **Screen/module:** Tools → **User Settings** submenu.
- **Layout details:** Nested submenu.
- **Visible fields:** User Details; **User Account Management**.
- **Buttons/actions:** Edit user / manage accounts.
- **Workflow purpose:** Manage users.
- **UI behaviour to reproduce:** User admin / RBAC.
- **Functionality to implement:** We have RBAC + user admin (admin role); confirms the pattern.
- **Implementation status:** Planned (we already have RBAC/admin).

### Screenshot (55)
- **Screen/module:** **Help** menu + Technical Support submenu.
- **Layout details:** Top menu.
- **Visible fields:** Help Centre, Technical Support, About; Create Installation Report, **System Administration Key (Ctrl+Alt+A)**, **Security Key (Ctrl+Alt+S)**, Real Time Back Up Restore, Restart Active Screen.
- **Buttons/actions:** Support utilities.
- **Workflow purpose:** Help & support actions.
- **UI behaviour to reproduce:** Support/security key entry.
- **Functionality to implement:** None core; security-key entry is prohibited-credential territory.
- **Implementation status:** Out of scope.

### Screenshot (56)
- **Screen/module:** Help → Technical Support submenu (duplicate view of #55).
- **Layout details:** Nested submenu.
- **Visible fields:** Create Installation Report, System Admin Key, Security Key, Real Time Back Up Restore, Restart Active Screen.
- **Buttons/actions:** Support actions.
- **Workflow purpose:** Support utilities.
- **UI behaviour to reproduce:** Support/maintenance.
- **Functionality to implement:** None.
- **Implementation status:** Out of scope.

### Screenshot (57)
- **Screen/module:** **About** dialog.
- **Layout details:** Modal.
- **Visible fields:** "Pharmacy Manager 17.3", Cegedim Rx, Windows build, site/registration number, **PostgreSQL** database, "drug interaction information is GUIDANCE ONLY".
- **Buttons/actions:** OK.
- **Workflow purpose:** Version/licence info.
- **UI behaviour to reproduce:** Identifies the product (Cegedim PM 17.3, PostgreSQL-backed).
- **Functionality to implement:** Confirms PostgreSQL choice is industry-aligned; note "guidance only" disclaimer mirrors our "not clinical advice".
- **Implementation status:** Out of scope (branding).

### Screenshot (58)
- **Screen/module:** **Notification Centre** (right slide-out panel).
- **Layout details:** Bell icon → slide-out.
- **Visible fields:** Empty state "You currently have no messages".
- **Buttons/actions:** Dismiss/close.
- **Workflow purpose:** In-app notifications.
- **UI behaviour to reproduce:** Central alerts surface.
- **Functionality to implement:** We have a Notification centre; a slide-out + empty-state pattern is worth matching (accessible empty states).
- **Implementation status:** Planned (notification UX polish).

### Screenshot (59)
- **Screen/module:** **RP / user** dropdown (top right).
- **Layout details:** Top-right user menu.
- **Visible fields:** Open Responsible Pharmacist (Ctrl+Alt+P), Change Pharmacist, Log as Absent, Log Out.
- **Buttons/actions:** RP/session actions.
- **Workflow purpose:** Responsible-pharmacist & session control.
- **UI behaviour to reproduce:** Who is the legally responsible pharmacist right now.
- **Functionality to implement:** A "responsible pharmacist on duty" indicator + audit (ties to our audit log).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (60)
- **Screen/module:** **Responsible Pharmacist** dialog (over eMessages).
- **Layout details:** From RP menu (#59).
- **Visible fields:** Date, Current status (Logged in), From/To, Action type; session records (who, start time); "times with no records".
- **Buttons/actions:** New, Details, Create record for selection, Close.
- **Workflow purpose:** Log RP sessions & gaps.
- **UI behaviour to reproduce:** Legal RP register / audit.
- **Functionality to implement:** RP session log → our immutable audit log.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (61)
- **Screen/module:** eMessages — **Action by** date filter dropdown.
- **Layout details:** Dropdown.
- **Visible fields:** Today, Tomorrow, Next 3 Days, Next 7 Days, Date Range.
- **Buttons/actions:** Pick horizon.
- **Workflow purpose:** Filter worklist by due horizon.
- **UI behaviour to reproduce:** "What's due soon" triage.
- **Functionality to implement:** Due-horizon filter on our dosette/notifications (Today/3d/7d).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (62)
- **Screen/module:** **Top search scope** dropdown.
- **Layout details:** Dropdown left of the search box.
- **Visible fields:** **Patient / Product**.
- **Buttons/actions:** Switch scope.
- **Workflow purpose:** Choose what the top bar searches.
- **UI behaviour to reproduce:** One search box, two entities.
- **Functionality to implement:** Optional scope toggle (patient vs medicine) on our top search.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (63)
- **Screen/module:** eMessages — **repeat dispensing** instances for one patient.
- **Layout details:** Message list.
- **Visible fields:** Name (N of 5), Handout, Expiry, Action by, **Status** (New-Ready to dispense / Claim complete), Prescription Type (Repeat Dispensing N of 5).
- **Buttons/actions:** Return / Dispense.
- **Workflow purpose:** Manage a repeat series (e.g. 1–5 of 5).
- **UI behaviour to reproduce:** Serial/repeat dispensing lifecycle.
- **Functionality to implement:** "N of M" cycle counter concept maps to our dosette cycles.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (64)
- **Screen/module:** Dispensary — **Matched Patient** dialog.
- **Layout details:** During electronic-prescription dispensing.
- **Visible fields:** Title, First/Other/Last name, Address, Postcode, NHS no, DoB, Sex, Charges Exemption.
- **Buttons/actions:** Back / Next / Cancel.
- **Workflow purpose:** Match the prescription's patient to an existing record.
- **UI behaviour to reproduce:** Avoid duplicate patients / confirm identity.
- **Functionality to implement:** Identity-confirmation step (we surface DOB/postcode/ID in search to disambiguate).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (65)
- **Screen/module:** Dispensary — **Confirm Patient Details** dialog.
- **Layout details:** After patient match.
- **Visible fields:** "details not checked will NOT be updated"; Telephone; NHS number auto-update; Download All / Select All.
- **Buttons/actions:** Update selected fields.
- **Workflow purpose:** Selectively update the patient record from the prescription.
- **UI behaviour to reproduce:** Controlled, auditable record updates.
- **Functionality to implement:** "Confirm which fields to update" pattern for safe record edits.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (66)
- **Screen/module:** Dispensary — **Patient Medication History** dialog.
- **Layout details:** During dispensing.
- **Visible fields:** List of past medications (drug, directions, date, qty); "Don't show this page again".
- **Buttons/actions:** Select to repeat from history.
- **Workflow purpose:** Reuse a previous medication when dispensing.
- **UI behaviour to reproduce:** Speed via reuse of prior items.
- **Functionality to implement:** "Repeat from history" when adding a dosette item (our med model has change history).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (67)
- **Screen/module:** Dispensary — **Select Product** + full prescription preview.
- **Layout details:** Dispensing item step.
- **Visible fields:** Product list (Levothyroxine 25mcg, Pack 28/500, **Stock 0**); right panel = patient demographics, Item 1/2 with directions + **DM+D codes**, prescriber, exemption; Personal list / Discontinued / Formulation substitution toggles.
- **Buttons/actions:** Next / Cancel; Endorse, Save to pending, Not dispensed; item paging (2 of 2).
- **Workflow purpose:** Pick the exact product/pack against the script.
- **UI behaviour to reproduce:** Product selection with stock visibility + full script context.
- **Functionality to implement:** Show **stock-on-hand at point of selection** (our picking list does this) + side-by-side script context.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (68)
- **Screen/module:** **Find Patient** dialog (canonical patient search).
- **Layout details:** Opened from search / dispensing.
- **Visible fields:** **Name, Street, Postcode, DOB**; result columns Last/First Name, Sex, #, Address, DOB; **"Extend search to similar sounding names"** checkbox; "Show temporary patients".
- **Buttons/actions:** Find, Add, Details, OK, Cancel.
- **Workflow purpose:** Locate a patient by multiple criteria.
- **UI behaviour to reproduce:** Multi-field + **phonetic** patient lookup with explicit selection.
- **Functionality to implement:** **Directly validates our implemented similar-spelling search** (phonetic + edit-distance) and multi-format matching. Could add explicit Street/DOB fields.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (69)
- **Screen/module:** Find Patient — many-result list (e.g. "Da Costa / Da Silva" cluster).
- **Layout details:** Result list scroll.
- **Visible fields:** Last/First Name, Sex, #, Address, DOB rows (long list).
- **Buttons/actions:** Select correct patient; OK/Cancel.
- **Workflow purpose:** Disambiguate among many same/similar surnames.
- **UI behaviour to reproduce:** Never auto-pick — staff choose from all matches.
- **Functionality to implement:** Confirms our "show all matches, no auto-open" rule.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (70)
- **Screen/module:** Find Patient — similar first-name/surname cluster results.
- **Layout details:** Result picker.
- **Visible fields:** Multiple closely matching invented-name patterns with record number, address and DOB for disambiguation.
- **Buttons/actions:** Select; Find; Add/Details/OK/Cancel; "Extend search to similar sounding names".
- **Workflow purpose:** Similar-sounding-name search in action.
- **UI behaviour to reproduce:** The canonical phonetic-search example.
- **Functionality to implement:** **Exact validation** of our similar-spelling tier (we ship a Connor/Conner/Connors analogue).
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (71)
- **Screen/module:** **Patient Details → Patient** tab.
- **Layout details:** Tabbed Patient Details (Patient/Doctor/Conditions/Medication/History/Other/Suppressions/Exemptions/Repeat Rx/…).
- **Visible fields:** Patient number, Title, First/Other/Last name, Ethnicity, Address, NHS no, **DOB, Age, Sex**, Group, Postcode, Home/Work/Mobile phone, E-mail; flags (Temporary, App user, Exempt, Always prints collection, Multi-card); label buttons.
- **Buttons/actions:** Intervene; Delete/OK/Cancel/Apply.
- **Workflow purpose:** Edit core demographics.
- **UI behaviour to reproduce:** The demographic heart of the record.
- **Functionality to implement:** Our patient record carries these fields (minus NHS); confirms field set.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (72)
- **Screen/module:** **Patient Details → Doctor** tab.
- **Layout details:** Doctor tab.
- **Visible fields:** Registered Doctor, Practice, Address, Postcode, Telephone.
- **Buttons/actions:** Details lookup; Address Label.
- **Workflow purpose:** Registered GP/practice details.
- **UI behaviour to reproduce:** Prescriber/practice linkage.
- **Functionality to implement:** Our record has a Doctor tab (name/practice/phone) — aligned.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (73)
- **Screen/module:** **Patient Details → Conditions** tab.
- **Layout details:** Conditions tab.
- **Visible fields:** PMR Conditions (Has / Has Not / Unknown), Other Known Conditions, product **sensitivities** (Product/Applicability/Comment), Other known sensitivities, **Adverse Drug Reactions**.
- **Buttons/actions:** Add/Delete/Edit.
- **Workflow purpose:** Conditions, sensitivities, ADRs.
- **UI behaviour to reproduce:** Clinical safety context (allergies/ADRs).
- **Functionality to implement:** We have an allergies field; could add an **ADR/sensitivities** section (feeds AI clinical-safety).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (74)
- **Screen/module:** **Patient Details → Medication** tab.
- **Layout details:** Medication tab.
- **Visible fields:** Medication Items (drug, directions, price, qty); Select Repeat Format (Email/Print/Paper); "don't show expanded directions".
- **Buttons/actions:** View Prescription Tracker; manage items.
- **Workflow purpose:** The patient's medication list.
- **UI behaviour to reproduce:** Current/repeat medication overview.
- **Functionality to implement:** Our Medication tab + change history already covers this.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (75)
- **Screen/module:** **Patient Details → History** tab.
- **Layout details:** History tab.
- **Visible fields:** Date (Last 30 days / From-To), Category filter; columns Description, Type, Date.
- **Buttons/actions:** Display; Intervene, Audit, Delete, Reprint, Collect, Details.
- **Workflow purpose:** Filterable activity/dispensing history.
- **UI behaviour to reproduce:** Per-patient audit/dispensing trail with reprint/collect.
- **Functionality to implement:** Our History tab + medication audit trail aligns; could add date/category filter.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (76)
- **Screen/module:** **Patient Details → Other** tab.
- **Layout details:** Other tab.
- **Visible fields:** Other Medication Items (Add Product/Free Text), Consent to share data, **Notes**, Print Custom Label; Options (**Child-resistant container**, Form registered, Large labels required, Drug dependency), Interaction search months.
- **Buttons/actions:** Add product/free text; toggle options.
- **Workflow purpose:** Misc per-patient options & notes.
- **UI behaviour to reproduce:** Dispensing preferences & consent.
- **Functionality to implement:** "Large labels"/"child-resistant" flags = **accessibility-relevant** dispensing prefs; consent flag.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (77)
- **Screen/module:** **Medication Item** dialog → Details tab.
- **Layout details:** From Medication tab.
- **Visible fields:** Product, "patient regularly receives / generate anticipated repeat", Dates (last printed, next due, treatment period, last dispensed), Compliance (compliant / not / manual override).
- **Buttons/actions:** OK/Cancel/Update.
- **Workflow purpose:** Configure one repeat medication item.
- **UI behaviour to reproduce:** Repeat scheduling + compliance flag.
- **Functionality to implement:** "Next due"/"anticipated repeat" ties to our dosette next-expected dates.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (78)
- **Screen/module:** Medication Item → **Preferences** tab.
- **Layout details:** Item dialog tab.
- **Visible fields:** Preferred item; "patient has requested the following items".
- **Buttons/actions:** Add/Remove preference.
- **Workflow purpose:** Patient's preferred items.
- **UI behaviour to reproduce:** Brand/format preference capture.
- **Functionality to implement:** Patient preference notes (brand/format).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (79)
- **Screen/module:** Medication Item → **Compliance** tab.
- **Layout details:** Item dialog tab.
- **Visible fields:** Parameters (days early/late), Summary (times dispensed, **non-compliances**), Compliant/Non-compliant indicator.
- **Buttons/actions:** OK/Cancel.
- **Workflow purpose:** Track adherence to repeat schedule.
- **UI behaviour to reproduce:** Adherence monitoring.
- **Functionality to implement:** **AI non-compliance / unusual-usage detection** — strong AI feature (compare dispensed cadence to expected).
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (80)
- **Screen/module:** Medication Item — **Prescription Item Details**.
- **Layout details:** Drill-down from medication list.
- **Visible fields:** Added by, Dispensary supply (NHS Standard), Prescriber, Prescribing Practice, Patient, Written as, Quantity, Directions, Reference, Quantity Owed; tabs Details/Notes/Charging/Non Compliance/Items Dispensed.
- **Buttons/actions:** Details/OK/Cancel.
- **Workflow purpose:** Full detail of a dispensed item.
- **UI behaviour to reproduce:** Auditable dispensed-item record (who/what/when).
- **Functionality to implement:** Our dispense-line concept (written/dispensed-as, qty, owed) — defer.
- **Implementation status:** Partial (covered by the original dispensing workspace; external or vendor-specific fields remain excluded).

### Screenshot (81)
- **Screen/module:** Prescription Item Details → **Details** tab.
- **Layout details:** Item dialog tab.
- **Visible fields:** Dosage (Quantity, Frequency, Abbreviation), **Accuracy Checking** (Checked by, Date Checked), Notes.
- **Buttons/actions:** Details/OK/Cancel.
- **Workflow purpose:** Dosage + accuracy check on an item.
- **UI behaviour to reproduce:** Records WHO accuracy-checked an item and WHEN.
- **Functionality to implement:** Capture **checked-by + timestamp** on our dosette "Checked" state (audited).
- **Implementation status:** Partial (covered by the original dispensing workspace; external or vendor-specific fields remain excluded).

### Screenshot (82)
- **Screen/module:** Prescription Item Details → **Charging** tab.
- **Layout details:** Item dialog tab.
- **Visible fields:** Charge type, Tariff use, Cost to recipient, Cost of product, Number of charges, Fees, Expected reimbursement, Explanation.
- **Buttons/actions:** OK/Cancel.
- **Workflow purpose:** Fees & reimbursement.
- **UI behaviour to reproduce:** NHS pricing/endorsement.
- **Functionality to implement:** Not applicable (no NHS charging).
- **Implementation status:** Partial (covered by the original dispensing workspace; external or vendor-specific fields remain excluded).

### Screenshot (83)
- **Screen/module:** Prescription Item Details → **Dispensary Supply Form** tab.
- **Layout details:** Item dialog tab.
- **Visible fields:** Added by, Dispensary supply (NHS Standard), Prescriber, Prescribing Practice, Patient, Supply Collection Date, Electronic ID, VAT rate.
- **Buttons/actions:** Details/OK/Cancel.
- **Workflow purpose:** Supply/source metadata.
- **UI behaviour to reproduce:** Provenance of the supply.
- **Functionality to implement:** "Collection date" + provenance fields (defer).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (84)
- **Screen/module:** **eMessage Details** — full electronic prescription record.
- **Layout details:** From eMessages list.
- **Visible fields:** Left: patient (NHS, DoB, Age, Sex), Item (Fluoxetine 20mg, 3 of 6, directions, DM+D), prescriber/practice; Right: Electronic/Secondary Message ID, Description, Action by, **Message Type (R2 Prescription), Priority, Status, Status Reason, Notes**; tabs eMessage Record/Data/Repeat Details/Additional Details/Local Patient.
- **Buttons/actions:** Export Log; OK/Cancel.
- **Workflow purpose:** Inspect an electronic prescription.
- **UI behaviour to reproduce:** Canonical e-prescription detail with priority/status.
- **Functionality to implement:** **Priority + status** on worklist items; "two-pane: patient/script summary + metadata" layout.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (85)
- **Screen/module:** Dispensary — **Private Prescription / Incomplete Details** dialog.
- **Layout details:** During private dispensing.
- **Visible fields:** Prescription date, Prescription notes; Dispense as; Item iteration; Reason for supply; "incomplete details — add to improve quality".
- **Buttons/actions:** OK/Cancel.
- **Workflow purpose:** Complete a private (non-NHS) script.
- **UI behaviour to reproduce:** Private supply handling.
- **Functionality to implement:** A simple "private supply" type (no NHS) could fit our model.
- **Implementation status:** Partial (covered by the original dispensing workspace; external or vendor-specific fields remain excluded).

### Screenshot (86)
- **Screen/module:** **User Details → Account Details** dialog.
- **Layout details:** Tools → User Settings → User Account Management.
- **Visible fields:** User ID, Account status, First/Last name, **Job role (Dispenser)**, Professional reference; Security (Reset/Forgot password, Forgot questions); **Administrator account**, Disable account, Handout Manager User.
- **Buttons/actions:** Reset/forgot password; OK/Cancel.
- **Workflow purpose:** Manage a user account.
- **UI behaviour to reproduce:** RBAC user management (roles, admin flag, account status).
- **Functionality to implement:** **Directly aligns with our RBAC** (Administrator/Pharmacist/Dispenser). Could add admin user-management UI + account status. (We do NOT handle passwords in plain text — security note.)
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (87)
- **Screen/module:** **System Details → Backup & Misc**.
- **Layout details:** Tools → System Settings → System Configuration.
- **Visible fields:** Backup directory; reports/log directories; **Automatic Purging older than (days)**: pending supplies (28), reclaim owings (28), order logs (7), message-dynamics (60), expired EPSR1 (28), EPS advanced logs (30); Saved-reports max space; Confirm deletion.
- **Buttons/actions:** Browse paths; set purge days; OK.
- **Workflow purpose:** Backup paths + data-retention/purging.
- **UI behaviour to reproduce:** Backups + automated data lifecycle.
- **Functionality to implement:** **Data-retention policy** (auto-purge old transient records) is good practice; our audit log is append-only by design.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (88)
- **Screen/module:** **Pharmacy Details → Pharmacy** tab (General).
- **Layout details:** Settings → Pharmacy.
- **Visible fields:** Pharmacy name, Owner, Address, Postcode, Telephone, Modem; "chain/buying group"; NACS code; sub-tabs General/Opening Times/Intelligence Hub/Communications.
- **Buttons/actions:** Edit; OK.
- **Workflow purpose:** Pharmacy identity.
- **UI behaviour to reproduce:** Site configuration.
- **Functionality to implement:** Our Settings can hold pharmacy identity + opening times.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (89)
- **Screen/module:** Pharmacy Details → **Licence** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Site number, Registration key, Activation key, Number of licences, Expiry date, Database server.
- **Buttons/actions:** Enter keys; OK.
- **Workflow purpose:** Licence/registration keys.
- **UI behaviour to reproduce:** Product licensing.
- **Functionality to implement:** Not applicable.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (90)
- **Screen/module:** Pharmacy Details → Dispensing → Printing/Endorsing/Defaults.
- **Layout details:** Settings tab.
- **Visible fields:** Print bag/dispensing/address labels; print on address/second labels; print sorting; overnight-label content; prescription separation.
- **Buttons/actions:** Toggle print options; OK.
- **Workflow purpose:** Configure label/endorsement printing defaults.
- **UI behaviour to reproduce:** Label/print defaults.
- **Functionality to implement:** Print toggles for our labels (defer; our print is browser-based).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (91)
- **Screen/module:** Pharmacy Details → **Charging** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Private charges (tariff/retail/trade base), charge list (Dispensing/Container/Extra CD), mark-up (min £17.50, 60%), print cost on bag label, NHS charge, VAT rates.
- **Buttons/actions:** Add/Edit/Delete charges; OK.
- **Workflow purpose:** Private/NHS charge config.
- **UI behaviour to reproduce:** Pricing rules.
- **Functionality to implement:** Not applicable (no charging).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (92)
- **Screen/module:** Pharmacy Details → **Checking → Services**.
- **Layout details:** Settings tab.
- **Visible fields:** New Medicine Service (Enable), **Alert Type: Display onscreen alert / Print reminder label**; sub-tabs Clinical/Services.
- **Buttons/actions:** Toggle alerts.
- **Workflow purpose:** Medication-checking & service alerts.
- **UI behaviour to reproduce:** Clinical-check & service prompts.
- **Functionality to implement:** **Dual alert channel** (onscreen + print) is an accessibility idea; alert prompts feed our AI clinical-safety.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (93)
- **Screen/module:** Pharmacy Details → **Products → General**.
- **Layout details:** Settings tab.
- **Visible fields:** Personal List Options (default-to-personal-list, auto-add after N dispenses), Assistance (**Reconstituted quantity / Special container / Calendar pack / Split container**), New Product (Auto-Order ON).
- **Buttons/actions:** Toggle options.
- **Workflow purpose:** Product/personal-list defaults.
- **UI behaviour to reproduce:** Dispensing assistance + auto-reorder defaults.
- **Functionality to implement:** **Calendar-pack assistance** is MDS-relevant; "auto-order on new product" ties to our reorder logic.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (94)
- **Screen/module:** Pharmacy Details → **Ordering** tab.
- **Layout details:** Settings tab (sub-tabs Ordering/Stock Control/Order Rules).
- **Visible fields:** Remove received orders, audible alert when order due, **separate ordering for MDS room**, order responses (label/form printer), **Auto book-in** (older than N days), default supplier, **expensive-order threshold (£100)**.
- **Buttons/actions:** Toggle; OK.
- **Workflow purpose:** Order workflow defaults.
- **UI behaviour to reproduce:** Automates ordering & receipt.
- **Functionality to implement:** "Auto book-in", "expensive-order flag", separate MDS ordering — ideas for our PO/reorder feature.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (95)
- **Screen/module:** Pharmacy Details → **Product Rules** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Product → Order Set mapping (e.g. Accrete D3 → "Phoenix H/c Dist Order").
- **Buttons/actions:** Find/Add/Edit/Delete.
- **Workflow purpose:** Per-product order-set exceptions.
- **UI behaviour to reproduce:** Which supplier/order-set a product defaults to.
- **Functionality to implement:** Default-supplier-per-medicine (we have default_supplier already).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (96)
- **Screen/module:** Pharmacy Details → **Events** tab.
- **Layout details:** Settings tab.
- **Visible fields:** When (Today/From-To); Date + Event ("User X logged in/out successfully").
- **Buttons/actions:** Display; Reprint.
- **Workflow purpose:** System event/audit log.
- **UI behaviour to reproduce:** **Login/logout & system audit trail**.
- **Functionality to implement:** Our **immutable audit log** already records significant actions; could surface a filterable event view (date range).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (97)
- **Screen/module:** Pharmacy Details → **EPS** tab → General.
- **Layout details:** Settings tab.
- **Visible fields:** Dispense Notify Options, Auto Notify, Prescription Completion, Claiming, Real-Time Exemption Check, Patient Nomination.
- **Buttons/actions:** Toggle; OK.
- **Workflow purpose:** Electronic Prescription Service config.
- **UI behaviour to reproduce:** NHS EPS integration.
- **Functionality to implement:** Not applicable (no NHS EPS).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (98)
- **Screen/module:** Pharmacy Details → **Scanner** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Activate barcode scanning, Port, Device (BC-NLSeries USB), advanced logging.
- **Buttons/actions:** Enable; set port; OK.
- **Workflow purpose:** Barcode-scanner configuration.
- **UI behaviour to reproduce:** Hardware for **scan-verification accuracy checks**.
- **Functionality to implement:** Supports our roadmap **barcode/2D-scan accuracy check** (a browser camera/keyboard-wedge equivalent).
- **Implementation status:** Planned (barcode accuracy check — roadmap #1).

### Screenshot (99)
- **Screen/module:** Pharmacy Details → **Patient Selection Wizard** tab.
- **Layout details:** Settings tab.
- **Visible fields:** "Don't show medication history while dispensing"; dm+d description checking; **dm+d item validation** ("validate each item dispensed against the prescribed item — keep enabled").
- **Buttons/actions:** Toggle; OK.
- **Workflow purpose:** Dispensing validation options.
- **UI behaviour to reproduce:** Ensures dispensed item matches prescribed item (safety).
- **Functionality to implement:** **Dispensed-vs-prescribed validation** = our scan/accuracy-check concept.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (100)
- **Screen/module:** Pharmacy Details → **Repeat Rx** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Display patients with **items due in next X days (14)**, items due in following X days (28), **patients with GP review due in X days (28)**, default repeat period (28), **default GP review period (90)**; delivery service; auto registration letters.
- **Buttons/actions:** Set thresholds; OK.
- **Workflow purpose:** Repeat/review timing thresholds.
- **UI behaviour to reproduce:** Drives "due soon" and "review due" worklists.
- **Functionality to implement:** **Configurable "due soon / review due" windows** → feeds our AI "patients due for review" + dosette "due dates".
- **Implementation status:** Partial (covered by the original dispensing workspace; external or vendor-specific fields remain excluded).

### Screenshot (101)
- **Screen/module:** Pharmacy Details → **Leaflet Printing** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Enable Health Information / Patient Information leaflet printing; homepage; print label with leaflet.
- **Buttons/actions:** Toggle; OK.
- **Workflow purpose:** Patient/health info leaflet printing.
- **UI behaviour to reproduce:** Auto patient leaflets.
- **Functionality to implement:** Optional "patient info leaflet" with a dosette pack (defer).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (102)
- **Screen/module:** Pharmacy Details → **Electronic Messaging** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Repeating (**copy quantity / directions from last dispense**), Quantity Matching, Labelling for multiple/single packs, **Barcode scan to MDS**, prescription grouping (90 days).
- **Buttons/actions:** Toggle; OK.
- **Workflow purpose:** Repeat/labelling automation.
- **UI behaviour to reproduce:** Speed via copy-from-last + label rules.
- **Functionality to implement:** **"Copy from last dispense"** efficiency (our med change history enables this); "barcode scan to MDS" = our scan-check.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (103)
- **Screen/module:** Pharmacy Details → **Responsible Pharmacist** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Enable reminder (N min after startup if not logged in), show reminder for missing/incomplete records, display missing records up to 2 weeks, min 15-min gaps.
- **Buttons/actions:** Toggle; OK.
- **Workflow purpose:** RP reminder/compliance settings.
- **UI behaviour to reproduce:** Ensures RP register completeness.
- **Functionality to implement:** RP reminder → ties to our audit/RP indicator (#59/#60).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (104)
- **Screen/module:** Pharmacy Details → **Message Dynamics** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Pharmacy ID, URL, polling interval, collection notification options (acute/repeat: notify/defer/prompt), identify active patients on bag labels.
- **Buttons/actions:** Configure; OK.
- **Workflow purpose:** Patient-messaging integration.
- **UI behaviour to reproduce:** SMS/collection notifications.
- **Functionality to implement:** Collection-ready notification concept (we have notifications); external SMS out of scope.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (105)
- **Screen/module:** Pharmacy Details → **Realtime Backup** tab (full tab list visible).
- **Layout details:** Settings tab.
- **Visible fields:** Enable Realtime Backup; storage location; number of archives (3–14); full settings-tab list (Dispensing, Charging, Checking, Products, Ordering, Scanner, Repeat Rx, RP, Security, eMAR, FMD, Accuracy Check, …).
- **Buttons/actions:** Enable; set path; OK.
- **Workflow purpose:** Continuous DB backup config.
- **UI behaviour to reproduce:** Disaster recovery to point-of-failure.
- **Functionality to implement:** Confirms the **breadth** of a real settings surface — we keep ours focused; PostgreSQL backups are an ops concern.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (106)
- **Screen/module:** Pharmacy Details → **Medication Services** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Targeted MURs (enabled, MUR year Apr–Mar), Prompting (on-screen prompts / print labels), Annual MURs.
- **Buttons/actions:** Toggle; OK.
- **Workflow purpose:** MUR/advanced-service config.
- **UI behaviour to reproduce:** NHS advanced-service management.
- **Functionality to implement:** Not applicable (NHS MUR).
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (107)
- **Screen/module:** Pharmacy Details → **Patient Alerts** tab.
- **Layout details:** Settings tab.
- **Visible fields:** No-Patient-History alert; Alert Types (Prescription type Paper/Electronic/Both, Message Dynamics, EPSR2 Nomination + age, Home Delivery + age, **User-Defined Alert**).
- **Buttons/actions:** Toggle alerts; OK.
- **Workflow purpose:** Configure point-of-dispensing alerts.
- **UI behaviour to reproduce:** Surface patient-specific flags at dispense.
- **Functionality to implement:** **User-defined patient alert** (e.g. "always delivers", "review due") shown on opening a record.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (108)
- **Screen/module:** Pharmacy Details → **Keystroke Reduction** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Quantity Matching, Defer Claim, **Fast Labelling** (auto-populate Dispense-As item, auto-populate directions from prescription), **Trusted directions** (alert when not set), Set Defaults.
- **Buttons/actions:** Toggle; Set Defaults.
- **Workflow purpose:** Speed up data entry.
- **UI behaviour to reproduce:** Fewer keystrokes via auto-fill + trusted directions.
- **Functionality to implement:** **Auto-fill directions** + **Trusted Directions (sig-code) builder** — efficiency & accessibility.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (109)
- **Screen/module:** Pharmacy Details → **Security** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Advanced Password Reset mode, Block continuous changes, **Minimum admin password length (8)**, **Maximum password age (56 days)**.
- **Buttons/actions:** Set policy; OK.
- **Workflow purpose:** Password policy.
- **UI behaviour to reproduce:** Account security policy.
- **Functionality to implement:** Password-policy ideas (we use Django PBKDF2 + validators); could add min-length/age config.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (110)
- **Screen/module:** Pharmacy Details → **eMAR** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Activate (eMAR wizard), Registration key, eMAR activation key, Expiry date.
- **Buttons/actions:** Activate eMAR.
- **Workflow purpose:** Electronic MAR activation.
- **UI behaviour to reproduce:** Electronic MAR charts to care homes.
- **Functionality to implement:** Our printable MAR/tray label is the offline equivalent.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (111)
- **Screen/module:** Pharmacy Details → **FMD** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Enable FMD integration; **warn about items due to expire in 60 days**; aggregation during dispensing.
- **Buttons/actions:** Enable; set warn-days.
- **Workflow purpose:** Falsified Medicines Directive scanning.
- **UI behaviour to reproduce:** Pack authentication + expiry warning at dispense.
- **Functionality to implement:** **Expiry warning at point of pick** (we already warn on FEFO/expiry); 2D-pack scan ties to barcode accuracy check.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (112)
- **Screen/module:** Pharmacy Details → **Delivery** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Pro Delivery Manager (Use API / Print QR Code, API Key, URL, Company ID, Authenticate); PharmDel.
- **Buttons/actions:** Authenticate.
- **Workflow purpose:** Delivery-manager integration.
- **UI behaviour to reproduce:** Home-delivery routing/proof.
- **Functionality to implement:** "Delivery" as a handout type (we have Collected/Delivered states); external API out of scope.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (113)
- **Screen/module:** Pharmacy Details → **App Integration** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Select app (e.g. Healthera), Activate/DeActivate.
- **Buttons/actions:** Activate integration.
- **Workflow purpose:** Patient-app integration.
- **UI behaviour to reproduce:** Patient-facing app linkage.
- **Functionality to implement:** Out of scope (no external patient app).
- **Implementation status:** Out of scope.

### Screenshot (114)
- **Screen/module:** Pharmacy Details → **Automated Clinical Check** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Activate; auto clinical check based on last **6 months**; automate checks in Clinical Check module only.
- **Buttons/actions:** Enable; OK.
- **Workflow purpose:** Enable automatic clinical checking.
- **UI behaviour to reproduce:** Automated interaction/clinical screening window.
- **Functionality to implement:** Our **AI Clinical Safety** screen is the analogue; configurable look-back window is a nice idea.
- **Implementation status:** Partial; explainable AI recommendations require human review, while richer clinical-safety prompts remain planned.

### Screenshot (115)
- **Screen/module:** Pharmacy Details → **Accuracy Check** tab.
- **Layout details:** Settings tab.
- **Visible fields:** Activate Accuracy Check, Exclude MDS/MDSC, **Allow Bulk Manual Confirmation**, Enable Split Pack Prompts, Additional bags for Fridge/CD, **Enable Clinical Check Warning**; **Label & QR Settings** (Picking-list label, Item label, Bag label margins; **Print Test Label**).
- **Buttons/actions:** Enable; set label margins; print test.
- **Workflow purpose:** Scan/accuracy-check config + label layout.
- **UI behaviour to reproduce:** The accuracy/scan-check gate + printable picking/bag labels with QR.
- **Functionality to implement:** **Directly supports roadmap #1 (barcode/QR accuracy check)** + a **picking-list label**; our printable tray label is adjacent.
- **Implementation status:** Partial (covered by the original dispensing workspace; external or vendor-specific fields remain excluded).

### Screenshot (116)
- **Screen/module:** **User Details → Preferences** tab.
- **Layout details:** Tools → User Settings → User Details.
- **Visible fields:** **Colours** (mandatory / invalid / quasi-mandatory input colours), Enter-key behaviour, Print labels timing, Print orders, Dispense order, Prescription-finished options, Confirm multiple deletes.
- **Buttons/actions:** Pick colours/behaviour; OK.
- **Workflow purpose:** Per-user UI preferences.
- **UI behaviour to reproduce:** Personalised UI + input validation cues.
- **Functionality to implement:** **Per-user accessibility preferences** (high-contrast/colour cues, confirm-before-delete) — ties to our PreferencesContext.
- **Implementation status:** Partial (covered by the original dispensing workspace; external or vendor-specific fields remain excluded).

### Screenshot (117)
- **Screen/module:** **User Details → Dispensing** tab.
- **Layout details:** User Details tab.
- **Visible fields:** Messages (patient preference, quantity-not-in-range, **batch number required**, endorsement, **non compliance**, directions-too-long, **Yellow (Level 2) interactions**, tariff exceeded, named-patient-only); Directions (cautions/both/neither); Counselling/Pharmacist-advice/Tariff prompts; Patient-notes dialog.
- **Buttons/actions:** Toggle alerts; OK.
- **Workflow purpose:** Per-user dispensing alert preferences.
- **UI behaviour to reproduce:** Which safety prompts each user sees.
- **Functionality to implement:** Configurable **alert set** (interactions, non-compliance, batch-required) feeding our AI clinical-safety + notifications.
- **Implementation status:** Implemented or represented by an equivalent original workflow in this project.

### Screenshot (118)
- **Screen/module:** **User Management** dialog.
- **Layout details:** Tools → User Settings → User Account Management.
- **Visible fields:** User ID, **Administrator? (Yes/No)**, Last Logged In, **State (Active)**; include deleted accounts.
- **Buttons/actions:** Add, Delete, Details, Close.
- **Workflow purpose:** Admin list of all users.
- **UI behaviour to reproduce:** RBAC user administration + last-login audit.
- **Functionality to implement:** **Admin user-management table** (role, active/inactive, last login) — fits our admin role.
- **Implementation status:** Partial; the core workflow exists, while vendor-specific configuration or integrations are deliberately omitted.

### Screenshot (119)
- **Screen/module:** **Bulk Operations** wizard (intro).
- **Layout details:** Tools → Bulk Operations.
- **Visible fields:** Operation list — Remove All Drugs From Personal List, Remove Unused Drugs & Pack Policies, Reset Brand/Pack Policies, **Mass Prescription Change**, Change Default Generic Manufacturer, Reset Interaction Search Period, Reset Auto Registration, …
- **Buttons/actions:** Next/Close.
- **Workflow purpose:** Run estate-wide product/list operations.
- **UI behaviour to reproduce:** Batch maintenance of product/patient data.
- **Functionality to implement:** Admin bulk tools (e.g. recompute reorder levels) — niche; defer.
- **Implementation status:** Out of scope (vendor bulk tooling).

### Screenshot (120)
- **Screen/module:** Bulk Operations wizard (operation list).
- **Layout details:** Tools → Bulk Operations.
- **Visible fields:** Remove all drugs from personal list, Remove unused drugs/pack policies, Reset brand/pack policies, Mass Prescription Change, Reset Interaction Search, Zero Balance Used, Fix Repeats, Setup Special Obtains.
- **Buttons/actions:** Next/Close.
- **Workflow purpose:** Choose a bulk maintenance operation.
- **UI behaviour to reproduce:** Estate-wide data fixes.
- **Functionality to implement:** Defer (admin tooling).
- **Implementation status:** Out of scope.

### Screenshot (121)
- **Screen/module:** Bulk Operations wizard (list scrolled).
- **Layout details:** Same wizard.
- **Visible fields:** Reset brand/pack policies, Mass Prescription Change, Reset Interaction Search, Zero Balance Used, Fix Repeats, Setup Special Obtains, **Restore MDS Repeats & History**, Remove prepared owings.
- **Buttons/actions:** Next/Close.
- **Workflow purpose:** More bulk operations.
- **UI behaviour to reproduce:** MDS/owings batch maintenance.
- **Functionality to implement:** Defer.
- **Implementation status:** Out of scope.

### Screenshot (122)
- **Screen/module:** Tools → **Inquiry** submenu (duplicate of #49, with shortcuts).
- **Layout details:** Nested submenu + shortcuts.
- **Visible fields:** Patient/Product/Supplier/Prescriber/Institution/Direction/Counter File/Nursing Home/Stock Adjustment Reasons/Caution/Interventions/dm+d/**Trusted Directions (Shift+Ctrl+T)**/Audit Content/Leaflets.
- **Buttons/actions:** Open editor.
- **Workflow purpose:** Reference-data lookups.
- **UI behaviour to reproduce:** Keyboard-driven reference editors.
- **Functionality to implement:** Keyboard shortcuts + a Trusted Directions editor (see #49).
- **Implementation status:** Partial; the dispensing shortcut and trusted-direction lookup are implemented, while an administrator phrase editor is planned.

### Screenshot (123)
- **Screen/module:** Dispensary — **Trusted Directions** picker.
- **Layout details:** From the dispensing Directions field.
- **Visible fields:** Code list — "ONE to be taken", "Take TWO 5ml spoonsful", "Gently pat ONE into the region", "Take THREE 5ml spoonful", "1 tablet to be taken" — with short codes.
- **Buttons/actions:** Pick a direction; Edit; Close.
- **Workflow purpose:** Expand a short dosage code into full directions.
- **UI behaviour to reproduce:** Standardised, fast, **plain-English** directions (avoids Latin abbreviations).
- **Functionality to implement:** A **Trusted Directions / sig-code builder** — type a code → expand to clear instructions on dosette items/labels. Strong efficiency + accessibility + safety win.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (124)
- **Screen/module:** Trusted Directions picker (more codes).
- **Layout details:** Same picker.
- **Visible fields:** "1 capsule to be taken", "ONE OR TWO to be taken", "Take ONE 5ml dose", "Take ONE at 9 hours", "2 capsule to be taken", …
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** Breadth of standard directions.
- **Functionality to implement:** Seed a directions library for the builder.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (125)
- **Screen/module:** Trusted Directions picker (more codes).
- **Layout details:** Same picker.
- **Visible fields:** "every 12 hours", "TWO to be taken", "Take FOUR 5ml spoonsful", "Take a 20ml dose", "every TWO hours", "Take TWO OR THREE", …
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** Frequency/quantity direction variants.
- **Functionality to implement:** Frequency presets for the directions builder.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (126)
- **Screen/module:** Trusted Directions picker (more codes).
- **Layout details:** Same picker.
- **Visible fields:** "Take a 20ml dose", "Take TWO 5ml spoonsful", "Take TWO OR THREE", "Take TWO AT FIRST then…", "every TWO to THREE hours".
- **Buttons/actions:** Pick; Edit; Close.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** More frequency/quantity directions.
- **Functionality to implement:** Directions-library seed (see #123).
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (127)
- **Screen/module:** Trusted Directions picker (more codes).
- **Layout details:** Same picker.
- **Visible fields:** "THREE to be taken", "3 capsules to be taken", "every THREE hours", "Take THREE TO FOUR", "every THREE TO FOUR hours".
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** Three-dose variants.
- **Functionality to implement:** Directions-library seed.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (128)
- **Screen/module:** Trusted Directions picker (more codes).
- **Layout details:** Same picker.
- **Visible fields:** "every 24 hours", "FOUR to be taken", "4 tablets to be taken", "Take FOUR at first then", "every FOUR TO SIX hours".
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** Four-dose / interval variants.
- **Functionality to implement:** Directions-library seed.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (129)
- **Screen/module:** Trusted Directions picker (more codes).
- **Layout details:** Same picker.
- **Visible fields:** "Take TWO 5ml spoonsful", "Take FOUR 5ml spoonsful", "Take ONE OR TWO 5ml…", "Take ONE 5ml dose".
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** Liquid-dose variants.
- **Functionality to implement:** Directions-library seed.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (130)
- **Screen/module:** Trusted Directions / Directions abbreviation codes.
- **Layout details:** Directions field picker.
- **Visible fields:** Abbreviations (e.g. AD/BD/AE/AF…) expanding to "before food", "on alternate days", "after meals", "apply to affected area", "into the affected ear", "as before", etc.
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Latin-style sig codes → plain English.
- **UI behaviour to reproduce:** Map clinician shorthand to patient-friendly text.
- **Functionality to implement:** **Abbreviation-expansion table** for the directions builder (safety: avoid ambiguous Latin on patient labels).
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (131)
- **Screen/module:** Trusted Directions picker (more codes).
- **Layout details:** Same picker.
- **Visible fields:** "every 6/8 hours", "every EIGHT hours" variants.
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** Interval-dosing variants.
- **Functionality to implement:** Directions-library seed.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (132)
- **Screen/module:** Trusted Directions picker (more codes).
- **Layout details:** Same picker.
- **Visible fields:** "every EIGHT hours" and related interval directions.
- **Buttons/actions:** Pick; Edit; Close.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** Interval-dosing variants.
- **Functionality to implement:** Directions-library seed.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (133)
- **Screen/module:** Trusted Directions picker (more codes).
- **Layout details:** Same picker.
- **Visible fields:** "Take a 5ml dose", "Take a 10ml dose", "Take a 15ml dose" variants.
- **Buttons/actions:** Pick; Edit; Close.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** Liquid-volume directions.
- **Functionality to implement:** Directions-library seed (see #123).
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (134)
- **Screen/module:** Trusted Directions picker — **"when required" (PRN)**.
- **Layout details:** Same picker.
- **Visible fields:** "when required" (code PRN).
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** As-needed dosing direction.
- **UI behaviour to reproduce:** PRN dosing.
- **Functionality to implement:** PRN flag/text on dosette items + labels.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (135)
- **Screen/module:** Trusted Directions picker (more codes).
- **Layout details:** Same picker.
- **Visible fields:** "Take TWO 5ml spoonsful", "ONE OR TWO 5ml spoonsful", "Take TWO OR THREE", "Take TWO AT FIRST then" variants.
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** Quantity-range directions.
- **Functionality to implement:** Directions-library seed.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (136)
- **Screen/module:** Trusted Directions picker — application/route directions.
- **Layout details:** Same picker.
- **Visible fields:** "Apply one or two drops to the affected area", "two spray in each nostril TWICE a day", "TWO OR THREE times a day", **BEFORE meals**, "when required".
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Route-specific directions.
- **UI behaviour to reproduce:** Route/site + timing directions.
- **Functionality to implement:** Route/site directions in the builder.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (137)
- **Screen/module:** Trusted Directions picker — cautionary directions.
- **Layout details:** Same picker.
- **Visible fields:** "DO NOT SWALLOW", "Give a TWO AND A HALF 5ml dose", "**AS DIRECTED**", "**BETWEEN meals**", "Add one 5ml spoonful to a pint of hot water", "Inhale TWO puffs", "when required".
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Cautionary/admin directions.
- **UI behaviour to reproduce:** Safety/administration directions.
- **Functionality to implement:** Cautionary directions + warnings on labels (we have a label footer).
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (138)
- **Screen/module:** Trusted Directions picker — more cautions.
- **Layout details:** Same picker.
- **Visible fields:** "**SHAKE WELL BEFORE USE**", "**TO BE DISSOLVED** with water and taken", "Inhale TWO", "when required".
- **Buttons/actions:** Pick; Edit; Close.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** Preparation/administration cautions.
- **Functionality to implement:** Standard cautionary labels (e.g. "shake well") as selectable warnings.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (139)
- **Screen/module:** Trusted Directions picker (more codes).
- **Layout details:** Same picker.
- **Visible fields:** "ONE to be taken", "Take TWO 5ml spoonsful", "1 capsule to be taken", "Take THREE 5ml spoonful", "Gently rub ONE into the region".
- **Buttons/actions:** Pick; Edit; Close.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** Core dosing directions.
- **Functionality to implement:** Directions-library seed (see #123).
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (140)
- **Screen/module:** Trusted Directions picker — route/site directions.
- **Layout details:** Same picker.
- **Visible fields:** "Gently put ONE into the rectum", "Gently put ONE into the region", "Gently put ONE into the vagina", "Take TWO 5ml spoonsful".
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Application-site directions.
- **UI behaviour to reproduce:** Suppository/pessary/topical directions.
- **Functionality to implement:** Route directions seed.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (141)
- **Screen/module:** Trusted Directions picker (more codes).
- **Layout details:** Same picker.
- **Visible fields:** "Take a 20ml dose", "every 24 hours", "Take TWO 5ml spoonsful", "every TWO to THREE hours" variants.
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** Volume/interval directions.
- **Functionality to implement:** Directions-library seed.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (142)
- **Screen/module:** Trusted Directions picker (more codes).
- **Layout details:** Same picker.
- **Visible fields:** "every TWO to THREE hours", "THREE to be taken", "3 capsules to be taken", "Take THREE TO FOUR", "every THREE to FOUR hours".
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** Three-dose / interval directions.
- **Functionality to implement:** Directions-library seed.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (143)
- **Screen/module:** Trusted Directions picker (more codes).
- **Layout details:** Same picker.
- **Visible fields:** "4 capsules to be taken", "every FOUR hours", "Take FOUR at first then", "every FOUR TO SIX hours", "FOUR to be taken".
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** Four-dose / interval directions.
- **Functionality to implement:** Directions-library seed.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (144)
- **Screen/module:** Trusted Directions picker (more codes).
- **Layout details:** Same picker.
- **Visible fields:** "Take ONE OR TWO 5ml spoonsful", "Take a 5ml dose", "FIVE times a day", "every SIX hours", "every SIX TO EIGHT hours", "every EIGHT hours", "at BEDTIME".
- **Buttons/actions:** Pick; Edit; Close.
- **Workflow purpose:** Continued directions library.
- **UI behaviour to reproduce:** Frequency + bedtime directions.
- **Functionality to implement:** Directions-library seed; "at bedtime" maps to our Bedtime slot.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (145)
- **Screen/module:** Trusted Directions — **abbreviation codes**.
- **Layout details:** Same picker.
- **Visible fields:** AD/BD/AE/AF-style codes → "before food", "on alternate days", "after meals", "apply to affected area", "THE APPLICATION", "into the affected ear", "as before".
- **Buttons/actions:** Pick; Edit; Close.
- **Workflow purpose:** Map clinician abbreviations to plain English.
- **UI behaviour to reproduce:** Shorthand → safe label text.
- **Functionality to implement:** **Abbreviation-expansion table** for the directions builder (avoid ambiguous Latin).
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (146)
- **Screen/module:** Trusted Directions — abbreviation/timing codes.
- **Layout details:** Same picker.
- **Visible fields:** "as before", "Apply one or two drops to the affected area" (ASD), "Apply thinly to the affected area and rub in" (ATH), "TWICE a day", "two spray in each nostril TWICE a day", "as BOTH ears".
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Timing/route abbreviations.
- **UI behaviour to reproduce:** Topical/route timing.
- **Functionality to implement:** Directions-library seed.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (147)
- **Screen/module:** Trusted Directions — caution/route codes.
- **Layout details:** Same picker.
- **Visible fields:** "two AD 5ml spoon", "TWO OR THREE times a day", "CHEW before swallowing", "Put ONE drop", "Put THREE drops", "EMERGENCY SUPPLY", "THE CREAM".
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Route/caution abbreviations.
- **UI behaviour to reproduce:** Formulation-specific directions.
- **Functionality to implement:** Directions-library seed.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (148)
- **Screen/module:** Trusted Directions — admin/route codes.
- **Layout details:** Same picker.
- **Visible fields:** "EMERGENCY SUPPLY", "THE EYE DROPS", "each MORNING", "**FOR EXTERNAL USE ONLY**", "Give a TWO AND A HALF 5ml dose", "Take HALF a tablet", "EVERY HOUR".
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Administration directions.
- **UI behaviour to reproduce:** Route + frequency + external-use caution.
- **Functionality to implement:** External-use & frequency cautions for labels.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (149)
- **Screen/module:** Trusted Directions — frequency/route codes.
- **Layout details:** Same picker.
- **Visible fields:** "EVERY HOUR", "Take HALF TO ONE tablet", "in water", "BETWEEN meals", "Add one 5ml spoonful to a pint of hot water", "into the LEFT ear", "**THE LINIMENT**", "LOT".
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Frequency/route abbreviations.
- **UI behaviour to reproduce:** Preparation + route directions.
- **Functionality to implement:** Directions-library seed.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (150)
- **Screen/module:** Trusted Directions — formulation/route codes.
- **Layout details:** Same picker.
- **Visible fields:** "THE LOTION", "into the LEFT ear", "in the MORNING", "To be taken as directed by your doctor", "as directed", "THE MIXTURE", "THE NOSE DROPS", "ONCE A DAY".
- **Buttons/actions:** Pick; Edit; Close.
- **Workflow purpose:** Formulation-specific directions.
- **UI behaviour to reproduce:** Formulation + frequency directions.
- **Functionality to implement:** Directions-library seed (lotion/mixture/drops + once-a-day).
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (151)
- **Screen/module:** Trusted Directions — route/frequency codes.
- **Layout details:** Same picker.
- **Visible fields:** "ONCE A DAY", "Inhale TWO puffs", "AFTER food", "when required" (PRN), "THE EAR DROPS", "into the RIGHT eye".
- **Buttons/actions:** Pick; Edit; Close.
- **Workflow purpose:** Inhaler/ear/eye + frequency directions.
- **UI behaviour to reproduce:** Route + timing directions.
- **Functionality to implement:** Directions-library seed (see #123/#130).
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (152)
- **Screen/module:** Trusted Directions — topical/admin codes.
- **Layout details:** Same picker.
- **Visible fields:** "into the RIGHT ear", "Rub in gently", "**SHAKE WELL BEFORE USE**", "spread evenly through the day", "FOUR times a day", "Spread thinly on the affected skin", "To be well shaken with water and taken".
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Topical application directions.
- **UI behaviour to reproduce:** Topical preparation + frequency.
- **Functionality to implement:** Directions-library seed.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (153)
- **Screen/module:** Trusted Directions — frequency/use codes.
- **Layout details:** Same picker.
- **Visible fields:** "To be well shaken with water and taken", "THREE times a day", "THREE TO FOUR times a day", "Use ONE", "Use TWO", "Use THREE", "Use FOUR".
- **Buttons/actions:** Pick; Edit.
- **Workflow purpose:** Frequency + "Use N" directions.
- **UI behaviour to reproduce:** Device/applicator "use N" + frequency.
- **Functionality to implement:** Directions-library seed.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

### Screenshot (154)
- **Screen/module:** Trusted Directions — final codes (end of library).
- **Layout details:** Same picker (end).
- **Visible fields:** "Use ONE/TWO/THREE/FOUR", "to be taken as directed by your doctor", "THE OINTMENT", "in water", "when required", "with water".
- **Buttons/actions:** Pick; Edit; Close.
- **Workflow purpose:** "Use N" + as-directed + formulation directions.
- **UI behaviour to reproduce:** Closes out the standard directions library.
- **Functionality to implement:** Complete the directions-library seed for the builder; "as directed by your doctor" + cautionary phrases for safe labels.
- **Implementation status:** Implemented (trusted-directions API, seeded original phrase library, keyboard picker and dispensing integration).

---

## Inventory complete

**154 of 154 screenshots individually inspected and documented** (Screenshot (1) … Screenshot (154)).

Coverage by cluster: dispensing pipeline & dispensary item entry (1–5, 13–19, 63–67, 84–85), home/overview dashboards (7–9), navigation & global shell (6, 46–62), eMessages & worklists (10–12, 63), MDS/dosette (28–39), stock & ordering (20–26, 94–95), pending/owings/instalments/repeats (27, 40–43), reports (44–45), patient record tabs (68–83), settings/Pharmacy Details (86–118), bulk/admin tools (119–122), and the Trusted Directions (sig-code) library (123–154).

Top original adoptions identified: role-based sidebar (search-first patient access), similar-spelling search (**already shipped**), dosette cycle-history panel, store-wide dispensing pipeline board, barcode/QR accuracy check + picking label, a Trusted-Directions/sig-code builder, AI review-due & non-compliance detection, and per-user accessibility preferences. NHS/EPS/NCSO/MUR/FMD/eMAR, Cegedim branding, the green-cross logo, "Nomad/Manrex" tray brands, charging/reimbursement, and licence keys were all marked **ignore — not copied**.
