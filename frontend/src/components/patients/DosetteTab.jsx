/**
 * DosetteTab — the dosette workspace inside a patient record.
 *
 * Improved tray (one column per time slot, med + strength + dose×qty + time,
 * icon + colour band so colour is never the only signal), 8-state preparation
 * workflow with a timeline, repeat-cycle AI (human-confirmed), the patient's own
 * picking list (FEFO batch + stock/expiry warnings), and a clean printable tray
 * label. Simulated data — academic demonstration, not clinical advice.
 */
import { useState } from "react";
import {
  RefreshCw, Printer, Clock, Sunrise, Sun, Sunset, Moon, ClipboardList,
  AlertTriangle, CheckCircle2, Info, ShieldAlert, X, Check, ArrowRight,
} from "lucide-react";
import { Card, Button, StatusChip, useToast, cx } from "../ui";
import {
  getTray, getPickingList, suggestRepeatCycle, WORKFLOW_STATUSES, STATUS_TONE,
  PERIODS, fmtDate,
} from "../../services/patientData";

const PERIOD_META = {
  Morning: { icon: Sunrise, band: "bg-warning", soft: "bg-warning-bg", fg: "text-warning-fg", time: "08:00" },
  Afternoon: { icon: Sun, band: "bg-info", soft: "bg-info-bg", fg: "text-info-fg", time: "12:00" },
  Evening: { icon: Sunset, band: "bg-accent", soft: "bg-accent-soft", fg: "text-accent", time: "18:00" },
  Bedtime: { icon: Moon, band: "bg-text-secondary", soft: "bg-subtle", fg: "text-text-secondary", time: "22:00" },
};
const CHECK_ICON = { success: CheckCircle2, info: Info, warning: AlertTriangle, danger: ShieldAlert };
const DOT = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", info: "bg-info", neutral: "bg-text-tertiary" };

export default function DosetteTab({ patient }) {
  const toast = useToast();
  const [status, setStatus] = useState(patient.workflow.status);
  const [history, setHistory] = useState(patient.workflow.history);
  const [repeat, setRepeat] = useState(null);

  // Reset local state if a different patient is shown in the same modal.
  const [pid, setPid] = useState(patient.id);
  if (patient.id !== pid) {
    setPid(patient.id);
    setStatus(patient.workflow.status);
    setHistory(patient.workflow.history);
    setRepeat(null);
  }

  const tray = getTray(patient);
  const picking = getPickingList(patient);
  const issues = picking.filter((p) => p.warning).length;

  const advance = (next) => {
    setStatus(next);
    setHistory((h) => [...h, { status: next, at: new Date().toISOString().slice(0, 10), staff: "You", note: "" }]);
    toast?.success(`Status → ${next}`);
  };
  const confirmRepeat = () => {
    toast?.success("Next dosette cycle drafted for review");
    advance("Picking required");
    setRepeat(null);
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setRepeat(suggestRepeatCycle(patient))}><RefreshCw size={16} /> Repeat dosette</Button>
        <Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print tray label</Button>
        <div className="ms-auto flex items-center gap-2">
          <label htmlFor="wf-status" className="text-caption text-text-secondary">Preparation</label>
          <select
            id="wf-status" value={status} onChange={(e) => advance(e.target.value)}
            className="h-9 rounded-md border border-border-strong bg-surface px-2.5 text-body focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring"
          >
            {WORKFLOW_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-caption text-text-tertiary">
        <Clock size={13} aria-hidden="true" />
        Cycle {fmtDate(patient.cycle.start)} → {fmtDate(patient.cycle.end)} · {patient.cycle.lengthDays} days
        <StatusChip tone={STATUS_TONE[status]} icon={false}>{status}</StatusChip>
        {issues > 0 && <StatusChip tone="danger">{issues} picking issue{issues > 1 ? "s" : ""}</StatusChip>}
      </div>

      {/* Tray */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tray.map(({ period, items }) => {
          const m = PERIOD_META[period];
          return (
            <section key={period} className="overflow-hidden rounded-xl border border-border-subtle bg-surface" aria-label={`${period} slot`}>
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
                  items.map((it) => (
                    <div key={`${it.name}-${it.strength}`} className="rounded-lg bg-subtle px-3 py-2">
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

      {/* Patient picking list */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5">
          <ClipboardList size={16} className="text-accent" aria-hidden="true" />
          <h4 className="text-subtitle font-semibold">Picking list for this cycle</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead className="bg-subtle text-left text-caption text-text-secondary">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                <th>Medicine</th><th className="text-right">Need</th><th className="text-right">On hand</th>
                <th>Batch (FEFO)</th><th>Expiry</th><th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {picking.map((p) => (
                <tr key={`${p.name}-${p.strength}`} className="align-top">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-text-primary">{p.name} {p.strength}</div>
                    <div className="text-caption text-text-tertiary">{p.form} · loc {p.location}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right tnum font-semibold">{p.needed}</td>
                  <td className={cx("px-3 py-2.5 text-right tnum", p.onHand < p.needed && "font-semibold text-danger-fg")}>{p.onHand}</td>
                  <td className="px-3 py-2.5 tnum">{p.batch}</td>
                  <td className="px-3 py-2.5 tnum">{fmtDate(p.expiry)}<span className="block text-caption text-text-tertiary">{p.expiryDays}d</span></td>
                  <td className="px-3 py-2.5">
                    {p.warning ? <StatusChip tone="danger">{p.warning}</StatusChip> : <StatusChip tone="success">FEFO OK</StatusChip>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Workflow timeline */}
      <Card className="p-4">
        <h4 className="mb-2 text-micro uppercase text-text-tertiary">Preparation history</h4>
        <ol className="space-y-2">
          {history.slice().reverse().map((h, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className={cx("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", DOT[STATUS_TONE[h.status]] || DOT.neutral)} aria-hidden="true" />
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
      </Card>

      {/* Repeat-cycle AI review */}
      {repeat && (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-4 animate-slide-up">
          <div className="mb-2 flex items-center gap-2">
            <RefreshCw size={16} className="text-accent" aria-hidden="true" />
            <h4 className="text-subtitle font-semibold text-text-primary">Repeat dosette — AI draft</h4>
          </div>
          <div className="space-y-2">
            {repeat.checks.map((c, i) => {
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
          <p className="mt-2 text-caption text-text-tertiary">{repeat.note}</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRepeat(null)}><X size={15} /> Cancel</Button>
            <Button onClick={confirmRepeat}><Check size={15} /> Confirm &amp; draft cycle <ArrowRight size={14} /></Button>
          </div>
        </div>
      )}

      {/* Printable patient-facing label (hidden on screen) */}
      <PrintLabel patient={patient} tray={tray} />
    </div>
  );
}

function PrintLabel({ patient, tray }) {
  return (
    <div id="pm-print-root" className="hidden print:block">
      <div className="pm-label">
        <div className="pm-label-head">
          <div>
            <div className="pm-label-name">{patient.title} {patient.name}</div>
            <div className="pm-label-sub">DOB {fmtDate(patient.dob)} · {patient.id}</div>
          </div>
          <div className="pm-label-cycle">
            <div>Cycle: {fmtDate(patient.cycle.start)} – {fmtDate(patient.cycle.end)}</div>
            <div>{patient.packType}</div>
          </div>
        </div>

        {PERIODS.map((period) => {
          const row = tray.find((t) => t.period === period);
          const meta = PERIOD_META[period];
          return (
            <div key={period} className="pm-label-period">
              <div className="pm-label-period-name">{period}<span className="pm-label-period-time">{meta.time}</span></div>
              <div className="pm-label-meds">
                {row.items.length === 0
                  ? <span className="pm-label-none">None</span>
                  : row.items.map((it) => (
                      <div key={`${it.name}-${it.strength}`} className="pm-label-med">
                        <div className="pm-label-med-line">
                          <strong>{it.name} {it.strength}</strong> — {it.qty} {it.form.toLowerCase()}{it.qty > 1 ? "s" : ""}
                        </div>
                        {it.instruction && <div className="pm-label-med-dir">{it.instruction}</div>}
                        {it.appearance && (
                          <div className="pm-label-med-look">
                            Appearance: {[it.appearance.colour, it.appearance.shape, it.form].filter(Boolean).join(" · ")}
                            {it.appearance.imprint ? ` · marking “${it.appearance.imprint}”` : ""}
                          </div>
                        )}
                      </div>
                    ))}
              </div>
            </div>
          );
        })}

        <div className="pm-label-foot">
          Take as directed. Keep out of reach and sight of children. Medication appearance is provided for
          identification support only and may vary between manufacturers — not a substitute for professional advice.
        </div>
      </div>
    </div>
  );
}
