/**
 * Explainable AI engine — client-side, deterministic, transparent.
 *
 * Philosophy (matches the backend forecasting engine): this is a *decision-support*
 * aid, not a clinical decision-maker. Every result reports WHY it was produced so a
 * trained pharmacist stays in control. It runs entirely in the browser over neutral
 * sample data, so the whole AI Suite is demonstrable today; `aiClient.js` upgrades
 * each call to the live `/api/ai/*` backend when those endpoints exist.
 *
 * No NHS branding, data, or integration anywhere — prescriptions simply exist as inputs.
 */

const TODAY = new Date("2026-06-13T09:00:00");
const day = (offset) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offset);
  return d;
};
const iso = (d) => d.toISOString().slice(0, 10);
const fmt = (d) =>
  d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/* ------------------------------------------------------------------ sample data */
// Neutral, invented content per the product's data conventions.
export const PATIENTS = [
  {
    id: "PT-10428",
    name: "Margaret Hayes",
    setting: "Care home",
    packType: "Monthly compliance pack",
    dueDate: iso(day(1)),
    meds: [
      { name: "Amlodipine", strength: "5mg", form: "tablet", slots: ["Morning"], dose: 1 },
      { name: "Atorvastatin", strength: "20mg", form: "tablet", slots: ["Night"], dose: 1 },
      { name: "Metformin", strength: "500mg", form: "tablet", slots: ["Morning", "Evening"], dose: 1 },
      { name: "Ramipril", strength: "5mg", form: "capsule", slots: ["Morning"], dose: 1 },
    ],
  },
  {
    id: "PT-10915",
    name: "David Okafor",
    setting: "Community",
    packType: "Weekly compliance pack",
    dueDate: iso(day(3)),
    meds: [
      { name: "Levothyroxine", strength: "50mcg", form: "tablet", slots: ["Morning"], dose: 1 },
      { name: "Omeprazole", strength: "20mg", form: "capsule", slots: ["Morning"], dose: 1 },
      { name: "Sertraline", strength: "50mg", form: "tablet", slots: ["Morning"], dose: 1 },
    ],
  },
  {
    id: "PT-11203",
    name: "Priya Sharma",
    setting: "Community",
    packType: "Monthly compliance pack",
    dueDate: iso(day(0)),
    meds: [
      { name: "Ramipril", strength: "5mg", form: "capsule", slots: ["Morning"], dose: 1 },
      { name: "Atorvastatin", strength: "40mg", form: "tablet", slots: ["Night"], dose: 1 },
      { name: "Metformin", strength: "500mg", form: "tablet", slots: ["Morning", "Evening"], dose: 1 },
    ],
  },
  {
    id: "PT-11876",
    name: "Thomas Reilly",
    setting: "Care home",
    packType: "Monthly compliance pack",
    dueDate: iso(day(-1)),
    meds: [
      { name: "Amlodipine", strength: "10mg", form: "tablet", slots: ["Morning"], dose: 1 },
      { name: "Sertraline", strength: "100mg", form: "tablet", slots: ["Morning"], dose: 1 },
      { name: "Omeprazole", strength: "20mg", form: "capsule", slots: ["Morning"], dose: 1 },
    ],
  },
  {
    id: "PT-12044",
    name: "Aisha Bello",
    setting: "Community",
    packType: "Weekly compliance pack",
    dueDate: iso(day(4)),
    meds: [
      { name: "Levothyroxine", strength: "100mcg", form: "tablet", slots: ["Morning"], dose: 1 },
      { name: "Amlodipine", strength: "5mg", form: "tablet", slots: ["Morning"], dose: 1 },
    ],
  },
];

export const INVENTORY = [
  { medicine: "Atorvastatin 20mg tab", batch: "B7741A", expiry: "2026-09-30", onHand: 1240, location: "A3", reorder: 300, weekly: 180, supplier: "Meridian Wholesale", leadTimeDays: 2, unitCost: 0.04 },
  { medicine: "Amlodipine 5mg tab", batch: "K2209C", expiry: iso(day(54)), onHand: 540, location: "A1", reorder: 250, weekly: 210, supplier: "Cawthorne Supply Co", leadTimeDays: 3, unitCost: 0.03 },
  { medicine: "Metformin 500mg tab", batch: "M4418D", expiry: "2027-02-28", onHand: 2980, location: "B2", reorder: 600, weekly: 520, supplier: "Meridian Wholesale", leadTimeDays: 2, unitCost: 0.02 },
  { medicine: "Omeprazole 20mg cap", batch: "O1187E", expiry: iso(day(11)), onHand: 90, location: "C4", reorder: 200, weekly: 160, supplier: "Cawthorne Supply Co", leadTimeDays: 3, unitCost: 0.05 },
  { medicine: "Ramipril 5mg cap", batch: "R3320F", expiry: iso(day(140)), onHand: 175, location: "A2", reorder: 220, weekly: 95, supplier: "Meridian Wholesale", leadTimeDays: 2, unitCost: 0.06 },
  { medicine: "Levothyroxine 50mcg tab", batch: "L8855G", expiry: iso(day(72)), onHand: 410, location: "B1", reorder: 150, weekly: 70, supplier: "Northgate Supplies", leadTimeDays: 4, unitCost: 0.07 },
  { medicine: "Sertraline 50mg tab", batch: "S6643H", expiry: iso(day(220)), onHand: 660, location: "C1", reorder: 200, weekly: 130, supplier: "Northgate Supplies", leadTimeDays: 4, unitCost: 0.05 },
];

/* ------------------------------------------------- clinical knowledge (neutral) */
// Compact, well-established interaction / timing rules for explainable flags.
// Decision-support only — staff verify against current references.
const INTERACTIONS = [
  {
    a: "Levothyroxine",
    b: "Omeprazole",
    severity: "warning",
    title: "Absorption timing — Levothyroxine + Omeprazole",
    detail:
      "Proton-pump inhibitors can reduce levothyroxine absorption. Separate administration and keep levothyroxine on an empty stomach, well before food.",
    action: "Schedule levothyroxine in a separate slot from omeprazole; flag for pharmacist timing review.",
  },
  {
    a: "Ramipril",
    b: "Metformin",
    severity: "info",
    title: "Renal monitoring — ACE inhibitor + Metformin",
    detail:
      "ACE inhibitors with metformin warrant periodic renal-function awareness, particularly in older or care-home patients.",
    action: "Confirm renal monitoring is current for this patient.",
  },
];

const DUPLICATE_CLASSES = {
  "ACE inhibitor": ["Ramipril"],
  Statin: ["Atorvastatin"],
  SSRI: ["Sertraline"],
};

// Typical maximum daily strengths used purely to surface a "review high dose" prompt.
const HIGH_DOSE = {
  Sertraline: { maxMg: 200, unit: "mg" },
  Amlodipine: { maxMg: 10, unit: "mg" },
  Atorvastatin: { maxMg: 80, unit: "mg" },
};

const strengthMg = (s) => {
  const m = /([\d.]+)\s*mg/i.exec(s || "");
  return m ? parseFloat(m[1]) : null;
};

/* ----------------------------------------------------------------- utilities */
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const daysUntil = (isoDate) => Math.round((new Date(isoDate) - TODAY) / 86400000);

/* ============================================================= SAFETY CHECK */
export function runSafetyCheck(patient) {
  const meds = patient.meds || [];
  const names = meds.map((m) => m.name);
  const checks = [];

  // 1. Interaction pairs
  INTERACTIONS.forEach((rule) => {
    if (names.includes(rule.a) && names.includes(rule.b)) {
      checks.push({
        kind: "Interaction",
        severity: rule.severity,
        title: rule.title,
        detail: rule.detail,
        action: rule.action,
      });
    }
  });

  // 2. Duplicate therapy within a class
  Object.entries(DUPLICATE_CLASSES).forEach(([cls, members]) => {
    const present = names.filter((n) => members.includes(n));
    if (present.length > 1) {
      checks.push({
        kind: "Duplicate therapy",
        severity: "danger",
        title: `Possible duplicate ${cls}`,
        detail: `${present.join(" and ")} both act as a ${cls}. Confirm this is intentional.`,
        action: "Pharmacist to verify single-agent intent before assembly.",
      });
    }
  });

  // 3. High-dose review
  meds.forEach((m) => {
    const limit = HIGH_DOSE[m.name];
    const mg = strengthMg(m.strength);
    const perDay = mg ? mg * (m.dose || 1) * (m.slots?.length || 1) : null;
    if (limit && perDay && perDay >= limit.maxMg) {
      checks.push({
        kind: "Dose review",
        severity: "warning",
        title: `${m.name} at ceiling dose`,
        detail: `${m.name} ${m.strength} × ${m.slots?.length || 1}/day reaches the typical maximum of ${limit.maxMg}${limit.unit}/day.`,
        action: "Confirm intended at maximum; no further uptitration without review.",
      });
    }
  });

  if (checks.length === 0) {
    checks.push({
      kind: "Clear",
      severity: "pass",
      title: "No flags detected",
      detail: "No interaction, duplicate-therapy, or dose concerns surfaced across this regimen.",
      action: "Proceed to pack assembly per normal workflow.",
    });
  }

  const rank = { danger: 3, warning: 2, info: 1, pass: 0 };
  const overall = checks.reduce((acc, c) => (rank[c.severity] > rank[acc] ? c.severity : acc), "pass");

  return {
    patient: { id: patient.id, name: patient.name, setting: patient.setting },
    medCount: meds.length,
    overall,
    checks,
    note:
      "Explainable decision-support. Flags are prompts to review, not instructions. Verify against current clinical references.",
  };
}

/* ========================================================== REORDER + WASTE */
export function runReorderSuggestions() {
  const items = INVENTORY.map((row) => {
    const weeksCover = row.weekly > 0 ? +(row.onHand / row.weekly).toFixed(1) : 99;
    const coverAtLead = row.onHand - (row.weekly / 7) * row.leadTimeDays;
    let urgency = "ok";
    if (row.onHand <= row.reorder || coverAtLead <= row.reorder * 0.5) urgency = "now";
    else if (weeksCover <= 3) urgency = "soon";
    // Target ~6 weeks cover, rounded to packs of 100.
    const target = Math.ceil((row.weekly * 6) / 100) * 100;
    const suggestedQty = urgency === "ok" ? 0 : Math.max(0, target - row.onHand);
    return {
      medicine: row.medicine,
      onHand: row.onHand,
      reorder: row.reorder,
      weekly: row.weekly,
      weeksCover,
      suggestedQty,
      supplier: row.supplier,
      leadTimeDays: row.leadTimeDays,
      urgency,
      rationale:
        urgency === "now"
          ? `On hand (${row.onHand}) at/under reorder level (${row.reorder}); ~${weeksCover}w cover. Lead time ${row.leadTimeDays}d.`
          : urgency === "soon"
          ? `~${weeksCover}w cover left at current run-rate (${row.weekly}/wk). Order ahead of the ${row.leadTimeDays}d lead time.`
          : `Healthy — ~${weeksCover}w cover, above reorder level.`,
    };
  });

  // Waste / expiry projection (FEFO): stock that will expire before it can be used.
  const waste = INVENTORY.map((row) => {
    const d = daysUntil(row.expiry);
    const projectedUse = Math.round((row.weekly / 7) * Math.max(0, d));
    const projectedWaste = Math.max(0, row.onHand - projectedUse);
    return {
      medicine: row.medicine,
      batch: row.batch,
      expiry: row.expiry,
      daysToExpiry: d,
      onHand: row.onHand,
      projectedUse,
      projectedWaste,
      value: +(projectedWaste * row.unitCost).toFixed(2),
    };
  }).filter((w) => w.daysToExpiry < 120 && w.projectedWaste > 0)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
    .map((w) => ({
      ...w,
      suggestion:
        w.daysToExpiry <= 14
          ? "Prioritise into upcoming packs or transfer; expiring imminently."
          : "Bring forward in FEFO rotation; avoid reordering until drawn down.",
    }));

  const orderNow = items.filter((i) => i.urgency !== "ok");
  return {
    generatedAt: TODAY.toISOString(),
    items,
    waste,
    summary: {
      toOrder: orderNow.length,
      orderUnits: orderNow.reduce((s, i) => s + i.suggestedQty, 0),
      wasteValue: +waste.reduce((s, w) => s + w.value, 0).toFixed(2),
      wasteUnits: waste.reduce((s, w) => s + w.projectedWaste, 0),
    },
  };
}

/* ============================================================ INTAKE PARSE */
const FORM_HINTS = [
  { re: /\bcap(sule)?s?\b/i, form: "capsule" },
  { re: /\btab(let)?s?\b/i, form: "tablet" },
];
const SLOT_HINTS = [
  { re: /\b(morning|mane|am|breakfast|before food)\b/i, slot: "Morning" },
  { re: /\b(noon|lunch|midday)\b/i, slot: "Noon" },
  { re: /\b(evening|tea|dinner|pm)\b/i, slot: "Evening" },
  { re: /\b(night|nocte|bed(time)?)\b/i, slot: "Night" },
];
const FREQ_SLOTS = {
  "once daily": ["Morning"],
  od: ["Morning"],
  "twice daily": ["Morning", "Evening"],
  bd: ["Morning", "Evening"],
  "three times": ["Morning", "Noon", "Evening"],
  tds: ["Morning", "Noon", "Evening"],
};

export function runIntakeParse(text) {
  const lines = (text || "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed = [];
  const unresolved = [];

  lines.forEach((line) => {
    const strengthMatch = /([\d.]+)\s*(mg|mcg|g|ml)\b/i.exec(line);
    const nameMatch = /^([A-Za-z][A-Za-z\- ]+?)\s+[\d.]/.exec(line);
    if (!nameMatch || !strengthMatch) {
      unresolved.push(line);
      return;
    }
    const name = nameMatch[1].trim();
    const strength = `${strengthMatch[1]}${strengthMatch[2].toLowerCase()}`;
    const form = (FORM_HINTS.find((f) => f.re.test(line)) || {}).form || "tablet";

    let slots = [];
    const freqKey = Object.keys(FREQ_SLOTS).find((k) => new RegExp(`\\b${k}\\b`, "i").test(line));
    if (freqKey) slots = FREQ_SLOTS[freqKey];
    SLOT_HINTS.forEach((s) => {
      if (s.re.test(line) && !slots.includes(s.slot)) slots.push(s.slot);
    });
    if (slots.length === 0) slots = ["Morning"];

    // confidence: name + strength + (explicit slot/freq) all present scores highest
    let confidence = 0.6;
    if (freqKey || SLOT_HINTS.some((s) => s.re.test(line))) confidence += 0.25;
    if (FORM_HINTS.some((f) => f.re.test(line))) confidence += 0.1;
    confidence = Math.min(0.99, +confidence.toFixed(2));

    const warnings = [];
    if (/levothyroxine/i.test(name)) warnings.push("Take before food, separated from other meds.");
    if (!freqKey && !SLOT_HINTS.some((s) => s.re.test(line)))
      warnings.push("Frequency not explicit — defaulted to Morning; confirm.");

    parsed.push({
      medicine: name,
      strength,
      form,
      slots,
      dose: 1,
      confidence,
      warnings,
      source: line,
    });
  });

  return {
    lineCount: lines.length,
    resolved: parsed.length,
    items: parsed,
    unresolved,
    note:
      "Parsed for review only. Every line must be confirmed by a pharmacist before it enters a pack. No external/branded source is implied.",
  };
}

/* ============================================================ CO-PILOT NLU */
// Lightweight, explainable intent routing over the in-app data.
export function runCopilot(query) {
  const q = (query || "").toLowerCase().trim();
  const has = (...words) => words.some((w) => q.includes(w));

  // due / schedule
  if (has("due", "schedule", "prep", "ahead")) {
    const wd = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].find((d) => q.includes(d));
    let items = [...PATIENTS].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    let scopeLabel = "next due";
    if (wd) {
      items = PATIENTS.filter((p) => fmt(new Date(p.dueDate)).toLowerCase().startsWith(wd.slice(0, 3)));
      scopeLabel = `due ${wd[0].toUpperCase()}${wd.slice(1)}`;
    }
    return {
      intent: "Pack due-date lookup",
      summary: `${items.length} ${items.length === 1 ? "pack" : "packs"} ${scopeLabel}.`,
      explanation: "Matched on due-date keywords; sorted by soonest due (proactive prep).",
      items: items.map((p) => ({
        title: p.name,
        subtitle: `${p.packType} · ${p.setting}`,
        meta: fmt(new Date(p.dueDate)),
        tone: daysUntil(p.dueDate) < 0 ? "danger" : daysUntil(p.dueDate) <= 1 ? "warning" : "info",
        to: "/picking",
      })),
      actions: [{ label: "Open picking lists", to: "/picking", tone: "primary" }],
    };
  }

  // low stock / order
  if (has("short", "low", "stock", "order", "reorder", "out of")) {
    const { items } = runReorderSuggestions();
    const low = items.filter((i) => i.urgency !== "ok");
    return {
      intent: "Low-stock & reorder",
      summary: `${low.length} ${low.length === 1 ? "line needs" : "lines need"} ordering.`,
      explanation: "Combined on-hand vs reorder level and run-rate cover against supplier lead time.",
      items: low.map((i) => ({
        title: i.medicine,
        subtitle: i.rationale,
        meta: i.suggestedQty ? `+${i.suggestedQty}` : "review",
        tone: i.urgency === "now" ? "danger" : "warning",
        to: "/ai/reorder",
      })),
      actions: [{ label: "Open Smart Reorder", to: "/ai/reorder", tone: "primary" }],
    };
  }

  // expiry / waste
  if (has("expiry", "expir", "waste", "fefo")) {
    const { waste } = runReorderSuggestions();
    return {
      intent: "Expiry & waste",
      summary: `${waste.length} ${waste.length === 1 ? "batch" : "batches"} at waste risk.`,
      explanation: "Projected unused stock before expiry at current run-rate (FEFO).",
      items: waste.map((w) => ({
        title: w.medicine,
        subtitle: `Batch ${w.batch} · ${w.projectedWaste} at risk · £${w.value}`,
        meta: `${w.daysToExpiry}d`,
        tone: w.daysToExpiry <= 14 ? "danger" : "warning",
        to: "/expiry",
      })),
      actions: [{ label: "Open expiry view", to: "/expiry", tone: "primary" }],
    };
  }

  // safety / interaction
  if (has("interaction", "safety", "interact", "duplicate", "clinical")) {
    const flagged = PATIENTS.map((p) => ({ p, r: runSafetyCheck(p) })).filter((x) => x.r.overall !== "pass");
    return {
      intent: "Clinical safety scan",
      summary: `${flagged.length} ${flagged.length === 1 ? "patient has" : "patients have"} flags to review.`,
      explanation: "Ran interaction, duplicate-therapy and dose rules across active regimens.",
      items: flagged.map(({ p, r }) => ({
        title: p.name,
        subtitle: r.checks[0].title,
        meta: r.overall,
        tone: r.overall,
        to: "/ai/safety",
      })),
      actions: [{ label: "Open Clinical Safety", to: "/ai/safety", tone: "primary" }],
    };
  }

  // patient lookup
  const patient = PATIENTS.find((p) => q.includes(p.name.toLowerCase().split(" ")[0]) || q.includes(p.id.toLowerCase()));
  if (patient) {
    return {
      intent: "Patient lookup",
      summary: `${patient.name} · ${patient.packType}`,
      explanation: "Matched a patient by name or ID.",
      items: [
        { title: "Medications", subtitle: patient.meds.map((m) => `${m.name} ${m.strength}`).join(", "), meta: `${patient.meds.length}`, tone: "neutral", to: "/patients" },
        { title: "Next pack due", subtitle: patient.setting, meta: fmt(new Date(patient.dueDate)), tone: daysUntil(patient.dueDate) <= 1 ? "warning" : "info", to: "/dosette" },
      ],
      actions: [
        { label: "Safety-check this patient", to: "/ai/safety", tone: "primary" },
        { label: "Open patient", to: "/patients", tone: "secondary" },
      ],
    };
  }

  // fallback: helpful suggestions
  return {
    intent: "Suggestions",
    summary: "Try one of these — I work over your live workspace.",
    explanation: "No specific intent matched; showing high-value starting points.",
    items: [
      { title: "What's due this week?", subtitle: "Proactive pack prep", meta: "due", tone: "info", to: null, prompt: "What packs are due this week?" },
      { title: "What's running short?", subtitle: "Low stock & reorder", meta: "stock", tone: "info", to: null, prompt: "What stock is running short?" },
      { title: "Any safety flags?", subtitle: "Interactions & duplicates", meta: "safety", tone: "info", to: null, prompt: "Show clinical safety flags" },
      { title: "What might we waste?", subtitle: "Expiry projection", meta: "waste", tone: "info", to: null, prompt: "What stock might we waste?" },
    ],
    actions: [{ label: "Open AI hub", to: "/ai", tone: "primary" }],
  };
}

/* live insight tiles for the AI hub */
export function runInsights() {
  const reorder = runReorderSuggestions();
  const safety = PATIENTS.map(runSafetyCheck);
  const flagged = safety.filter((s) => s.overall !== "pass").length;
  const dueSoon = PATIENTS.filter((p) => daysUntil(p.dueDate) <= 2).length;
  return {
    dueSoon,
    flagged,
    toOrder: reorder.summary.toOrder,
    wasteValue: reorder.summary.wasteValue,
  };
}

/* ========================================================== AI DAILY BRIEF */
// Aggregates the day's signals into one ranked, explainable operational to-do list.
export function runDailyBrief() {
  const tasks = [];

  // Pack due dates (proactive prep)
  PATIENTS.forEach((p) => {
    const d = daysUntil(p.dueDate);
    if (d > 4) return;
    const overdue = d < 0;
    tasks.push({
      id: `due-${p.id}`,
      category: "Dosette",
      title: overdue ? `Overdue pack — ${p.name}` : `Prepare pack — ${p.name}`,
      detail: `${p.packType} · ${p.setting} · due ${fmt(new Date(p.dueDate))}`,
      priority: overdue ? 96 + Math.min(4, -d) : 88 - d * 6,
      tone: overdue ? "danger" : d <= 1 ? "warning" : "info",
      confidence: 0.99,
      reasoning: overdue
        ? `Due date has passed by ${-d} day(s); compliance packs should never run late.`
        : `Due in ${d} day(s); prepare ahead so it is ready before the due date.`,
      action: { label: "Open picking", to: "/picking" },
    });
  });

  // Clinical safety flags
  PATIENTS.forEach((p) => {
    const r = runSafetyCheck(p);
    if (r.overall === "pass") return;
    const top = r.checks.find((c) => c.severity === r.overall) || r.checks[0];
    tasks.push({
      id: `safety-${p.id}`,
      category: "Clinical",
      title: `Review ${p.name} — ${top.kind.toLowerCase()}`,
      detail: top.title,
      priority: r.overall === "danger" ? 94 : r.overall === "warning" ? 76 : 58,
      tone: r.overall,
      confidence: 0.9,
      reasoning: top.detail,
      action: { label: "Open Clinical Safety", to: "/ai/safety" },
    });
  });

  // Stock to order
  const { items, waste } = runReorderSuggestions();
  items
    .filter((i) => i.urgency !== "ok")
    .forEach((i) => {
      tasks.push({
        id: `stock-${i.medicine}`,
        category: "Stock",
        title: `${i.urgency === "now" ? "Order now" : "Order soon"} — ${i.medicine}`,
        detail: `Suggest +${i.suggestedQty} from ${i.supplier} (${i.leadTimeDays}d lead)`,
        priority: i.urgency === "now" ? 86 : 66,
        tone: i.urgency === "now" ? "danger" : "warning",
        confidence: 0.8,
        reasoning: i.rationale,
        action: { label: "Open Smart Reorder", to: "/ai/reorder" },
      });
    });

  // Waste interventions
  waste
    .filter((w) => w.daysToExpiry <= 21 && w.projectedWaste > 0)
    .forEach((w) => {
      tasks.push({
        id: `waste-${w.batch}`,
        category: "Waste",
        title: `Prevent waste — ${w.medicine}`,
        detail: `Batch ${w.batch}: ${w.projectedWaste} at risk (£${w.value}) · ${w.daysToExpiry}d to expiry`,
        priority: w.daysToExpiry <= 14 ? 78 : 52,
        tone: w.daysToExpiry <= 14 ? "warning" : "info",
        confidence: 0.75,
        reasoning: w.suggestion,
        action: { label: "Open expiry view", to: "/expiry" },
      });
    });

  tasks.sort((a, b) => b.priority - a.priority);
  const byCat = tasks.reduce((acc, t) => ((acc[t.category] = (acc[t.category] || 0) + 1), acc), {});

  return {
    generatedAt: TODAY.toISOString(),
    dateLabel: fmt(TODAY),
    total: tasks.length,
    urgent: tasks.filter((t) => t.priority >= 85).length,
    byCategory: byCat,
    tasks,
    note:
      "AI-ranked operational summary — decision-support only. Priorities are computed from due dates, run-rate cover, expiry and clinical rules; confirm before acting.",
  };
}

export const _engineMeta = { delay, fmt, daysUntil, TODAY };
