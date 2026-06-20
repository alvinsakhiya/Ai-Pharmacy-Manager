import type { Alert, AlertCategory, AlertSeverity } from "./notificationsApi";
import { useAlertsQuery } from "./useNotifications";

const SUMMARY_LABELS = [
  { key: "total", label: "Total" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warning" },
  { key: "info", label: "Info" },
] as const;

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  critical: "bg-red-50 text-red-700",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-sky-50 text-sky-700",
};

const CATEGORY_LABELS: Record<AlertCategory, string> = {
  stock: "Stock",
  dosette: "Dosette",
};

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </article>
  );
}

function Chip({ children, className }: { children: string; className: string }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function SubjectDetails({ alert }: { alert: Alert }) {
  if (alert.category === "stock") {
    return (
      <p className="mt-3 text-sm text-slate-600">
        {[alert.subject.medication_name, `Pharmacy ${alert.pharmacy_id}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
    );
  }

  if (alert.category === "dosette") {
    return (
      <p className="mt-3 text-sm text-slate-600">
        {[
          alert.subject.cycle_reference
            ? `Cycle ${alert.subject.cycle_reference}`
            : null,
          alert.subject.patient_reference
            ? `Patient ${alert.subject.patient_reference}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    );
  }

  return null;
}

function AlertCard({ alert }: { alert: Alert }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <Chip className={SEVERITY_STYLES[alert.severity]}>
          {alert.severity}
        </Chip>
        <Chip className="bg-slate-100 text-slate-700">
          {CATEGORY_LABELS[alert.category]}
        </Chip>
      </div>
      <h2 className="mt-4 text-base font-bold text-slate-950">{alert.title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">{alert.message}</p>
      <SubjectDetails alert={alert} />
    </article>
  );
}

export function AlertsScreen() {
  const alertsQuery = useAlertsQuery();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-teal-700">Live alerts</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Alerts
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Operational stock and Dosette/MDS alerts.
        </p>
      </section>

      {alertsQuery.isLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Loading alerts...
        </section>
      ) : null}

      {alertsQuery.isError ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <h2 className="text-lg font-bold text-red-900">
            Could not load alerts.
          </h2>
          <p className="mt-2 text-sm text-red-700">
            Please retry. Your session or permissions may need refreshing.
          </p>
          <button
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            onClick={() => void alertsQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </section>
      ) : null}

      {alertsQuery.isSuccess ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {SUMMARY_LABELS.map((summary) => (
              <SummaryCard
                key={summary.key}
                label={summary.label}
                value={alertsQuery.data.summary[summary.key]}
              />
            ))}
            <SummaryCard
              label="Stock"
              value={alertsQuery.data.summary.by_category.stock}
            />
            <SummaryCard
              label="Dosette"
              value={alertsQuery.data.summary.by_category.dosette}
            />
          </section>

          {alertsQuery.data.alerts.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
              No active alerts.
            </section>
          ) : (
            <section className="space-y-4">
              {alertsQuery.data.alerts.map((alert) => (
                <AlertCard alert={alert} key={alert.id} />
              ))}
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
