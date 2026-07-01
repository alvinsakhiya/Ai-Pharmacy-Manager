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
import { SkeletonRows } from "../../components/ui/Skeleton";
import { labelClass, selectClass } from "../../components/ui/forms";
import { cn } from "../../lib/cn";
import { scopeLabel } from "../../lib/scope";
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
    description: "Items to check for low stock, stockouts, or expiry.",
    category: "stock_expiry",
    permission: "stock.view",
    exportTypes: ["CSV"],
    humanReview: false,
    icon: ShieldAlert,
  },
  {
    id: "stock_movements",
    title: "Stock movements",
    description: "Recent stock coming in, going out, and adjustments.",
    category: "stock_expiry",
    permission: "stock.view",
    exportTypes: ["CSV"],
    humanReview: false,
    icon: ClipboardList,
  },
  {
    id: "expiry",
    title: "Expiry review",
    description: "Batches expiring within the time window you choose.",
    category: "stock_expiry",
    permission: "stock.view",
    exportTypes: ["CSV"],
    humanReview: false,
    icon: CalendarClock,
  },
  {
    id: "dead_stock",
    title: "Dead/slow stock",
    description: "Stock that is not moving, moving slowly, or active.",
    category: "stock_expiry",
    permission: "stock.view",
    exportTypes: ["CSV"],
    humanReview: true,
    icon: ArchiveX,
  },
  {
    id: "stock_valuation",
    title: "Stock valuation",
    description: "The value of your stock by item, with totals.",
    category: "stock_expiry",
    permission: "stock.view",
    exportTypes: ["CSV"],
    humanReview: false,
    icon: Boxes,
  },
  {
    id: "forecast_reorder",
    title: "Forecast & reorder",
    description: "Estimated reorder amounts based on past stock movement.",
    category: "operational_performance",
    permission: "forecast.view",
    exportTypes: ["CSV"],
    humanReview: true,
    icon: TrendingUp,
  },
  {
    id: "transfer_suggestions",
    title: "Transfer suggestions",
    description: "Possible stock transfers between branches to review.",
    category: "operational_performance",
    permission: "transfer_suggestion.view",
    exportTypes: ["CSV"],
    humanReview: true,
    icon: ArrowRightLeft,
  },
  {
    id: "mds_workload",
    title: "MDS workload",
    description: "Dosette workload by pharmacy and status (no patient names).",
    category: "dosette_workload",
    permission: "blister.view",
    exportTypes: ["CSV"],
    humanReview: false,
    icon: Layers,
  },
];

type ReportCategoryId =
  | "stock_expiry"
  | "dosette_workload"
  | "patient_review_activity"
  | "operational_performance";

const REPORT_CATEGORIES: Array<{
  id: ReportCategoryId;
  title: string;
  description: string;
  icon: LucideIcon;
  reportIds: ReportId[];
}> = [
  {
    id: "stock_expiry",
    title: "Stock and expiry",
    description: "Stock risk, expiry, value, and movement reports.",
    icon: ShieldAlert,
    reportIds: [
      "stock_attention",
      "expiry",
      "dead_stock",
      "stock_valuation",
      "stock_movements",
    ],
  },
  {
    id: "dosette_workload",
    title: "MDS / Dosette workload",
    description: "Dosette workload and prepare-reminder summaries.",
    icon: Layers,
    reportIds: ["mds_workload"],
  },
  {
    id: "patient_review_activity",
    title: "Patient review activity",
    description: "Patient review reports will appear here when available.",
    icon: FileText,
    reportIds: [],
  },
  {
    id: "operational_performance",
    title: "Operational performance",
    description: "Forecast estimates and potential transfer opportunities.",
    icon: BarChart3,
    reportIds: ["forecast_reorder", "transfer_suggestions"],
  },
];

const SUMMARY_CARDS: Array<{
  report?: ReportId;
  label: string;
  helper: string;
  icon: LucideIcon;
}> = [
  {
    report: "stock_attention",
    label: "Stock risk",
    helper: "Items that need a stock review.",
    icon: ShieldAlert,
  },
  {
    report: "expiry",
    label: "Expiry review",
    helper: "Batches in the selected expiry window.",
    icon: CalendarClock,
  },
  {
    report: "mds_workload",
    label: "MDS workload",
    helper: "Dosette cycles by status.",
    icon: Layers,
  },
  {
    label: "Patient review activity",
    helper: "No patient review report is available here.",
    icon: FileText,
  },
  {
    report: "stock_movements",
    label: "Operational actions",
    helper: "Recent stock activity.",
    icon: ClipboardList,
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

function formatDateLong(value: Date): string {
  return value.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

function humanReviewNote(reportId: ReportId): string {
  if (reportId === "forecast_reorder") {
    return "Forecast estimates are operational report outputs. Review before ordering.";
  }
  if (reportId === "transfer_suggestions") {
    return "Potential transfer opportunities are operational report outputs. Review before transfer.";
  }
  return "Operational report outputs need human review before stock action.";
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
        "group flex flex-col rounded-2xl border p-3.5 text-left shadow-soft outline-none",
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
            "grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors",
            active
              ? "border-brand bg-surface text-brand-ink"
              : "border-brand-soft bg-brand-soft text-brand-ink group-hover:border-brand group-hover:bg-brand group-hover:text-white",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="tnum rounded-full border border-line bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-muted">
          {count === undefined ? "CSV" : `${formatNumber(count)} rows`}
        </span>
      </div>
      <h2 className="mt-2.5 text-[15px] font-bold tracking-[-0.01em] text-ink">
        {report.title}
      </h2>
      <p className="mt-1 text-[13px] leading-5 text-muted">
        {report.description}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
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
    <article className="interactive-card flex min-h-[128px] flex-col justify-between rounded-2xl border border-line bg-surface p-3.5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-lilac-soft bg-lilac-soft text-brand"
        >
          <Icon className="h-4 w-4" />
        </span>
        <Badge variant={count === undefined && !loading ? "neutral" : "brand"}>
          Rows
        </Badge>
      </div>
      <div>
        <p className="mt-3 text-[13px] font-semibold text-muted">{label}</p>
        <p className="tnum mt-1 text-2xl font-extrabold tracking-[-0.02em] text-ink">
          {loading ? "..." : count === undefined ? "No data" : formatNumber(count)}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">{helper}</p>
      </div>
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
    card.report ? availableIds.has(card.report) : true,
  );

  if (summaryCards.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Report summaries"
      className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
    >
      {summaryCards.map((card) => (
        <SummaryMetricCard
          count={card.report ? cardCounts.get(card.report) : undefined}
          helper={card.helper}
          icon={card.icon}
          key={card.report ?? card.label}
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
  cardCounts,
  onSelectReport,
}: {
  activeReportId: ReportId;
  availableReports: typeof REPORTS;
  cardCounts: Map<ReportId, number>;
  onSelectReport: (reportId: ReportId) => void;
}) {
  const availableByCategory = new Map<ReportCategoryId, typeof REPORTS>();
  for (const category of REPORT_CATEGORIES) {
    availableByCategory.set(
      category.id,
      category.reportIds
        .map((reportId) =>
          availableReports.find((report) => report.id === reportId),
        )
        .filter((report): report is (typeof REPORTS)[number] => Boolean(report)),
    );
  }

  return (
    <section aria-label="Report groups" className="space-y-4">
      {REPORT_CATEGORIES.map((category) => {
        const reports = availableByCategory.get(category.id) ?? [];
        const Icon = category.icon;
        const active = reports.some((report) => report.id === activeReportId);
        return (
          <section
            aria-labelledby={`report-group-${category.id}`}
            className="rounded-2xl border border-line bg-surface-subtle p-3.5 shadow-soft sm:p-4"
            key={category.id}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full border",
                    active
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line bg-surface text-ink-soft",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2
                    id={`report-group-${category.id}`}
                    className="text-base font-extrabold text-ink"
                  >
                    {category.title}
                  </h2>
                  <p className="mt-1 text-[13px] text-muted">
                    {category.description}
                  </p>
                </div>
              </div>
              <Badge variant={active ? "brand" : "neutral"}>
                {reports.length === 0
                  ? "No report yet"
                  : `${formatNumber(reports.length)} operational report${
                      reports.length === 1 ? "" : "s"
                    }`}
              </Badge>
            </div>
            {reports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-strong bg-surface px-4 py-5">
                <h3 className="text-sm font-extrabold text-ink">
                  {category.id === "patient_review_activity"
                    ? "No patient review activity report is available yet."
                    : "No reports are available in this group."}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                  {category.id === "patient_review_activity"
                    ? "Patient review activity can appear here when an existing report is added to the reporting API. No extra analytics are inferred."
                    : "Reports appear here when your account has access to the existing reporting API for this group."}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {reports.map((report) => (
                  <ReportCard
                    active={report.id === activeReportId}
                    count={cardCounts.get(report.id)}
                    key={report.id}
                    onSelect={() => onSelectReport(report.id)}
                    report={report}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}

function PreviewCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">{children}</div>;
}

function PreviewRecordCard({
  children,
  title,
  badges,
}: {
  children: ReactNode;
  title: ReactNode;
  badges?: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="min-w-0 text-base font-extrabold text-ink">{title}</h3>
        {badges ? <div className="flex flex-wrap gap-2">{badges}</div> : null}
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">{children}</dl>
    </article>
  );
}

function PreviewDetail({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface-subtle px-3 py-2.5">
      <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function StockAttentionPreview({ report }: { report: ReportPreview }) {
  if (report.report !== "stock_attention") {
    return null;
  }
  return (
    <PreviewCardGrid>
      {report.rows.map((row) => (
        <PreviewRecordCard
          badges={
            <>
              {row.flags.low_stock ? <Badge variant="warning">Low stock</Badge> : null}
              {row.flags.near_expiry ? <Badge variant="warning">Expiry review</Badge> : null}
              {row.flags.stockout ? <Badge variant="danger">Stockout</Badge> : null}
            </>
          }
          key={row.stock_item_id}
          title={row.medication_name}
        >
          <PreviewDetail label="Pharmacy" value={row.pharmacy_id} />
          <PreviewDetail label="On hand" value={formatNumber(row.quantity_on_hand)} />
          <PreviewDetail label="Reorder level" value={formatNumber(row.reorder_level)} />
          <PreviewDetail label="Expiry" value={formatDate(row.earliest_expiry)} />
          <PreviewDetail label="Attention" value={formatNumber(row.attention_score)} />
          <PreviewDetail
            label="Suggested reorder review"
            value={formatNumber(row.suggested_reorder_quantity)}
          />
        </PreviewRecordCard>
      ))}
    </PreviewCardGrid>
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
    <PreviewCardGrid>
      {rows.map((row) => (
        <PreviewRecordCard
          badges={<Badge variant="neutral">{row.movement_type}</Badge>}
          key={row.movement_id}
          title={row.medication_name}
        >
          <PreviewDetail label="Date" value={formatDateTime(row.created_at)} />
          <PreviewDetail label="Pharmacy" value={row.pharmacy_id} />
          <PreviewDetail label="Batch" value={row.batch_number || "-"} />
          <PreviewDetail label="Quantity delta" value={row.quantity_delta} />
          <PreviewDetail label="Balance after" value={row.balance_after} />
          <PreviewDetail label="Reference" value={row.reference || "-"} />
        </PreviewRecordCard>
      ))}
    </PreviewCardGrid>
  );
}

function ExpiryPreview({ rows }: { rows: ExpiryReportRow[] }) {
  return (
    <PreviewCardGrid>
      {rows.map((row) => (
        <PreviewRecordCard
          badges={<StatusBadge label={row.severity} />}
          key={`${row.pharmacy_id}-${row.batch_number}-${row.medication_label}`}
          title={row.medication_label}
        >
          <PreviewDetail label="Pharmacy" value={row.pharmacy_name} />
          <PreviewDetail label="Batch" value={row.batch_number} />
          <PreviewDetail label="Expiry" value={formatDate(row.expiry_date)} />
          <PreviewDetail label="Quantity" value={formatNumber(row.quantity)} />
          <PreviewDetail
            label="Days"
            value={
              row.days_until_expiry < 0
              ? `${Math.abs(row.days_until_expiry)} overdue`
                : `${row.days_until_expiry} days`
            }
          />
          <PreviewDetail label="Review" value="Review before action" />
        </PreviewRecordCard>
      ))}
    </PreviewCardGrid>
  );
}

function DeadStockPreview({ rows }: { rows: DeadStockReportRow[] }) {
  return (
    <PreviewCardGrid>
      {rows.map((row) => (
        <PreviewRecordCard
          badges={<StatusBadge label={row.status} />}
          key={`${row.pharmacy_id}-${row.medication_label}`}
          title={row.medication_label}
        >
          <PreviewDetail label="Pharmacy" value={row.pharmacy_id} />
          <PreviewDetail label="On hand" value={formatNumber(row.quantity_on_hand)} />
          <PreviewDetail
            label="Days since outbound"
            value={formatMaybeNumber(row.days_since_last_outbound)}
          />
          <PreviewDetail label="Suggested action" value={row.suggested_action} />
        </PreviewRecordCard>
      ))}
    </PreviewCardGrid>
  );
}

function ForecastPreview({ rows }: { rows: ForecastReorderReportRow[] }) {
  return (
    <PreviewCardGrid>
      {rows.map((row) => (
        <PreviewRecordCard
          badges={<Badge variant="warning">Review before action</Badge>}
          key={`${row.forecast_run_id}-${row.medication_label}`}
          title={row.medication_label}
        >
          <PreviewDetail label="Pharmacy" value={row.pharmacy_name} />
          <PreviewDetail
            label="Forecast estimate"
            value={`${formatNumber(row.predicted_usage_units)} units`}
          />
          <PreviewDetail
            label="Current stock"
            value={`${formatNumber(row.current_stock_units)} units`}
          />
          <PreviewDetail
            label="Suggested reorder review"
            value={
              <>
                {formatNumber(row.suggested_reorder_units)} units
                {row.suggested_reorder_packs !== null
                  ? ` · ${formatNumber(row.suggested_reorder_packs)} packs`
                  : ""}
              </>
            }
          />
          <PreviewDetail label="Confidence" value={formatConfidence(row.confidence)} />
          <PreviewDetail label="Review" value="Review before ordering." />
        </PreviewRecordCard>
      ))}
    </PreviewCardGrid>
  );
}

function TransferPreview({ rows }: { rows: TransferSuggestionsReportRow[] }) {
  return (
    <PreviewCardGrid>
      {rows.map((row) => (
        <PreviewRecordCard
          badges={<StatusBadge label={row.status} />}
          key={`${row.created_at}-${row.source_pharmacy_id}-${row.medication_label}`}
          title={row.medication_label}
        >
          <PreviewDetail
            label="Route"
            value={`${row.source_pharmacy_name} to ${row.destination_pharmacy_name}`}
          />
          <PreviewDetail
            label="Potential transfer opportunity"
            value={
              <>
                {formatNumber(row.suggested_quantity_units)} units
                {row.suggested_quantity_packs !== null
                  ? ` · ${formatNumber(row.suggested_quantity_packs)} packs`
                  : ""}
              </>
            }
          />
          <PreviewDetail label="Confidence" value={formatConfidence(row.confidence)} />
          <PreviewDetail label="Review note" value={row.reason} />
          <PreviewDetail label="Review" value="Review before transfer." />
        </PreviewRecordCard>
      ))}
    </PreviewCardGrid>
  );
}

function StockValuationPreview({ report }: { report: StockValuationReport }) {
  return (
    <PreviewCardGrid>
      {report.rows.map((row) => (
        <PreviewRecordCard key={row.stock_item_id} title={row.medication_label}>
          <PreviewDetail label="Pharmacy" value={row.pharmacy_name} />
          <PreviewDetail label="On hand" value={formatNumber(row.quantity_on_hand)} />
          <PreviewDetail label="Unit price" value={formatCurrency(row.unit_price)} />
          <PreviewDetail label="Box price" value={formatCurrency(row.pack_price)} />
          <PreviewDetail label="Stock value" value={formatCurrency(row.stock_value)} />
        </PreviewRecordCard>
      ))}
    </PreviewCardGrid>
  );
}

function MdsPreview({ rows }: { rows: MdsWorkloadReportRow[] }) {
  return (
    <PreviewCardGrid>
      {rows.map((row) => (
        <PreviewRecordCard
          badges={<Badge variant="info">MDS workload</Badge>}
          key={`${row.pharmacy_id}-${row.cycle_status}`}
          title={row.pharmacy_name}
        >
          <PreviewDetail label="Cycle status" value={row.cycle_status} />
          <PreviewDetail label="Due" value={formatNumber(row.due_count)} />
          <PreviewDetail label="Overdue" value={formatNumber(row.overdue_count)} />
          <PreviewDetail
            label="Upcoming cycles"
            value={formatNumber(row.upcoming_cycles)}
          />
        </PreviewRecordCard>
      ))}
    </PreviewCardGrid>
  );
}

function PreviewCards({ report }: { report: ReportPreview }) {
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
    return "No report rows match the current view.";
  }
  if (reportId === "dead_stock") {
    return "No report rows match the current view.";
  }
  return "No report rows match the current view.";
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
  const today = useMemo(() => new Date(), []);
  const dateLabel = useMemo(() => formatDateLong(today), [today]);

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
  const humanReviewCount = availableReports.filter(
    (report) => report.humanReview,
  ).length;
  const updatedLabel = dashboardQuery.data
    ? `Updated ${formatDateTime(dashboardQuery.data.generated_at)}`
    : "Reports use the current scoped data.";
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
      <header className="animate-fade-in-up space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
              Operational reports
            </p>
            <h1 className="mt-1.5 text-[30px] font-extrabold tracking-[-0.025em] text-ink sm:text-[34px]">
              Reports
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              Review stock, expiry, and workload signals before action.
            </p>
            <p className="mt-2 text-xs font-medium text-muted">{updatedLabel}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {user ? scopeLabel(user) : "Scope unavailable"}
            </Badge>
            <Badge variant="info">Human review required</Badge>
            <Badge variant="neutral">{activeReport?.title ?? "Report"}</Badge>
            <Badge variant="neutral">{dateLabel}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
          <Badge variant="brand" icon={<BarChart3 className="h-3 w-3" />}>
            {formatNumber(availableReports.length)} reports available
          </Badge>
          <Badge variant="warning" icon={<ShieldAlert className="h-3 w-3" />}>
            {formatNumber(humanReviewCount)} review sections
          </Badge>
          <span>{filterSummary}</span>
        </div>
      </header>

      <ReportsSummaryCards
        availableReports={availableReports}
        cardCounts={cardCounts}
        loading={dashboardQuery.isLoading}
      />

      <ReportCategoryCards
        activeReportId={activeReportId}
        availableReports={availableReports}
        cardCounts={cardCounts}
        onSelectReport={setActiveReportId}
      />

      <Panel>
        <PanelHeader
          title="Report controls"
          subtitle="Choose a report to preview it or export a CSV."
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="neutral">
                  {previewQuery.isSuccess
                    ? `${formatNumber(previewQuery.data.row_count)} rows shown`
                    : "Rows loading"}
                </Badge>
                <Badge variant="neutral">CSV export available</Badge>
                {activeReport?.humanReview ? (
                  <Badge variant="warning">Human review required</Badge>
                ) : null}
              </div>
              {activeReport?.humanReview ? (
                <p className="mt-1.5 inline-flex items-start gap-1.5 text-xs text-warning-ink">
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  />
                  <span>{humanReviewNote(activeReportId)}</span>
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
            <p className="sr-only" role="status">
              Loading reports...
            </p>
            <SkeletonRows rows={6} />
          </div>
        ) : null}

        {previewQuery.isError ? (
          <div className="p-5 sm:p-6">
            <EmptyState
              tone="danger"
              icon={<AlertTriangle className="h-5 w-5" />}
              title="Could not load reports."
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
              <PreviewCards report={previewQuery.data} />
            </>
          )
        ) : null}
      </Panel>
    </div>
  );
}
