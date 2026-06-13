/** AI hub — the front door to the Co-pilot and the four AI capabilities. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  ShieldCheck,
  PackageSearch,
  ScanText,
  CalendarClock,
  AlertTriangle,
  Boxes,
  TimerReset,
  ArrowRight,
  Command,
} from "lucide-react";
import { Card, Button, StatusChip, Skeleton, cx } from "../../components/ui";
import { insights } from "../../services/aiClient";

const openCopilot = () => window.dispatchEvent(new Event("copilot:open"));

function Tile({ icon: Icon, label, value, tone, loading }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-caption font-medium text-text-secondary">{label}</span>
        <Icon size={16} className="text-text-tertiary" />
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <div className={cx("mt-1 text-display font-semibold tnum", tone)}>{value}</div>
      )}
    </Card>
  );
}

const CAPS = [
  {
    icon: Sparkles,
    title: "AI Co-pilot",
    blurb: "Ask in plain language across your whole workspace and jump straight to the answer.",
    cta: "Ask anything",
    action: "copilot",
    accent: true,
  },
  {
    icon: ShieldCheck,
    title: "Clinical Safety AI",
    blurb: "Live interaction, duplicate-therapy and dose checks as a regimen is built — with explanations.",
    cta: "Run a check",
    to: "/ai/safety",
  },
  {
    icon: PackageSearch,
    title: "Smart Reorder + Waste",
    blurb: "Forecast-driven reorder quantities and FEFO waste projections, ready to draft into orders.",
    cta: "View suggestions",
    to: "/ai/reorder",
  },
  {
    icon: ScanText,
    title: "Prescription Intake AI",
    blurb: "Turn a prescription into a structured, slot-by-slot schedule for pharmacist review.",
    cta: "Parse a prescription",
    to: "/ai/intake",
  },
];

export default function AIHub() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    insights().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-elev-1">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent-soft blur-2xl" />
        <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-elev-1">
                <Sparkles size={18} />
              </span>
              <StatusChip tone="info" icon={false}>
                AI Suite
              </StatusChip>
            </div>
            <h1 className="text-display font-semibold tracking-tight text-text-primary">AI Co-pilot</h1>
            <p className="mt-1 text-body text-text-secondary">
              One place to ask, check, and act — interactions, stock, waste and intake, all explainable and under your control.
            </p>
          </div>
          <Button size="lg" onClick={openCopilot} className="shrink-0">
            <Sparkles size={16} /> Ask anything
            <kbd className="ml-1 flex items-center gap-0.5 rounded bg-white/20 px-1.5 py-0.5 text-[11px]">
              <Command size={11} /> K
            </kbd>
          </Button>
        </div>
      </div>

      {/* Live insight tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon={CalendarClock} label="Packs due ≤ 48h" value={data?.dueSoon ?? 0} tone="text-text-primary" loading={!data} />
        <Tile icon={AlertTriangle} label="Safety flags" value={data?.flagged ?? 0} tone={data?.flagged ? "text-warning-fg" : "text-text-primary"} loading={!data} />
        <Tile icon={Boxes} label="Lines to order" value={data?.toOrder ?? 0} tone={data?.toOrder ? "text-danger-fg" : "text-text-primary"} loading={!data} />
        <Tile icon={TimerReset} label="Projected waste" value={`£${data?.wasteValue ?? 0}`} tone="text-text-primary" loading={!data} />
      </div>

      {/* Capabilities */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CAPS.map((c) => (
          <Card
            key={c.title}
            className={cx(
              "group flex flex-col p-5 transition-all duration-200 ease hover:-translate-y-0.5 hover:shadow-elev-2",
              c.accent && "ring-1 ring-accent/20"
            )}
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <c.icon size={20} />
            </div>
            <h3 className="text-subtitle font-semibold text-text-primary">{c.title}</h3>
            <p className="mt-1 flex-1 text-body text-text-secondary">{c.blurb}</p>
            <button
              onClick={() => (c.action === "copilot" ? openCopilot() : navigate(c.to))}
              className="mt-4 inline-flex items-center gap-1.5 self-start text-body font-medium text-accent transition group-hover:gap-2.5"
            >
              {c.cta}
              <ArrowRight size={16} />
            </button>
          </Card>
        ))}
      </div>

      <p className="text-caption text-text-tertiary">
        Decision-support only — every suggestion is a prompt to review, not an instruction. No external or branded data source.
      </p>
    </div>
  );
}
