import { useState } from "react";

import type { StockAnalyticsFlags, StockAnalyticsItem } from "../analytics/analyticsApi";
import {
  downloadReportCsv,
  STOCK_ATTENTION_CSV_PATH,
  STOCK_MOVEMENTS_CSV_PATH,
  type StockMovementRow,
} from "./reportsApi";
import {
  useStockAttentionReportQuery,
  useStockMovementsReportQuery,
} from "./useReports";

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

function CsvButton({
  filename,
  path,
}: {
  filename: string;
  path: string;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState(false);

  async function handleDownload() {
    setIsDownloading(true);
    setError(false);

    try {
      await downloadReportCsv(path, filename);
    } catch {
      setError(true);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={isDownloading}
        onClick={() => void handleDownload()}
        type="button"
      >
        {isDownloading ? "Downloading..." : "Download CSV"}
      </button>
      {error ? (
        <p className="text-sm font-medium text-red-700">
          Report download failed.
        </p>
      ) : null}
    </div>
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

function AttentionRow({ item }: { item: StockAnalyticsItem }) {
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
        {formatDate(item.earliest_expiry)}
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
            {item.reasons.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        ) : (
          <span className="text-slate-500">-</span>
        )}
      </td>
    </tr>
  );
}

function MovementRow({ movement }: { movement: StockMovementRow }) {
  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {formatDateTime(movement.created_at)}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
        {movement.medication_name}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {movement.pharmacy_id}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {movement.batch_number || "-"}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {movement.movement_type}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-950">
        {movement.quantity_delta}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {movement.balance_after}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {movement.reference || "-"}
      </td>
    </tr>
  );
}

export function ReportsScreen() {
  const stockAttentionQuery = useStockAttentionReportQuery();
  const stockMovementsQuery = useStockMovementsReportQuery();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-teal-700">Stock exports</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Reports
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Read-only stock reports and CSV exports.
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Stock attention report
            </h2>
            {stockAttentionQuery.isSuccess ? (
              <p className="mt-2 text-sm text-slate-600">
                {stockAttentionQuery.data.row_count} stock items returned.
              </p>
            ) : null}
          </div>
          <CsvButton
            filename="stock-attention-report.csv"
            path={STOCK_ATTENTION_CSV_PATH}
          />
        </div>

        {stockAttentionQuery.isLoading ? (
          <div className="p-8 text-sm text-slate-600">
            Loading stock attention report...
          </div>
        ) : null}

        {stockAttentionQuery.isError ? (
          <div className="bg-red-50 p-8">
            <h3 className="text-base font-bold text-red-900">
              Could not load stock attention report.
            </h3>
            <p className="mt-2 text-sm text-red-700">
              Please retry. Your session or permissions may need refreshing.
            </p>
            <button
              className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              onClick={() => void stockAttentionQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        {stockAttentionQuery.isSuccess ? (
          <>
            <div className="grid gap-4 bg-slate-50 p-6 md:grid-cols-2 xl:grid-cols-4">
              {SUMMARY_LABELS.map((summary) => (
                <SummaryCard
                  key={summary.key}
                  label={summary.label}
                  value={stockAttentionQuery.data.summary[summary.key]}
                />
              ))}
            </div>

            {stockAttentionQuery.data.rows.length === 0 ? (
              <div className="p-8 text-sm text-slate-600">
                No stock attention rows to display.
              </div>
            ) : (
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
                        Attention notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {stockAttentionQuery.data.rows.map((item) => (
                      <AttentionRow item={item} key={item.stock_item_id} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Stock movements report
            </h2>
            {stockMovementsQuery.isSuccess ? (
              <div className="mt-2 space-y-1 text-sm text-slate-600">
                <p>{stockMovementsQuery.data.row_count} movements returned.</p>
                {stockMovementsQuery.data.limited ? (
                  <p>
                    Showing the most recent{" "}
                    {stockMovementsQuery.data.filters.limit} movements.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <CsvButton
            filename="stock-movements-report.csv"
            path={STOCK_MOVEMENTS_CSV_PATH}
          />
        </div>

        {stockMovementsQuery.isLoading ? (
          <div className="p-8 text-sm text-slate-600">
            Loading stock movements report...
          </div>
        ) : null}

        {stockMovementsQuery.isError ? (
          <div className="bg-red-50 p-8">
            <h3 className="text-base font-bold text-red-900">
              Could not load stock movements report.
            </h3>
            <p className="mt-2 text-sm text-red-700">
              Please retry. Your session or permissions may need refreshing.
            </p>
            <button
              className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              onClick={() => void stockMovementsQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        {stockMovementsQuery.isSuccess ? (
          stockMovementsQuery.data.rows.length === 0 ? (
            <div className="p-8 text-sm text-slate-600">
              No stock movements to display.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Medication
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pharmacy
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Batch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Quantity delta
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Balance after
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reference
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {stockMovementsQuery.data.rows.map((movement) => (
                    <MovementRow
                      key={movement.movement_id}
                      movement={movement}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </section>
    </div>
  );
}
