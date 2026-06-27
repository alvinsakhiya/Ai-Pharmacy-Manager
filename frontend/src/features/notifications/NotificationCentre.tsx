import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Bell, ListChecks } from "lucide-react";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { cn } from "../../lib/cn";
import type { Alert, AlertSeverity } from "./notificationsApi";
import {
  ALERT_CATEGORY_LABELS,
  ALERT_SEVERITY_BADGE,
  ALERT_SEVERITY_LABELS,
  alertScopeLabel,
  alertTypeLabel,
} from "./alertDisplay";
import {
  useAlertsQuery,
  useClearAlertsMutation,
  useDismissAlertMutation,
} from "./useNotifications";

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <Badge variant={ALERT_SEVERITY_BADGE[severity]} dot>
      {ALERT_SEVERITY_LABELS[severity]}
    </Badge>
  );
}

function groupAlerts(alerts: Alert[]) {
  return {
    critical: alerts.filter((alert) => alert.severity === "critical"),
    warning: alerts.filter((alert) => alert.severity === "warning"),
    info: alerts.filter((alert) => alert.severity === "info"),
  };
}

export function NotificationCentre() {
  const [open, setOpen] = useState(false);
  const [hiddenFingerprints, setHiddenFingerprints] = useState<Set<string>>(
    () => new Set(),
  );
  const alertsQuery = useAlertsQuery();
  const dismissAlert = useDismissAlertMutation();
  const clearAlerts = useClearAlertsMutation();
  const alerts = useMemo(
    () =>
      (alertsQuery.data?.alerts ?? []).filter(
        (alert) => !hiddenFingerprints.has(alert.id),
      ),
    [alertsQuery.data?.alerts, hiddenFingerprints],
  );
  const groupedAlerts = useMemo(() => groupAlerts(alerts), [alerts]);
  const count = alerts.length;

  async function handleDismiss(alert: Alert) {
    await dismissAlert.mutateAsync(alert.id);
    setHiddenFingerprints((current) => new Set(current).add(alert.id));
  }

  async function handleClearAll() {
    const fingerprints = alerts.map((alert) => alert.id);
    await clearAlerts.mutateAsync(fingerprints);
    setHiddenFingerprints(new Set(fingerprints));
  }

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-label="Open notification centre"
        className={cn(
          "relative inline-flex h-10 w-10 items-center justify-center rounded-full border bg-surface text-ink-soft shadow-elev-1",
          "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-soft active:scale-[0.98]",
          "outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
          open
            ? "border-line-strong bg-surface-subtle text-ink"
            : "border-line-strong hover:bg-surface-subtle hover:text-ink",
        )}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {count > 0 ? (
          <span className="tnum absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <section className="absolute right-0 z-50 mt-3 w-[min(24rem,calc(100vw-2rem))] origin-top-right animate-scale-in overflow-hidden rounded-2xl border border-line bg-surface shadow-elev-2">
          <div className="flex items-start justify-between gap-4 border-b border-line bg-surface-subtle/60 px-4 py-3">
            <div className="min-w-0 space-y-2">
              <h2 className="text-sm font-bold tracking-[-0.01em] text-ink">
                Notification centre
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Review operational alerts before action. Work Queue keeps tasks
                separate.
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={count > 0 ? "brand" : "neutral"}>
                  {count} active alert{count === 1 ? "" : "s"}
                </Badge>
                <Badge variant="info">Human review required</Badge>
              </div>
            </div>
            {count > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-brand hover:text-brand-ink"
                disabled={clearAlerts.isPending}
                onClick={() => void handleClearAll()}
              >
                Dismiss visible
              </Button>
            ) : null}
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {alertsQuery.isLoading ? (
              <div className="px-4 py-4">
                <p className="sr-only" role="status">
                  Loading alerts...
                </p>
                <SkeletonRows rows={4} />
              </div>
            ) : null}

            {alertsQuery.isError ? (
              <div className="m-4 rounded-xl border border-danger-border bg-danger-soft px-4 py-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-danger-ink">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Could not load alerts.
                </p>
                <Button
                  size="sm"
                  variant="danger"
                  className="mt-3"
                  onClick={() => void alertsQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {alertsQuery.isSuccess && count === 0 ? (
              <div className="px-4 py-10 text-center">
                <span
                  aria-hidden="true"
                  className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full border border-line bg-surface-subtle text-muted"
                >
                  <Bell className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold text-ink">
                  No active alerts
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Work Queue will show tasks that need action.
                </p>
              </div>
            ) : null}

            {alertsQuery.isSuccess && count > 0 ? (
              <div className="divide-y divide-line">
                {(["critical", "warning", "info"] as AlertSeverity[]).map(
                  (severity) =>
                    groupedAlerts[severity].length > 0 ? (
                      <div key={severity} className="py-2">
                        <p className="px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                          {ALERT_SEVERITY_LABELS[severity]}
                        </p>
                        <div className="space-y-1">
                          {groupedAlerts[severity].map((alert) => (
                            <article
                              className="px-4 py-3 transition-colors duration-150 ease-soft hover:bg-surface-subtle"
                              key={alert.id}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <SeverityBadge severity={alert.severity} />
                                    <Badge variant="neutral">
                                      {ALERT_CATEGORY_LABELS[alert.category]}
                                    </Badge>
                                    <Badge variant="info">
                                      {alertTypeLabel(alert.type)}
                                    </Badge>
                                  </div>
                                  <h3 className="mt-2 text-sm font-semibold text-ink">
                                    {alert.title}
                                  </h3>
                                  <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                                    {alert.message}
                                  </p>
                                  <p className="mt-1 text-xs text-muted">
                                    {alertScopeLabel(alert)}
                                  </p>
                                  {alert.category === "dosette" ? (
                                    <p className="mt-1 text-xs font-semibold text-info-ink">
                                      Managed in Work Queue.
                                    </p>
                                  ) : null}
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="shrink-0 text-muted hover:text-ink"
                                  disabled={dismissAlert.isPending}
                                  onClick={() => void handleDismiss(alert)}
                                >
                                  Dismiss alert
                                </Button>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : null,
                )}
              </div>
            ) : null}
          </div>

          <div className="border-t border-line px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors duration-150 ease-soft hover:text-brand-ink"
                onClick={() => setOpen(false)}
                to="/alerts"
              >
                Open Alerts
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors duration-150 ease-soft hover:text-ink"
                onClick={() => setOpen(false)}
                to="/work-queue"
              >
                <ListChecks className="h-4 w-4" aria-hidden="true" />
                Open Work Queue
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
