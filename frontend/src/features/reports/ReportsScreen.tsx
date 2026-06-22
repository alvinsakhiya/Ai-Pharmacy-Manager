import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import type {
  DeadStockReportRow,
  ExpiryReportRow,
  ForecastReorderReportRow,
  MdsWorkloadReportRow,
  ReportFilters,
  ReportId,
  ReportPreview,
  StockMovementRow,
  TransferSuggestionsReportRow,
} from "./reportsApi";
import { downloadReportCsv, reportCsvPath } from "./reportsApi";
import { useReportPreviewQuery, useReportsDashboardQuery } from "./useReports";

const REPORTS: Array<{
  id: ReportId;
  title: string;
  description: string;
  permission: string;
  exportTypes: string[];
  humanReview: boolean;
}> = [
  {
    id: "stock_attention",
    title: "Stock attention",
    description: "Items flagged for stockout, low stock, expiry, or movement risk.",
    permission: "stock.view",
    exportTypes: ["CSV"],
    humanReview: false,
  },
  {
    id: "stock_movements",
    title: "Stock movements",
    description: "Recent receipts, adjustments, transfers, and deductions.",
    permission: "stock.view",
    exportTypes: ["CSV"],
    humanReview: false,
  },
  {
    id: "expiry",
    title: "Expiry risk",
    description: "Batches expiring inside the selected operational window.",
    permission: "stock.view",
    exportTypes: ["CSV"],
    humanReview: false,
  },
  {
    id: "dead_stock",
    title: "Dead/slow stock",
    description: "Stock movement signals for dead, slow, and active items.",
    permission: "stock.view",
    exportTypes: ["CSV"],
    humanReview: true,
  },
  {
    id: "forecast_reorder",
    title: "Forecast & reorder",
    description: "Latest forecast suggestions from stock movement history.",
    permission: "forecast.view",
    exportTypes: ["CSV"],
    humanReview: true,
  },
  {
    id: "transfer_suggestions",
    title: "Transfer suggestions",
    description: "Cross-branch suggestions for superintendent/admin review.",
    permission: "transfer_suggestion.view",
    exportTypes: ["CSV"],
    humanReview: true,
  },
  {
    id: "mds_workload",
    title: "MDS workload",
    description: "Cycle workload counts by pharmacy and status without patient names.",
    permission: "blister.view",
    exportTypes: ["CSV"],
    humanReview: false,
  },
];

const WINDOW_OPTIONS = [30, 60, 90];
const TRANSFER_STATUSES = ["OPEN", "DISMISSED", "ACTIONED"];

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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

function formatMaybeNumber(value: number | null): string {
  return value === null ? "-" : formatNumber(value);
}

function formatConfidence(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return `${Math.round(parsed * 100)}%`;
}

function toneForStatus(status: string): string {
  if (["critical", "dead", "OPEN"].includes(status)) {
    return "bg-red-50 text-red-700";
  }
  if (["warning", "slow"].includes(status)) {
    return "bg-amber-50 text-amber-700";
  }
  if (["watch", "active", "COMPLETED", "ACTIONED"].includes(status)) {
    return "bg-emerald-50 text-emerald-700";
  }
  return "bg-slate-100 text-slate-700";
}

function Badge({ label }: { label: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneForStatus(label)}`}>
      {label}
    </span>
  );
}

function CsvButton({
  filename,
  filters,
  reportId,
}: {
  filename: string;
  filters: ReportFilters;
  reportId: ReportId;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState(false);

  async function handleDownload() {
    setIsDownloading(true);
    setError(false);
    try {
      await downloadReportCsv(reportCsvPath(reportId, filters), filename);
    } catch {
      setError(true);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={isDownloading}
        onClick={() => void handleDownload()}
        type="button"
      >
        {isDownloading ? "Downloading..." : "Download CSV"}
      </button>
      {error ? (
        <p className="text-sm font-medium text-red-700">Report download failed.</p>
      ) : null}
    </div>
  );
}

function ReportCard({
  active,
  count,
  onSelect,
  report,
}: {
  active: boolean;
  count?: number;
  onSelect: () => void;
  report: (typeof REPORTS)[number];
}) {
  return (
    <button
      className={`rounded-xl border p-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
        active
          ? "border-teal-500 bg-teal-50"
          : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50"
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-bold text-slate-950">{report.title}</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {count === undefined ? "CSV" : `${count} rows`}
        </span>
      </div>
      <p className="mt-2 min-h-10 text-sm leading-5 text-slate-600">
        {report.description}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {report.exportTypes.map((exportType) => (
          <span
            className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
            key={exportType}
          >
            {exportType}
          </span>
        ))}
        {report.humanReview ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            Human review required
          </span>
        ) : null}
      </div>
    </button>
  );
}

function TableShell({
  children,
  headers,
}: {
  children: ReactNode;
  headers: string[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((header) => (
              <th
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                key={header}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">{children}</tbody>
      </table>
    </div>
  );
}

function StockAttentionPreview({ report }: { report: ReportPreview }) {
  if (report.report !== "stock_attention") {
    return null;
  }
  return (
    <TableShell
      headers={[
        "Medication",
        "Pharmacy",
        "On hand",
        "Reorder level",
        "Expiry",
        "Attention",
        "Suggested reorder",
      ]}
    >
      {report.rows.map((row) => (
        <tr key={row.stock_item_id}>
          <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
            {row.medication_name}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {row.pharmacy_id}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {row.quantity_on_hand}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {row.reorder_level}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {formatDate(row.earliest_expiry)}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-950">
            {row.attention_score}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {row.suggested_reorder_quantity}
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function StockMovementsPreview({ rows }: { rows: StockMovementRow[] }) {
  return (
    <TableShell
      headers={[
        "Date",
        "Medication",
        "Pharmacy",
        "Batch",
        "Type",
        "Quantity delta",
        "Balance after",
      ]}
    >
      {rows.map((row) => (
        <tr key={row.movement_id}>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {formatDateTime(row.created_at)}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
            {row.medication_name}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {row.pharmacy_id}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {row.batch_number || "-"}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {row.movement_type}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-950">
            {row.quantity_delta}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {row.balance_after}
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function ExpiryPreview({ rows }: { rows: ExpiryReportRow[] }) {
  return (
    <TableShell
      headers={[
        "Product",
        "Pharmacy",
        "Batch",
        "Expiry",
        "Quantity",
        "Days",
        "Severity",
      ]}
    >
      {rows.map((row) => (
        <tr key={`${row.pharmacy_id}-${row.batch_number}-${row.medication_label}`}>
          <td className="min-w-64 px-4 py-4 text-sm font-medium text-slate-950">
            {row.medication_label}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {row.pharmacy_name}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {row.batch_number}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {formatDate(row.expiry_date)}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {formatNumber(row.quantity)}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {row.days_until_expiry}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm">
            <Badge label={row.severity} />
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function DeadStockPreview({ rows }: { rows: DeadStockReportRow[] }) {
  return (
    <TableShell
      headers={[
        "Product",
        "Pharmacy",
        "On hand",
        "Days since outbound",
        "Status",
        "Suggested action",
      ]}
    >
      {rows.map((row) => (
        <tr key={`${row.pharmacy_id}-${row.medication_label}`}>
          <td className="min-w-64 px-4 py-4 text-sm font-medium text-slate-950">
            {row.medication_label}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {row.pharmacy_id}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {formatNumber(row.quantity_on_hand)}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {formatMaybeNumber(row.days_since_last_outbound)}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm">
            <Badge label={row.status} />
          </td>
          <td className="min-w-72 px-4 py-4 text-sm text-slate-700">
            {row.suggested_action}
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function ForecastPreview({ rows }: { rows: ForecastReorderReportRow[] }) {
  return (
    <TableShell
      headers={[
        "Product",
        "Pharmacy",
        "Predicted usage",
        "Current stock",
        "Suggested reorder",
        "Confidence",
        "Review",
      ]}
    >
      {rows.map((row) => (
        <tr key={`${row.forecast_run_id}-${row.medication_label}`}>
          <td className="min-w-72 px-4 py-4 text-sm font-medium text-slate-950">
            {row.medication_label}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {row.pharmacy_name}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {formatNumber(row.predicted_usage_units)} units
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {formatNumber(row.current_stock_units)} units
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-950">
            {formatNumber(row.suggested_reorder_units)} units
            {row.suggested_reorder_packs !== null ? (
              <span className="block text-xs font-normal text-slate-500">
                {formatNumber(row.suggested_reorder_packs)} packs
              </span>
            ) : null}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {formatConfidence(row.confidence)}
          </td>
          <td className="min-w-80 px-4 py-4 text-sm text-slate-700">
            Human review required before ordering.
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function TransferPreview({ rows }: { rows: TransferSuggestionsReportRow[] }) {
  return (
    <TableShell
      headers={[
        "Product",
        "Route",
        "Suggested quantity",
        "Confidence",
        "Status",
        "Reason",
      ]}
    >
      {rows.map((row) => (
        <tr key={`${row.created_at}-${row.source_pharmacy_id}-${row.medication_label}`}>
          <td className="min-w-72 px-4 py-4 text-sm font-medium text-slate-950">
            {row.medication_label}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {row.source_pharmacy_name} to {row.destination_pharmacy_name}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-950">
            {formatNumber(row.suggested_quantity_units)} units
            {row.suggested_quantity_packs !== null ? (
              <span className="block text-xs font-normal text-slate-500">
                {formatNumber(row.suggested_quantity_packs)} packs
              </span>
            ) : null}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {formatConfidence(row.confidence)}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm">
            <Badge label={row.status} />
          </td>
          <td className="min-w-96 px-4 py-4 text-sm text-slate-700">
            {row.reason}
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function MdsPreview({ rows }: { rows: MdsWorkloadReportRow[] }) {
  return (
    <TableShell
      headers={[
        "Pharmacy",
        "Cycle status",
        "Due",
        "Overdue",
        "Upcoming cycles",
      ]}
    >
      {rows.map((row) => (
        <tr key={`${row.pharmacy_id}-${row.cycle_status}`}>
          <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
            {row.pharmacy_name}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {row.cycle_status}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {formatNumber(row.due_count)}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {formatNumber(row.overdue_count)}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
            {formatNumber(row.upcoming_cycles)}
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function PreviewTable({ report }: { report: ReportPreview }) {
  if (report.report === "stock_attention") {
    return <StockAttentionPreview report={report} />;
  }
  if (report.report === "stock_movements") {
    return <StockMovementsPreview rows={report.rows} />;
  }
  if (report.report === "expiry") {
    return <ExpiryPreview rows={report.rows} />;
  }
  if (report.report === "dead_stock") {
    return <DeadStockPreview rows={report.rows} />;
  }
  if (report.report === "forecast_reorder") {
    return <ForecastPreview rows={report.rows} />;
  }
  if (report.report === "transfer_suggestions") {
    return <TransferPreview rows={report.rows} />;
  }
  return <MdsPreview rows={report.rows} />;
}

function reportFilename(reportId: ReportId): string {
  return `${reportId.replaceAll("_", "-")}-report.csv`;
}

export function ReportsScreen() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const availableReports = useMemo(
    () => REPORTS.filter((report) => can(report.permission)),
    [can],
  );
  const [activeReportId, setActiveReportId] = useState<ReportId>("stock_attention");
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | undefined>(
    undefined,
  );
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(
    undefined,
  );
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState("OPEN");

  useEffect(() => {
    if (!availableReports.some((report) => report.id === activeReportId)) {
      setActiveReportId(availableReports[0]?.id ?? "stock_attention");
    }
  }, [activeReportId, availableReports]);

  useEffect(() => {
    if (selectedPharmacyId === undefined && (user?.pharmacies ?? []).length > 0) {
      setSelectedPharmacyId(user?.pharmacies[0]?.id);
    }
  }, [selectedPharmacyId, user?.pharmacies]);

  useEffect(() => {
    if (selectedGroupId === undefined && (user?.scope.group_ids ?? []).length > 0) {
      setSelectedGroupId(user?.scope.group_ids[0]);
    }
  }, [selectedGroupId, user?.scope.group_ids]);

  const activeReport = REPORTS.find((report) => report.id === activeReportId);
  const filters = useMemo<ReportFilters>(
    () => ({
      days,
      groupId:
        activeReportId === "transfer_suggestions" ? selectedGroupId : undefined,
      pharmacyId:
        activeReportId === "transfer_suggestions" ? undefined : selectedPharmacyId,
      status: activeReportId === "transfer_suggestions" ? status : undefined,
    }),
    [activeReportId, days, selectedGroupId, selectedPharmacyId, status],
  );
  const dashboardQuery = useReportsDashboardQuery(filters);
  const previewQuery = useReportPreviewQuery(activeReportId, filters);
  const cardCounts = useMemo(() => {
    return new Map(
      (dashboardQuery.data?.cards ?? []).map((card) => [card.report, card.row_count]),
    );
  }, [dashboardQuery.data?.cards]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-teal-700">Operational exports</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Reports
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Operational exports and pharmacy intelligence reports.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {availableReports.map((report) => (
          <ReportCard
            active={report.id === activeReportId}
            count={cardCounts.get(report.id)}
            key={report.id}
            onSelect={() => setActiveReportId(report.id)}
            report={report}
          />
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          {activeReportId !== "transfer_suggestions" ? (
            <label className="text-sm font-medium text-slate-700">
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
                <option value="">All in scope</option>
                {(user?.pharmacies ?? []).map((pharmacy) => (
                  <option key={pharmacy.id} value={pharmacy.id}>
                    {pharmacy.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-sm font-medium text-slate-700">
              Group
              <select
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                onChange={(event) =>
                  setSelectedGroupId(
                    event.target.value ? Number(event.target.value) : undefined,
                  )
                }
                value={selectedGroupId ?? ""}
              >
                <option value="">All in scope</option>
                {(user?.scope.group_ids ?? []).map((groupId) => (
                  <option key={groupId} value={groupId}>
                    Group {groupId}
                  </option>
                ))}
              </select>
            </label>
          )}

          {["expiry", "dead_stock", "mds_workload"].includes(activeReportId) ? (
            <label className="text-sm font-medium text-slate-700">
              Window
              <select
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                onChange={(event) => setDays(Number(event.target.value))}
                value={days}
              >
                {WINDOW_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} days
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {activeReportId === "transfer_suggestions" ? (
            <label className="text-sm font-medium text-slate-700">
              Status
              <select
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                onChange={(event) => setStatus(event.target.value)}
                value={status}
              >
                {TRANSFER_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">Report preview</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {activeReport?.title ?? "Report"}
            </h2>
            {activeReport?.humanReview ? (
              <p className="mt-2 text-sm text-amber-700">
                Forecast and transfer outputs are operational suggestions only.
                Human review required before ordering or transfer.
              </p>
            ) : null}
          </div>
          <CsvButton
            filename={reportFilename(activeReportId)}
            filters={filters}
            reportId={activeReportId}
          />
        </div>

        {previewQuery.isLoading ? (
          <div className="p-8 text-sm text-slate-600">Loading report preview...</div>
        ) : null}

        {previewQuery.isError ? (
          <div className="bg-red-50 p-8">
            <h3 className="text-base font-bold text-red-900">
              Could not load report preview.
            </h3>
            <p className="mt-2 text-sm text-red-700">
              Please retry. Your session or permissions may need refreshing.
            </p>
            <button
              className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              onClick={() => void previewQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        {previewQuery.isSuccess ? (
          previewQuery.data.rows.length === 0 ? (
            <div className="p-8 text-sm text-slate-600">
              No rows to display for this report.
            </div>
          ) : (
            <PreviewTable report={previewQuery.data} />
          )
        ) : null}
      </section>
    </div>
  );
}
