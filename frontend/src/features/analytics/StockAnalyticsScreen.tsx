import type { StockAnalyticsFlags, StockAnalyticsItem } from "./analyticsApi";
import { useStockAnalyticsOverviewQuery } from "./useAnalytics";

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
  const stockOverviewQuery = useStockAnalyticsOverviewQuery();

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
