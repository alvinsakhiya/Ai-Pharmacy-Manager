/**
 * Dosette — overview/dashboard of compliance-pack preparation across patients.
 *
 * This is a read-at-a-glance overview only; individual dosette management happens
 * inside each patient's record (open a row to jump straight to the Dosette tab).
 */
import { useMemo, useState } from "react";
import { LayoutGrid, Clock, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Card, StatusChip, EmptyState, cx } from "../components/ui";
import { PATIENTS, getPickingList, STATUS_TONE, fmtDate, TODAY_ISO } from "../services/patientData";
import PatientRecord from "../components/patients/PatientRecord";

const URGENCY = { "Issue found": 0, "Picking required": 1, "Not started": 1.5, "Picking in progress": 2, Picked: 3, Checked: 4, Ready: 5, "Collected / Delivered": 6 };

function daysTo(isoDate) {
  return Math.round((new Date(isoDate) - new Date(TODAY_ISO)) / 86400000);
}

export default function Dosette() {
  const [selected, setSelected] = useState(null);

  const rows = useMemo(
    () =>
      PATIENTS.map((p) => ({
        p,
        endsIn: daysTo(p.cycle.end),
        issues: getPickingList(p).filter((x) => x.warning).length,
      })).sort((a, b) => (URGENCY[a.p.workflow.status] ?? 9) - (URGENCY[b.p.workflow.status] ?? 9) || a.endsIn - b.endsIn),
    []
  );

  const ready = rows.filter((r) => r.p.workflow.status === "Ready" || r.p.workflow.status === "Collected / Delivered").length;
  const issues = rows.filter((r) => r.p.workflow.status === "Issue found" || r.issues > 0).length;
  const dueSoon = rows.filter((r) => r.endsIn <= 3).length;

  const tiles = [
    { label: "Dosette patients", value: rows.length, tone: "text-text-primary", icon: LayoutGrid },
    { label: "Cycles ending ≤ 3 days", value: dueSoon, tone: dueSoon ? "text-warning-fg" : "text-text-primary", icon: Clock },
    { label: "Need attention", value: issues, tone: issues ? "text-danger-fg" : "text-text-primary", icon: AlertTriangle },
    { label: "Ready / delivered", value: ready, tone: "text-success-fg", icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-display font-semibold tracking-tight">Dosette overview</h1>
        <p className="mt-1 text-body text-text-secondary">
          Compliance-pack preparation at a glance. Open a patient to manage their tray, picking list and cycle.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-caption font-medium text-text-secondary">{t.label}</span>
              <t.icon size={16} className="text-text-tertiary" aria-hidden="true" />
            </div>
            <div className={cx("mt-1 text-display font-semibold tnum", t.tone)}>{t.value}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={LayoutGrid} title="No dosette patients" hint="Compliance-pack patients appear here." />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {rows.map(({ p, endsIn, issues: n }) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelected(p)}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-accent-ring"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-body font-semibold text-accent" aria-hidden="true">
                    {p.firstName[0]}{p.surname[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-semibold text-text-primary">{p.name}</span>
                      <StatusChip tone={STATUS_TONE[p.workflow.status]} icon={false}>{p.workflow.status}</StatusChip>
                      {n > 0 && <StatusChip tone="danger">{n} stock issue{n > 1 ? "s" : ""}</StatusChip>}
                    </span>
                    <span className="mt-0.5 text-caption text-text-tertiary tnum">
                      {p.packType} · cycle ends {fmtDate(p.cycle.end)} ({endsIn >= 0 ? `in ${endsIn}d` : `${-endsIn}d ago`})
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-text-tertiary" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-caption text-text-tertiary">Simulated data for demonstration · individual dosettes are managed in the patient record.</p>

      <PatientRecord patient={selected} open={!!selected} onClose={() => setSelected(null)} initialTab="dosette" />
    </div>
  );
}
