import { useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  PackageSearch,
  RotateCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import PageHeader from "../components/Header";
import Badge from "../components/Badge";
import Button from "../components/Button";
import SearchField from "../components/SearchField";
import { Panel } from "../components/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import useApiResource from "../hooks/useApiResource";

const riskConfig = {
  High: {
    tone: "danger",
    icon: AlertTriangle,
    bar: "bg-red-500",
    panel: "border-red-200 bg-red-50/60",
  },
  Medium: {
    tone: "warning",
    icon: TrendingUp,
    bar: "bg-amber-500",
    panel: "border-amber-200 bg-amber-50/60",
  },
  Low: {
    tone: "success",
    icon: CheckCircle2,
    bar: "bg-emerald-500",
    panel: "border-emerald-200 bg-emerald-50/60",
  },
};

function RiskBadge({ risk }) {
  const config = riskConfig[risk] || riskConfig.Low;

  return (
    <Badge icon={config.icon} tone={config.tone}>
      {risk} risk
    </Badge>
  );
}

function CoverIndicator({ weeks, risk }) {
  const config = riskConfig[risk] || riskConfig.Low;
  const width = weeks == null ? 0 : Math.min((weeks / 8) * 100, 100);

  return (
    <div className="min-w-32">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-black text-slate-900">
          {weeks == null ? "No demand" : `${weeks} weeks`}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${config.bar}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function Forecasts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const {
    data: forecasts,
    error,
    isLoading,
    reload,
  } = useApiResource(
    "/forecasts/",
    "Forecasting data could not be retrieved. Check the API connection and try again."
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredForecasts = forecasts.filter((item) => {
    const matchesSearch = [item.medication, item.recommendation, item.risk_level]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery));
    const matchesRisk = riskFilter === "All" || item.risk_level === riskFilter;

    return matchesSearch && matchesRisk;
  });

  const highRiskCount = forecasts.filter((item) => item.risk_level === "High").length;
  const mediumRiskCount = forecasts.filter(
    (item) => item.risk_level === "Medium"
  ).length;
  const totalWeeklyDemand = forecasts.reduce(
    (total, item) => total + item.predicted_weekly_demand,
    0
  );

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Decision support"
        title="AI demand forecasting"
        description="Translate active dosette demand into stock-cover visibility, risk classification and reorder guidance."
        icon={BrainCircuit}
        actions={
          <Button icon={RotateCw} variant="secondary" onClick={reload}>
            Refresh forecast
          </Button>
        }
      />

      {!isLoading && !error && (
        <section className="liquid-hero relative mb-6 overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-300/30 blur-3xl" />
          <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100/75 text-violet-700 ring-1 ring-violet-200/70">
                <Sparkles size={23} />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-950">
                  Forecast intelligence summary
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Recommendations are derived from current batch stock and weekly
                  demand across active dosette schedules.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-2xl border border-white/75 bg-white/48 px-3 py-3 text-center shadow-sm backdrop-blur-xl">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  High risk
                </p>
                <p className="mt-1 text-xl font-black text-red-600">{highRiskCount}</p>
              </div>
              <div className="rounded-2xl border border-white/75 bg-white/48 px-3 py-3 text-center shadow-sm backdrop-blur-xl">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Medium
                </p>
                <p className="mt-1 text-xl font-black text-amber-600">
                  {mediumRiskCount}
                </p>
              </div>
              <div className="rounded-2xl border border-white/75 bg-white/48 px-3 py-3 text-center shadow-sm backdrop-blur-xl">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Weekly demand
                </p>
                <p className="mt-1 text-xl font-black text-blue-600">
                  {totalWeeklyDemand}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 sm:p-5 lg:flex-row">
          <SearchField
            id="forecast-search"
            label="Search forecasts"
            placeholder="Search medication, recommendation or risk..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
          <label className="sr-only" htmlFor="risk-filter">
            Filter by risk
          </label>
          <select
            id="risk-filter"
            className="field-control w-full font-semibold lg:max-w-48"
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value)}
          >
            <option value="All">All risk levels</option>
            <option value="High">High risk</option>
            <option value="Medium">Medium risk</option>
            <option value="Low">Low risk</option>
          </select>
        </div>

        {isLoading ? (
          <LoadingState label="Generating demand forecast..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filteredForecasts.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No matching forecast records"
            message="Adjust the medication search or risk filter to review other recommendations."
          />
        ) : (
          <>
            <div className="scrollbar-thin hidden overflow-x-auto lg:block">
              <table className="data-table min-w-[1120px]">
                <thead>
                  <tr>
                    <th>Medication</th>
                    <th>Current stock</th>
                    <th>Weekly demand</th>
                    <th>Weeks of cover</th>
                    <th>Recommendation</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredForecasts.map((item) => (
                    <tr key={item.medication}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700">
                            <BrainCircuit size={19} />
                          </div>
                          <span className="font-bold text-slate-900">
                            {item.medication}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="text-lg font-black text-slate-950">
                          {item.current_stock}
                        </span>
                        <span className="ml-1 text-xs font-semibold text-slate-400">
                          units
                        </span>
                      </td>
                      <td>
                        <span className="text-lg font-black text-slate-950">
                          {item.predicted_weekly_demand}
                        </span>
                        <span className="ml-1 text-xs font-semibold text-slate-400">
                          / week
                        </span>
                      </td>
                      <td>
                        <CoverIndicator
                          risk={item.risk_level}
                          weeks={item.weeks_of_cover}
                        />
                      </td>
                      <td className="max-w-xs">
                        <p className="text-sm font-semibold leading-6 text-slate-600">
                          {item.recommendation}
                        </p>
                      </td>
                      <td>
                        <RiskBadge risk={item.risk_level} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:hidden">
              {filteredForecasts.map((item) => {
                const config = riskConfig[item.risk_level] || riskConfig.Low;

                return (
                  <article
                    key={item.medication}
                    className={`rounded-2xl border p-4 ${config.panel}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Medication forecast
                        </p>
                        <h2 className="mt-1 font-bold text-slate-950">
                          {item.medication}
                        </h2>
                      </div>
                      <RiskBadge risk={item.risk_level} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white/80 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Current stock
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-950">
                          {item.current_stock}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/80 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Weekly demand
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-950">
                          {item.predicted_weekly_demand}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl bg-white/80 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Weeks of cover
                      </p>
                      <div className="mt-2">
                        <CoverIndicator
                          risk={item.risk_level}
                          weeks={item.weeks_of_cover}
                        />
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-white bg-white/70 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Recommendation
                      </p>
                      <p className="mt-1 text-sm font-bold leading-6 text-slate-800">
                        {item.recommendation}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </Panel>
    </MainLayout>
  );
}

export default Forecasts;
