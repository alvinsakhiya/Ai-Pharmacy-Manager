import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import type {
  ForecastItem,
  StockAnalyticsFlags,
  StockAnalyticsItem,
} from "./analyticsApi";
import {
  useGenerateForecast,
  useLatestForecastQuery,
  useStockAnalyticsOverviewQuery,
} from "./useAnalytics";

const SUMMARY_LABELS: Array<{
  key:
    | "total_items"
    | "needs_attention"
    | "stockout"
    | "low_stock"
    | "near_expiry"
    | "dead_stock"
    | "slow_moving";
  label: string;
}> = [
  { key: "total_items", label: "Total items" },
  { key: "needs_attention", label: "Needs attention" },
  { key: "stockout", label: "Stockout" },
  { key: "low_stock", label: "Low stock" },
  { key: "near_expiry", label: "Near expiry" },
  { key: "dead_stock", label: "Dead stock" },
  { key: "slow_moving", label: "Slow moving" },
];

const FLAG_LABELS: Array<{ key: keyof StockAnalyticsFlags; label: string }> = [
  { key: "stockout", label: "Stockout" },
  { key: "low_stock", label: "Low stock" },
  { key: "near_expiry", label: "Near expiry" },
  { key: "dead_stock", label: "Dead stock" },
  { key: "slow_moving", label: "Slow moving" },
];

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

function formatPackValue(value: string | number | null): string | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return String(value);
  }
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(parsed) ? 0 : 2,
  }).format(parsed);
}

function formatForecastQuantity(
  units: number,
  packs: string | number | null,
): string {
  const formattedPacks = formatPackValue(packs);
  if (formattedPacks === null) {
    return `${formatNumber(units)} units`;
  }
  return `${formattedPacks} packs / ${formatNumber(units)} units`;
}

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

function ForecastConfidence({ confidence }: { confidence: string }) {
  const percentage = Math.round(Number(confidence) * 100);
  const tone =
    percentage >= 75
      ? "bg-emerald-50 text-emerald-700"
      : percentage >= 50
        ? "bg-sky-50 text-sky-700"
        : "bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {percentage}% confidence
    </span>
  );
}

function ForecastRow({ item }: { item: ForecastItem }) {
  return (
    <tr>
      <td className="min-w-64 px-4 py-4 text-sm font-medium text-slate-950">
        {item.medication_label}
        <span className="mt-1 block text-xs font-normal text-slate-500">
          {item.history_points_count} history points over {item.window_days} days
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {formatForecastQuantity(
          item.predicted_usage_units,
          item.predicted_usage_packs,
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {formatForecastQuantity(item.current_stock_units, item.current_stock_packs)}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-950">
        {formatForecastQuantity(
          item.suggested_reorder_units,
          item.suggested_reorder_packs,
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm">
        <ForecastConfidence confidence={item.confidence} />
      </td>
      <td className="min-w-96 px-4 py-4 text-sm text-slate-700">
        <details>
          <summary className="cursor-pointer font-semibold text-teal-700">
            Explanation
          </summary>
          <p className="mt-2 leading-6">{item.explanation}</p>
        </details>
      </td>
    </tr>
  );
}

function FlagBadges({ flags }: { flags: StockAnalyticsFlags }) {
  const activeFlags = FLAG_LABELS.filter((flag) => flags[flag.key]);

  if (activeFlags.length === 0) {
    return <span className="text-sm text-slate-500">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {activeFlags.map((flag) => (
        <span
          className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
          key={flag.key}
        >
          {flag.label}
        </span>
      ))}
    </div>
  );
}

function ExpiryCell({ item }: { item: StockAnalyticsItem }) {
  if (!item.earliest_expiry) {
    return <span>-</span>;
  }

  return (
    <span>
      {formatDate(item.earliest_expiry)}
      {item.days_to_expiry !== null ? (
        <span className="block text-xs text-slate-500">
          {item.days_to_expiry} days
        </span>
      ) : null}
    </span>
  );
}

function AnalyticsRow({ item }: { item: StockAnalyticsItem }) {
  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
        {item.medication_name}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {item.pharmacy_id}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {item.quantity_on_hand}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {item.reorder_level}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        <ExpiryCell item={item} />
      </td>
      <td className="px-4 py-4 text-sm">
        <FlagBadges flags={item.flags} />
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-950">
        {item.attention_score}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {item.suggested_reorder_quantity}
      </td>
      <td className="px-4 py-4 text-sm text-slate-700">
        {item.reasons.length > 0 ? (
          <ul className="space-y-1">
            {item.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <span className="text-slate-500">-</span>
        )}
      </td>
    </tr>
  );
}

export function StockAnalyticsScreen() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const pharmacies = useMemo(() => user?.pharmacies ?? [], [user?.pharmacies]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | undefined>(
    undefined,
  );
  const [horizonDays, setHorizonDays] = useState(30);
  const stockOverviewQuery = useStockAnalyticsOverviewQuery(selectedPharmacyId);
  const latestForecastQuery = useLatestForecastQuery(selectedPharmacyId);
  const generateForecast = useGenerateForecast();
  const canRunForecast = can("forecast.run");

  useEffect(() => {
    if (selectedPharmacyId === undefined && pharmacies.length > 0) {
      setSelectedPharmacyId(pharmacies[0].id);
    }
  }, [pharmacies, selectedPharmacyId]);

  async function handleGenerateForecast() {
    if (selectedPharmacyId === undefined) {
      return;
    }

    await generateForecast.mutateAsync({
      pharmacy: selectedPharmacyId,
      horizon_days: horizonDays,
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-teal-700">
          Inventory analytics
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Stock Intelligence
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Explainable stock analytics based on inventory levels, expiry dates, and
          movement history.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">
              Forecast suggestion
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">
              Reorder forecasting
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Estimated demand based on stock movement history. Human review
              required before ordering.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {pharmacies.length > 0 ? (
              <label className="min-w-56 text-sm font-medium text-slate-700">
                Pharmacy
                <select
                  className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  onChange={(event) =>
                    setSelectedPharmacyId(
                      event.target.value ? Number(event.target.value) : undefined,
                    )
                  }
                  value={selectedPharmacyId ?? ""}
                >
                  {pharmacies.map((pharmacy) => (
                    <option key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="min-w-40 text-sm font-medium text-slate-700">
              Horizon
              <select
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                onChange={(event) => setHorizonDays(Number(event.target.value))}
                value={horizonDays}
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </label>

            {canRunForecast ? (
              <button
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  selectedPharmacyId === undefined || generateForecast.isPending
                }
                onClick={() => void handleGenerateForecast()}
                type="button"
              >
                {generateForecast.isPending
                  ? "Generating..."
                  : "Generate forecast"}
              </button>
            ) : null}
          </div>
        </div>

        {generateForecast.isError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Could not generate forecast. Check your pharmacy scope and try again.
          </p>
        ) : null}

        {selectedPharmacyId === undefined ? (
          <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Select a pharmacy to view forecasting suggestions.
          </p>
        ) : null}

        {latestForecastQuery.isLoading ? (
          <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Loading latest forecast...
          </p>
        ) : null}

        {latestForecastQuery.isError ? (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Could not load latest forecast.
          </p>
        ) : null}

        {latestForecastQuery.isSuccess && latestForecastQuery.data === null ? (
          <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No forecast generated yet.
          </p>
        ) : null}

        {latestForecastQuery.isSuccess && latestForecastQuery.data !== null ? (
          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-950">
                Latest forecast: {latestForecastQuery.data.horizon_days} days,
                model {latestForecastQuery.data.model_version}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Generated {formatDate(latestForecastQuery.data.created_at)}
              </p>
            </div>
            {latestForecastQuery.data.items.length === 0 ? (
              <p className="p-4 text-sm text-slate-600">
                No active stock items found for this pharmacy.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Predicted usage
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Current stock
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Suggested reorder
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Confidence
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Rationale
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {latestForecastQuery.data.items.map((item) => (
                      <ForecastRow item={item} key={item.id} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {stockOverviewQuery.isLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Loading stock intelligence...
        </section>
      ) : null}

      {stockOverviewQuery.isError ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <h2 className="text-lg font-bold text-red-900">
            Could not load stock intelligence.
          </h2>
          <p className="mt-2 text-sm text-red-700">
            Please retry. Your session or permissions may need refreshing.
          </p>
          <button
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            onClick={() => void stockOverviewQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </section>
      ) : null}

      {stockOverviewQuery.isSuccess ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {SUMMARY_LABELS.map((summary) => (
              <SummaryCard
                key={summary.key}
                label={summary.label}
                value={stockOverviewQuery.data.summary[summary.key]}
              />
            ))}
          </section>

          {stockOverviewQuery.data.items.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
              No stock analytics to display.
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-lg font-bold text-slate-950">
                  Attention table
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Thresholds: near expiry{" "}
                  {stockOverviewQuery.data.thresholds.near_expiry_days} days,
                  dead stock {stockOverviewQuery.data.thresholds.dead_stock_days}{" "}
                  days, slow moving below{" "}
                  {stockOverviewQuery.data.thresholds.slow_moving_threshold}{" "}
                  units consumed.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Medication
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Pharmacy
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        On hand
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Reorder level
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Expiry
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Flags
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Attention
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Reorder
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Reasons
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {stockOverviewQuery.data.items.map((item) => (
                      <AnalyticsRow item={item} key={item.stock_item_id} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
