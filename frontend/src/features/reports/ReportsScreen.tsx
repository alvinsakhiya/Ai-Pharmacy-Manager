import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArchiveX,
  ArrowRightLeft,
  BarChart3,
  Boxes,
  CalendarClock,
  ClipboardList,
  Download,
  FileText,
  Inbox,
  Layers,
  PackageSearch,
  ShieldAlert,
  TrendingUp,
  type LucideIcon,
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
  category: ReportCategoryId;
  permission: string;
  exportTypes: string[];
  humanReview: boolean;
  icon: LucideIcon;
}> = [
  {
    id: "stock_attention",
    title: "Stock attention",
    description: "Items flagged for stockout, low stock, expiry, or movement risk.",
    category: "stock_safety",
    permission: "stock.view",
    exportTypes: ["CSV"],
    humanReview: false,
    icon: ShieldAlert,
  },
  {
    id: "stock_movements",
    title: "Stock movements",
    description: "Recent receipts, adjustments, transfers, and deductions.",
    category: "stock_efficiency",
    permission: "stock.view",
    exportTypes: ["CSV"],
    humanReview: false,
    icon: ClipboardList,
  },
  {
    id: "expiry",
    title: "Expiry risk",
    description: "Batches expiring inside the selected operational window.",
    category: "stock_safety",
    permission: "stock.view",
    exportTypes: ["CSV"],
    humanReview: false,
    icon: CalendarClock,
  },
  {
    id: "dead_stock",
    title: "Dead/slow stock",
    description: "Stock movement signals for dead, slow, and active items.",
    category: "stock_efficiency",
    permission: "stock.view",
    exportTypes: ["CSV"],
    humanReview: true,
    icon: ArchiveX,
  },
  {
    id: "stock_valuation",
    title: "Stock valuation",
    description: "Stock value (quantity x unit price) by item, with totals.",
    category: "stock_efficiency",
    permission: "stock.view",
    exportTypes: ["CSV"],
    humanReview: false,
    icon: Boxes,
  },
  {
    id: "forecast_reorder",
    title: "Forecast & reorder",
    description: "Latest forecast suggestions from stock movement history.",
    category: "forecasting",
    permission: "forecast.view",
    exportTypes: ["CSV"],
    humanReview: true,
    icon: TrendingUp,
  },
  {
    id: "transfer_suggestions",
    title: "Transfer suggestions",
    description: "Cross-branch suggestions for superintendent/admin review.",
    category: "forecasting",
    permission: "transfer_suggestion.view",
    exportTypes: ["CSV"],
    humanReview: true,
    icon: ArrowRightLeft,
  },
  {
    id: "mds_workload",
    title: "MDS workload",
    description: "Cycle workload counts by pharmacy and status without patient names.",
    category: "dosette_workload",
    permission: "blister.view",
    exportTypes: ["CSV"],
    humanReview: false,
    icon: Layers,
  },
];

type ReportCategoryId =
  | "stock_safety"
  | "stock_efficiency"
  | "forecasting"
  | "dosette_workload";

const REPORT_CATEGORIES: Array<{
  id: ReportCategoryId;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: "stock_safety",
    title: "Stock safety",
    description: "Expiry, stockout, and low-stock attention.",
    icon: ShieldAlert,
  },
  {
    id: "stock_efficiency",
    title: "Stock efficiency",
    description: "Movement, valuation, dead-stock, and utilisation signals.",
    icon: PackageSearch,
  },
  {
    id: "forecasting",
    title: "Forecasting & planning",
    description: "Forecast estimates and potential transfer opportunities.",
    icon: TrendingUp,
  },
  {
    id: "dosette_workload",
    title: "Dosette workload",
    description: "MDS cycle workload by pharmacy and status.",
    icon: Layers,
  },
];

const SUMMARY_CARDS: Array<{
  report: ReportId;
  label: string;
  helper: string;
  icon: LucideIcon;
}> = [
  {
    report: "expiry",
    label: "Expiring soon",
    helper: "Batches in the current expiry window.",
    icon: CalendarClock,
  },
  {
    report: "dead_stock",
    label: "Dead stock lines",
    helper: "Lines for operational stock review.",
    icon: ArchiveX,
  },
  {
    report: "forecast_reorder",
    label: "Reorder suggestions",
    helper: "Suggested reorder review items.",
    icon: TrendingUp,
  },
  {
    report: "transfer_suggestions",
    label: "Transfer suggestions",
    helper: "Potential transfer opportunities.",
    icon: ArrowRightLeft,
  },
  {
    report: "mds_workload",
    label: "MDS workload",
    helper: "Cycle status workload rows.",
    icon: Layers,
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

function percentage(value: number, total: number): number {
  if (total <= 0 || value <= 0) {
    return 0;
  }
  return Math.max(4, Math.round((value / total) * 100));
}

function reportTitle(reportId: ReportId): string {
  return REPORTS.find((report) => report.id === reportId)?.title ?? "Report";
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
  reportTitle,
}: {
  filename: string;
  filters: ReportFilters;
  reportId: ReportId;
  reportTitle: string;
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
        Export CSV
      </Button>
      <p className="max-w-52 text-right text-xs leading-snug text-muted">
        {reportTitle} export. Exports reflect the current filtered report.
      </p>
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
  const Icon = report.icon;
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
          <Icon className="h-[18px] w-[18px]" />
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

function SummaryMetricCard({
  count,
  helper,
  icon: Icon,
  label,
  loading,
}: {
  count: number | undefined;
  helper: string;
  icon: LucideIcon;
  label: string;
  loading: boolean;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-lilac-soft bg-lilac-soft text-brand"
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <Badge variant={count === undefined && !loading ? "neutral" : "brand"}>
          CSV ready
        </Badge>
      </div>
      <p className="mt-4 text-sm font-semibold text-muted">{label}</p>
      <p className="tnum mt-1 text-2xl font-extrabold tracking-[-0.02em] text-ink">
        {loading ? "..." : count === undefined ? "Not available" : formatNumber(count)}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted">{helper}</p>
    </article>
  );
}

function ReportsSummaryCards({
  availableReports,
  cardCounts,
  loading,
}: {
  availableReports: typeof REPORTS;
  cardCounts: Map<ReportId, number>;
  loading: boolean;
}) {
  const availableIds = new Set(availableReports.map((report) => report.id));
  const summaryCards = SUMMARY_CARDS.filter((card) =>
    availableIds.has(card.report),
  );

  if (summaryCards.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Report summaries"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
    >
      {summaryCards.map((card) => (
        <SummaryMetricCard
          count={cardCounts.get(card.report)}
          helper={card.helper}
          icon={card.icon}
          key={card.report}
          label={card.label}
          loading={loading}
        />
      ))}
    </section>
  );
}

function ReportCategoryCards({
  activeReportId,
  availableReports,
  onSelectReport,
}: {
  activeReportId: ReportId;
  availableReports: typeof REPORTS;
  onSelectReport: (reportId: ReportId) => void;
}) {
  const availableByCategory = new Map<ReportCategoryId, typeof REPORTS>();
  for (const category of REPORT_CATEGORIES) {
    availableByCategory.set(
      category.id,
      availableReports.filter((report) => report.category === category.id),
    );
  }

  return (
    <section aria-label="Report categories" className="grid gap-3 lg:grid-cols-4">
      {REPORT_CATEGORIES.map((category) => {
        const reports = availableByCategory.get(category.id) ?? [];
        if (reports.length === 0) {
          return null;
        }
        const Icon = category.icon;
        const active = reports.some((report) => report.id === activeReportId);
        return (
          <button
            aria-pressed={active}
            className={cn(
              "rounded-2xl border p-4 text-left shadow-soft transition-all duration-200 ease-soft focus-ring",
              active
                ? "border-brand bg-brand-soft"
                : "border-line bg-surface hover:-translate-y-0.5 hover:border-line-strong hover:shadow-elev-2",
            )}
            key={category.id}
            onClick={() => onSelectReport(reports[0].id)}
            type="button"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-surface-subtle text-brand"
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-ink">{category.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {category.description}
                </p>
              </div>
            </div>
            <p aria-hidden="true" className="mt-3 text-xs font-semibold text-ink-soft">
              {reports.map((report) => report.title).join(" · ")}
            </p>
          </button>
        );
      })}
    </section>
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

function InsightStat({
  helper,
  label,
  tone = "neutral",
  value,
}: {
  helper?: string;
  label: string;
  tone?: "neutral" | "warning" | "danger" | "success" | "info";
  value: string;
}) {
  const toneClass = {
    neutral: "border-line bg-surface-subtle text-ink",
    warning: "border-warning-border bg-warning-soft text-warning-ink",
    danger: "border-danger-border bg-danger-soft text-danger-ink",
    success: "border-success-border bg-success-soft text-success-ink",
    info: "border-info-border bg-info-soft text-info-ink",
  }[tone];

  return (
    <div className={cn("rounded-xl border px-3.5 py-3", toneClass)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] opacity-75">
        {label}
      </p>
      <p className="tnum mt-1 text-xl font-extrabold tracking-[-0.02em]">
        {value}
      </p>
      {helper ? (
        <p className="mt-1 text-xs leading-relaxed opacity-80">{helper}</p>
      ) : null}
    </div>
  );
}

function BarMeter({
  label,
  max,
  tone = "brand",
  value,
}: {
  label: string;
  max: number;
  tone?: "brand" | "danger" | "warning" | "success" | "info";
  value: number;
}) {
  const colors = {
    brand: "bg-brand",
    danger: "bg-danger",
    warning: "bg-warning",
    success: "bg-success",
    info: "bg-info",
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-ink-soft">{label}</span>
        <span className="tnum font-bold text-ink">{formatNumber(value)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken">
        <div
          aria-hidden="true"
          className={cn("h-full rounded-full", colors[tone])}
          style={{ width: `${percentage(value, max)}%` }}
        />
      </div>
    </div>
  );
}

function ReportInsightPanel({ report }: { report: ReportPreview }) {
  if (report.report === "stock_attention") {
    const summary = report.summary;
    const max = Math.max(
      summary.stockout,
      summary.low_stock,
      summary.near_expiry,
      summary.dead_stock,
      summary.slow_moving,
      1,
    );
    return (
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <div className="grid gap-3 md:grid-cols-4">
          <InsightStat
            label="Needs attention"
            value={formatNumber(summary.needs_attention)}
            tone={summary.needs_attention > 0 ? "warning" : "success"}
          />
          <InsightStat label="Stockout" value={formatNumber(summary.stockout)} tone="danger" />
          <InsightStat label="Low stock" value={formatNumber(summary.low_stock)} tone="warning" />
          <InsightStat label="Total items" value={formatNumber(summary.total_items)} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <BarMeter label="Near expiry" max={max} value={summary.near_expiry} tone="warning" />
          <BarMeter label="Slow moving" max={max} value={summary.slow_moving} tone="info" />
        </div>
      </div>
    );
  }

  if (report.report === "expiry") {
    const expired = report.rows.filter((row) => row.days_until_expiry < 0).length;
    const sevenDays = report.rows.filter(
      (row) => row.days_until_expiry >= 0 && row.days_until_expiry <= 7,
    ).length;
    const thirtyDays = report.rows.filter(
      (row) => row.days_until_expiry > 7 && row.days_until_expiry <= 30,
    ).length;
    const later = report.rows.filter((row) => row.days_until_expiry > 30).length;
    const max = Math.max(expired, sevenDays, thirtyDays, later, 1);
    return (
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <div className="grid gap-3 md:grid-cols-4">
          <InsightStat
            label="Expiry rows"
            value={formatNumber(report.row_count)}
            helper={`${report.filters.window_days}-day report window`}
          />
          <InsightStat label="Expired" value={formatNumber(expired)} tone="danger" />
          <InsightStat label="0-7 days" value={formatNumber(sevenDays)} tone="warning" />
          <InsightStat label="8-30 days" value={formatNumber(thirtyDays)} tone="info" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <BarMeter label="Expired" max={max} value={expired} tone="danger" />
          <BarMeter label="0-7 days" max={max} value={sevenDays} tone="warning" />
          <BarMeter label="8-30 days" max={max} value={thirtyDays} tone="info" />
          <BarMeter label="31+ days" max={max} value={later} tone="success" />
        </div>
      </div>
    );
  }

  if (report.report === "dead_stock") {
    const dead = report.rows.filter((row) => row.status === "dead").length;
    const slow = report.rows.filter((row) => row.status === "slow").length;
    const active = report.rows.filter((row) => row.status === "active").length;
    const longestGap = Math.max(
      0,
      ...report.rows.map((row) => row.days_since_last_outbound ?? 0),
    );
    return (
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <div className="grid gap-3 md:grid-cols-5">
          <InsightStat label="Lines reviewed" value={formatNumber(report.row_count)} />
          <InsightStat label="Dead stock lines" value={formatNumber(dead)} tone="danger" />
          <InsightStat label="Slow stock lines" value={formatNumber(slow)} tone="warning" />
          <InsightStat label="Active lines" value={formatNumber(active)} tone="success" />
          <InsightStat
            label="Estimated value"
            value="Not available"
            helper="No value field returned by this report."
          />
        </div>
        <p className="mt-3 text-xs font-medium text-muted">
          Longest recorded gap since outbound movement: {formatNumber(longestGap)} days.
        </p>
      </div>
    );
  }

  if (report.report === "stock_valuation") {
    return (
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <div className="grid gap-3 md:grid-cols-4">
          <InsightStat
            label="Total stock value"
            value={formatCurrency(report.summary.total_value)}
            tone="info"
          />
          <InsightStat label="Total units" value={formatNumber(report.summary.total_units)} />
          <InsightStat label="Priced items" value={formatNumber(report.summary.priced_items)} />
          <InsightStat
            label="Unpriced items"
            value={formatNumber(report.summary.unpriced_items)}
            tone={report.summary.unpriced_items > 0 ? "warning" : "success"}
          />
        </div>
      </div>
    );
  }

  if (report.report === "forecast_reorder") {
    const totalUnits = report.rows.reduce(
      (total, row) => total + row.suggested_reorder_units,
      0,
    );
    const packRows = report.rows.filter(
      (row) => row.suggested_reorder_packs !== null,
    ).length;
    return (
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <div className="grid gap-3 md:grid-cols-4">
          <InsightStat
            label="Suggested reorder review"
            value={formatNumber(report.row_count)}
            helper="Review before ordering."
            tone="warning"
          />
          <InsightStat
            label="Forecast estimate"
            value={`${formatNumber(totalUnits)} units`}
          />
          <InsightStat label="Pack estimates" value={formatNumber(packRows)} />
          <InsightStat
            label="Human review"
            value="Required"
            helper="Ordering is not performed from this report."
            tone="warning"
          />
        </div>
      </div>
    );
  }

  if (report.report === "transfer_suggestions") {
    const open = report.rows.filter((row) => row.status === "OPEN").length;
    const actioned = report.rows.filter((row) => row.status === "ACTIONED").length;
    return (
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <div className="grid gap-3 md:grid-cols-4">
          <InsightStat
            label="Potential opportunity"
            value={formatNumber(report.row_count)}
            helper="Review before transfer."
            tone="info"
          />
          <InsightStat label="Open" value={formatNumber(open)} tone="warning" />
          <InsightStat label="Actioned" value={formatNumber(actioned)} tone="success" />
          <InsightStat
            label="Human review"
            value="Required"
            helper="Transfers are not performed from this report."
            tone="warning"
          />
        </div>
      </div>
    );
  }

  if (report.report === "mds_workload") {
    const due = report.rows.reduce((total, row) => total + row.due_count, 0);
    const overdue = report.rows.reduce((total, row) => total + row.overdue_count, 0);
    const upcoming = report.rows.reduce(
      (total, row) => total + row.upcoming_cycles,
      0,
    );
    const max = Math.max(due, overdue, upcoming, 1);
    return (
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <div className="grid gap-3 md:grid-cols-4">
          <InsightStat label="Workload rows" value={formatNumber(report.row_count)} />
          <InsightStat label="Due cycles" value={formatNumber(due)} tone="warning" />
          <InsightStat label="Overdue cycles" value={formatNumber(overdue)} tone="danger" />
          <InsightStat label="Upcoming cycles" value={formatNumber(upcoming)} tone="info" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <BarMeter label="Due" max={max} value={due} tone="warning" />
          <BarMeter label="Overdue" max={max} value={overdue} tone="danger" />
          <BarMeter label="Upcoming" max={max} value={upcoming} tone="info" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-line px-5 py-4 sm:px-6">
      <div className="grid gap-3 md:grid-cols-3">
        <InsightStat label="Rows" value={formatNumber(report.row_count)} />
        <InsightStat label="Export" value="CSV available" />
        <InsightStat label="Report type" value={reportTitle(report.report)} />
      </div>
    </div>
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
        <TR
          className={cn(
            row.days_until_expiry <= 7
              ? "bg-warning-soft/35 hover:bg-warning-soft/50"
              : undefined,
          )}
          key={`${row.pharmacy_id}-${row.batch_number}-${row.medication_label}`}
        >
          <TD className="min-w-64 font-medium text-ink">{row.medication_label}</TD>
          <TD className="whitespace-nowrap">{row.pharmacy_name}</TD>
          <TD className="whitespace-nowrap">{row.batch_number}</TD>
          <TD className="whitespace-nowrap">{formatDate(row.expiry_date)}</TD>
          <TD className="tnum whitespace-nowrap">{formatNumber(row.quantity)}</TD>
          <TD className="tnum whitespace-nowrap">
            {row.days_until_expiry < 0
              ? `${Math.abs(row.days_until_expiry)} overdue`
              : `${row.days_until_expiry} days`}
          </TD>
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
        "Forecast estimate",
        "Current stock",
        "Suggested reorder review",
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
          <TD className="min-w-80">Review before ordering.</TD>
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
        "Potential transfer opportunity",
        "Confidence",
        "Status",
        "Review note",
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
          <TD className="min-w-96">
            <span className="block">{row.reason}</span>
            <span className="mt-1 block text-xs font-semibold text-muted">
              Review before transfer.
            </span>
          </TD>
        </TR>
      ))}
    </PreviewTableShell>
  );
}

function StockValuationPreview({ report }: { report: StockValuationReport }) {
  return (
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

function emptyTitleForReport(reportId: ReportId): string {
  if (reportId === "expiry") {
    return "No expiry risk found for this period.";
  }
  if (reportId === "dead_stock") {
    return "No dead-stock lines found.";
  }
  return "No report data available yet.";
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
  const selectedPharmacy = (user?.pharmacies ?? []).find(
    (pharmacy) => pharmacy.id === selectedPharmacyId,
  );
  const filterSummary = [
    activeReportId === "transfer_suggestions"
      ? selectedGroupId
        ? `Group ${selectedGroupId}`
        : "All groups in scope"
      : selectedPharmacy
        ? selectedPharmacy.name
        : "All pharmacies in scope",
    ["expiry", "dead_stock", "mds_workload"].includes(activeReportId)
      ? `${days}-day window`
      : null,
    activeReportId === "transfer_suggestions" ? `Status ${status}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-5">
      <PageHeader
        className="animate-fade-in-up"
        eyebrow="Operational reports"
        title="Reports"
        subtitle="Review stock, expiry, workload, and planning insights before taking action."
        meta={
          dashboardQuery.data
            ? `Updated ${formatDateTime(dashboardQuery.data.generated_at)}`
            : "Reports use the current scoped data."
        }
      />

      <ReportsSummaryCards
        availableReports={availableReports}
        cardCounts={cardCounts}
        loading={dashboardQuery.isLoading}
      />

      <ReportCategoryCards
        activeReportId={activeReportId}
        availableReports={availableReports}
        onSelectReport={setActiveReportId}
      />

      <section
        aria-label="Report catalogue"
        className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
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
        <PanelHeader
          title="Filters"
          subtitle="Scope the operational report preview and CSV export."
        />
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
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="info" icon={<BarChart3 className="h-3 w-3" />}>
              Applied filters
            </Badge>
            <span className="text-sm font-medium text-ink-soft">
              {filterSummary}
            </span>
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
                    Forecast estimates and potential transfer opportunities are
                    operational report outputs. Review before ordering or transfer.
                  </span>
                </p>
              ) : null}
            </div>
            <CsvButton
              filename={reportFilename(activeReportId)}
              filters={filters}
              reportId={activeReportId}
              reportTitle={activeReport?.title ?? "Report"}
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
                title={emptyTitleForReport(activeReportId)}
                description="Adjust the filters above or pick another report to preview."
              />
            </div>
          ) : (
            <>
              <ReportInsightPanel report={previewQuery.data} />
              <PreviewTable report={previewQuery.data} />
            </>
          )
        ) : null}
      </Panel>
    </div>
  );
}
