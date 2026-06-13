/**
 * AI client — single surface the UI talks to.
 *
 * Each method tries the live backend first, then falls back to the local
 * explainable engine so the AI Suite is fully functional today. When you build
 * the server side, implement these endpoints and the UI upgrades automatically:
 *
 *   POST /api/ai/copilot/          { query }            -> intent result
 *   POST /api/ai/safety-check/     { patient_id }       -> safety result
 *   GET  /api/ai/reorder/                               -> reorder + waste
 *   POST /api/ai/intake/parse/     { text }             -> parsed schedule
 *   GET  /api/ai/insights/                              -> hub tiles
 *
 * The response shapes match the engine's outputs in aiEngine.js exactly.
 */
import api from "../api/client";
import {
  runCopilot,
  runSafetyCheck,
  runReorderSuggestions,
  runIntakeParse,
  runInsights,
  runDailyBrief,
  PATIENTS,
} from "./aiEngine";

// Small, deliberate latency so loading states read as "thinking", not laggy.
const think = (value, ms = 480) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

async function tryBackend(fn) {
  try {
    const res = await fn();
    return { ok: true, data: res.data, live: true };
  } catch {
    return { ok: false };
  }
}

export async function copilot(query) {
  const backend = await tryBackend(() => api.post("/ai/copilot/", { query }));
  if (backend.ok) return { ...backend.data, live: true };
  return think({ ...runCopilot(query), live: false });
}

export async function safetyCheck(patientId) {
  const backend = await tryBackend(() => api.post("/ai/safety-check/", { patient_id: patientId }));
  if (backend.ok) return { ...backend.data, live: true };
  const patient = PATIENTS.find((p) => p.id === patientId) || PATIENTS[0];
  return think({ ...runSafetyCheck(patient), live: false }, 620);
}

export async function reorder() {
  const backend = await tryBackend(() => api.get("/ai/reorder/"));
  if (backend.ok) return { ...backend.data, live: true };
  return think({ ...runReorderSuggestions(), live: false }, 560);
}

export async function intakeParse(text) {
  const backend = await tryBackend(() => api.post("/ai/intake/parse/", { text }));
  if (backend.ok) return { ...backend.data, live: true };
  return think({ ...runIntakeParse(text), live: false }, 700);
}

export async function insights() {
  const backend = await tryBackend(() => api.get("/ai/insights/"));
  if (backend.ok) return { ...backend.data, live: true };
  return think({ ...runInsights(), live: false }, 300);
}

export async function dailyBrief() {
  const backend = await tryBackend(() => api.get("/ai/daily-brief/"));
  if (backend.ok) return { ...backend.data, live: true };
  return think({ ...runDailyBrief(), live: false }, 520);
}

// Patients list for selectors (live patients endpoint when present, else sample).
export async function listPatients() {
  const backend = await tryBackend(() => api.get("/patients/"));
  if (backend.ok && Array.isArray(backend.data?.results || backend.data)) {
    const rows = backend.data.results || backend.data;
    if (rows.length) return rows;
  }
  return PATIENTS;
}

export default { copilot, safetyCheck, reorder, intakeParse, insights, dailyBrief, listPatients };
