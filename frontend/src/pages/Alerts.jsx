import {
  AlarmClock,
  CalendarClock,
  CalendarRange,
  PackageOpen,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import PageHeader from "../components/Header";
import Badge from "../components/Badge";
import Button from "../components/Button";
import { Panel } from "../components/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import useApiResource from "../hooks/useApiResource";
import { formatDate } from "../utils/helpers";

const alertGroups = [
  {
    key: "expired",
    title: "Expired stock",
    description: "Do not allocate. Quarantine and follow the pharmacy disposal process.",
    icon: ShieldAlert,
    tone: "danger",
    iconStyle: "border-red-200 bg-red-50 text-red-700",
    panelStyle: "border-red-200/80",
    bannerStyle: "bg-red-50/70",
  },
  {
    key: "one_month",
    title: "Expires within 1 month",
    description: "Prioritise review and use through the FEFO workflow where appropriate.",
    icon: AlarmClock,
    tone: "warning",
    iconStyle: "border-amber-200 bg-amber-50 text-amber-700",
    panelStyle: "border-amber-200/80",
    bannerStyle: "bg-amber-50/70",
  },
  {
    key: "three_months",
    title: "Expires within 3 months",
    description: "Monitor demand and avoid unnecessary replenishment.",
    icon: CalendarClock,
    tone: "blue",
    iconStyle: "border-blue-200 bg-blue-50 text-blue-700",
    panelStyle: "border-blue-200/80",
    bannerStyle: "bg-blue-50/70",
  },
  {
    key: "six_months",
    title: "Expires within 6 months",
    description: "Include in routine stock planning and FEFO preparation.",
    icon: CalendarRange,
    tone: "success",
    iconStyle: "border-emerald-200 bg-emerald-50 text-emerald-700",
    panelStyle: "border-emerald-200/80",
    bannerStyle: "bg-emerald-50/70",
  },
];

function Alerts() {
  const {
    data: alerts,
    error,
    isLoading,
    reload,
  } = useApiResource(
    "/expiry-alerts/",
    "Expiry alerts could not be retrieved. Check the API connection and try again.",
    null
  );

  if (isLoading) {
    return (
      <MainLayout>
        <Panel>
          <LoadingState label="Reviewing batch expiry dates..." />
        </Panel>
      </MainLayout>
    );
  }

  if (error || !alerts) {
    return (
      <MainLayout>
        <Panel>
          <ErrorState message={error} onRetry={reload} />
        </Panel>
      </MainLayout>
    );
  }

  const totalAlerts = alertGroups.reduce(
    (total, group) => total + alerts[group.key].length,
    0
  );
  const urgentCount = alerts.expired.length + alerts.one_month.length;

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Medication safety"
        title="Expiry alert centre"
        description="Review expired and approaching-expiry stock with clear clinical urgency and batch context."
        icon={TriangleAlert}
        actions={
          <Button icon={RotateCw} variant="secondary" onClick={reload}>
            Refresh alerts
          </Button>
        }
      />

      <section
        className={`mb-6 grid gap-5 rounded-[1.5rem] border p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center ${
          urgentCount > 0
            ? "border-amber-200 bg-linear-to-r from-amber-50 to-white"
            : "border-emerald-200 bg-linear-to-r from-emerald-50 to-white"
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              urgentCount > 0
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {urgentCount > 0 ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-950">
              {urgentCount > 0
                ? `${urgentCount} batch${urgentCount === 1 ? "" : "es"} need priority review`
                : "No urgent expiry risk detected"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Expired stock remains visible for safety monitoring but is excluded
              from active FEFO allocation and picking lists.
            </p>
          </div>
        </div>
        <Badge tone={urgentCount > 0 ? "warning" : "success"}>
          {totalAlerts} monitored batches
        </Badge>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {alertGroups.map((group) => {
          const Icon = group.icon;
          const batches = alerts[group.key];

          return (
            <section
              key={group.key}
              className={`surface-card overflow-hidden ${group.panelStyle}`}
            >
              <div
                className={`flex items-start justify-between gap-4 border-b border-inherit p-5 sm:p-6 ${group.bannerStyle}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${group.iconStyle}`}
                  >
                    <Icon size={21} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-950">
                      {group.title}
                    </h2>
                    <p className="mt-1 max-w-md text-xs leading-5 text-slate-600">
                      {group.description}
                    </p>
                  </div>
                </div>
                <Badge tone={group.tone}>{batches.length}</Badge>
              </div>

              {batches.length === 0 ? (
                <div className="py-2">
                  <EmptyState
                    icon={PackageOpen}
                    title="No batches in this category"
                    message="There is no current stock requiring this level of expiry review."
                  />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {batches.map((batch) => (
                    <article
                      key={batch.id}
                      className="p-5 transition hover:bg-slate-50/80 sm:p-6"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-950">{batch.medication}</p>
                          <p className="mt-1 font-mono text-xs font-bold text-slate-400">
                            Batch {batch.batch_number}
                          </p>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-sm font-black text-slate-900">
                            {formatDate(batch.expiry_date)}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            Expiry date
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Quantity
                          </p>
                          <p className="mt-1 text-sm font-black text-slate-800">
                            {batch.quantity} units
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Supplier
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold text-slate-700">
                            {batch.supplier || "Not recorded"}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </MainLayout>
  );
}

export default Alerts;
