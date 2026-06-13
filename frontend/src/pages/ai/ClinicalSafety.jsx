/** Clinical Safety AI — explainable interaction / duplicate / dose checks. */
import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Pill,
  AlertTriangle,
  Info,
  XCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Card, Button, StatusChip, EmptyState, cx } from "../../components/ui";
import { safetyCheck, listPatients } from "../../services/aiClient";
import AIDataNotice from "../../components/ai/AIDataNotice";

const VERDICT = {
  pass: { tone: "success", Icon: CheckCircle2, label: "No flags — clear to proceed", bg: "bg-success-bg", fg: "text-success-fg" },
  info: { tone: "info", Icon: Info, label: "Review notes", bg: "bg-info-bg", fg: "text-info-fg" },
  warning: { tone: "warning", Icon: AlertTriangle, label: "Review before assembly", bg: "bg-warning-bg", fg: "text-warning-fg" },
  danger: { tone: "danger", Icon: ShieldAlert, label: "Pharmacist review required", bg: "bg-danger-bg", fg: "text-danger-fg" },
};
const CHECK_TONE = { pass: "success", info: "info", warning: "warning", danger: "danger" };

export default function ClinicalSafety() {
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (patient) => {
    setSelected(patient);
    setResult(null);
    setLoading(true);
    const r = await safetyCheck(patient.id);
    setResult(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    listPatients().then((rows) => {
      setPatients(rows);
      if (rows[0]) run(rows[0]);
    });
  }, [run]);

  const verdict = result ? VERDICT[result.overall] || VERDICT.info : null;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-display font-semibold tracking-tight">Clinical Safety AI</h1>
          <p className="mt-1 text-body text-text-secondary">
            Interaction, duplicate-therapy and dose checks across a patient&apos;s regimen — each flag explained.
          </p>
        </div>
        <StatusChip tone="neutral" icon={false}>
          Decision-support
        </StatusChip>
      </header>

      <AIDataNotice live={result?.live} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        {/* Patient picker */}
        <Card className="overflow-hidden">
          <div className="border-b border-border-subtle px-4 py-3 text-micro uppercase text-text-tertiary">Patients</div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {patients.map((p) => (
              <button
                key={p.id}
                onClick={() => run(p)}
                className={cx(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-all duration-150 ease active:scale-[0.99]",
                  selected?.id === p.id ? "bg-accent-soft" : "hover:bg-subtle"
                )}
              >
                <span
                  className={cx(
                    "flex h-8 w-8 items-center justify-center rounded-full text-caption font-semibold",
                    selected?.id === p.id ? "bg-accent text-white" : "bg-subtle text-text-secondary"
                  )}
                >
                  {(p.name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-text-primary">{p.name}</span>
                  <span className="block truncate text-caption text-text-tertiary tnum">{p.id}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {loading && (
            <Card className="flex items-center gap-3 p-6 text-text-secondary">
              <Loader2 size={18} className="animate-spin text-accent" />
              Running safety checks…
            </Card>
          )}

          {!loading && !result && (
            <Card>
              <EmptyState icon={ShieldCheck} title="Select a patient" hint="Choose a patient to run the safety checks." />
            </Card>
          )}

          {!loading && result && verdict && (
            <>
              {/* Big, unmistakable verdict */}
              <div className={cx("flex items-center gap-4 rounded-2xl border border-border-subtle p-5", verdict.bg)}>
                <verdict.Icon size={32} className={verdict.fg} />
                <div className="flex-1">
                  <div className={cx("text-title font-semibold", verdict.fg)}>{verdict.label}</div>
                  <div className="mt-0.5 text-body text-text-secondary">
                    {result.patient?.name} · {result.medCount} medications checked
                  </div>
                </div>
                <StatusChip tone={verdict.tone}>
                  {result.checks.filter((c) => c.severity !== "pass").length || "0"} flags
                </StatusChip>
              </div>

              {/* Check cards */}
              <div className="space-y-3">
                {result.checks.map((c, i) => {
                  const tone = CHECK_TONE[c.severity] || "neutral";
                  const ToneIcon = { success: CheckCircle2, info: Info, warning: AlertTriangle, danger: XCircle }[tone] || Info;
                  return (
                    <Card key={`${c.kind}-${c.title}`} className="p-4 animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="flex items-start gap-3">
                        <span className={cx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", VERDICT[c.severity]?.bg, VERDICT[c.severity]?.fg)}>
                          <ToneIcon size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-subtitle font-semibold text-text-primary">{c.title}</h4>
                            <StatusChip tone={tone} icon={false}>
                              {c.kind}
                            </StatusChip>
                          </div>
                          <p className="mt-1 text-body text-text-secondary">{c.detail}</p>
                          {c.action && (
                            <p className="mt-2 rounded-md bg-subtle px-3 py-2 text-caption text-text-secondary">
                              <span className="font-medium text-text-primary">Suggested: </span>
                              {c.action}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface p-4">
                <p className="flex items-center gap-2 text-caption text-text-tertiary">
                  <Pill size={14} /> {result.note}
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => run(selected)}>
                    Re-run
                  </Button>
                  <Button size="sm" disabled={result.overall === "danger"}>
                    {result.overall === "danger" ? "Blocked — needs review" : "Mark reviewed"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
