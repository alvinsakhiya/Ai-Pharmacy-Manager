import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Download,
  FileText,
  Inbox,
  ShieldAlert,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { Badge, type BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { SkeletonRows } from "../../components/ui/Skeleton";
import {
  Table,
  TableScroll,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "../../components/ui/Table";
import { labelClass, selectClass } from "../../components/ui/forms";
import { cn } from "../../lib/cn";
import type {
  DeadStockReportRow,
  ExpiryReportRow,
  ForecastReorderReportRow,
  MdsWorkloadReportRow,
  ReportFilters,
  ReportId,
  ReportPreview,
  StockMovementRow,
  StockValuationReport,
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
    id: "stock_valuation",
    title: "Stock valuation",
    description: "Stock value (quantity x unit price) by item, with totals.",
    permission: "stock.view",
    exportTypes: ["CSV"],
    humanReview: false,
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

function formatCurrency(value: string | null): string {
  if (value === null) {
    return "-";
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(parsed);
}

function formatConfidence(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return `${Math.round(parsed * 100)}%`;
}

function variantForStatus(status: string): BadgeVariant {
  if (["critical", "dead", "OPEN"].includes(status)) {
    return "danger";
  }
  if (["warning", "slow"].includes(status)) {
    return "warning";
  }
  if (["watch", "active", "COMPLETED", "ACTIONED"].includes(status)) {
    return "success";
  }
  return "neutral";
}

function StatusBadge({ label }: { label: string }) {
  return <Badge variant={variantForStatus(label)}>{label}</Badge>;
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
    <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
      <Button
        variant="primary"
        leadingIcon={<Download className="h-4 w-4" />}
        disabled={isDownloading}
        onClick={() => void handleDownload()}
      >
        Download CSV
      </Button>
      {error ? (
        <p className="text-xs font-medium text-danger-ink">
          Report download failed.
        </p>
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
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "group flex flex-col rounded-2xl border p-4 text-left shadow-soft outline-none",
        "transition-all duration-200 ease-soft active:scale-[0.99]",
        "focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        active
          ? "border-brand bg-brand-soft"
          : "border-line bg-surface hover:-translate-y-0.5 hover:border-line-strong hover:shadow-elev-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors",
            active
              ? "border-brand bg-surface text-brand-ink"
              : "border-brand-soft bg-brand-soft text-brand-ink group-hover:border-brand group-hover:bg-brand group-hover:text-white",
          )}
        >
          <FileText className="h-[18px] w-[18px]" />
        </span>
        <span className="tnum rounded-full border border-line bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-muted">
          {count === undefined ? "CSV" : `${formatNumber(count)} rows`}
        </span>
      </div>
      <h2 className="mt-3 text-[15px] font-bold tracking-[-0.01em] text-ink">
        {report.title}
      </h2>
      <p className="mt-1 min-h-10 text-[13px] leading-5 text-muted">
        {report.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {report.exportTypes.map((exportType) => (
          <Badge key={exportType} variant="neutral" icon={<FileText className="h-3 w-3" />}>
            {exportType}
          </Badge>
        ))}
        {report.humanReview ? (
          <Badge variant="warning" icon={<ShieldAlert className="h-3 w-3" />}>
            Human review required
          </Badge>
        ) : null}
      </div>
    </button>
  );
}

function StockAttentionPreview({ report }: { report: ReportPreview }) {
  if (report.report !== "stock_attention") {
    return null;
  }
  return (
    <PreviewTableShell
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
        <TR key={row.stock_item_id}>
          <TD className="whitespace-nowrap font-medium text-ink">
            {row.medication_name}
          </TD>
          <TD className="whitespace-nowrap">{row.pharmacy_id}</TD>
          <TD className="tnum whitespace-nowrap">{row.quantity_on_hand}</TD>
          <TD className="tnum whitespace-nowrap">{row.reorder_level}</TD>
          <TD className="whitespace-nowrap">{formatDate(row.earliest_expiry)}</TD>
          <TD className="tnum whitespace-nowrap font-semibold text-ink">
            {row.attention_score}
          </TD>
          <TD className="tnum whitespace-nowrap">
            {row.suggested_reorder_quantity}
          </TD>
        </TR>
      ))}
    </PreviewTableShell>
  );
}

function StockMovementsPreview({ rows }: { rows: StockMovementRow[] }) {
  return (
    <PreviewTableShell
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
        <TR key={row.movement_id}>
          <TD className="tnum whitespace-nowrap">
            {formatDateTime(row.created_at)}
          </TD>
          <TD className="whitespace-nowrap font-medium text-ink">
            {row.medication_name}
          </TD>
          <TD className="whitespace-nowrap">{row.pharmacy_id}</TD>
          <TD className="whitespace-nowrap">{row.batch_number || "-"}</TD>
          <TD className="whitespace-nowrap">{row.movement_type}</TD>
          <TD className="tnum whitespace-nowrap font-semibold text-ink">
            {row.quantity_delta}
          </TD>
          <TD className="tnum whitespace-nowrap">{row.balance_after}</TD>
        </TR>
      ))}
    </PreviewTableShell>
  );
}

function ExpiryPreview({ rows }: { rows: ExpiryReportRow[] }) {
  return (
    <PreviewTableShell
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
        <TR key={`${row.pharmacy_id}-${row.batch_number}-${row.medication_label}`}>
          <TD className="min-w-64 font-medium text-ink">{row.medication_label}</TD>
          <TD className="whitespace-nowrap">{row.pharmacy_name}</TD>
          <TD className="whitespace-nowrap">{row.batch_number}</TD>
          <TD className="whitespace-nowrap">{formatDate(row.expiry_date)}</TD>
          <TD className="tnum whitespace-nowrap">{formatNumber(row.quantity)}</TD>
          <TD className="tnum whitespace-nowrap">{row.days_until_expiry}</TD>
          <TD className="whitespace-nowrap">
            <StatusBadge label={row.severity} />
          </TD>
        </TR>
      ))}
    </PreviewTableShell>
  );
}

function DeadStockPreview({ rows }: { rows: DeadStockReportRow[] }) {
  return (
    <PreviewTableShell
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
        <TR key={`${row.pharmacy_id}-${row.medication_label}`}>
          <TD className="min-w-64 font-medium text-ink">{row.medication_label}</TD>
          <TD className="whitespace-nowrap">{row.pharmacy_id}</TD>
          <TD className="tnum whitespace-nowrap">
            {formatNumber(row.quantity_on_hand)}
          </TD>
          <TD className="tnum whitespace-nowrap">
            {formatMaybeNumber(row.days_since_last_outbound)}
          </TD>
          <TD className="whitespace-nowrap">
            <StatusBadge label={row.status} />
          </TD>
          <TD className="min-w-72">{row.suggested_action}</TD>
        </TR>
      ))}
    </PreviewTableShell>
  );
}

function ForecastPreview({ rows }: { rows: ForecastReorderReportRow[] }) {
  return (
    <PreviewTableShell
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
        <TR key={`${row.forecast_run_id}-${row.medication_label}`}>
          <TD className="min-w-72 font-medium text-ink">{row.medication_label}</TD>
          <TD className="whitespace-nowrap">{row.pharmacy_name}</TD>
          <TD className="tnum whitespace-nowrap">
            {formatNumber(row.predicted_usage_units)} units
          </TD>
          <TD className="tnum whitespace-nowrap">
            {formatNumber(row.current_stock_units)} units
          </TD>
          <TD className="tnum whitespace-nowrap font-semibold text-ink">
            {formatNumber(row.suggested_reorder_units)} units
            {row.suggested_reorder_packs !== null ? (
              <span className="block text-xs font-normal text-muted">
                {formatNumber(row.suggested_reorder_packs)} packs
              </span>
            ) : null}
          </TD>
          <TD className="tnum whitespace-nowrap">
            {formatConfidence(row.confidence)}
          </TD>
          <TD className="min-w-80">Human review required before ordering.</TD>
        </TR>
      ))}
    </PreviewTableShell>
  );
}

function TransferPreview({ rows }: { rows: TransferSuggestionsReportRow[] }) {
  return (
    <PreviewTableShell
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
        <TR key={`${row.created_at}-${row.source_pharmacy_id}-${row.medication_label}`}>
          <TD className="min-w-72 font-medium text-ink">{row.medication_label}</TD>
          <TD className="whitespace-nowrap">
            {row.source_pharmacy_name} to {row.destination_pharmacy_name}
          </TD>
          <TD className="tnum whitespace-nowrap font-semibold text-ink">
            {formatNumber(row.suggested_quantity_units)} units
            {row.suggested_quantity_packs !== null ? (
              <span className="block text-xs font-normal text-muted">
                {formatNumber(row.suggested_quantity_packs)} packs
              </span>
            ) : null}
          </TD>
          <TD className="tnum whitespace-nowrap">
            {formatConfidence(row.confidence)}
          </TD>
          <TD className="whitespace-nowrap">
            <StatusBadge label={row.status} />
          </TD>
          <TD className="min-w-96">{row.reason}</TD>
        </TR>
      ))}
    </PreviewTableShell>
  );
}

function ValuationStat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-subtle px-3.5 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
        {label}
      </p>
      <p
        className={cn(
          "tnum mt-0.5 font-bold",
          strong ? "text-lg text-brand-ink" : "text-sm text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StockValuationPreview({ report }: { report: StockValuationReport }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 border-b border-line px-5 py-4 sm:grid-cols-4 sm:px-6">
        <ValuationStat
          label="Total stock value"
          value={formatCurrency(report.summary.total_value)}
          strong
        />
        <ValuationStat
          label="Total units"
          value={formatNumber(report.summary.total_units)}
        />
        <ValuationStat
          label="Priced items"
          value={formatNumber(report.summary.priced_items)}
        />
        <ValuationStat
          label="Unpriced items"
          value={formatNumber(report.summary.unpriced_items)}
        />
      </div>
      <PreviewTableShell
        headers={[
          "Product",
          "Pharmacy",
          "On hand",
          "Unit price",
          "Box price",
          "Stock value",
        ]}
      >
        {report.rows.map((row) => (
          <TR key={row.stock_item_id}>
            <TD className="min-w-64 font-medium text-ink">
              {row.medication_label}
            </TD>
            <TD className="whitespace-nowrap">{row.pharmacy_name}</TD>
            <TD className="tnum whitespace-nowrap">
              {formatNumber(row.quantity_on_hand)}
            </TD>
            <TD className="tnum whitespace-nowrap">
              {formatCurrency(row.unit_price)}
            </TD>
            <TD className="tnum whitespace-nowrap">
              {formatCurrency(row.pack_price)}
            </TD>
            <TD className="tnum whitespace-nowrap font-semibold text-ink">
              {formatCurrency(row.stock_value)}
            </TD>
          </TR>
        ))}
      </PreviewTableShell>
    </>
  );
}

function MdsPreview({ rows }: { rows: MdsWorkloadReportRow[] }) {
  return (
    <PreviewTableShell
      headers={["Pharmacy", "Cycle status", "Due", "Overdue", "Upcoming cycles"]}
    >
      {rows.map((row) => (
        <TR key={`${row.pharmacy_id}-${row.cycle_status}`}>
          <TD className="whitespace-nowrap font-medium text-ink">
            {row.pharmacy_name}
          </TD>
          <TD className="whitespace-nowrap">{row.cycle_status}</TD>
          <TD className="tnum whitespace-nowrap">{formatNumber(row.due_count)}</TD>
          <TD className="tnum whitespace-nowrap">
            {formatNumber(row.overdue_count)}
          </TD>
          <TD className="tnum whitespace-nowrap">
            {formatNumber(row.upcoming_cycles)}
          </TD>
        </TR>
      ))}
    </PreviewTableShell>
  );
}

function PreviewTableShell({
  children,
  headers,
}: {
  children: ReactNode;
  headers: string[];
}) {
  return (
    <TableScroll className="rounded-none border-0 shadow-none">
      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            {headers.map((header) => (
              <TH key={header}>{header}</TH>
            ))}
          </TR>
        </THead>
        <TBody>{children}</TBody>
      </Table>
    </TableScroll>
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
  if (report.report === "stock_valuation") {
    return <StockValuationPreview report={report} />;
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
    <div className="space-y-5">
      <PageHeader
        className="animate-fade-in-up"
        eyebrow="Operational exports"
        title="Reports"
        subtitle="Operational exports and pharmacy intelligence reports."
      />

      <section className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

      <Panel>
        <PanelHeader title="Filters" subtitle="Scope the export and preview." />
        <PanelBody>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
            {activeReportId !== "transfer_suggestions" ? (
              <label className={labelClass}>
                Pharmacy
                <select
                  className={selectClass}
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
              <label className={labelClass}>
                Group
                <select
                  className={selectClass}
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
              <label className={labelClass}>
                Window
                <select
                  className={selectClass}
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
              <label className={labelClass}>
                Status
                <select
                  className={selectClass}
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
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                Report preview
              </p>
              <h2 className="mt-1 text-[15px] font-bold tracking-[-0.01em] text-ink">
                {activeReport?.title ?? "Report"}
              </h2>
              {activeReport?.humanReview ? (
                <p className="mt-1.5 inline-flex items-start gap-1.5 text-xs text-warning-ink">
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  />
                  <span>
                    Forecast and transfer outputs are operational suggestions only.
                    Human review required before ordering or transfer.
                  </span>
                </p>
              ) : null}
            </div>
            <CsvButton
              filename={reportFilename(activeReportId)}
              filters={filters}
              reportId={activeReportId}
            />
          </div>
        </PanelHeader>

        {previewQuery.isLoading ? (
          <div className="p-5 sm:p-6">
            <SkeletonRows rows={6} />
          </div>
        ) : null}

        {previewQuery.isError ? (
          <div className="p-5 sm:p-6">
            <EmptyState
              tone="danger"
              icon={<AlertTriangle className="h-5 w-5" />}
              title="Could not load report preview."
              description="Please retry. Your session or permissions may need refreshing."
              action={
                <Button variant="danger" onClick={() => void previewQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          </div>
        ) : null}

        {previewQuery.isSuccess ? (
          previewQuery.data.rows.length === 0 ? (
            <div className="p-5 sm:p-6">
              <EmptyState
                icon={<Inbox className="h-5 w-5" />}
                title="No rows to display for this report."
                description="Adjust the filters above or pick another report to preview."
              />
            </div>
          ) : (
            <PreviewTable report={previewQuery.data} />
          )
        ) : null}
      </Panel>
    </div>
  );
}
