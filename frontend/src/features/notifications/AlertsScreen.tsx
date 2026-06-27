import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BellOff,
  BellRing,
  Boxes,
  CalendarClock,
  Filter,
  ListChecks,
  PackageCheck,
  Search,
  ShieldAlert,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { KpiCard } from "../../components/ui/KpiCard";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { inputClass, labelClass, selectClass } from "../../components/ui/forms";
import { cn } from "../../lib/cn";
import { scopeLabel } from "../../lib/scope";
import type {
  Alert,
  AlertCategory,
  AlertSeverity,
  AlertSummary,
} from "./notificationsApi";
import {
  useAlertsQuery,
  useClearAlertsMutation,
  useDismissAlertMutation,
} from "./useNotifications";
import {
  ALERT_CATEGORY_LABELS,
  ALERT_SEVERITY_BADGE,
  ALERT_SEVERITY_LABELS,
  alertAction,
  alertScopeLabel,
  alertTypeLabel,
} from "./alertDisplay";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateLong(value: Date): string {
  return value.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function summaryFor(alerts: Alert[]): AlertSummary {
  return {
    total: alerts.length,
    critical: alerts.filter((alert) => alert.severity === "critical").length,
    warning: alerts.filter((alert) => alert.severity === "warning").length,
    info: alerts.filter((alert) => alert.severity === "info").length,
    by_category: {
      stock: alerts.filter((alert) => alert.category === "stock").length,
      dosette: alerts.filter((alert) => alert.category === "dosette").length,
    },
  };
}

function alertSearchText(alert: Alert): string {
  return [
    alert.title,
    alert.message,
    alert.severity,
    alert.category,
    alert.type,
    alertScopeLabel(alert),
    alert.subject.medication_name,
    alert.subject.cycle_reference,
    alert.subject.patient_reference,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function activeFilterLabel({
  category,
  searchQuery,
  severity,
}: {
  category: AlertCategory | "";
  searchQuery: string;
  severity: AlertSeverity | "";
}) {
  const active = [
    category !== "",
    severity !== "",
    searchQuery.trim().length > 0,
  ].filter(Boolean).length;

  return active === 0
    ? "All alerts"
    : `${active} active filter${active === 1 ? "" : "s"}`;
}

function SubjectDetails({ alert }: { alert: Alert }) {
  if (alert.category === "stock") {
    return (
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        {[alert.subject.medication_name, `Pharmacy ${alert.pharmacy_id}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
    );
  }

  if (alert.category === "dosette") {
    return (
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        {[
          alert.subject.cycle_reference
            ? `Cycle ${alert.subject.cycle_reference}`
            : null,
          alert.subject.patient_reference
            ? `Patient ID ${alert.subject.patient_reference}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    );
  }

  return null;
}

function SeverityBadge({ alert }: { alert: Alert }) {
  return (
    <Badge variant={ALERT_SEVERITY_BADGE[alert.severity]} dot>
      {ALERT_SEVERITY_LABELS[alert.severity]}
    </Badge>
  );
}

function AlertCard({
  alert,
  generatedAt,
  onDismiss,
  pending,
}: {
  alert: Alert;
  generatedAt: string;
  onDismiss: (alert: Alert) => void;
  pending: boolean;
}) {
  const action = alertAction(alert);
  const isOperationalDosette = alert.category === "dosette";

  return (
    <article className="interactive-card overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
      <div className="h-1 bg-warning" />
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge alert={alert} />
            <Badge variant="neutral">{ALERT_CATEGORY_LABELS[alert.category]}</Badge>
            <Badge variant="info">{alertTypeLabel(alert.type)}</Badge>
            <Badge variant="brand">Active alert</Badge>
          </div>
          <h2 className="mt-4 text-[17px] font-extrabold tracking-[-0.01em] text-ink">
            {alert.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {alert.message}
          </p>
          <SubjectDetails alert={alert} />
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-muted">
            <span>{alertScopeLabel(alert)}</span>
            <span aria-hidden="true">·</span>
            <span>Signal checked {formatDateTime(generatedAt)}</span>
          </div>
          {isOperationalDosette ? (
            <p className="mt-3 rounded-xl border border-info-border bg-info-soft px-3 py-2 text-xs font-semibold text-info-ink">
              Operational tasks are managed in Work Queue.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            to={action.href}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-semibold text-ink-soft shadow-elev-1 transition-all duration-200 ease-soft hover:-translate-y-px hover:bg-surface-subtle hover:text-ink focus-ring"
          >
            {action.label}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => onDismiss(alert)}
          >
            Dismiss alert
          </Button>
        </div>
      </div>
    </article>
  );
}

function DistinctionPanel() {
  const items = [
    {
      icon: ListChecks,
      title: "Work Queue",
      body: "Use Work Queue for tasks that need action, such as Dosette preparation, pending checks, and stock follow-up.",
      tone: "border-lilac-soft bg-lilac-soft text-brand",
    },
    {
      icon: BellRing,
      title: "Alerts",
      body: "Alerts highlight operational signals. Review before action.",
      tone: "border-warning-border bg-warning-soft text-warning-ink",
    },
  ];

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <article
            className="rounded-2xl border border-line bg-surface p-5 shadow-soft"
            key={item.title}
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-full border",
                  item.tone,
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-ink">{item.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {item.body}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function AlertsScreen() {
  const { user } = useAuth();
  const [hiddenFingerprints, setHiddenFingerprints] = useState<Set<string>>(
    () => new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "">("");
  const [categoryFilter, setCategoryFilter] = useState<AlertCategory | "">("");
  const alertsQuery = useAlertsQuery();
  const dismissAlert = useDismissAlertMutation();
  const clearAlerts = useClearAlertsMutation();
  const today = useMemo(() => new Date(), []);
  const dateLabel = useMemo(() => formatDateLong(today), [today]);
  const visibleAlerts = useMemo(
    () =>
      (alertsQuery.data?.alerts ?? []).filter(
        (alert) => !hiddenFingerprints.has(alert.id),
      ),
    [alertsQuery.data?.alerts, hiddenFingerprints],
  );
  const filteredAlerts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return visibleAlerts.filter((alert) => {
      if (severityFilter && alert.severity !== severityFilter) {
        return false;
      }
      if (categoryFilter && alert.category !== categoryFilter) {
        return false;
      }
      if (query && !alertSearchText(alert).includes(query)) {
        return false;
      }
      return true;
    });
  }, [categoryFilter, searchQuery, severityFilter, visibleAlerts]);
  const summary = useMemo(() => summaryFor(filteredAlerts), [filteredAlerts]);
  const sourceSummary = useMemo(() => summaryFor(visibleAlerts), [visibleAlerts]);
  const expiryCount = filteredAlerts.filter((alert) => alert.type === "near_expiry")
    .length;
  const filterLabel = activeFilterLabel({
    category: categoryFilter,
    searchQuery,
    severity: severityFilter,
  });

  async function handleDismiss(alert: Alert) {
    await dismissAlert.mutateAsync(alert.id);
    setHiddenFingerprints((current) => new Set(current).add(alert.id));
  }

  async function handleDismissVisible() {
    const fingerprints = filteredAlerts.map((alert) => alert.id);
    await clearAlerts.mutateAsync(fingerprints);
    setHiddenFingerprints((current) => new Set([...current, ...fingerprints]));
  }

  return (
    <div className="space-y-5">
      <header className="animate-fade-in-up space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
              Alert centre
            </p>
            <h1 className="mt-1.5 text-[30px] font-extrabold tracking-[-0.025em] text-ink sm:text-[34px]">
              Alerts
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              Review operational alerts before taking action.
            </p>
          </div>
          <Link to="/work-queue">
            <Button
              variant="secondary"
              leadingIcon={<ListChecks className="h-4 w-4" />}
            >
              Open Work Queue
            </Button>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">
            {user ? scopeLabel(user) : "Scope unavailable"}
          </Badge>
          <Badge variant="info">Human review required</Badge>
          <Badge variant="neutral">{filterLabel}</Badge>
          <Badge variant="neutral">{dateLabel}</Badge>
          <Badge variant="brand">
            {alertsQuery.isSuccess
              ? `${summary.total} alerts shown`
              : "Alerts loading"}
          </Badge>
        </div>
      </header>

      <DistinctionPanel />

      {alertsQuery.isLoading ? (
        <Panel>
          <PanelHeader
            title="Alerts"
            subtitle="Loading alerts..."
          />
          <PanelBody>
            <p className="sr-only" role="status">
              Loading alerts...
            </p>
            <SkeletonRows rows={4} />
          </PanelBody>
        </Panel>
      ) : null}

      {alertsQuery.isError ? (
        <EmptyState
          tone="danger"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
          title="Could not load alerts."
          description="Please retry. Your session or permissions may need refreshing."
          action={
            <Button
              variant="danger"
              onClick={() => void alertsQuery.refetch()}
            >
              Retry
            </Button>
          }
        />
      ) : null}

      {alertsQuery.isSuccess ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <KpiCard
              icon={<ShieldAlert className="h-4 w-4" />}
              label="Critical alerts"
              value={summary.critical}
              note="Risk signals needing review before action."
            />
            <KpiCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Warning alerts"
              value={summary.warning}
              note="Signals that may need attention."
            />
            <KpiCard
              icon={<Boxes className="h-4 w-4" />}
              label="Stock alerts"
              value={summary.by_category.stock}
              note="Stock-level system signals."
            />
            <KpiCard
              icon={<CalendarClock className="h-4 w-4" />}
              label="Expiry alerts"
              value={expiryCount}
              note="Expiry-related risk signals."
            />
            <KpiCard
              icon={<PackageCheck className="h-4 w-4" />}
              label="Dosette signals"
              value={summary.by_category.dosette}
              note="Workflow signals, with tasks managed in Work Queue."
            />
            <KpiCard
              icon={<BellRing className="h-4 w-4" />}
              label="Active alerts"
              value={summary.total}
              note={`${sourceSummary.total} active alerts before filters.`}
            />
          </section>

          <Panel>
            <PanelHeader
              title="Alert controls"
              subtitle={`${filteredAlerts.length} of ${visibleAlerts.length} alerts shown`}
              icon={<Filter className="h-4 w-4" aria-hidden="true" />}
            />
            <PanelBody>
              <div className="grid gap-4 md:grid-cols-3">
                <label className={labelClass}>
                  Search alerts
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                    />
                    <input
                      className={cn(inputClass, "pl-9")}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Title, message, reference..."
                      type="search"
                      value={searchQuery}
                    />
                  </div>
                </label>

                <label className={labelClass}>
                  Severity
                  <select
                    className={selectClass}
                    onChange={(event) =>
                      setSeverityFilter(event.target.value as AlertSeverity | "")
                    }
                    value={severityFilter}
                  >
                    <option value="">All severities</option>
                    <option value="critical">Critical</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </select>
                </label>

                <label className={labelClass}>
                  Category
                  <select
                    className={selectClass}
                    onChange={(event) =>
                      setCategoryFilter(event.target.value as AlertCategory | "")
                    }
                    value={categoryFilter}
                  >
                    <option value="">All categories</option>
                    <option value="stock">Stock</option>
                    <option value="dosette">Dosette</option>
                  </select>
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
                <Badge variant="info">{filterLabel}</Badge>
                <span>Existing alert data only</span>
              </div>
            </PanelBody>
          </Panel>

          {filteredAlerts.length === 0 ? (
            <EmptyState
              icon={<BellOff className="h-5 w-5" aria-hidden="true" />}
              title="No alerts match the current view."
              description="Adjust the filters or refresh the alert centre."
            />
          ) : (
            <Panel>
              <PanelHeader
                title="Alert inbox"
                subtitle="Alerts highlight operational signals. Review before action."
                actions={
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={clearAlerts.isPending || filteredAlerts.length === 0}
                    onClick={() => void handleDismissVisible()}
                  >
                    Dismiss visible alerts
                  </Button>
                }
              />
              <PanelBody className="space-y-3">
                {filteredAlerts.map((alert) => (
                  <AlertCard
                    alert={alert}
                    generatedAt={alertsQuery.data.generated_at}
                    key={alert.id}
                    onDismiss={(item) => void handleDismiss(item)}
                    pending={dismissAlert.isPending}
                  />
                ))}
              </PanelBody>
            </Panel>
          )}
        </>
      ) : null}
    </div>
  );
}
