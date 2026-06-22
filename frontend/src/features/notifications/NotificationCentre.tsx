import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { Alert, AlertSeverity } from "./notificationsApi";
import {
  useAlertsQuery,
  useClearAlertsMutation,
  useDismissAlertMutation,
} from "./useNotifications";

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  critical: "bg-red-50 text-red-700",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-sky-50 text-sky-700",
};

const CATEGORY_LABELS = {
  stock: "Stock",
  dosette: "Dosette",
} as const;

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        SEVERITY_STYLES[severity],
      ].join(" ")}
    >
      {SEVERITY_LABELS[severity]}
    </span>
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
    await clearAlerts.mutateAsync(undefined);
    setHiddenFingerprints(new Set(fingerprints));
  }

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-label="Open notification centre"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <BellIcon />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <section className="absolute right-0 z-50 mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-950">
                Notifications
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Dismissed alerts hide from your notification centre only.
              </p>
            </div>
            {count > 0 ? (
              <button
                className="text-sm font-semibold text-teal-700 transition hover:text-teal-900 disabled:cursor-not-allowed disabled:text-slate-400"
                disabled={clearAlerts.isPending}
                onClick={() => void handleClearAll()}
                type="button"
              >
                Clear all
              </button>
            ) : null}
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {alertsQuery.isLoading ? (
              <p className="px-4 py-6 text-sm text-slate-600">
                Loading notifications...
              </p>
            ) : null}

            {alertsQuery.isError ? (
              <div className="bg-red-50 px-4 py-5">
                <p className="text-sm font-semibold text-red-900">
                  Could not load notifications.
                </p>
                <button
                  className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  onClick={() => void alertsQuery.refetch()}
                  type="button"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {alertsQuery.isSuccess && count === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-600">
                No active alerts
              </p>
            ) : null}

            {alertsQuery.isSuccess && count > 0 ? (
              <div className="divide-y divide-slate-100">
                {(["critical", "warning", "info"] as AlertSeverity[]).map(
                  (severity) =>
                    groupedAlerts[severity].length > 0 ? (
                      <div key={severity} className="py-2">
                        <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {SEVERITY_LABELS[severity]}
                        </p>
                        <div className="space-y-1">
                          {groupedAlerts[severity].map((alert) => (
                            <article
                              className="px-4 py-3 transition hover:bg-slate-50"
                              key={alert.id}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap gap-2">
                                    <SeverityBadge severity={alert.severity} />
                                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                      {CATEGORY_LABELS[alert.category]}
                                    </span>
                                  </div>
                                  <h3 className="mt-2 text-sm font-semibold text-slate-950">
                                    {alert.title}
                                  </h3>
                                  <p className="mt-1 text-sm leading-5 text-slate-600">
                                    {alert.message}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Pharmacy {alert.pharmacy_id}
                                  </p>
                                </div>
                                <button
                                  className="text-sm font-semibold text-slate-500 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
                                  disabled={dismissAlert.isPending}
                                  onClick={() => void handleDismiss(alert)}
                                  type="button"
                                >
                                  Dismiss
                                </button>
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

          <div className="border-t border-slate-200 px-4 py-3">
            <Link
              className="text-sm font-semibold text-teal-700 transition hover:text-teal-900"
              onClick={() => setOpen(false)}
              to="/alerts"
            >
              Open Alerts page
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
