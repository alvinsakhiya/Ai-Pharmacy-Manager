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
  Clock,
  PackageCheck,
  PoundSterling,
  ScrollText,
  TriangleAlert,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { scopeLabel } from "../../lib/scope";
import { cn } from "../../lib/cn";
import { getAlerts } from "../notifications/notificationsApi";
import { getReportPreview } from "../reports/reportsApi";
import type {
  ExpiryReport,
  MdsWorkloadReport,
  StockValuationReport,
} from "../reports/reportsApi";
import { listAuditEvents } from "../audit/auditApi";
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

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
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
  const canAudit = can("audit.view");
  const canAlerts = canStock || canBlister;

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

  if (!user) {
    return null;
  }

  const firstName = (user.full_name || user.email).split(/\s+/)[0];
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

  const hasMain = canBlister || canStock;
  const hasRail = canBlister || canStock || canAlerts || canAudit;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <header className="flex animate-fade-in-up flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
            {dateLabel}
          </p>
          <h1 className="mt-1.5 text-[26px] font-extrabold tracking-[-0.025em] text-ink sm:text-[28px]">
            Hello, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Here&rsquo;s your operations overview — {scopeLabel(user)}.
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
      </header>

      {/* KPI row */}
      <section
        aria-label="Key metrics"
        className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {canAlerts ? (
          <Kpi
            label="Open alerts"
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
              footer={
                canBlister
                  ? `${mdsDue} pack${mdsDue === 1 ? "" : "s"} due in ${mdsWindow}d`
                  : `${expiry?.row_count ?? 0} batch${
                      (expiry?.row_count ?? 0) === 1 ? "" : "es"
                    } expiring soon`
              }
              footerLink={canAlerts ? "/alerts" : undefined}
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
  value,
  icon,
  tint,
  chip,
  loading,
  error,
}: {
  label: ReactNode;
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
        <p className="text-[13px] font-semibold text-ink-soft">{label}</p>
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
            Compliance packs across your scope — prepare ahead
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
        <div className="mt-5 grid grid-cols-3 gap-3">
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
    <article className="overflow-hidden rounded-2xl bg-gradient-feature p-6 shadow-soft transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-elev-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-extrabold tracking-[-0.01em] text-ink">
            Expiring soon
          </h2>
          <p className="mt-0.5 text-[13px] font-medium text-ink-soft">
            Soonest-expiring batches — rotate or use first (FEFO)
          </p>
        </div>
        <Link
          to="/reports"
          aria-label="Open expiry report"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sidebar text-white transition-transform duration-200 ease-soft hover:scale-105 active:scale-95 focus-ring"
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
        <p className="mt-5 rounded-xl bg-white/45 px-4 py-6 text-center text-sm font-semibold text-ink-soft">
          Nothing expiring in the next {window} days. 🎉
        </p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl">
          <div className="grid grid-cols-[1.6fr_1fr_0.7fr_0.8fr] gap-2 bg-sidebar/90 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-sidebar-text">
            <span>Medication</span>
            <span>Batch</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Expiry</span>
          </div>
          <div className="divide-y divide-white/40 bg-white/35">
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

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function CalendarCard({
  today,
  footer,
  footerLink,
}: {
  today: Date;
  footer: string;
  footerLink?: string;
}) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthLabel = today.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <article className="rounded-2xl bg-gradient-gold p-5 shadow-soft transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-elev-2">
      <h2 className="text-[17px] font-extrabold text-ink">{monthLabel}</h2>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-ink-soft">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1 text-center">
        {cells.map((day, index) => {
          if (day === null) {
            return <span key={`b-${index}`} className="py-1.5" />;
          }
          const isToday = day === todayDate;
          return (
            <div
              key={day}
              className={cn(
                "py-1.5 text-[13px] font-bold tnum",
                isToday
                  ? "animate-scale-in rounded-full bg-white text-brand shadow-elev-1"
                  : "text-ink-soft",
              )}
            >
              {day}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-white/55 px-3 py-2.5">
        <p className="text-[12px] font-bold text-ink">{footer}</p>
        {footerLink ? (
          <Link
            to={footerLink}
            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-brand focus-ring"
          >
            Details
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </article>
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
