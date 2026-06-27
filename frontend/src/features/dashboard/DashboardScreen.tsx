import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  ListChecks,
  PackageCheck,
  PoundSterling,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { scopeLabel } from "../../lib/scope";
import { cn } from "../../lib/cn";
import {
  getAlerts,
  getWorkQueue,
  type WorkQueueItem,
  type WorkQueueSummary,
} from "../notifications/notificationsApi";
import {
  formatWorkQueueDate,
  workQueueActionLabel,
  workQueuePriorityLabel,
  workQueueStatusLabel,
} from "../notifications/workQueueDisplay";
import { getReportPreview } from "../reports/reportsApi";
import type {
  ExpiryReport,
  MdsWorkloadReport,
  StockValuationReport,
} from "../reports/reportsApi";
import { listAuditEvents } from "../audit/auditApi";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";

type Tone = "danger" | "warning" | "success" | "info" | "neutral";

const TONE_CHIP: Record<Tone, string> = {
  danger: "bg-danger-soft text-danger-ink",
  warning: "bg-warning-soft text-warning-ink",
  success: "bg-success-soft text-success-ink",
  info: "bg-info-soft text-info-ink",
  neutral: "bg-surface-sunken text-ink-soft",
};

const WORK_QUEUE_SUMMARY: Array<{
  key: Exclude<keyof WorkQueueSummary, "total">;
  label: string;
  icon: ReactNode;
}> = [
  { key: "urgent", label: "Urgent", icon: <TriangleAlert className="h-3.5 w-3.5" /> },
  { key: "due_soon", label: "Due soon", icon: <Clock className="h-3.5 w-3.5" /> },
  {
    key: "waiting_check",
    label: "Waiting check",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
  },
  {
    key: "stock_action",
    label: "Stock action",
    icon: <PackageCheck className="h-3.5 w-3.5" />,
  },
  {
    key: "reviews",
    label: "Reviews",
    icon: <ClipboardCheck className="h-3.5 w-3.5" />,
  },
];

function formatGBP(value: string | number | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) {
    return "£0";
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function humanizeAction(action: string): string {
  const cleaned = action.replace(/_/g, " ").trim().toLowerCase();
  if (!cleaned) return "Activity";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function workQueuePriorityTone(
  priority: WorkQueueItem["priority"],
): "danger" | "warning" | "info" | "neutral" {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "info";
  return "neutral";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") {
    return document.documentElement.classList.contains("reduce-motion");
  }
  return (
    document.documentElement.classList.contains("reduce-motion") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Counts a number up to its target on mount / when it changes — a satisfying
 * "alive" touch on the headline figures. Honours reduced-motion (snaps).
 */
function CountUp({
  value,
  format,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value || prefersReducedMotion()) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    let raf = 0;
    let startTs = 0;
    const duration = 700;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const progress = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
        setDisplay(value);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const rounded = Math.round(display);
  return <>{format ? format(rounded) : rounded.toLocaleString()}</>;
}

export function DashboardScreen() {
  const { user } = useAuth();
  const { can } = usePermissions();

  const canStock = can("stock.view");
  const canBlister = can("blister.view");
  const canReview = can("review.view");
  const canAudit = can("audit.view");
  const canAlerts = canStock || canBlister;
  const canWorkQueue = canStock || canBlister || canReview;

  const alertsQuery = useQuery({
    queryKey: ["dashboard", "alerts"],
    queryFn: getAlerts,
    enabled: canAlerts,
  });
  const valuationQuery = useQuery({
    queryKey: ["dashboard", "valuation"],
    queryFn: () =>
      getReportPreview("stock_valuation").then((r) => r as StockValuationReport),
    enabled: canStock,
  });
  const expiryQuery = useQuery({
    queryKey: ["dashboard", "expiry"],
    queryFn: () => getReportPreview("expiry").then((r) => r as ExpiryReport),
    enabled: canStock,
  });
  const mdsQuery = useQuery({
    queryKey: ["dashboard", "mds"],
    queryFn: () =>
      getReportPreview("mds_workload").then((r) => r as MdsWorkloadReport),
    enabled: canBlister,
  });
  const auditQuery = useQuery({
    queryKey: ["dashboard", "audit"],
    queryFn: () => listAuditEvents({ page: 1 }),
    enabled: canAudit,
  });
  const workQueueQuery = useQuery({
    queryKey: ["notifications", "work-queue"],
    queryFn: getWorkQueue,
    enabled: canWorkQueue,
  });

  if (!user) {
    return null;
  }

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const alertSummary = alertsQuery.data?.summary;
  const expiry = expiryQuery.data;
  const expiredCount = expiry
    ? expiry.rows.filter((r) => r.days_until_expiry < 0).length
    : 0;
  const valuation = valuationQuery.data;
  const mdsRows = mdsQuery.data?.rows ?? [];
  const mdsOverdue = mdsRows.reduce((sum, r) => sum + r.overdue_count, 0);
  const mdsDue = mdsRows.reduce((sum, r) => sum + r.due_count, 0);
  const mdsUpcoming = mdsRows.reduce((sum, r) => sum + r.upcoming_cycles, 0);
  const expiryWindow = expiry?.filters.window_days ?? 30;
  const mdsWindow = mdsQuery.data?.filters.window_days ?? 30;

  const hasMain = canWorkQueue || canBlister || canStock;
  const hasRail = canWorkQueue || canBlister || canStock || canAlerts || canAudit;
  const calendarEvents = buildCalendarEvents({
    expiryRows: canStock ? (expiry?.rows ?? []) : [],
    workQueueItems: canWorkQueue ? (workQueueQuery.data?.items ?? []) : [],
  });

  return (
    <div className="space-y-5">
      <header className="animate-fade-in-up space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
              Pharmacy command centre
            </p>
            <h1 className="mt-1.5 text-[30px] font-extrabold tracking-[-0.025em] text-ink sm:text-[34px]">
              Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              Monitor operational signals across stock, dosette preparation,
              and workload.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            {canAlerts ? (
              <Link to="/alerts">
                <Button
                  variant="secondary"
                  leadingIcon={<Bell className="h-4 w-4" />}
                >
                  View alerts
                </Button>
              </Link>
            ) : null}
            {canWorkQueue ? (
              <Link to="/work-queue">
                <Button
                  variant="secondary"
                  leadingIcon={<ListChecks className="h-4 w-4" />}
                >
                  Open Work Queue
                </Button>
              </Link>
            ) : null}
            {canStock ? (
              <Link to="/reports">
                <Button
                  variant="primary"
                  trailingIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Open reports
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{scopeLabel(user)}</Badge>
          <Badge variant="info">Human review required</Badge>
          <Badge variant="neutral">{dateLabel}</Badge>
        </div>
      </header>

      {/* KPI row */}
      <section
        aria-label="Key metrics"
        className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {canAlerts ? (
          <Kpi
            label="Open alerts"
            helper="Operational alerts requiring review"
            icon={<Bell className="h-4 w-4" />}
            tint="bg-lilac-soft text-brand-ink border-lilac"
            loading={alertsQuery.isLoading}
            error={alertsQuery.isError}
            value={<CountUp value={alertSummary?.total ?? 0} />}
            chip={
              alertSummary
                ? alertSummary.critical > 0
                  ? { text: `${alertSummary.critical} critical`, tone: "danger" }
                  : alertSummary.warning > 0
                    ? {
                        text: `${alertSummary.warning} warning`,
                        tone: "warning",
                      }
                    : { text: "All clear", tone: "success" }
                : undefined
            }
          />
        ) : null}

        {canStock ? (
          <Kpi
            label="Stock value"
            helper="Current priced inventory value"
            icon={<PoundSterling className="h-4 w-4" />}
            tint="bg-gold-soft text-gold-ink border-gold"
            loading={valuationQuery.isLoading}
            error={valuationQuery.isError}
            value={
              <CountUp
                value={Number(valuation?.summary.total_value ?? 0)}
                format={formatGBP}
              />
            }
            chip={
              valuation
                ? {
                    text: `${valuation.summary.total_units.toLocaleString()} units`,
                    tone: "neutral",
                  }
                : undefined
            }
          />
        ) : null}

        {canStock ? (
          <Kpi
            label={`Expiring ≤ ${expiryWindow}d`}
            helper="Batches in the expiry review window"
            icon={<Clock className="h-4 w-4" />}
            tint="bg-info-soft text-info-ink border-info-border"
            loading={expiryQuery.isLoading}
            error={expiryQuery.isError}
            value={<CountUp value={expiry?.row_count ?? 0} />}
            chip={
              expiry
                ? expiredCount > 0
                  ? { text: `${expiredCount} expired`, tone: "danger" }
                  : { text: "none expired", tone: "success" }
                : undefined
            }
          />
        ) : null}

        {canBlister ? (
          <Kpi
            label="Packs due"
            helper="Dosette preparation workload"
            icon={<CalendarClock className="h-4 w-4" />}
            tint="bg-peach-soft text-peach-ink border-peach"
            loading={mdsQuery.isLoading}
            error={mdsQuery.isError}
            value={<CountUp value={mdsDue} />}
            chip={
              mdsQuery.data
                ? mdsOverdue > 0
                  ? { text: `${mdsOverdue} overdue`, tone: "danger" }
                  : { text: "on track", tone: "success" }
                : undefined
            }
          />
        ) : null}
      </section>

      {/* Main + rail */}
      <section className="grid gap-5 lg:grid-cols-3">
        {hasMain ? (
          <div className="stagger space-y-5 lg:col-span-2">
            {canWorkQueue ? (
              <NeedsAttentionCard
                error={workQueueQuery.isError}
                generatedAt={workQueueQuery.data?.generated_at}
                items={workQueueQuery.data?.items ?? []}
                loading={workQueueQuery.isLoading}
                summary={workQueueQuery.data?.summary}
              />
            ) : null}
            {canBlister ? (
              <WorkloadCard
                loading={mdsQuery.isLoading}
                error={mdsQuery.isError}
                hasRows={mdsRows.length > 0}
                overdue={mdsOverdue}
                due={mdsDue}
                upcoming={mdsUpcoming}
                window={mdsWindow}
                showManage={can("patient.view")}
              />
            ) : null}
            {canStock ? (
              <ExpiringCard
                loading={expiryQuery.isLoading}
                error={expiryQuery.isError}
                rows={expiry?.rows ?? []}
                window={expiryWindow}
              />
            ) : null}
          </div>
        ) : null}

        <div className="stagger space-y-5">
          {hasMain ? (
            <CalendarCard
              today={today}
              events={calendarEvents}
              loading={
                (canWorkQueue && workQueueQuery.isLoading) ||
                (canStock && expiryQuery.isLoading)
              }
              error={
                (canWorkQueue && workQueueQuery.isError) ||
                (canStock && expiryQuery.isError)
              }
            />
          ) : null}

          {canAlerts ? (
            <AlertsBreakdownCard
              loading={alertsQuery.isLoading}
              error={alertsQuery.isError}
              summary={alertSummary}
            />
          ) : null}

          {canAudit ? (
            <ActivityCard
              loading={auditQuery.isLoading}
              error={auditQuery.isError}
              events={auditQuery.data?.results ?? []}
            />
          ) : null}

          {!hasRail ? <WelcomeCard scope={scopeLabel(user)} /> : null}
        </div>
      </section>
    </div>
  );
}

/* ----------------------------- KPI card ----------------------------- */

function Kpi({
  label,
  helper,
  value,
  icon,
  tint,
  chip,
  loading,
  error,
}: {
  label: ReactNode;
  helper: ReactNode;
  value: ReactNode;
  icon: ReactNode;
  tint: string;
  chip?: { text: string; tone: Tone };
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <article className="flex min-h-[120px] flex-col justify-between rounded-2xl border border-line bg-surface p-5 shadow-soft transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-elev-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-ink-soft">{label}</p>
          <p className="mt-1 max-w-[12rem] text-xs leading-relaxed text-muted">
            {helper}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full border",
            tint,
          )}
        >
          {icon}
        </span>
      </div>
      <div>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="tnum text-[30px] font-extrabold leading-none tracking-[-0.02em] text-ink">
            {error ? "—" : value}
          </p>
        )}
        <div className="mt-3 h-5">
          {!loading && chip ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold",
                TONE_CHIP[chip.tone],
              )}
            >
              {chip.text}
            </span>
          ) : !loading && error ? (
            <span className="text-[11px] font-medium text-muted">
              Unable to load right now
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/* ---------------------- Needs attention card ----------------------- */

function NeedsAttentionCard({
  loading,
  error,
  summary,
  items,
  generatedAt,
}: {
  loading: boolean;
  error: boolean;
  summary: WorkQueueSummary | undefined;
  items: WorkQueueItem[];
  generatedAt: string | undefined;
}) {
  const topTasks = items.slice(0, 5);
  const updatedLabel = generatedAt
    ? `Updated ${relativeTime(generatedAt)} from current queue`
    : "Updated from current queue";

  return (
    <section
      aria-label="Needs attention"
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-elev-2"
    >
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-lilac-soft bg-lilac-soft text-brand"
            >
              <ListChecks className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[19px] font-extrabold tracking-[-0.01em] text-ink">
                Needs attention
              </h2>
              <p className="mt-0.5 text-[13px] font-medium text-muted">
                {loading ? "Loading current queue..." : updatedLabel}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge variant="info">Review before action</Badge>
          <Link to="/work-queue">
            <Button
              variant="secondary"
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              Open Work Queue
            </Button>
          </Link>
        </div>
      </div>

      {error ? (
        <div className="px-5 py-5">
          <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-ink">
            Couldn&rsquo;t load the current queue.
          </p>
        </div>
      ) : loading ? (
        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {WORK_QUEUE_SUMMARY.map((item) => (
              <Skeleton className="h-16" key={item.key} />
            ))}
          </div>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !summary || summary.total === 0 ? (
        <div className="px-5 py-5">
          <div className="rounded-xl bg-success-soft px-4 py-6 text-center">
            <p className="text-sm font-bold text-success-ink">
              Nothing needs attention right now.
            </p>
          </div>
        </div>
      ) : (
        <div className="px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {WORK_QUEUE_SUMMARY.map((item) => (
              <div
                className="rounded-xl border border-line bg-surface-subtle p-3 transition-colors hover:border-line-strong"
                key={item.key}
              >
                <div className="flex items-center justify-between gap-2">
                  <span aria-hidden="true" className="text-muted">
                    {item.icon}
                  </span>
                  <span className="tnum text-xl font-extrabold text-ink">
                    {summary[item.key]}
                  </span>
                </div>
                <p className="mt-2 truncate text-xs font-semibold text-muted">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {topTasks.map((item) => (
              <div
                className="grid gap-3 bg-surface px-4 py-4 transition-colors hover:bg-surface-subtle lg:grid-cols-[minmax(0,1fr)_auto]"
                key={item.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="min-w-0 text-sm font-bold text-ink">
                      {item.title}
                    </h3>
                    <Badge variant={workQueuePriorityTone(item.priority)}>
                      {workQueuePriorityLabel(item.priority)}
                    </Badge>
                    <Badge variant={item.priority === "urgent" ? "danger" : "neutral"} dot>
                      {workQueueStatusLabel(item.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
                    {item.reason}
                  </p>
                  <p className="mt-2 truncate text-xs font-semibold text-muted">
                    {[
                      item.patient_reference
                        ? `Patient ID ${item.patient_reference}`
                        : null,
                      item.pharmacy_name || `Pharmacy ${item.pharmacy_id}`,
                      item.due_date ? `Due ${formatWorkQueueDate(item.due_date)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Link
                  aria-label={`Open record: ${workQueueActionLabel(item)}`}
                  to={item.action_href}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-[13px] font-bold text-ink-soft shadow-elev-1 transition-all duration-200 ease-soft hover:-translate-y-px hover:bg-surface-subtle hover:text-ink focus-ring lg:self-center"
                >
                  {workQueueActionLabel(item)}
                  <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* -------------------------- Workload card --------------------------- */

function WorkloadCard({
  loading,
  error,
  hasRows,
  overdue,
  due,
  upcoming,
  window,
  showManage,
}: {
  loading: boolean;
  error: boolean;
  hasRows: boolean;
  overdue: number;
  due: number;
  upcoming: number;
  window: number;
  showManage: boolean;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-6 shadow-soft transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-elev-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-extrabold tracking-[-0.01em] text-ink">
            Dosette workload
          </h2>
          <p className="mt-0.5 text-[13px] font-medium text-muted">
            Preparation workload across your scope
          </p>
        </div>
        {showManage ? (
          <Link
            to="/patients"
            className="inline-flex items-center gap-1.5 rounded-full bg-peach-soft px-3.5 py-2 text-[12px] font-bold text-peach-ink transition-all duration-200 ease-soft hover:bg-peach/30 active:scale-95 focus-ring"
          >
            Manage packs
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="mt-5 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger-ink">
          Couldn&rsquo;t load workload right now.
        </p>
      ) : loading ? (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : !hasRows ? (
        <p className="mt-5 rounded-xl bg-surface-subtle px-4 py-6 text-center text-sm font-medium text-muted">
          No active dosette cycles in your scope yet.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <WorkloadStat
            label="Overdue"
            value={overdue}
            tone={overdue > 0 ? "danger" : "neutral"}
            icon={<TriangleAlert className="h-4 w-4" />}
          />
          <WorkloadStat
            label={`Due in ${window}d`}
            value={due}
            tone="peach"
            icon={<CalendarClock className="h-4 w-4" />}
          />
          <WorkloadStat
            label={`Starting in ${window}d`}
            value={upcoming}
            tone="info"
            icon={<PackageCheck className="h-4 w-4" />}
          />
        </div>
      )}
    </article>
  );
}

function WorkloadStat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "danger" | "peach" | "info" | "neutral";
  icon: ReactNode;
}) {
  const badge =
    tone === "danger"
      ? "bg-danger-soft text-danger-ink"
      : tone === "peach"
        ? "bg-peach-soft text-peach-ink"
        : tone === "info"
          ? "bg-info-soft text-info-ink"
          : "bg-surface-sunken text-ink-soft";
  return (
    <div className="rounded-xl border border-line bg-surface-subtle p-4 transition-transform duration-200 ease-soft hover:-translate-y-0.5">
      <span
        aria-hidden="true"
        className={cn("grid h-9 w-9 place-items-center rounded-full", badge)}
      >
        {icon}
      </span>
      <p className="tnum mt-3 text-2xl font-extrabold leading-none text-ink">
        <CountUp value={value} />
      </p>
      <p className="mt-1.5 text-[12px] font-semibold text-muted">{label}</p>
    </div>
  );
}

/* --------------------------- Expiring card -------------------------- */

function expiryTone(days: number): { tone: Tone; text: string } {
  if (days < 0) return { tone: "danger", text: "Expired" };
  if (days <= 30) return { tone: "warning", text: `${days}d` };
  if (days <= 90) return { tone: "info", text: `${days}d` };
  return { tone: "neutral", text: `${days}d` };
}

function ExpiringCard({
  loading,
  error,
  rows,
  window,
}: {
  loading: boolean;
  error: boolean;
  rows: ExpiryReport["rows"];
  window: number;
}) {
  const top = [...rows]
    .sort((a, b) => a.days_until_expiry - b.days_until_expiry)
    .slice(0, 5);

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-soft transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-elev-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-extrabold tracking-[-0.01em] text-ink">
            Expiring soon
          </h2>
          <p className="mt-0.5 text-[13px] font-medium text-muted">
            Stock risk signals from the expiry report
          </p>
        </div>
        <Link
          to="/reports"
          aria-label="Open reports"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-subtle text-ink-soft transition-transform duration-200 ease-soft hover:scale-105 hover:text-ink active:scale-95 focus-ring"
        >
          <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      {error ? (
        <p className="mt-5 rounded-xl bg-white/60 px-4 py-3 text-sm font-medium text-danger-ink">
          Couldn&rsquo;t load expiry data right now.
        </p>
      ) : loading ? (
        <div className="mt-5 space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : top.length === 0 ? (
        <p className="mt-5 rounded-xl bg-surface-subtle px-4 py-6 text-center text-sm font-semibold text-ink-soft">
          No expiry signals in the next {window} days.
        </p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-line">
          <div className="grid grid-cols-[1.6fr_1fr_0.7fr_0.8fr] gap-2 bg-surface-subtle px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
            <span>Medication</span>
            <span>Batch</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Expiry</span>
          </div>
          <div className="divide-y divide-line bg-surface">
            {top.map((row, index) => {
              const tag = expiryTone(row.days_until_expiry);
              return (
                <div
                  key={`${row.batch_number}-${index}`}
                  className="grid grid-cols-[1.6fr_1fr_0.7fr_0.8fr] items-center gap-2 px-4 py-3 text-[13px] font-semibold text-ink"
                >
                  <span className="truncate">{row.medication_label}</span>
                  <span className="tnum truncate text-ink-soft">
                    {row.batch_number || "—"}
                  </span>
                  <span className="tnum text-right text-ink-soft">
                    {row.quantity.toLocaleString()}
                  </span>
                  <span className="text-right">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold",
                        TONE_CHIP[tag.tone],
                      )}
                    >
                      {tag.text}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

/* --------------------------- Calendar card -------------------------- */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type CalendarEventCategory = "work_queue" | "dosette" | "review" | "stock";

interface DashboardCalendarEvent {
  id: string;
  dateKey: string;
  title: string;
  reason: string;
  status: string;
  category: CalendarEventCategory;
  pharmacyName: string;
  patientReference: string;
  actionHref: string;
  actionLabel: string;
}

const CALENDAR_CATEGORY_LABEL: Record<CalendarEventCategory, string> = {
  work_queue: "Work Queue",
  dosette: "Dosette",
  review: "Review",
  stock: "Stock/Expiry",
};

const CALENDAR_CATEGORY_DOT: Record<CalendarEventCategory, string> = {
  work_queue: "bg-info",
  dosette: "bg-peach",
  review: "bg-brand",
  stock: "bg-warning",
};

function dateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateStringToKey(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return dateKey(parsed);
}

function addMonths(value: Date, delta: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + delta, 1);
}

function calendarDayLabel(value: Date): string {
  return value.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function selectedDayLabel(value: string): string {
  return parseDateKey(value).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function calendarCategoryForItem(item: WorkQueueItem): CalendarEventCategory {
  if (item.group === "reviews" || item.type.includes("REVIEW")) return "review";
  if (item.group === "stock_action" || item.type.includes("STOCK")) return "stock";
  if (item.type.includes("MDS") || item.type.includes("CYCLE")) return "dosette";
  return "work_queue";
}

function calendarEventTone(
  event: DashboardCalendarEvent,
): "danger" | "warning" | "brand" | "info" | "neutral" {
  if (event.status === "OVERDUE" || event.status === "CRITICAL") return "danger";
  if (event.category === "stock" || event.status === "DUE_SOON") return "warning";
  if (event.category === "review") return "brand";
  return "info";
}

function buildCalendarEvents({
  expiryRows,
  workQueueItems,
}: {
  expiryRows: ExpiryReport["rows"];
  workQueueItems: WorkQueueItem[];
}): DashboardCalendarEvent[] {
  const workQueueEvents = workQueueItems.flatMap((item) => {
    const key = dateStringToKey(item.due_date);
    if (!key) return [];
    return [
      {
        id: `work-${item.id}`,
        dateKey: key,
        title: item.title,
        reason: item.reason || "Needs attention. Review before action.",
        status: item.status,
        category: calendarCategoryForItem(item),
        pharmacyName: item.pharmacy_name || `Pharmacy ${item.pharmacy_id}`,
        patientReference: item.patient_reference,
        actionHref: item.action_href || "/work-queue",
        actionLabel: workQueueActionLabel(item),
      } satisfies DashboardCalendarEvent,
    ];
  });

  const expiryEvents = expiryRows.flatMap((row, index) => {
    const key = dateStringToKey(row.expiry_date);
    if (!key) return [];
    return [
      {
        id: `expiry-${row.batch_number || row.medication_label}-${index}`,
        dateKey: key,
        title: `Expiry review: ${row.medication_label}`,
        reason: `Batch ${row.batch_number || "not recorded"} expires ${formatWorkQueueDate(row.expiry_date)}. Review before action.`,
        status: row.severity || "EXPIRY",
        category: "stock",
        pharmacyName: row.pharmacy_name || `Pharmacy ${row.pharmacy_id}`,
        patientReference: "",
        actionHref: "/reports",
        actionLabel: "Open Reports",
      } satisfies DashboardCalendarEvent,
    ];
  });

  return [...workQueueEvents, ...expiryEvents].sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    return a.title.localeCompare(b.title);
  });
}

function CalendarCard({
  today,
  events,
  loading,
  error,
}: {
  today: Date;
  events: DashboardCalendarEvent[];
  loading: boolean;
  error: boolean;
}) {
  const todayKey = dateKey(today);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthLabel = visibleMonth.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const eventsByDay = events.reduce<Record<string, DashboardCalendarEvent[]>>(
    (acc, event) => {
      acc[event.dateKey] ??= [];
      acc[event.dateKey].push(event);
      return acc;
    },
    {},
  );
  const selectedEvents = eventsByDay[selectedDate] ?? [];
  const monthEventCount = events.filter((event) => {
    const eventDate = parseDateKey(event.dateKey);
    return (
      eventDate.getFullYear() === year && eventDate.getMonth() === month
    );
  }).length;

  function resetToday() {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(todayKey);
  }

  return (
    <section
      aria-label="Pharmacy calendar"
      className="rounded-2xl border border-gold bg-gradient-gold p-5 shadow-soft transition-all duration-200 ease-soft hover:shadow-elev-2"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-gold-ink">
            <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
            Scheduled signals
          </p>
          <h2 className="mt-1 text-[19px] font-extrabold tracking-[-0.01em] text-ink">
            {monthLabel}
          </h2>
          <p className="mt-1 text-xs font-semibold text-ink-soft">
            {loading
              ? "Loading scheduled signals..."
              : `${monthEventCount} item${monthEventCount === 1 ? "" : "s"} this month`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            aria-label="Previous month"
            className="grid h-9 w-9 place-items-center rounded-full border border-gold bg-white/65 text-ink shadow-elev-1 transition-all duration-200 ease-soft hover:-translate-y-px hover:bg-white focus-ring"
            onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            className="h-9 rounded-full border border-gold bg-white/65 px-3 text-[12px] font-extrabold text-ink shadow-elev-1 transition-all duration-200 ease-soft hover:-translate-y-px hover:bg-white focus-ring"
            onClick={resetToday}
            type="button"
          >
            Today
          </button>
          <button
            aria-label="Next month"
            className="grid h-9 w-9 place-items-center rounded-full border border-gold bg-white/65 text-ink shadow-elev-1 transition-all duration-200 ease-soft hover:-translate-y-px hover:bg-white focus-ring"
            onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
            type="button"
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-ink-soft">
        {SHORT_WEEKDAYS.map((d, index) => (
          <span key={d} title={WEEKDAYS[index]}>
            {d}
          </span>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5 text-center">
        {cells.map((day, index) => {
          if (day === null) {
            return (
              <span
                aria-hidden="true"
                key={`b-${index}`}
                className="min-h-[4.15rem] rounded-xl bg-white/20"
              />
            );
          }
          const cellDate = new Date(year, month, day);
          const cellKey = dateKey(cellDate);
          const isToday = cellKey === todayKey;
          const isSelected = cellKey === selectedDate;
          const dayEvents = eventsByDay[cellKey] ?? [];
          const categories = Array.from(
            new Set(dayEvents.map((event) => event.category)),
          ).slice(0, 4);
          const signalLabel = `${dayEvents.length} scheduled signal${dayEvents.length === 1 ? "" : "s"}`;
          return (
            <button
              aria-pressed={isSelected}
              aria-label={`Select ${calendarDayLabel(cellDate)}, ${signalLabel}`}
              key={day}
              className={cn(
                "group flex min-h-[4.15rem] flex-col items-start rounded-xl border px-2 py-2 text-left transition-all duration-200 ease-soft focus-ring",
                isSelected
                  ? "border-brand bg-white text-ink shadow-elev-2"
                  : "border-white/55 bg-white/45 text-ink-soft hover:-translate-y-px hover:border-gold hover:bg-white/75 hover:shadow-elev-1",
              )}
              onClick={() => setSelectedDate(cellKey)}
              type="button"
            >
              <span
                className={cn(
                  "tnum inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[13px] font-extrabold",
                  isToday && !isSelected && "bg-white text-brand shadow-elev-1",
                  isSelected && "bg-brand text-white",
                )}
              >
                {day}
              </span>
              <span className="mt-auto flex min-h-4 items-center gap-1">
                {categories.map((category) => (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      CALENDAR_CATEGORY_DOT[category],
                    )}
                    key={category}
                    title={CALENDAR_CATEGORY_LABEL[category]}
                  />
                ))}
              </span>
              {dayEvents.length > 0 ? (
                <span className="tnum mt-1 rounded-full bg-sidebar/90 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                  {dayEvents.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div
        aria-label="Calendar day details"
        className="mt-4 rounded-xl border border-gold bg-white/70 p-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-ink">
              {selectedDayLabel(selectedDate)}
            </h3>
            <p className="mt-0.5 text-[11px] font-semibold text-muted">
              Review before action.
            </p>
          </div>
          <Badge variant={selectedEvents.length > 0 ? "info" : "neutral"}>
            <span className="tnum">{selectedEvents.length}</span> item
            {selectedEvents.length === 1 ? "" : "s"}
          </Badge>
        </div>
        {error ? (
          <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm font-semibold text-danger-ink">
            Couldn&rsquo;t load scheduled signals.
          </p>
        ) : loading ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : selectedEvents.length === 0 ? (
          <p className="mt-3 rounded-lg bg-white/70 px-3 py-4 text-sm font-semibold text-ink-soft">
            No items scheduled for this day.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {selectedEvents.map((event) => (
              <article
                className="rounded-lg border border-line bg-white px-3 py-3 shadow-elev-1"
                key={event.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold text-ink">
                      {event.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-ink-soft">
                      {event.reason}
                    </p>
                  </div>
                  <Badge variant={calendarEventTone(event)}>
                    {workQueueStatusLabel(event.status)}
                  </Badge>
                </div>
                <p className="mt-2 text-[11px] font-semibold text-muted">
                  {[
                    CALENDAR_CATEGORY_LABEL[event.category],
                    event.patientReference
                      ? `Patient ID ${event.patientReference}`
                      : null,
                    event.pharmacyName,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <Link
                  to={event.actionHref}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-[12px] font-bold text-ink-soft transition-all duration-200 ease-soft hover:-translate-y-px hover:bg-surface-subtle hover:text-ink focus-ring"
                >
                  {event.actionLabel || "Open record"}
                  <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ----------------------- Alerts breakdown card ---------------------- */

function AlertsBreakdownCard({
  loading,
  error,
  summary,
}: {
  loading: boolean;
  error: boolean;
  summary:
    | { total: number; critical: number; warning: number; info: number }
    | undefined;
}) {
  const rows: { label: string; value: number; bar: string }[] = summary
    ? [
        { label: "Critical", value: summary.critical, bar: "bg-danger" },
        { label: "Warning", value: summary.warning, bar: "bg-warning" },
        { label: "Info", value: summary.info, bar: "bg-info" },
      ]
    : [];
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 shadow-soft transition-all duration-200 ease-soft hover:shadow-elev-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-ink">Alerts breakdown</h2>
        <Link
          to="/alerts"
          aria-label="Open alerts"
          className="text-muted transition-colors hover:text-brand focus-ring"
        >
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
      {error ? (
        <p className="mt-4 text-sm font-medium text-muted">
          Unable to load alerts.
        </p>
      ) : loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      ) : !summary || summary.total === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-success-ink">
          <AlertTriangle aria-hidden="true" className="h-4 w-4" />
          No open alerts.
        </p>
      ) : (
        <div className="mt-4 space-y-3.5">
          {rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-baseline justify-between">
                <p className="text-[13px] font-semibold text-ink-soft">
                  {row.label}
                </p>
                <p className="tnum text-[14px] font-bold text-ink">
                  {row.value}
                </p>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className={cn(
                    "h-full origin-left animate-grow-x rounded-full",
                    row.bar,
                  )}
                  style={{ width: `${Math.round((row.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

/* --------------------------- Activity card -------------------------- */

function ActivityCard({
  loading,
  error,
  events,
}: {
  loading: boolean;
  error: boolean;
  events: { id: number; action: string; actor_email: string; target_type: string; created_at: string }[];
}) {
  const top = events.slice(0, 4);
  return (
    <article className="rounded-2xl border border-line bg-surface p-5 shadow-soft transition-all duration-200 ease-soft hover:shadow-elev-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-ink">Recent activity</h2>
        <Link
          to="/audit"
          aria-label="Open audit log"
          className="text-muted transition-colors hover:text-brand focus-ring"
        >
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
      {error ? (
        <p className="mt-4 text-sm font-medium text-muted">
          Unable to load activity.
        </p>
      ) : loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : top.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-muted">
          <Activity aria-hidden="true" className="h-4 w-4" />
          No recent activity.
        </p>
      ) : (
        <div className="mt-3 space-y-3.5">
          {top.map((event, index) => (
            <div
              key={event.id}
              className={cn(index > 0 && "border-t border-line pt-3")}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold text-ink">
                  <ScrollText
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 text-muted"
                  />
                  <span className="truncate">{humanizeAction(event.action)}</span>
                </p>
                <span className="shrink-0 text-[11px] font-semibold text-muted-soft">
                  {relativeTime(event.created_at)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[12px] text-muted">
                {event.actor_email}
              </p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

/* --------------------------- Welcome card --------------------------- */

function WelcomeCard({ scope }: { scope: string }) {
  return (
    <article className="rounded-2xl bg-gradient-gold p-6 shadow-soft">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
        Current workspace
      </p>
      <h2 className="mt-2 text-lg font-bold tracking-[-0.015em] text-ink">
        Welcome to your workspace
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
        You&rsquo;re signed in to {scope}. Use the navigation to open the
        modules available to you — every action is audit-logged.
      </p>
    </article>
  );
}
