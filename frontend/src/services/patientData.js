/**
 * Patient workspace data engine — self-contained, explainable, simulated.
 *
 * Drives the redesigned Patients workflow (search → record → dosette → picking →
 * print) without depending on a backend, so it is fully demonstrable. All content
 * is invented/neutral and for academic demonstration only — NOT clinical advice,
 * and no real or NHS-branded data. The shapes mirror what a `/patients/*` API
 * would return, so this can later be swapped for live data behind the same calls.
 */

const TODAY = new Date("2026-06-13T09:00:00");
const PERIODS = ["Morning", "Afternoon", "Evening", "Bedtime"];

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const iso = (d) => d.toISOString().slice(0, 10);
const ddmonyyyy = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const ageFrom = (dob) => {
  const b = new Date(dob);
  let a = TODAY.getFullYear() - b.getFullYear();
  if (TODAY.getMonth() < b.getMonth() || (TODAY.getMonth() === b.getMonth() && TODAY.getDate() < b.getDate())) a -= 1;
  return a;
};

export const WORKFLOW_STATUSES = [
  "Not started",
  "Picking required",
  "Picking in progress",
  "Picked",
  "Checked",
  "Ready",
  "Collected / Delivered",
  "Issue found",
];

export const STATUS_TONE = {
  "Not started": "neutral",
  "Picking required": "warning",
  "Picking in progress": "info",
  Picked: "info",
  Checked: "info",
  Ready: "success",
  "Collected / Delivered": "success",
  "Issue found": "danger",
};

// ---------------------------------------------------------------- medications
// Each medication carries simulated appearance data for patient identification.
const M = {
  amlodipine5: {
    name: "Amlodipine", strength: "5mg", form: "Tablet",
    appearance: { colour: "White", shape: "Round", imprint: "A5", description: "Small white round tablet" },
  },
  amlodipine10: {
    name: "Amlodipine", strength: "10mg", form: "Tablet",
    appearance: { colour: "White", shape: "Round", imprint: "A10", description: "White round tablet" },
  },
  atorvastatin20: {
    name: "Atorvastatin", strength: "20mg", form: "Tablet",
    appearance: { colour: "White", shape: "Oval", imprint: "ATV20", description: "White oval film-coated tablet" },
  },
  atorvastatin40: {
    name: "Atorvastatin", strength: "40mg", form: "Tablet",
    appearance: { colour: "White", shape: "Oval", imprint: "ATV40", description: "White oval film-coated tablet" },
  },
  metformin500: {
    name: "Metformin", strength: "500mg", form: "Tablet",
    appearance: { colour: "White", shape: "Round", imprint: "MF500", description: "White round film-coated tablet" },
  },
  ramipril2: {
    name: "Ramipril", strength: "2.5mg", form: "Capsule",
    appearance: { colour: "Yellow / White", shape: "Capsule", imprint: "R2.5", description: "Two-tone capsule" },
  },
  ramipril5: {
    name: "Ramipril", strength: "5mg", form: "Capsule",
    appearance: { colour: "Red / White", shape: "Capsule", imprint: "R5", description: "Two-tone capsule" },
  },
  levothyroxine50: {
    name: "Levothyroxine", strength: "50mcg", form: "Tablet",
    appearance: { colour: "White", shape: "Round", imprint: "L50", description: "Small white round tablet" },
  },
  omeprazole20: {
    name: "Omeprazole", strength: "20mg", form: "Capsule",
    appearance: { colour: "Pink / Brown", shape: "Capsule", imprint: "OM20", description: "Gastro-resistant capsule" },
  },
  sertraline50: {
    name: "Sertraline", strength: "50mg", form: "Tablet",
    appearance: { colour: "Blue", shape: "Oval", imprint: "SE50", description: "Blue oval film-coated tablet" },
  },
};

// Build a medication record with slot doses + instruction + audit trail.
let medSeq = 1;
function med(base, opts) {
  const {
    slots, instruction, quantity = 28, intervalDays = 28, lastOffset = -12,
    prescribedBy = "Dr H. Mistry", createdBy = "P. Sharma (Pharmacist)",
    updatedBy = "P. Sharma (Pharmacist)", status = "Active",
    startOffset = -180, notes = "", audit, changes,
  } = opts;
  const last = addDays(TODAY, lastOffset);
  // Change history: an explicit "Started" entry plus any provided dosage/quantity/stop changes.
  const hist = [
    {
      at: iso(addDays(TODAY, startOffset)), staff: createdBy, type: "Started",
      detail: `${base.name} ${base.strength} ${base.form.toLowerCase()} started`, reason: "New prescription",
    },
    ...(changes || (audit || []).map((a) => ({ at: a.at, staff: a.staff, type: "Updated", detail: a.change, reason: "" }))),
  ];
  return {
    id: `RX-${1000 + medSeq++}`,
    ...base,
    instruction,
    slots, // { Morning: qty, Afternoon: qty, Evening: qty, Bedtime: qty }
    quantityPerDay: PERIODS.reduce((s, p) => s + (slots[p] || 0), 0),
    quantity,
    intervalDays,
    lastDispensed: iso(last),
    previousDispensed: iso(addDays(last, -intervalDays)),
    nextExpected: status === "Active" ? iso(addDays(last, intervalDays)) : null,
    startDate: iso(addDays(TODAY, startOffset)),
    status,
    prescribedBy,
    createdBy,
    updatedBy,
    updatedAt: hist[hist.length - 1].at,
    notes,
    changes: hist,
  };
}

// Stock snapshot per medicine (for the per-patient picking list / FEFO).
const STOCK = {
  "Amlodipine 5mg": { onHand: 540, batch: "K2209C", expiry: iso(addDays(TODAY, 54)), location: "A1" },
  "Amlodipine 10mg": { onHand: 300, batch: "K7781D", expiry: iso(addDays(TODAY, 130)), location: "A1" },
  "Atorvastatin 20mg": { onHand: 1240, batch: "B7741A", expiry: iso(addDays(TODAY, 110)), location: "A3" },
  "Atorvastatin 40mg": { onHand: 420, batch: "B9920C", expiry: iso(addDays(TODAY, 9)), location: "A3" },
  "Metformin 500mg": { onHand: 2980, batch: "M4418D", expiry: iso(addDays(TODAY, 240)), location: "B2" },
  "Ramipril 2.5mg": { onHand: 86, batch: "R3320F", expiry: iso(addDays(TODAY, 140)), location: "A2" },
  "Ramipril 5mg": { onHand: 175, batch: "R5540G", expiry: iso(addDays(TODAY, 75)), location: "A2" },
  "Levothyroxine 50mcg": { onHand: 410, batch: "L8855G", expiry: iso(addDays(TODAY, 72)), location: "B1" },
  "Omeprazole 20mg": { onHand: 90, batch: "O1187E", expiry: iso(addDays(TODAY, 11)), location: "C4" },
  "Sertraline 50mg": { onHand: 660, batch: "S6643H", expiry: iso(addDays(TODAY, 220)), location: "C1" },
};

function cycle(startOffset, lengthDays = 28) {
  const start = addDays(TODAY, startOffset);
  return { start: iso(start), end: iso(addDays(start, lengthDays - 1)), lengthDays };
}

// ---------------------------------------------------------------- patients
export const PATIENTS = [
  {
    id: "PT-10428",
    firstName: "Alvin",
    surname: "Sakhiya",
    dob: "1991-03-26",
    postcode: "LE3 9QP",
    phone: "07700 900421",
    address: "14 Glenfield Road, Leicester",
    status: "active",
    careSetting: "Community",
    packType: "Monthly compliance pack",
    doctor: { name: "Dr H. Mistry", practice: "Glenfield Medical Centre", phone: "0116 496 0001", address: "Glenfield, Leicester" },
    allergies: ["Penicillin"],
    cycle: cycle(-2, 28),
    workflow: {
      status: "Picking required",
      history: [
        { status: "Not started", at: iso(addDays(TODAY, -3)), staff: "System", note: "Cycle created" },
        { status: "Picking required", at: iso(addDays(TODAY, -1)), staff: "P. Sharma", note: "Due in 26 days — prep early" },
      ],
    },
    meds: [
      med(M.metformin500, {
        slots: { Morning: 1, Evening: 1 }, instruction: "Take ONE tablet in the morning and ONE in the evening with food",
        quantity: 56, intervalDays: 28, lastOffset: -12, startOffset: -400, prescribedBy: "Dr H. Mistry",
        changes: [
          { at: iso(addDays(TODAY, -230)), staff: "Dr H. Mistry", type: "Dose change", detail: "Increased from once daily to twice daily (BD)", reason: "HbA1c above target" },
          { at: iso(addDays(TODAY, -40)), staff: "P. Sharma (Pharmacist)", type: "Quantity change", detail: "Pack quantity 28 → 56 to match BD dosing", reason: "Align supply to dose" },
        ],
      }),
      med(M.amlodipine5, { slots: { Morning: 1 }, instruction: "Take ONE tablet each morning", quantity: 28, lastOffset: -12, startOffset: -300 }),
      med(M.atorvastatin20, { slots: { Bedtime: 1 }, instruction: "Take ONE tablet at night", quantity: 28, lastOffset: -12, startOffset: -300 }),
      med(M.ramipril2, {
        slots: { Bedtime: 1 }, instruction: "Take ONE capsule at night", quantity: 28, lastOffset: -10, startOffset: -10, prescribedBy: "Dr H. Mistry",
        changes: [{ at: iso(addDays(TODAY, -10)), staff: "Dr H. Mistry", type: "Started", detail: "New item — ramipril 2.5mg initiated", reason: "Blood pressure management" }],
      }),
    ],
    notes: [
      { at: iso(addDays(TODAY, -10)), staff: "P. Sharma", category: "Clinical review", text: "Annual medication review completed. No changes required beyond ramipril initiation." },
    ],
  },
  {
    id: "PT-10915",
    firstName: "Margaret",
    surname: "Hayes",
    dob: "1948-11-02",
    postcode: "LE5 4AB",
    phone: "07700 900512",
    address: "3 Spinney Hill, Leicester",
    status: "active",
    careSetting: "Care home",
    packType: "Monthly compliance pack",
    doctor: { name: "Dr A. Khan", practice: "Spinney Hill Surgery", phone: "0116 496 0202", address: "Spinney Hill, Leicester" },
    allergies: [],
    cycle: cycle(-1, 28),
    workflow: {
      status: "Ready",
      history: [
        { status: "Picked", at: iso(addDays(TODAY, -2)), staff: "T. Reilly", note: "" },
        { status: "Checked", at: iso(addDays(TODAY, -1)), staff: "P. Sharma", note: "Final check passed" },
        { status: "Ready", at: iso(addDays(TODAY, -1)), staff: "P. Sharma", note: "Sealed" },
      ],
    },
    meds: [
      med(M.amlodipine10, { slots: { Morning: 1 }, instruction: "Take ONE tablet each morning" }),
      med(M.atorvastatin40, { slots: { Bedtime: 1 }, instruction: "Take ONE tablet at night" }),
      med(M.omeprazole20, { slots: { Morning: 1 }, instruction: "Take ONE capsule each morning before food" }),
      med(M.sertraline50, { slots: { Morning: 1 }, instruction: "Take ONE tablet each morning" }),
    ],
    notes: [{ at: iso(addDays(TODAY, -20)), staff: "Care home", category: "Note", text: "Prefers delivery before 10am." }],
  },
  {
    id: "PT-11203",
    firstName: "David",
    surname: "Okafor",
    dob: "1956-06-18",
    postcode: "LE2 1TR",
    phone: "07700 900688",
    address: "27 Aylestone Road, Leicester",
    status: "active",
    careSetting: "Community",
    packType: "Weekly compliance pack",
    doctor: { name: "Dr S. Patel", practice: "Aylestone Health", phone: "0116 496 0303", address: "Aylestone, Leicester" },
    allergies: ["Aspirin"],
    cycle: cycle(-5, 7),
    workflow: {
      status: "Issue found",
      history: [
        { status: "Picking in progress", at: iso(addDays(TODAY, -1)), staff: "T. Reilly", note: "" },
        { status: "Issue found", at: iso(TODAY), staff: "T. Reilly", note: "Omeprazole stock below requirement" },
      ],
    },
    meds: [
      med(M.levothyroxine50, { slots: { Morning: 1 }, instruction: "Take ONE tablet each morning before food" }),
      med(M.omeprazole20, { slots: { Morning: 1 }, instruction: "Take ONE capsule each morning" }),
      med(M.ramipril5, { slots: { Morning: 1 }, instruction: "Take ONE capsule each morning" }),
    ],
    notes: [],
  },
  {
    id: "PT-11876",
    firstName: "Priya",
    surname: "Sharma",
    dob: "1972-01-09",
    postcode: "LE4 7DG",
    phone: "07700 900734",
    address: "9 Belgrave Gate, Leicester",
    status: "active",
    careSetting: "Community",
    packType: "Monthly compliance pack",
    doctor: { name: "Dr H. Mistry", practice: "Belgrave Medical", phone: "0116 496 0404", address: "Belgrave, Leicester" },
    allergies: [],
    cycle: cycle(2, 28),
    workflow: { status: "Not started", history: [{ status: "Not started", at: iso(TODAY), staff: "System", note: "Cycle scheduled" }] },
    meds: [
      med(M.ramipril5, { slots: { Morning: 1 }, instruction: "Take ONE capsule each morning" }),
      med(M.atorvastatin40, { slots: { Bedtime: 1 }, instruction: "Take ONE tablet at night" }),
      med(M.metformin500, { slots: { Morning: 1, Evening: 1 }, instruction: "Take ONE tablet morning and evening with food" }),
    ],
    notes: [],
  },
  // A deliberately near-identical surname cluster (Connor / Conner / Connors) so
  // the similar-spelling search tier is demonstrable: searching "conner" surfaces
  // all three, the non-exact ones flagged as similar matches.
  {
    id: "PT-12044",
    firstName: "James",
    surname: "Connor",
    dob: "1953-09-14",
    postcode: "LE3 2BB",
    phone: "07700 900810",
    address: "5 Hinckley Road, Leicester",
    status: "active",
    careSetting: "Community",
    packType: "Monthly compliance pack",
    doctor: { name: "Dr A. Khan", practice: "Hinckley Road Surgery", phone: "0116 496 0505", address: "Hinckley Road, Leicester" },
    allergies: [],
    cycle: cycle(-1, 28),
    workflow: { status: "Picked", history: [{ status: "Picked", at: iso(addDays(TODAY, -1)), staff: "T. Reilly", note: "" }] },
    meds: [
      med(M.amlodipine5, { slots: { Morning: 1 }, instruction: "Take ONE tablet each morning" }),
      med(M.atorvastatin20, { slots: { Bedtime: 1 }, instruction: "Take ONE tablet at night" }),
    ],
    notes: [],
  },
  {
    id: "PT-12051",
    firstName: "Aisha",
    surname: "Conner",
    dob: "1967-04-22",
    postcode: "LE4 6CC",
    phone: "07700 900822",
    address: "41 Melton Road, Leicester",
    status: "active",
    careSetting: "Community",
    packType: "Weekly compliance pack",
    doctor: { name: "Dr S. Patel", practice: "Melton Road Health", phone: "0116 496 0606", address: "Melton Road, Leicester" },
    allergies: [],
    cycle: cycle(-3, 7),
    workflow: { status: "Picking required", history: [{ status: "Picking required", at: iso(addDays(TODAY, -1)), staff: "P. Sharma", note: "" }] },
    meds: [
      med(M.levothyroxine50, { slots: { Morning: 1 }, instruction: "Take ONE tablet each morning before food" }),
      med(M.sertraline50, { slots: { Morning: 1 }, instruction: "Take ONE tablet each morning" }),
    ],
    notes: [],
  },
  {
    id: "PT-12067",
    firstName: "Robert",
    surname: "Connors",
    dob: "1940-12-05",
    postcode: "LE2 8DD",
    phone: "07700 900833",
    address: "18 Saffron Lane, Leicester",
    status: "inactive",
    careSetting: "Care home",
    packType: "Monthly compliance pack",
    doctor: { name: "Dr H. Mistry", practice: "Saffron Lane Medical", phone: "0116 496 0707", address: "Saffron Lane, Leicester" },
    allergies: ["Codeine"],
    cycle: cycle(-10, 28),
    workflow: { status: "Collected / Delivered", history: [{ status: "Collected / Delivered", at: iso(addDays(TODAY, -6)), staff: "P. Sharma", note: "" }] },
    meds: [
      med(M.omeprazole20, { slots: { Morning: 1 }, instruction: "Take ONE capsule each morning before food" }),
    ],
    notes: [{ at: iso(addDays(TODAY, -30)), staff: "Care home", category: "Note", text: "Pack collection paused pending review." }],
  },
];

const META = {
  "PT-10428": { title: "Mr", sex: "Male" },
  "PT-10915": { title: "Mrs", sex: "Female" },
  "PT-11203": { title: "Mr", sex: "Male" },
  "PT-11876": { title: "Ms", sex: "Female" },
  "PT-12044": { title: "Mr", sex: "Male" },
  "PT-12051": { title: "Mrs", sex: "Female" },
  "PT-12067": { title: "Mr", sex: "Male" },
};
PATIENTS.forEach((p) => {
  p.name = `${p.firstName} ${p.surname}`;
  p.age = ageFrom(p.dob);
  Object.assign(p, META[p.id] || { title: "", sex: "" });
});

// Flattened, newest-first medication change history for the History tab.
export function getMedicationHistory(patient) {
  return patient.meds
    .flatMap((m) => m.changes.map((c) => ({ ...c, medicine: `${m.name} ${m.strength}` })))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

// ---------------------------------------------------------------- search
// Multi-format: full name, "A Sakhiya", "Alvin S", "Al Sa", initials, DOB
// (several formats), postcode, patient ID — plus a *similar-spelling* tier so a
// misheard or mistyped surname still surfaces the right patient (the real-world
// Find-Patient behaviour that groups e.g. Connor / Conner / Connors together).
const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

// Soundex-style phonetic key: surnames that *sound* alike share a key. Kept
// deliberately small and dependency-free; this is identification support only.
function phonetic(s) {
  const up = (s || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!up) return "";
  const code = (ch) =>
    ({ B: "1", F: "1", P: "1", V: "1", C: "2", G: "2", J: "2", K: "2", Q: "2", S: "2", X: "2", Z: "2",
       D: "3", T: "3", L: "4", M: "5", N: "5", R: "6" }[ch] || "");
  let out = up[0];
  let prev = code(up[0]);
  for (let i = 1; i < up.length; i++) {
    const c = code(up[i]);
    if (c && c !== prev) out += c;
    if (up[i] !== "H" && up[i] !== "W") prev = c; // H/W don't break a run
  }
  return (out + "000").slice(0, 4);
}

// Levenshtein edit distance — how many single-character edits separate two words.
function editDistance(a, b) {
  a = a || ""; b = b || "";
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

function dobVariants(dob) {
  const d = new Date(dob);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return [dob, `${dd}/${mm}/${yyyy}`, `${dd}-${mm}-${yyyy}`, `${dd}.${mm}.${yyyy}`, `${dd}${mm}${yyyy}`, ddmonyyyy(dob)].map(norm);
}

export function searchPatients(query) {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(" ").filter(Boolean);
  // A single alphabetic word (≥3 letters) is treated as a possible surname for
  // the similar-spelling tier.
  const surnameish = tokens.length === 1 && /^[a-z]+$/.test(q) && q.length >= 3;
  const qPhon = surnameish ? phonetic(q) : "";

  return PATIENTS.map((p) => {
    const first = norm(p.firstName);
    const sur = norm(p.surname);
    const full = norm(p.name);
    const id = norm(p.id);
    const pc = norm(p.postcode);
    let score = 0;
    let fuzzy = false;

    if (id === q || id.replace(/[^a-z0-9]/g, "") === q.replace(/[^a-z0-9]/g, "")) score += 100;
    if (full === q) score += 90;
    if (full.startsWith(q)) score += 50;
    if (pc.replace(/\s/g, "").includes(q.replace(/\s/g, "")) && q.length >= 2) score += 60;
    if (dobVariants(p.dob).some((v) => v === q || v.includes(q))) score += 80;

    // token matching: each token must hit first/surname start (handles "al sa", "a sakhiya", "alvin s")
    if (tokens.length >= 1) {
      const hit = tokens.every((t) => first.startsWith(t) || sur.startsWith(t) || full.includes(t));
      if (hit) score += 40 + tokens.length * 6;
      // initials e.g. "as"
      if (tokens.length === 1 && t1Initials(p).includes(q)) score += 30;
    }

    // Similar-spelling tier — only when nothing above matched this patient, so a
    // direct match always outranks a phonetic/near one. Scored below any direct
    // hit and flagged so the UI can label it "similar".
    if (surnameish && score === 0) {
      const dist = editDistance(sur, q);
      const soundsAlike = qPhon && phonetic(sur) === qPhon;
      if (soundsAlike || dist <= 2) {
        score += Math.max(8, 22 - dist * 5) + (soundsAlike ? 6 : 0);
        fuzzy = true;
      }
    }
    return { p, score, fuzzy };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => ({ ...r.p, _fuzzy: r.fuzzy }));
}
function t1Initials(p) {
  return norm(`${p.firstName[0]}${p.surname[0]}`);
}

// ---------------------------------------------------------------- derived views
export function getTray(patient) {
  return PERIODS.map((period) => ({
    period,
    items: patient.meds
      .filter((m) => m.status === "Active" && (m.slots[period] || 0) > 0)
      .map((m) => ({
        name: m.name, strength: m.strength, form: m.form, qty: m.slots[period],
        instruction: m.instruction, appearance: m.appearance,
      })),
  }));
}

export function getPickingList(patient) {
  const days = patient.cycle.lengthDays;
  return patient.meds
    .filter((m) => m.status === "Active")
    .map((m) => {
      const key = `${m.name} ${m.strength}`;
      const stock = STOCK[key] || { onHand: 0, batch: "—", expiry: iso(addDays(TODAY, 365)), location: "—" };
      const needed = m.quantityPerDay * days;
      const expiryDays = Math.round((new Date(stock.expiry) - TODAY) / 86400000);
      const cycleEndDays = Math.round((new Date(patient.cycle.end) - TODAY) / 86400000);
      let warning = null;
      if (stock.onHand < needed) warning = `Short by ${needed - stock.onHand} — order before picking`;
      else if (expiryDays <= cycleEndDays) warning = `Batch expires before cycle ends — use alternative batch`;
      return {
        name: m.name, strength: m.strength, form: m.form,
        needed, onHand: stock.onHand, batch: stock.batch, expiry: stock.expiry,
        location: stock.location, expiryDays,
        fefoOk: !warning, warning,
      };
    });
}

// ---------------------------------------------------------------- repeat dosette AI
export function suggestRepeatCycle(patient) {
  const last = patient.cycle;
  const nextStart = addDays(new Date(last.end), 1);
  const nextEnd = addDays(nextStart, last.lengthDays - 1);
  const picking = getPickingList(patient);
  const stockWarnings = picking.filter((p) => p.warning);
  const scheduleChanged = patient.meds.some((m) =>
    m.changes.some((c) => new Date(c.at) >= addDays(TODAY, -30)));
  const checks = [];
  checks.push({
    tone: "info", title: "Suggested next cycle",
    detail: `${ddmonyyyy(nextStart)} → ${ddmonyyyy(nextEnd)} (${last.lengthDays}-day cycle).`,
    confidence: 0.97, reasoning: "Continues from the current cycle end date with the same cycle length.",
  });
  checks.push(
    scheduleChanged
      ? { tone: "warning", title: "Medication schedule changed recently", detail: "One or more items changed in the last 30 days — review before repeating.", confidence: 0.88, reasoning: "Recent entries found in the medication audit trail." }
      : { tone: "success", title: "No recent schedule changes", detail: "Regimen is stable since the last cycle.", confidence: 0.9, reasoning: "No medication audit entries in the last 30 days." }
  );
  stockWarnings.forEach((w) =>
    checks.push({ tone: "danger", title: `Stock issue — ${w.name} ${w.strength}`, detail: w.warning, confidence: 0.8, reasoning: "Projected requirement compared against on-hand stock and batch expiry (FEFO)." })
  );
  if (stockWarnings.length === 0)
    checks.push({ tone: "success", title: "Stock available", detail: "All items have sufficient in-date stock for the next cycle.", confidence: 0.82, reasoning: "On-hand stock covers projected requirement with in-date batches." });

  return {
    nextCycle: { start: iso(nextStart), end: iso(nextEnd), lengthDays: last.lengthDays },
    checks,
    note: "AI-drafted next cycle for review. Confirm before saving — AI never changes clinical data automatically.",
  };
}

export const fmtDate = ddmonyyyy;
export const TODAY_ISO = iso(TODAY);
export { PERIODS };
