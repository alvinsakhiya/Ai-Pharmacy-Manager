import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  ClipboardCheck,
  PackageOpen,
  Pill,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import PageHeader from "../components/Header";
import StatCard from "../components/StatCard";
import Badge from "../components/Badge";
import { Panel, PanelHeader } from "../components/Panel";
import { ErrorState, LoadingState } from "../components/PageState";
import useApiResource from "../hooks/useApiResource";
import { buttonClassName } from "../utils/styles";

const expiryGroups = [
  {
    key: "expired",
    label: "Expired stock",
    detail: "Remove from active allocation",
    bar: "bg-red-500",
    badgeTone: "danger",
  },
  {
    key: "one_month",
    label: "Within 1 month",
    detail: "Priority pharmacist review",
    bar: "bg-amber-500",
    badgeTone: "warning",
  },
  {
    key: "three_months",
    label: "Within 3 months",
    detail: "Monitor usage velocity",
    bar: "bg-blue-500",
    badgeTone: "blue",
  },
  {
    key: "six_months",
    label: "Within 6 months",
    detail: "Routine stock planning",
    bar: "bg-emerald-500",
    badgeTone: "success",
  },
];

const fefoSteps = [
  {
    number: "01",
    title: "Exclude expired stock",
    description: "Only positive, in-date batches enter active allocation.",
  },
  {
    number: "02",
    title: "Prioritise earliest expiry",
    description: "Usable batches are ordered by their expiry date.",
  },
  {
    number: "03",
    title: "Surface shortfalls",
    description: "Picking lists clearly identify unmet weekly quantities.",
  },
];

function Dashboard() {
  const {
    data: stats,
    error,
    isLoading,
    reload,
  } = useApiResource(
    "/dashboard/",
    "Dashboard metrics could not be retrieved. Check the API connection and try again.",
    null
  );

  if (isLoading) {
    return (
      <MainLayout>
        <Panel>
          <LoadingState label="Preparing your operations overview..." />
        </Panel>
      </MainLayout>
    );
  }

  if (error || !stats) {
    return (
      <MainLayout>
        <Panel>
          <ErrorState message={error} onRetry={reload} />
        </Panel>
      </MainLayout>
    );
  }

  const totalAlerts = Object.values(stats.expiry_alerts).reduce(
    (total, count) => total + count,
    0
  );
  const highestAlertCount = Math.max(...Object.values(stats.expiry_alerts), 1);
  const currentDate = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Operations overview"
        title="Pharmacy dashboard"
        description="A live view of patient workload, medicine stock and expiry safety across the pharmacy."
        icon={Activity}
        actions={
          <Badge dot tone="success">
            Live API data
          </Badge>
        }
      />

      <section className="relative mb-6 overflow-hidden rounded-[1.75rem] bg-linear-to-br from-[#0a1828] via-[#0b2933] to-[#07524e] p-6 text-white shadow-xl shadow-slate-950/10 sm:p-8 lg:p-10">
        <div className="subtle-grid absolute inset-0 opacity-60" />
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">
              {currentDate}
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
              Clinical operations are ready for review.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              {stats.active_dosette_records} active dosette schedules are being
              supported by {stats.total_batches} tracked stock batches.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/picking-lists"
              className={buttonClassName(
                "teal",
                "bg-teal-400 text-slate-950 shadow-none hover:bg-teal-300"
              )}
            >
              Open picking lists
              <ArrowRight size={17} />
            </Link>
            <Link
              to="/alerts"
              className={buttonClassName(
                "secondary",
                "border-white/15 bg-white/10 text-white shadow-none hover:border-white/25 hover:bg-white/15"
              )}
            >
              Review alerts
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Registered patients"
          value={stats.total_patients}
          subtitle="Patient records available for care workflows"
          icon={Users}
          tone="teal"
        />
        <StatCard
          title="Medication catalogue"
          value={stats.total_medications}
          subtitle="Medicines maintained in the stock catalogue"
          icon={Pill}
          tone="blue"
        />
        <StatCard
          title="Tracked batches"
          value={stats.total_batches}
          subtitle="Batch-level quantity and expiry visibility"
          icon={PackageOpen}
          tone="purple"
        />
        <StatCard
          title="Expiry attention"
          value={totalAlerts}
          subtitle="Batches currently visible in safety monitoring"
          icon={TriangleAlert}
          tone="amber"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Panel>
          <PanelHeader
            title="Expiry risk overview"
            description="Stock grouped by the urgency of pharmacist review."
            eyebrow="Safety monitoring"
            icon={TriangleAlert}
            action={
              <Link
                to="/alerts"
                className="text-sm font-bold text-teal-700 transition hover:text-teal-900 focus-visible:rounded-lg"
              >
                View all alerts
              </Link>
            }
          />
          <div className="space-y-5 p-5 sm:p-6">
            {expiryGroups.map((group) => {
              const count = stats.expiry_alerts[group.key];
              const width = Math.max((count / highestAlertCount) * 100, count ? 8 : 0);

              return (
                <div key={group.key}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{group.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{group.detail}</p>
                    </div>
                    <Badge tone={group.badgeTone}>
                      {count} {count === 1 ? "batch" : "batches"}
                    </Badge>
                  </div>
                  <div
                    className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
                    aria-hidden="true"
                  >
                    <div
                      className={`h-full rounded-full ${group.bar}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="bg-linear-to-br from-slate-950 to-slate-800 px-5 py-6 text-white sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-teal-300">
                  Stock optimisation
                </p>
                <h2 className="mt-2 text-xl font-bold tracking-tight">
                  FEFO allocation controls
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  The allocation workflow prioritises safe stock use and exposes
                  shortages before dosette picking.
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-400 text-slate-950">
                <ShieldCheck size={22} />
              </div>
            </div>
          </div>

          <div className="space-y-1 p-3 sm:p-4">
            {fefoSteps.map((step) => (
              <div
                key={step.number}
                className="flex gap-4 rounded-2xl p-3 transition hover:bg-slate-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xs font-black text-teal-700">
                  {step.number}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{step.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
            <Link
              to="/picking-lists"
              className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 transition hover:text-teal-900 focus-visible:rounded-lg"
            >
              <ClipboardCheck size={17} />
              Generate a patient picking list
              <ArrowRight size={16} />
            </Link>
          </div>
        </Panel>
      </div>
    </MainLayout>
  );
}

export default Dashboard;
