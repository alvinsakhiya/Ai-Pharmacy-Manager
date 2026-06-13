/**
 * PatientRecord — tabbed record where staff manage everything for one patient.
 *
 * Tabs: Patient · Doctor · Medication · Dosette · Picking · History · Notes.
 * The Dosette tab is the hub: improved tray, repeat-cycle AI, workflow status and
 * a patient-facing printable label. Accessible tabs (role=tablist), keyboard
 * operable, colour never the sole signal (icon + label everywhere).
 *
 * Simulated data — academic demonstration only, not clinical advice.
 */
import { useState } from "react";
import {
  User, Stethoscope, Pill, LayoutGrid, ClipboardList, History, StickyNote,
  Printer, RefreshCw, Sunrise, Sun, Sunset, Moon, Package, AlertTriangle,
  CheckCircle2, Info, ShieldAlert, MapPin, CalendarClock, Clock, X, Check,
} from "lucide-react";
import { Card, Button, StatusChip, EmptyState, Modal, useToast, cx } from "../ui";
import {
  getTray, getPickingList, suggestRepeatCycle, WORKFLOW_STATUSES, STATUS_TONE,
  fmtDate, PERIODS,
} from "../../services/patientData";

const TABS = [
  { id: "patient", label: "Patient", icon: User },
  { id: "doctor", label: "Doctor", icon: Stethoscope },
  { id: "medication", label: "Medication", icon: Pill },
  { id: "dosette", label: "Dosette", icon: LayoutGrid },
  { id: "picking", label: "Picking", icon: ClipboardList },
  { id: "history", label: "History", icon: History },
  { id: "notes", label: "Notes", icon: StickyNote },
];

const PERIOD_META = {
  Morning: { icon: Sunrise, band: "bg-warning", soft: "bg-warning-bg", fg: "text-warning-fg", time: "08:00" },
  Afternoon: { icon: Sun, band: "bg-info", soft: "bg-info-bg", fg: "text-info-fg", time: "12:00" },
  Evening: { icon: Sunset, band: "bg-accent", soft: "bg-accent-soft", fg: "text-accent", time: "18:00" },
  Bedtime: { icon: Moon, band: "bg-text-secondary", soft: "bg-subtle", fg: "text-text-secondary", time: "22:00" },
};

const KV = ({ label, value }) => (
  <div className="rounded-xl bg-subtle p-3">
    <div className="text-caption text-text-secondary">{label}</div>
    <div className="text-body font-semibold text-text-primary">{value || "—"}</div>
  </div>
);

export default function PatientRecord({ patient, open, onClose }) {
  const toast = useToast();
  const [tab, setTab] = useState("dosette");
  const [status, setStatus] = useState(patient?.workflow.status);
  const [history, setHistory] = useState(patient?.workflow.history || []);
  const [repeat, setRepeat] = useState(null);

  // Re-sync when a different patient opens.
  const [pid, setPid] = useState(patient?.id);
  if (patient && patient.id !== pid) {
    setPid(patient.id);
    setStatus(patient.workflow.status);
    setHistory(patient.workflow.history);
    setRepeat(null);
    setTab("dosette");
  }

  if (!open || !patient) return null;

  const tray = getTray(patient);
  const picking = getPickingList(patient);
  const pickingIssues = picking.filter((p) => p.warning).length;

  const advanceStatus = (next) => {
    setStatus(next);
    setHistory((h) => [...h, { status: next, at: new Date().toISOString().slice(0, 10), staff: "You", note: "" }]);
    toast?.success(`Status → ${next}`);
  };

  const runRepeat = () => setRepeat(suggestRepeatCycle(patient));
  const confirmRepeat = () => {
    toast?.success("Next dosette cycle drafted for review");
    advanceStatus("Picking required");
    setRepeat(null);
  };

  return (
    <Modal open={open} onClose={onClose} wide title={`${patient.name} · ${patient.id}`}>
      {/* Identity strip */}
      <div className="pm-no-print mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-subtle px-4 py-2.5 text-caption text-text-secondary">
        <span className="inline-flex items-center gap-1"><CalendarClock size={13} aria-hidden="true" /> DOB {fmtDate(patient.dob)} ({patient.age})</span>
        <span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden="true" /> {patient.postcode}</span>
        <span className="inline-flex items-center gap-1"><Package size={13} aria-hidden="true" /> {patient.packType}</span>
        {patient.allergies.length > 0 ? (
          <StatusChip tone="warning">Allergy: {patient.allergies.join(", ")}</StatusChip>
        ) : (
          <StatusChip tone="success" icon={false}>No known allergies</StatusChip>
        )}
        <StatusChip tone={STATUS_TONE[status]} icon={false}>{status}</StatusChip>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Patient record" className="pm-no-print mb-4 flex gap-1 overflow-x-auto border-b border-border-subtle">
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              className={cx(
                "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-body font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent-ring",
                on ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-text-primary"
              )}
            >
              <t.icon size={16} aria-hidden="true" />
              {t.label}
              {t.id === "picking" && pickingIssues > 0 && (
                <span className="ml-0.5 rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white" aria-label={`${pickingIssues} issues`}>{pickingIssues}</span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="pm-no-print">
        {tab === "patient" && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <KV label="Full name" value={patient.name} />
            <KV label="Patient ID" value={patient.id} />
            <KV label="Date of birth" value={`${fmtDate(patient.dob)} (${patient.age})`} />
            <KV label="Phone" value={patient.phone} />
            <KV label="Postcode" value={patient.postcode} />
            <KV label="Care setting" value={patient.careSetting} />
            <KV label="Address" value={patient.address} />
            <KV label="Pack type" value={patient.packType} />
            <KV label="Allergies" value={patient.allergies.join(", ") || "None recorded"} />
          </div>
        )}

        {tab === "doctor" && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <KV label="Prescriber" value={patient.doctor.name} />
            <KV label="Practice" value={patient.doctor.practice} />
            <KV label="Practice phone" value={patient.doctor.phone} />
            <KV label="Practice address" value={patient.doctor.address} />
          </div>
        )}

        {tab === "medication" && <Medication patient={patient} />}

        {tab === "dosette" && (
          <Dosette
            patient={patient} tray={tray} status={status} history={history}
            onAdvance={advanceStatus} onRepeat={runRepeat} onPrint={() => window.print()}
            pickingIssues={pickingIssues}
          />
        )}

        {tab === "picking" && <Picking picking={picking} cycleDays={patient.cycle.lengthDays} />}

        {tab === "history" && (
          <ol className="space-y-2">
            {history.slice().reverse().map((h, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-border-subtle p-3">
                <span className={cx("mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
                  { success: "bg-success", warning: "bg-warning", danger: "bg-danger", info: "bg-info", neutral: "bg-text-tertiary" }[STATUS_TONE[h.status]])} aria-hidden="true" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-body font-medium text-text-primary">{h.status}</span>
                    <span className="text-caption text-text-tertiary tnum">{fmtDate(h.at)}</span>
                  </div>
                  <div className="text-caption text-text-tertiary">{h.staff}{h.note ? ` · ${h.note}` : ""}</div>
                </div>
              </li>
            ))}
          </ol>
        )}

        {tab === "notes" && (
          patient.notes.length === 0
            ? <EmptyState icon={StickyNote} title="No notes" hint="Clinical and operational notes for this patient appear here." />
            : <ul className="space-y-2">
                {patient.notes.map((n, i) => (
                  <li key={i} className="rounded-xl border border-border-subtle p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <StatusChip tone="neutral" icon={false}>{n.category}</StatusChip>
                      <span className="text-caption text-text-tertiary">{fmtDate(n.at)} · {n.staff}</span>
                    </div>
                    <p className="text-body">{n.text}</p>
                  </li>
                ))}
              </ul>
        )}
      </div>

      {/* Repeat-dosette review panel */}
      {repeat && (
        <RepeatPanel data={repeat} onConfirm={confirmRepeat} onCancel={() => setRepeat(null)} />
      )}

      {/* Patient-facing printable label (hidden on screen, shown only when printing) */}
      <PrintLabel patient={patient} tray={tray} />
    </Modal>
  );
}

/* ----------------------------------------------------------------- Dosette tab */
function Dosette({ patient, tray, status, onAdvance, onRepeat, onPrint, pickingIssues }) {
  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onRepeat}><RefreshCw size={16} /> Repeat dosette</Button>
        <Button variant="secondary" onClick={onPrint}><Printer size={16} /> Print tray label</Button>
        <div className="ms-auto flex items-center gap-2">
          <label htmlFor="wf" className="text-caption text-text-secondary">Status</label>
          <select
            id="wf" value={status} onChange={(e) => onAdvance(e.target.value)}
            className="h-9 rounded-md border border-border-strong bg-surface px-2.5 text-body focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring"
          >
            {WORKFLOW_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-caption text-text-tertiary">
        <Clock size={13} aria-hidden="true" />
        Cycle {fmtDate(patient.cycle.start)} → {fmtDate(patient.cycle.end)} · {patient.cycle.lengthDays} days
        {pickingIssues > 0 && <StatusChip tone="danger">{pickingIssues} picking issue{pickingIssues > 1 ? "s" : ""}</StatusChip>}
      </div>

      {/* Tray — one column per period */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tray.map(({ period, items }) => {
          const m = PERIOD_META[period];
          return (
            <section key={period} className="overflow-hidden rounded-xl border border-border-subtle bg-surface" aria-label={period}>
              <header className={cx("flex items-center gap-2 px-3 py-2", m.soft)}>
                <m.icon size={16} className={m.fg} aria-hidden="true" />
                <span className={cx("text-body font-semibold", m.fg)}>{period}</span>
                <span className="ms-auto text-caption text-text-tertiary tnum">{m.time}</span>
              </header>
              <div className={cx("h-1", m.band)} aria-hidden="true" />
              <div className="space-y-2 p-3">
                {items.length === 0 ? (
                  <p className="py-2 text-center text-caption text-text-tertiary">— None —</p>
                ) : (
                  items.map((it, i) => (
                    <div key={i} className="rounded-lg bg-subtle px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-body font-semibold text-text-primary">{it.name}</span>
                        <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-caption font-semibold text-text-primary tnum">×{it.qty}</span>
                      </div>
                      <div className="text-caption text-text-secondary">{it.strength} · {it.form}</div>
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Medication tab */
function Medication({ patient }) {
  const [openId, setOpenId] = useState(null);
  return (
    <div className="space-y-2.5">
      {patient.meds.map((m) => {
        const expanded = openId === m.id;
        return (
          <Card key={m.id} className="overflow-hidden">
            <button
              onClick={() => setOpenId(expanded ? null : m.id)}
              aria-expanded={expanded}
              className="flex w-full items-center gap-3 p-3.5 text-left hover:bg-subtle focus-visible:ring-2 focus-visible:ring-accent-ring"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent" aria-hidden="true"><Pill size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-semibold text-text-primary">{m.name} {m.strength}</span>
                  <StatusChip tone={m.status === "Active" ? "success" : "neutral"} icon={false}>{m.status}</StatusChip>
                </span>
                <span className="block truncate text-caption text-text-secondary">{m.instruction}</span>
              </span>
              <span className="shrink-0 text-caption text-text-tertiary tnum">{m.quantityPerDay}/day</span>
            </button>
            {expanded && (
              <div className="border-t border-border-subtle p-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <KV label="Form" value={m.form} />
                  <KV label="Quantity / day" value={m.quantityPerDay} />
                  <KV label="Start date" value={fmtDate(m.startDate)} />
                  <KV label="End date" value={fmtDate(m.endDate)} />
                  <KV label="Created by" value={m.createdBy} />
                  <KV label="Last updated" value={fmtDate(m.updatedAt)} />
                </div>
                <div className="mt-3 rounded-xl bg-subtle p-3">
                  <div className="text-micro uppercase text-text-tertiary">Appearance (identification)</div>
                  <div className="mt-1 text-body text-text-secondary">
                    {m.appearance.colour} · {m.appearance.shape} · imprint “{m.appearance.imprint}” — {m.appearance.description}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-micro uppercase text-text-tertiary">Change history</div>
                  {m.audit.length === 0 ? (
                    <p className="text-caption text-text-tertiary">No changes recorded.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {m.audit.map((a, i) => (
                        <li key={i} className="flex items-center gap-2 text-caption text-text-secondary">
                          <History size={13} aria-hidden="true" />
                          <span className="tnum">{fmtDate(a.at)}</span> · {a.staff} · {a.change}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- Picking tab */
function Picking({ picking, cycleDays }) {
  return (
    <div className="space-y-3">
      <p className="text-caption text-text-tertiary">Quantities for a {cycleDays}-day cycle, with FEFO batch suggestion and stock check.</p>
      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="w-full text-body">
          <thead className="bg-subtle text-left text-caption text-text-secondary">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th>Medicine</th><th className="text-right">Need</th><th className="text-right">On hand</th>
              <th>Batch (FEFO)</th><th>Expiry</th><th>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {picking.map((p, i) => (
              <tr key={i} className="align-top">
                <td className="px-3 py-2.5">
                  <div className="font-medium text-text-primary">{p.name} {p.strength}</div>
                  <div className="text-caption text-text-tertiary">{p.form} · loc {p.location}</div>
                </td>
                <td className="px-3 py-2.5 text-right tnum font-semibold">{p.needed}</td>
                <td className={cx("px-3 py-2.5 text-right tnum", p.onHand < p.needed && "text-danger-fg font-semibold")}>{p.onHand}</td>
                <td className="px-3 py-2.5 tnum">{p.batch}</td>
                <td className="px-3 py-2.5 tnum">{fmtDate(p.expiry)}<span className="block text-caption text-text-tertiary">{p.expiryDays}d</span></td>
                <td className="px-3 py-2.5">
                  {p.warning
                    ? <StatusChip tone="danger">{p.warning}</StatusChip>
                    : <StatusChip tone="success">FEFO OK</StatusChip>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Repeat panel */
const CHECK_ICON = { success: CheckCircle2, info: Info, warning: AlertTriangle, danger: ShieldAlert };
function RepeatPanel({ data, onConfirm, onCancel }) {
  return (
    <div className="pm-no-print mt-4 rounded-2xl border border-accent/30 bg-accent-soft/40 p-4 animate-slide-up">
      <div className="mb-2 flex items-center gap-2">
        <RefreshCw size={16} className="text-accent" aria-hidden="true" />
        <h3 className="text-subtitle font-semibold text-text-primary">Repeat dosette — AI draft</h3>
      </div>
      <div className="space-y-2">
        {data.checks.map((c, i) => {
          const Icon = CHECK_ICON[c.tone] || Info;
          return (
            <div key={i} className="rounded-xl border border-border-subtle bg-surface p-3">
              <div className="flex items-start gap-2">
                <Icon size={16} className={{ success: "text-success-fg", info: "text-info-fg", warning: "text-warning-fg", danger: "text-danger-fg" }[c.tone]} aria-hidden="true" />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-body font-medium text-text-primary">{c.title}</span>
                    <span className="text-caption text-text-tertiary">conf. {Math.round(c.confidence * 100)}%</span>
                  </div>
                  <p className="text-caption text-text-secondary">{c.detail}</p>
                  <p className="mt-1 text-caption text-text-tertiary"><span className="font-medium">Why:</span> {c.reasoning}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-caption text-text-tertiary">{data.note}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}><X size={15} /> Cancel</Button>
        <Button onClick={onConfirm}><Check size={15} /> Confirm &amp; draft cycle</Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Print label */
function PrintLabel({ patient, tray }) {
  return (
    <div id="pm-print-root" className="hidden print:block">
      <div className="pm-label">
        <div className="pm-label-head">
          <div>
            <div className="pm-label-name">{patient.name}</div>
            <div className="pm-label-sub">DOB {fmtDate(patient.dob)} · {patient.id}</div>
          </div>
          <div className="pm-label-cycle">
            <div>Cycle: {fmtDate(patient.cycle.start)} – {fmtDate(patient.cycle.end)}</div>
            <div>{patient.packType}</div>
          </div>
        </div>

        {PERIODS.map((period) => {
          const row = tray.find((t) => t.period === period);
          return (
            <div key={period} className="pm-label-period">
              <div className="pm-label-period-name">{period}</div>
              <div className="pm-label-meds">
                {row.items.length === 0
                  ? <span className="pm-label-none">None</span>
                  : row.items.map((it, i) => (
                      <div key={i} className="pm-label-med">
                        <strong>{it.name} {it.strength}</strong> — {it.qty} {it.form.toLowerCase()}{it.qty > 1 ? "s" : ""}
                      </div>
                    ))}
              </div>
            </div>
          );
        })}

        <div className="pm-label-foot">
          Take as directed. Keep out of reach of children. For identification support only — not a substitute for professional advice.
        </div>
      </div>
    </div>
  );
}
