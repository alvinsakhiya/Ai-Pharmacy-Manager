/** Prescription Intake AI — parse free text into a structured, reviewable schedule. */
import { useState } from "react";
import { ScanText, Sparkles, Check, AlertTriangle, FileText, Loader2, Upload } from "lucide-react";
import { Card, Button, StatusChip, EmptyState, cx } from "../../components/ui";
import { intakeParse } from "../../services/aiClient";

const SLOTS = ["Morning", "Noon", "Evening", "Night"];
const SAMPLE = `Amlodipine 5mg tablets - once daily in the morning
Atorvastatin 20mg tablets - one at night
Metformin 500mg tablets - twice daily, morning and evening
Levothyroxine 50mcg tablets - once daily before food
Omeprazole 20mg capsules - one each morning`;

function Confidence({ value }) {
  const pct = Math.round(value * 100);
  const tone = value >= 0.85 ? "success" : value >= 0.7 ? "info" : "warning";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-subtle">
        <div
          className={cx("h-full rounded-full transition-all duration-500 ease", {
            success: "bg-success",
            info: "bg-info",
            warning: "bg-warning",
          }[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-caption text-text-tertiary tnum">{pct}%</span>
    </div>
  );
}

export default function Intake() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const parse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    setConfirmed(false);
    const r = await intakeParse(text);
    setResult(r);
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-display font-semibold tracking-tight">Prescription Intake AI</h1>
        <p className="mt-1 text-body text-text-secondary">
          Paste the prescription text and the Co-pilot structures it into slot-by-slot lines for pharmacist review.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Input */}
        <Card className="flex flex-col p-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-subtitle font-semibold text-text-primary">
              <FileText size={16} className="text-text-tertiary" /> Prescription text
            </label>
            <button onClick={() => setText(SAMPLE)} className="text-caption font-medium text-accent hover:underline">
              Load sample
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"One medication per line, e.g.\nAmlodipine 5mg tablets - once daily morning"}
            rows={9}
            className="w-full flex-1 resize-none rounded-md border border-border-strong bg-surface p-3 text-body text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-caption text-text-tertiary">
              <Upload size={13} /> Image OCR connects to your scanning provider
            </span>
            <Button onClick={parse} disabled={!text.trim() || loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Parse
            </Button>
          </div>
        </Card>

        {/* Output */}
        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <h3 className="flex items-center gap-2 text-subtitle font-semibold">
              <ScanText size={16} className="text-accent" /> Structured schedule
            </h3>
            {result && (
              <StatusChip tone="info" icon={false}>
                {result.resolved}/{result.lineCount} parsed
              </StatusChip>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {!result && !loading && (
              <EmptyState icon={ScanText} title="Nothing parsed yet" hint="Paste a prescription and press Parse." />
            )}
            {loading && (
              <div className="flex items-center gap-3 p-6 text-text-secondary">
                <Loader2 size={18} className="animate-spin text-accent" /> Structuring lines…
              </div>
            )}

            {result && !loading && (
              <div className="space-y-2.5 animate-fade-in">
                {result.items.map((m, i) => (
                  <div key={i} className="rounded-xl border border-border-subtle p-3 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-body font-semibold text-text-primary">
                          {m.medicine} <span className="font-normal text-text-secondary">{m.strength}</span>
                        </div>
                        <div className="text-caption text-text-tertiary capitalize">{m.form}</div>
                      </div>
                      <Confidence value={m.confidence} />
                    </div>

                    {/* Slot grid */}
                    <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                      {SLOTS.map((s) => {
                        const on = m.slots.includes(s);
                        return (
                          <div
                            key={s}
                            className={cx(
                              "rounded-md border py-1.5 text-center text-caption font-medium transition",
                              on ? "border-accent bg-accent-soft text-accent" : "border-border-subtle bg-app text-text-tertiary"
                            )}
                          >
                            {s}
                          </div>
                        );
                      })}
                    </div>

                    {m.warnings?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {m.warnings.map((w, j) => (
                          <p key={j} className="flex items-start gap-1.5 text-caption text-warning-fg">
                            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                            {w}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {result.unresolved?.length > 0 && (
                  <div className="rounded-xl border border-dashed border-border-strong bg-app p-3">
                    <p className="mb-1 text-caption font-medium text-text-secondary">Couldn't parse — review manually</p>
                    {result.unresolved.map((u, i) => (
                      <p key={i} className="truncate text-caption text-text-tertiary">
                        • {u}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {result && !loading && (
            <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-4 py-3">
              <p className="text-caption text-text-tertiary">{result.note}</p>
              <Button size="sm" variant={confirmed ? "secondary" : "primary"} disabled={confirmed} onClick={() => setConfirmed(true)}>
                {confirmed ? (
                  <>
                    <Check size={14} /> Sent to review
                  </>
                ) : (
                  "Confirm for review"
                )}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
