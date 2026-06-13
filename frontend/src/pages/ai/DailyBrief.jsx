/** AI Daily Brief — one ranked, explainable operational to-do list for the shift. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ListChecks,
  CalendarClock,
  ShieldAlert,
  Boxes,
  TimerReset,
  ArrowRight,
  Info,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Card, Button, StatusChip, EmptyState, cx } from "../../components/ui";
import { dailyBrief } from "../../services/aiClient";
import { usePreferences } from "../../context/PreferencesContext";
import AIDataNotice from "../../components/ai/AIDataNotice";

const CAT_ICON = { Dosette: CalendarClock, Clinical: ShieldAlert, Stock: Boxes, Waste: TimerReset };

function PriorityDot({ tone }) {
  const map = { danger: "bg-danger", warning: "bg-warning", info: "bg-info", success: "bg-success" };
  return <span className={cx("h-2.5 w-2.5 rounded-full", map[tone] || "bg-text-tertiary")} aria-hidden="true" />;
}

function TaskRow({ task, showReason, onAct, index }) {
  const Icon = CAT_ICON[task.category] || Info;
  return (
    <Card className="p-4 animate-slide-up" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-text-secondary" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityDot tone={task.tone} />
            <h3 className="text-subtitle font-semibold text-text-primary">{task.title}</h3>
            <StatusChip tone={task.tone === "info" ? "info" : task.tone} icon={false}>
              {task.category}
            </StatusChip>
          </div>
          <p className="mt-1 text-body text-text-secondary">{task.detail}</p>

          {showReason && (
            <div className="mt-2 rounded-md bg-subtle px-3 py-2">
              <p className="text-caption text-text-secondary">
                <span className="font-medium text-text-primary">Why this matters: </span>
                {task.reasoning}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">Confidence</span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border-subtle">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(task.confidence * 100)}%` }} />
                </div>
                <span className="text-caption text-text-tertiary tnum">{Math.round(task.confidence * 100)}%</span>
              </div>
            </div>
          )}
        </div>
        <Button variant="secondary" size="sm" className="shrink-0" onClick={() => onAct(task.action.to)}>
          {task.action.label}
          <ArrowRight size={14} />
        </Button>
      </div>
    </Card>
  );
}

export default function DailyBrief() {
  const navigate = useNavigate();
  const { prefs } = usePreferences();
  const showReason = prefs.ai.explanationLevel === "detailed";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dailyBrief().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const focus = (data?.tasks || []).filter((t) => t.priority >= 85);
  const later = (data?.tasks || []).filter((t) => t.priority < 85);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-text-tertiary">
            <ListChecks size={16} aria-hidden="true" />
            <span className="text-micro uppercase">AI Daily Brief</span>
          </div>
          <h1 className="text-display font-semibold tracking-tight">Today’s priorities</h1>
          <p className="mt-1 text-body text-text-secondary">
            {data ? `${data.dateLabel} · ${data.total} actions ranked by urgency` : "Compiling your shift…"}
          </p>
        </div>
        {data && (
          <div className="flex gap-2">
            <StatusChip tone="danger" icon={false}>
              {data.urgent} urgent
            </StatusChip>
            <StatusChip tone="neutral" icon={false}>
              {data.total} total
            </StatusChip>
          </div>
        )}
      </header>

      <AIDataNotice live={data?.live} />

      {loading && (
        <Card className="flex items-center gap-3 p-6 text-text-secondary">
          <Loader2 size={18} className="animate-spin text-accent" aria-hidden="true" /> Prioritising today’s tasks…
        </Card>
      )}

      {!loading && data && data.total === 0 && (
        <Card>
          <EmptyState icon={CheckCircle2} title="All clear" hint="No priority actions for today — nice work." />
        </Card>
      )}

      {!loading && focus.length > 0 && (
        <section aria-label="Focus now">
          <h2 className="mb-2 text-micro uppercase text-text-tertiary">Focus now</h2>
          <div className="space-y-3">
            {focus.map((t, i) => (
              <TaskRow key={t.id} task={t} index={i} showReason={showReason} onAct={(to) => navigate(to)} />
            ))}
          </div>
        </section>
      )}

      {!loading && later.length > 0 && (
        <section aria-label="Also today">
          <h2 className="mb-2 text-micro uppercase text-text-tertiary">Also today</h2>
          <div className="space-y-3">
            {later.map((t, i) => (
              <TaskRow key={t.id} task={t} index={i} showReason={showReason} onAct={(to) => navigate(to)} />
            ))}
          </div>
        </section>
      )}

      {!loading && data && (
        <p className="text-caption text-text-tertiary">{data.note}</p>
      )}
    </div>
  );
}
