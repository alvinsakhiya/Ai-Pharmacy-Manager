import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  ClipboardCheck,
  Pill,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import PageHeader from "../components/Header";
import StatCard from "../components/StatCard";
import Badge from "../components/Badge";
import Button from "../components/Button";
import { Panel, PanelHeader } from "../components/Panel";
import { DashboardSkeleton } from "../components/Skeleton";
import { ErrorState } from "../components/PageState";
import useApiResource from "../hooks/useApiResource";
import useToast from "../hooks/useToast";
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
    bar: "bg-slate-400",
    badgeTone: "slate",
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

const riskBadgeTones = { High: "danger", Medium: "warning", Low: "success" };
const riskBarStyles = { High: "bg-red-500", Medium: "bg-amber-500", Low: "bg-emerald-500" };

function ForecastRiskRow({ forecast }) {
  const coverWidth =
    forecast.weeks_of_cover == null
      ? 0
      : Math.min((forecast.weeks_of_cover / 8) * 100, 100);

  return (
    <li className="flex items-center justify-between gap-4 rounded-2xl p-3 transition hover:bg-slate-50">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-900">
          {forecast.medication}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{forecast.recommendation}</p>
      </div>
      <div className="w-28 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700">
            {forecast.weeks_of_cover == null
              ? "No demand"
              : `${forecast.weeks_of_cover} wks`}
          </span>
          <Badge tone={riskBadgeTones[forecast.risk_level] || "slate"}>
            {forecast.risk_level}
          </Badge>
        </div>
        <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${riskBarStyles[forecast.risk_level] || "bg-slate-300"}`}
            style={{ width: `${coverWidth}%` }}
          />
        </div>
      </div>
    </li>
  );
}

function Dashboard() {
  const toast = useToast();
  const {
    data: stats,
    error,
    isLoading,
    isReloading,
    reload,
  } = useApiResource(
    "/dashboard/",
    "Dashboard metrics could not be retrieved. Check the API connection and try again.",
    null
  );
  const { data: forecasts, reload: reloadForecasts } = useApiResource(
    "/forecasts/",
    ""
  );

  const handleRefresh = () => {
    Promise.all([reload(), reloadForecasts()])
      .then(() => toast.success("Dashboard refreshed", "Showing the latest operational data."))
      .catch(() =>
        toast.error("Refresh failed", "Showing the most recently loaded data instead.")
      );
  };

  if (isLoading) {
    return (
      <MainLayout>
        <PageHeader
          eyebrow="Operations overview"
          title="Pharmacy dashboard"
          description="A live view of patient workload, medicine stock and expiry safety across the pharmacy."
          icon={Activity}
        />
        <DashboardSkeleton />
      </MainLayout>
    );
  }

  if (error || !stats) {
    return (
      <MainLayout>
        <Panel>
          <ErrorState
            message={error || "Dashboard metrics could not be retrieved."}
            onRetry={reload}
          />
        </Panel>
      </MainLayout>
    );
  }

  const alertCounts = Object.fromEntries(
    expiryGroups.map((group) => [group.key, stats.expiry_alerts?.[group.key] ?? 0])
  );
  const urgentCount = alertCounts.expired + alertCounts.one_month;
  const highestAlertCount = Math.max(...Object.values(alertCounts), 1);
  const atRiskForecasts = forecasts
    .filter((forecast) => forecast.risk_level !== "Low")
    .sort((a, b) => (a.weeks_of_cover ?? Infinity) - (b.weeks_of_cover ?? Infinity))
    .slice(0, 4);
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
          <Button
            icon={RotateCw}
            loading={isReloading}
            variant="secondary"
            onClick={handleRefresh}
          >
            Refresh data
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Registered patients"
          value={stats.total_patients}
          subtitle="Patient records available for care workflows"
          icon={Users}
          tone="teal"
          to="/patients"
        />
        <StatCard
          title="Medication catalogue"
          value={stats.total_medications}
          subtitle="Medicines maintained in the stock catalogue"
          icon={Pill}
          tone="blue"
          to="/inventory"
        />
        <StatCard
          title="Active dosette schedules"
          value={stats.active_dosette_records}
          subtitle="Live medication schedules driving weekly demand"
          icon={ClipboardCheck}
          tone="purple"
          to="/dosette"
        />
        <StatCard
          title="Urgent expiry attention"
          value={urgentCount}
          subtitle={`${alertCounts.expired} expired · ${alertCounts.one_month} within 1 month`}
          icon={TriangleAlert}
          tone="amber"
          to="/alerts"
        />
      </div>

      <section className="liquid-hero relative mt-6 overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-blue-300/30 blur-3xl" />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                urgentCount > 0
                  ? "bg-amber-100/75 text-amber-700 ring-1 ring-amber-200/70"
                  : "bg-emerald-100/75 text-emerald-700 ring-1 ring-emerald-200/70"
              }`}
            >
              {urgentCount > 0 ? <ShieldAlert size={23} /> : <ShieldCheck size={23} />}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                {currentDate}
              </p>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                {urgentCount > 0
                  ? `${urgentCount} ${urgentCount === 1 ? "batch needs" : "batches need"} priority expiry review.`
                  : "No urgent expiry risk across tracked stock."}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {stats.active_dosette_records} active dosette schedules are being
                supported by {stats.total_batches} tracked stock batches.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/picking-lists"
              className={buttonClassName(
                "teal",
                "border-blue-500/70 bg-blue-600 text-white shadow-lg shadow-blue-600/15 hover:bg-blue-500"
              )}
            >
              Open picking lists
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link
              to="/alerts"
              className={buttonClassName(
                "secondary",
                "border-white/80 bg-white/55 text-slate-700 shadow-sm backdrop-blur-xl hover:bg-white/80"
              )}
            >
              Review alerts
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Expiry risk overview"
            description="Stock grouped by the urgency of pharmacist review."
            eyebrow="Safety monitoring"
            icon={TriangleAlert}
            action={
              <Link
                to="/alerts"
                className="text-sm font-bold text-blue-600 underline decoration-blue-300 underline-offset-4 transition hover:text-blue-800"
              >
                View all alerts
              </Link>
            }
          />
          <ul className="space-y-5 p-5 sm:p-6">
            {expiryGroups.map((group) => {
              const count = alertCounts[group.key];
              const width = Math.max((count / highestAlertCount) * 100, count ? 8 : 0);

              return (
                <li key={group.key}>
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
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader
            title="Forecast risk snapshot"
            description="Medicines with the least stock cover against weekly dosette demand."
            eyebrow="Decision support"
            icon={BrainCircuit}
            action={
              <Link
                to="/forecasts"
                className="text-sm font-bold text-blue-600 underline decoration-blue-300 underline-offset-4 transition hover:text-blue-800"
              >
                Open forecasting
              </Link>
            }
          />
          {atRiskForecasts.length === 0 ? (
            <div className="flex items-center gap-3 p-5 text-sm font-semibold text-slate-600 sm:p-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <ShieldCheck aria-hidden="true" size={19} />
              </span>
              No medications are currently at forecast risk — stock cover is adequate.
            </div>
          ) : (
            <ul className="space-y-1 p-3 sm:p-4">
              {atRiskForecasts.map((forecast) => (
                <ForecastRiskRow key={forecast.medication} forecast={forecast} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="mt-6 overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)]">
          <div className="border-b border-white/65 bg-blue-600/8 px-5 py-6 sm:px-6 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">
                  Stock optimisation
                </p>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                  FEFO allocation controls
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Allocation prioritises safe stock use and exposes shortages
                  before dosette picking.
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <ShieldCheck aria-hidden="true" size={22} />
              </div>
            </div>
          </div>

          <div className="grid gap-1 p-3 sm:grid-cols-3 sm:p-4">
            {fefoSteps.map((step) => (
              <div
                key={step.number}
                className="flex gap-4 rounded-2xl p-3 transition hover:bg-slate-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50/75 text-xs font-black text-blue-600">
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
        </div>

        <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
          <Link
            to="/picking-lists"
            className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 underline decoration-blue-300 underline-offset-4 transition hover:text-blue-800"
          >
            <ClipboardCheck aria-hidden="true" size={17} />
            Generate a patient picking list
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </Panel>
    </MainLayout>
  );
}

export default Dashboard;
