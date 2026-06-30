import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightLeft,
  Boxes,
  CalendarClock,
  ChevronDown,
  LineChart,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import type {
  ExpiryRisk,
  ForecastItem,
  ForecastRun,
  MdsDemandSignal,
  StockReviewQueue,
  StockReviewQueueItem,
  TransferSuggestion,
} from "./analyticsApi";
import {
  useDismissTransferSuggestion,
  useExpiryRiskQuery,
  useGenerateForecast,
  useGenerateTransferSuggestions,
  useLatestForecastQuery,
  useMdsDemandSignalQuery,
  useStockReviewQueueQuery,
  useTransferSuggestionsQuery,
} from "./useAnalytics";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
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

const ROADMAP_IDEAS = [
  {
    title: "FEFO adherence monitor",
    description: "Expiry order signal for review before action.",
    icon: ShieldCheck,
  },
  {
    title: "Slow-moving stock detector",
    description: "Operational signal for stock that may need review.",
    icon: Boxes,
  },
  {
    title: "Weekly change summary",
    description: "Plain-language movement changes for team review.",
    icon: TrendingUp,
  },
  {
    title: "Transfer opportunity review",
    description: "Cross-branch stock signal with human review required.",
    icon: ArrowRightLeft,
  },
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

function formatCurrencyValue(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Intl.NumberFormat("en-GB", {
    currency: "GBP",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(parsed);
}

function currencyString(value: number): string {
  return value.toFixed(2);
}

function parseCurrency(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

/** A select that adopts house styling but keeps the label-control wiring intact. */
function FieldSelect({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(selectClass, "appearance-none pr-9", className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  tone?: "neutral" | "warning" | "danger" | "info";
}) {
  const toneClass = {
    danger: "border-danger-border bg-danger-soft text-danger-ink",
    info: "border-info-border bg-info-soft text-info-ink",
    neutral: "border-line bg-surface text-ink",
    warning: "border-warning-border bg-warning-soft text-warning-ink",
  }[tone];

  return (
    <article className={cn("rounded-2xl border p-3 shadow-soft", toneClass)}>
      <p className="text-xs font-bold uppercase tracking-[0.06em] text-current/70">
        {label}
      </p>
      <p className="tnum mt-1 text-xl font-extrabold tracking-[-0.01em]">
        {value}
      </p>
      {helper ? (
        <p className="mt-1 text-xs font-semibold leading-relaxed text-current/70">
          {helper}
        </p>
      ) : null}
    </article>
  );
}

function InlineStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2">
      <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
        {label}
      </dt>
      <dd className="tnum mt-0.5 text-sm font-extrabold text-ink">{value}</dd>
    </div>
  );
}

function ForecastConfidence({ confidence }: { confidence: string }) {
  const percentage = Math.round(Number(confidence) * 100);
  const variant =
    percentage >= 75 ? "success" : percentage >= 50 ? "info" : "warning";
  const label =
    percentage >= 75
      ? "High confidence"
      : percentage >= 50
        ? "Medium confidence"
        : percentage >= 35
          ? "Low confidence"
          : "Limited history";

  return (
    <Badge variant={variant} dot>
      <span>
        {label} · <span className="tnum">{percentage}%</span>
      </span>
    </Badge>
  );
}

function ConfidenceChip({ confidence }: { confidence: string }) {
  return <ForecastConfidence confidence={confidence} />;
}

function RiskLevelBadge({ level }: { level: "high" | "medium" | "low" }) {
  const variant =
    level === "high" ? "danger" : level === "medium" ? "warning" : "info";
  const label =
    level === "high"
      ? "High risk"
      : level === "medium"
        ? "Medium risk"
        : "Low risk";

  return <Badge variant={variant}>{label}</Badge>;
}

interface BranchSummary {
  expiryRiskCount: number;
  highRisk: number;
  itemsToReview: number;
  lowStockCount: number;
  mdsShortfallUnits: number;
  pharmacy: { id: number; name: string };
  riskLevel: "high" | "medium" | "low";
  transferOpportunities: number;
  valueAtRisk: string;
}

function isLowStockQueueItem(item: StockReviewQueueItem): boolean {
  return [...item.reason_chips, ...item.signals].some((label) =>
    label.toLowerCase().includes("low stock"),
  );
}

function queueSummaryForItems(
  items: StockReviewQueueItem[],
): StockReviewQueue["summary"] {
  return {
    total_items: items.length,
    high_risk: items.filter((item) => item.risk_level === "high").length,
    medium_risk: items.filter((item) => item.risk_level === "medium").length,
    low_risk: items.filter((item) => item.risk_level === "low").length,
    mds_shortfall: items.filter((item) => item.shortfall_units > 0).length,
    expiry_risk: items.filter((item) =>
      item.reason_chips.some((reason) =>
        reason.toLowerCase().includes("expiry"),
      ),
    ).length,
    low_confidence: items.filter(
      (item) =>
        item.forecast_confidence !== null && Number(item.forecast_confidence) < 0.5,
    ).length,
  };
}

function filterStockReviewQueue(
  data: StockReviewQueue | undefined,
  pharmacyId: number | undefined,
): StockReviewQueue | undefined {
  if (!data || pharmacyId === undefined) {
    return data;
  }
  const items = data.items.filter((item) => item.pharmacy_id === pharmacyId);
  return {
    ...data,
    summary: queueSummaryForItems(items),
    items,
  };
}

function mdsSummaryForItems(items: MdsDemandSignal["items"]): MdsDemandSignal["summary"] {
  return {
    total_required_units: items.reduce(
      (total, item) => total + item.required_units,
      0,
    ),
    total_available_units: items.reduce(
      (total, item) => total + item.available_units,
      0,
    ),
    total_shortfall_units: items.reduce(
      (total, item) => total + item.shortfall_units,
      0,
    ),
    items_with_shortfall: items.filter((item) => item.shortfall_units > 0).length,
    mapping_needed: items.filter((item) => item.mapping_status === "mapping_needed")
      .length,
    cycles_affected: items.reduce((total, item) => total + item.cycles_affected, 0),
    patients_affected: items.reduce(
      (total, item) => total + item.patients_affected,
      0,
    ),
  };
}

function filterMdsDemandSignal(
  data: MdsDemandSignal | undefined,
  pharmacyId: number | undefined,
): MdsDemandSignal | undefined {
  if (!data || pharmacyId === undefined) {
    return data;
  }
  const items = data.items.filter((item) => item.pharmacy_id === pharmacyId);
  return {
    ...data,
    summary: mdsSummaryForItems(items),
    items,
  };
}

function filterExpiryRisk(
  data: ExpiryRisk | undefined,
  pharmacyId: number | undefined,
): ExpiryRisk | undefined {
  if (!data || pharmacyId === undefined) {
    return data;
  }
  const items = data.items.filter((item) => item.pharmacy_id === pharmacyId);
  const buckets = data.buckets.map((bucket) => {
    const bucketItems = items.filter((item) => item.bucket === bucket.key);
    return {
      ...bucket,
      units: bucketItems.reduce((total, item) => total + item.quantity, 0),
      estimated_value: currencyString(
        bucketItems.reduce(
          (total, item) => total + parseCurrency(item.estimated_value),
          0,
        ),
      ),
      unpriced_units: bucketItems.reduce(
        (total, item) => total + item.unpriced_units,
        0,
      ),
      batch_count: bucketItems.length,
      product_count: new Set(bucketItems.map((item) => item.medication_id)).size,
    };
  });

  return {
    ...data,
    summary: {
      expiring_within_30_days_units: items
        .filter((item) => item.days_to_expiry <= 30)
        .reduce((total, item) => total + item.quantity, 0),
      value_at_risk: currencyString(
        items.reduce((total, item) => total + parseCurrency(item.estimated_value), 0),
      ),
      unpriced_risk_units: items.reduce(
        (total, item) => total + item.unpriced_units,
        0,
      ),
      products_affected: new Set(items.map((item) => item.medication_id)).size,
    },
    buckets,
    items,
  };
}

function buildBranchSummaries({
  expiryRisk,
  mdsDemand,
  pharmacies,
  queue,
  transferSuggestions,
}: {
  expiryRisk: ExpiryRisk | undefined;
  mdsDemand: MdsDemandSignal | undefined;
  pharmacies: { id: number; name: string }[];
  queue: StockReviewQueue | undefined;
  transferSuggestions: TransferSuggestion[] | undefined;
}): BranchSummary[] {
  return pharmacies.map((pharmacy) => {
    const queueItems =
      queue?.items.filter((item) => item.pharmacy_id === pharmacy.id) ?? [];
    const mdsItems =
      mdsDemand?.items.filter((item) => item.pharmacy_id === pharmacy.id) ?? [];
    const expiryItems =
      expiryRisk?.items.filter((item) => item.pharmacy_id === pharmacy.id) ?? [];
    const transferOpportunities =
      transferSuggestions?.filter(
        (suggestion) =>
          suggestion.status === "OPEN" &&
          (suggestion.source_pharmacy === pharmacy.id ||
            suggestion.destination_pharmacy === pharmacy.id),
      ).length ?? 0;
    const highRisk = queueItems.filter((item) => item.risk_level === "high").length;
    const mdsShortfallUnits = mdsItems.reduce(
      (total, item) => total + item.shortfall_units,
      0,
    );
    const lowStockCount = queueItems.filter(isLowStockQueueItem).length;
    const expiryRiskCount = expiryItems.length;
    const valueAtRisk = currencyString(
      expiryItems.reduce(
        (total, item) => total + parseCurrency(item.estimated_value),
        0,
      ),
    );
    const riskLevel =
      highRisk > 0 || mdsShortfallUnits > 0
        ? "high"
        : expiryRiskCount > 0 || lowStockCount > 0 || transferOpportunities > 0
          ? "medium"
          : "low";

    return {
      expiryRiskCount,
      highRisk,
      itemsToReview: queueItems.length,
      lowStockCount,
      mdsShortfallUnits,
      pharmacy,
      riskLevel,
      transferOpportunities,
      valueAtRisk,
    };
  });
}

function transferSuggestionsForBranch(
  suggestions: TransferSuggestion[] | undefined,
  pharmacyId: number | undefined,
): TransferSuggestion[] {
  if (!suggestions || pharmacyId === undefined) {
    return [];
  }
  return suggestions.filter(
    (suggestion) =>
      suggestion.source_pharmacy === pharmacyId ||
      suggestion.destination_pharmacy === pharmacyId,
  );
}

function BranchMetric({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
        {label}
      </p>
      <p className="tnum mt-1 text-sm font-extrabold text-ink">{value}</p>
    </div>
  );
}

function BranchOverviewGrid({
  isError,
  isLoading,
  onSelect,
  selectedPharmacyId,
  summaries,
}: {
  isError: boolean;
  isLoading: boolean;
  onSelect: (pharmacyId: number) => void;
  selectedPharmacyId: number | undefined;
  summaries: BranchSummary[];
}) {
  return (
    <Panel>
      <PanelHeader
        title="Group overview"
        subtitle="Select a branch to review stock signals."
        icon={<Boxes className="h-4 w-4" />}
        actions={<Badge variant="info">{formatNumber(summaries.length)} branches</Badge>}
      />
      <PanelBody className="space-y-4">
        {isLoading ? <SkeletonRows rows={3} /> : null}
        {isError ? (
          <EmptyState
            tone="danger"
            icon={<Boxes className="h-5 w-5" />}
            title="Could not load group stock signals."
            className="py-8"
          />
        ) : null}
        {!isLoading && !isError && summaries.length === 0 ? (
          <EmptyState
            icon={<Boxes className="h-5 w-5" />}
            title="No branches available in this scope."
            className="py-8"
          />
        ) : null}
        {summaries.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {summaries.map((summary) => {
              const isSelected = selectedPharmacyId === summary.pharmacy.id;
              return (
                <article
                  className={cn(
                    "rounded-2xl border bg-surface p-4 shadow-soft transition-colors",
                    isSelected
                      ? "border-brand-ring ring-2 ring-brand-ring/30"
                      : "border-line",
                  )}
                  key={summary.pharmacy.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-extrabold tracking-[-0.01em] text-ink">
                        {summary.pharmacy.name}
                      </h2>
                      <p className="mt-1 text-xs font-semibold text-muted">
                        Branch #{summary.pharmacy.id}
                      </p>
                    </div>
                    <RiskLevelBadge level={summary.riskLevel} />
                  </div>

                  <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                    <BranchMetric
                      label="Items to review"
                      value={formatNumber(summary.itemsToReview)}
                    />
                    <BranchMetric
                      label="MDS shortfalls"
                      value={formatNumber(summary.mdsShortfallUnits)}
                    />
                    <BranchMetric
                      label="Expiry risk"
                      value={formatNumber(summary.expiryRiskCount)}
                    />
                    <BranchMetric
                      label="Value at risk"
                      value={formatCurrencyValue(summary.valueAtRisk)}
                    />
                    <BranchMetric
                      label="Low stock"
                      value={formatNumber(summary.lowStockCount)}
                    />
                    <BranchMetric
                      label="Transfer opportunities"
                      value={formatNumber(summary.transferOpportunities)}
                    />
                  </dl>

                  <div className="mt-4 flex justify-end">
                    <Button
                      aria-pressed={isSelected}
                      onClick={() => onSelect(summary.pharmacy.id)}
                      size="sm"
                      variant={isSelected ? "primary" : "secondary"}
                    >
                      View branch
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function ReviewTransferModal({
  onClose,
  suggestion,
}: {
  onClose: () => void;
  suggestion: TransferSuggestion | null;
}) {
  const inventoryHref = suggestion?.source_stock_item
    ? `/inventory/${suggestion.source_stock_item}`
    : "/inventory";

  return (
    <Modal
      description="Suggested review only. Human review required."
      isOpen={suggestion !== null}
      onClose={onClose}
      title="Review transfer"
      size="sm"
    >
      {suggestion ? (
        <div className="space-y-5">
          <dl className="grid gap-3">
            <InlineStat label="Product" value={suggestion.medication_label} />
            <InlineStat label="From" value={suggestion.source_pharmacy_name} />
            <InlineStat label="To" value={suggestion.destination_pharmacy_name} />
            <InlineStat
              label="Suggested quantity"
              value={formatForecastQuantity(
                suggestion.suggested_quantity_units,
                suggestion.suggested_quantity_packs,
              )}
            />
            <InlineStat
              label="Stock available at source"
              value={`${formatNumber(suggestion.current_source_stock_units)} units`}
            />
            <InlineStat
              label="Stock level at destination"
              value="Review in stock transfer workflow"
            />
            <InlineStat
              label="Expiry note"
              value="Review batch expiry before transfer."
            />
          </dl>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-muted">
              Reason
            </p>
            <p className="mt-1 rounded-xl border border-line bg-surface-subtle p-3 text-sm leading-relaxed text-ink-soft">
              {suggestion.reason}
            </p>
          </div>

          <p className="rounded-xl border border-info-border bg-info-soft p-3 text-sm font-semibold leading-relaxed text-info-ink">
            Transfer must be completed through stock transfer workflow.
          </p>

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-full border border-lilac bg-lilac px-4 text-sm font-semibold text-lilac-ink shadow-elev-1 transition-colors hover:border-lilac-hover hover:bg-lilac-hover"
              to={inventoryHref}
            >
              Open stock transfer workflow
            </Link>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function BranchTransferSuggestionsPanel({
  canGenerateTransferSuggestions,
  deadDays,
  generateError,
  groupIds,
  isGenerating,
  onGenerate,
  onReview,
  selectedGroupId,
  selectedPharmacyName,
  setDeadDays,
  setSelectedGroupId,
  suggestions,
}: {
  canGenerateTransferSuggestions: boolean;
  deadDays: number;
  generateError: boolean;
  groupIds: number[];
  isGenerating: boolean;
  onGenerate: () => void;
  onReview: (suggestion: TransferSuggestion) => void;
  selectedGroupId: number | undefined;
  selectedPharmacyName: string;
  setDeadDays: (value: number) => void;
  setSelectedGroupId: (value: number | undefined) => void;
  suggestions: {
    data: TransferSuggestion[];
    isError: boolean;
    isLoading: boolean;
    isSuccess: boolean;
  };
}) {
  return (
    <Panel>
      <PanelHeader>
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-lilac-soft bg-lilac-soft text-brand"
            >
              <ArrowRightLeft className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                Transfer suggestion
              </p>
              <h2 className="mt-0.5 text-[15px] font-bold tracking-[-0.01em] text-ink">
                Transfer suggestions for {selectedPharmacyName}
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
                Operational suggestions involving the selected branch. Human
                review required before transfer.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {groupIds.length > 1 ? (
              <label className="min-w-44">
                <span className={labelClass}>Group</span>
                <FieldSelect
                  onChange={(event) =>
                    setSelectedGroupId(
                      event.target.value ? Number(event.target.value) : undefined,
                    )
                  }
                  value={selectedGroupId ?? ""}
                >
                  {groupIds.map((groupId) => (
                    <option key={groupId} value={groupId}>
                      Group {groupId}
                    </option>
                  ))}
                </FieldSelect>
              </label>
            ) : null}

            <label className="min-w-40">
              <span className={labelClass}>Review window</span>
              <FieldSelect
                onChange={(event) => setDeadDays(Number(event.target.value))}
                value={deadDays}
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </FieldSelect>
            </label>

            {canGenerateTransferSuggestions ? (
              <Button
                variant="primary"
                leadingIcon={<Sparkles className="h-4 w-4" />}
                disabled={selectedGroupId === undefined || isGenerating}
                onClick={() => onGenerate()}
              >
                {isGenerating ? "Generating..." : "Generate suggestions"}
              </Button>
            ) : null}
          </div>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-4">
        {generateError ? (
          <p className="rounded-xl border border-danger-border bg-danger-soft p-3 text-sm text-danger-ink">
            Could not generate transfer suggestions. Check your group scope and
            try again.
          </p>
        ) : null}
        {selectedGroupId === undefined ? (
          <EmptyState
            icon={<ArrowRightLeft className="h-5 w-5" />}
            title="Select a group to view transfer suggestions."
            className="py-8"
          />
        ) : null}
        {suggestions.isLoading ? <SkeletonRows rows={4} /> : null}
        {suggestions.isError ? (
          <EmptyState
            tone="danger"
            icon={<ArrowRightLeft className="h-5 w-5" />}
            title="Could not load transfer suggestions."
            className="py-8"
          />
        ) : null}
        {suggestions.isSuccess && suggestions.data.length === 0 ? (
          <EmptyState
            icon={<ArrowRightLeft className="h-5 w-5" />}
            title="No transfer suggestions to review for this branch."
            description="Transfer suggestions appear here only after human review signals are generated."
            className="py-8"
          />
        ) : null}
        {suggestions.data.length > 0 ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {suggestions.data.map((suggestion) => (
              <article
                className="rounded-2xl border border-line bg-surface-subtle p-4"
                key={suggestion.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-ink">
                      {suggestion.medication_label}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      {suggestion.source_pharmacy_name} to{" "}
                      {suggestion.destination_pharmacy_name}
                    </p>
                  </div>
                  <ConfidenceChip confidence={suggestion.confidence} />
                </div>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <InlineStat label="From" value={suggestion.source_pharmacy_name} />
                  <InlineStat label="To" value={suggestion.destination_pharmacy_name} />
                  <InlineStat
                    label="Suggested quantity"
                    value={formatForecastQuantity(
                      suggestion.suggested_quantity_units,
                      suggestion.suggested_quantity_packs,
                    )}
                  />
                  <InlineStat
                    label="Source stock"
                    value={`${formatNumber(
                      suggestion.current_source_stock_units,
                    )} units`}
                  />
                </dl>
                <p className="mt-3 text-xs leading-relaxed text-ink-soft">
                  {suggestion.reason}
                </p>
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => onReview(suggestion)}
                    size="sm"
                    variant="secondary"
                  >
                    Review transfer
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function ForecastRow({ item }: { item: ForecastItem }) {
  return (
    <TR>
      <TD className="min-w-60">
        <span className="font-semibold text-ink">{item.medication_label}</span>
        <span className="mt-1 block text-xs text-muted">
          {item.history_points_count} history points over {item.window_days} days
        </span>
      </TD>
      <TD className="tnum whitespace-nowrap">
        {formatForecastQuantity(
          item.predicted_usage_units,
          item.predicted_usage_packs,
        )}
      </TD>
      <TD className="tnum whitespace-nowrap">
        {formatForecastQuantity(item.current_stock_units, item.current_stock_packs)}
      </TD>
      <TD className="tnum whitespace-nowrap font-semibold text-ink">
        {formatForecastQuantity(
          item.suggested_reorder_units,
          item.suggested_reorder_packs,
        )}
      </TD>
      <TD className="whitespace-nowrap">
        <ForecastConfidence confidence={item.confidence} />
      </TD>
      <TD className="min-w-72">
        <details className="group">
          <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 font-semibold text-brand transition-colors hover:text-brand-hover">
            <ChevronDown
              aria-hidden="true"
              className="h-3.5 w-3.5 transition-transform duration-150 ease-soft group-open:rotate-180"
            />
            Explanation
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-ink-soft">
            {item.explanation}
          </p>
        </details>
      </TD>
    </TR>
  );
}

function TransferSuggestionRow({
  canDismiss,
  onDismiss,
  suggestion,
}: {
  canDismiss: boolean;
  onDismiss: (suggestionId: number) => void;
  suggestion: TransferSuggestion;
}) {
  return (
    <TR>
      <TD className="min-w-60">
        <span className="font-semibold text-ink">
          {suggestion.medication_label}
        </span>
        <span className="mt-1 block text-xs text-muted">
          Status: {suggestion.status}
        </span>
      </TD>
      <TD className="whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          {suggestion.source_pharmacy_name}
          <ArrowRightLeft aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
          {suggestion.destination_pharmacy_name}
        </span>
      </TD>
      <TD className="tnum whitespace-nowrap font-semibold text-ink">
        {formatForecastQuantity(
          suggestion.suggested_quantity_units,
          suggestion.suggested_quantity_packs,
        )}
      </TD>
      <TD className="whitespace-nowrap">
        <ConfidenceChip confidence={suggestion.confidence} />
      </TD>
      <TD className="min-w-72 text-xs leading-relaxed">{suggestion.reason}</TD>
      <TD className="whitespace-nowrap text-right">
        {canDismiss ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDismiss(suggestion.id)}
          >
            Dismiss
          </Button>
        ) : null}
      </TD>
    </TR>
  );
}

function StockReviewRow({ item }: { item: StockReviewQueueItem }) {
  const demandText =
    item.shortfall_units > 0
      ? `${formatNumber(item.shortfall_units)} shortfall`
      : `${formatNumber(item.available_units)} available`;

  return (
    <article className="rounded-2xl border border-line bg-surface-subtle p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-ink">
            {item.medication_name}
          </h3>
          <p className="mt-1 text-xs font-semibold text-muted">
            {item.pharmacy_name}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <RiskLevelBadge level={item.risk_level} />
          <span className="tnum text-xs font-bold text-muted">
            Score {item.score}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.reason_chips.map((reason) => (
          <Badge key={reason} variant="warning">
            {reason}
          </Badge>
        ))}
      </div>

      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        <InlineStat label="Demand" value={demandText} />
        <InlineStat
          label="Available"
          value={`${formatNumber(item.available_units)} units`}
        />
        <InlineStat
          label="Confidence"
          value={item.forecast_confidence_label ?? "Not generated"}
        />
      </dl>

      <p className="mt-3 rounded-xl border border-info-border bg-info-soft px-3 py-2 text-xs font-semibold leading-relaxed text-info-ink">
        {item.review_message}
      </p>
    </article>
  );
}

function StockReviewQueuePanel({
  data,
  isError,
  isLoading,
}: {
  data?: StockReviewQueue;
  isError: boolean;
  isLoading: boolean;
}) {
  const topItems = data?.items.slice(0, 8) ?? [];

  return (
    <Panel className="h-full">
      <PanelHeader
        title="Stock review queue"
        subtitle="Primary suggested review list."
        icon={<PackageSearch className="h-4 w-4" />}
        actions={
          data ? (
            <Badge variant="info">
              {formatNumber(data.summary.total_items)} items
            </Badge>
          ) : null
        }
      />
      <PanelBody className="space-y-3">
        {isLoading ? <SkeletonRows rows={4} /> : null}
        {isError ? (
          <EmptyState
            tone="danger"
            icon={<PackageSearch className="h-5 w-5" />}
            title="Could not load stock review queue."
            className="py-8"
          />
        ) : null}
        {data && data.items.length === 0 ? (
          <EmptyState
            icon={<PackageSearch className="h-5 w-5" />}
            title="No suggested stock reviews."
            description="Operational signals will appear when stock, demand, expiry, or confidence needs review."
            className="py-8"
          />
        ) : null}
        {topItems.length > 0 ? (
          <div className="space-y-3">
            {topItems.map((item) => (
              <StockReviewRow
                item={item}
                key={`${item.stock_item_id ?? item.medication_id}-${item.pharmacy_id}`}
              />
            ))}
            {data && data.items.length > topItems.length ? (
              <p className="text-xs font-semibold text-muted">
                Showing {topItems.length} of {formatNumber(data.items.length)} review
                items.
              </p>
            ) : null}
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function MdsDemandPanel({
  data,
  isError,
  isLoading,
}: {
  data?: MdsDemandSignal;
  isError: boolean;
  isLoading: boolean;
}) {
  const visibleItems = data?.items.slice(0, 3) ?? [];

  return (
    <Panel>
      <PanelHeader
        title="MDS demand signal"
        subtitle="Patient counts only."
        icon={<CalendarClock className="h-4 w-4" />}
        actions={
          data ? <Badge variant="info">{data.horizon_days} days</Badge> : null
        }
      />
      <PanelBody className="space-y-3">
        {data ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            <InlineStat
              label="Required"
              value={formatNumber(data.summary.total_required_units)}
            />
            <InlineStat
              label="Shortfall"
              value={formatNumber(data.summary.total_shortfall_units)}
            />
            <InlineStat
              label="Cycles"
              value={formatNumber(data.summary.cycles_affected)}
            />
            <InlineStat
              label="Patients"
              value={formatNumber(data.summary.patients_affected)}
            />
          </dl>
        ) : null}
        {isLoading ? <SkeletonRows rows={3} /> : null}
        {isError ? (
          <EmptyState
            tone="danger"
            icon={<CalendarClock className="h-5 w-5" />}
            title="Could not load MDS demand signal."
            className="py-8"
          />
        ) : null}
        {data && data.items.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-5 w-5" />}
            title="No MDS demand signal."
            description="Upcoming cycles without stock deduction will appear here."
            className="py-8"
          />
        ) : null}
        {visibleItems.length > 0 ? (
          <div className="space-y-2">
            {visibleItems.map((item) => (
              <article
                className="rounded-xl border border-line bg-surface-subtle p-3"
                key={`${item.stock_item_id ?? item.medication_id}-${item.pharmacy_id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-ink">
                      {item.medication_name}
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      {formatNumber(item.required_units)} required ·{" "}
                      {formatNumber(item.available_units)} available
                    </p>
                  </div>
                  <Badge
                    variant={
                      item.mapping_status === "mapping_needed"
                        ? "warning"
                        : "info"
                    }
                  >
                    {item.mapping_status === "mapping_needed"
                      ? "Mapping needed"
                      : "Mapped"}
                  </Badge>
                </div>
                <p className="tnum mt-2 text-sm font-bold text-ink">
                  {formatNumber(item.shortfall_units)} shortfall
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function ExpiryRiskPanel({
  data,
  isError,
  isLoading,
}: {
  data?: ExpiryRisk;
  isError: boolean;
  isLoading: boolean;
}) {
  const riskItems =
    data?.items.filter((item) => item.days_to_expiry <= 90).slice(0, 3) ?? [];

  return (
    <Panel>
      <PanelHeader
        title="Expiry risk / value at risk"
        subtitle="Active positive batches."
        icon={<ShieldCheck className="h-4 w-4" />}
        actions={<Badge variant="info">Expiry risk</Badge>}
      />
      <PanelBody className="space-y-3">
        {data ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            <InlineStat
              label="30-day units"
              value={formatNumber(data.summary.expiring_within_30_days_units)}
            />
            <InlineStat
              label="Value at risk"
              value={formatCurrencyValue(data.summary.value_at_risk)}
            />
            <InlineStat
              label="Unpriced units"
              value={formatNumber(data.summary.unpriced_risk_units)}
            />
            <InlineStat
              label="Products"
              value={formatNumber(data.summary.products_affected)}
            />
          </dl>
        ) : null}
        {data ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {data.buckets.slice(0, 3).map((bucket) => (
              <article
                className="rounded-xl border border-line bg-surface-subtle px-3 py-2"
                key={bucket.key}
              >
                <p className="text-xs font-bold text-muted">{bucket.label}</p>
                <p className="tnum mt-1 text-sm font-extrabold text-ink">
                  {formatNumber(bucket.units)}
                </p>
              </article>
            ))}
          </div>
        ) : null}
        {isLoading ? <SkeletonRows rows={3} /> : null}
        {isError ? (
          <EmptyState
            tone="danger"
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Could not load expiry risk."
            className="py-8"
          />
        ) : null}
        {data && data.items.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title="No expiry risk."
            className="py-8"
          />
        ) : null}
        {riskItems.length > 0 ? (
          <div className="space-y-2">
            {riskItems.map((item) => (
              <article
                className="rounded-xl border border-line bg-surface-subtle p-3"
                key={`${item.stock_item_id}-${item.batch_number}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-ink">
                      {item.medication_name}
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      Batch {item.batch_number} · {formatDate(item.expiry_date)}
                    </p>
                  </div>
                  <Badge variant="warning">{item.bucket_label}</Badge>
                </div>
                <p className="tnum mt-2 text-sm font-bold text-ink">
                  {formatNumber(item.quantity)} units ·{" "}
                  {formatCurrencyValue(item.estimated_value)}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function ForecastConfidencePanel({
  forecast,
  lowConfidenceItems,
}: {
  forecast: ForecastRun | null | undefined;
  lowConfidenceItems: number | undefined;
}) {
  const averageConfidence = useMemo(() => {
    if (!forecast || forecast.items.length === 0) {
      return null;
    }
    const total = forecast.items.reduce(
      (sum, item) => sum + Number(item.confidence),
      0,
    );
    return Math.round((total / forecast.items.length) * 100);
  }, [forecast]);

  return (
    <Panel>
      <PanelHeader
        title="Forecast confidence"
        subtitle="Movement history quality."
        icon={<TrendingUp className="h-4 w-4" />}
      />
      <PanelBody className="space-y-3">
        <dl className="grid gap-2 sm:grid-cols-2">
          <InlineStat
            label="Average"
            value={averageConfidence === null ? "-" : `${averageConfidence}%`}
          />
          <InlineStat
            label="Low confidence"
            value={formatNumber(lowConfidenceItems ?? 0)}
          />
        </dl>
        <p className="rounded-xl border border-info-border bg-info-soft px-3 py-2 text-xs font-semibold leading-relaxed text-info-ink">
          Forecast confidence is an operational signal. Human review required.
        </p>
      </PanelBody>
    </Panel>
  );
}

function ForecastPanel({
  canRunForecast,
  description = "Estimated demand from stock movement history. Review before action.",
  generateError,
  isGenerating,
  horizonDays,
  latestForecast,
  onGenerate,
  title = "Reorder forecasting",
  eyebrow = "Forecast suggestion",
  selectedPharmacyId,
  setHorizonDays,
}: {
  canRunForecast: boolean;
  description?: string;
  generateError: boolean;
  isGenerating: boolean;
  horizonDays: number;
  latestForecast: {
    data: ForecastRun | null | undefined;
    isError: boolean;
    isLoading: boolean;
    isSuccess: boolean;
  };
  onGenerate: () => void;
  title?: string;
  eyebrow?: string;
  selectedPharmacyId: number | undefined;
  setHorizonDays: (value: number) => void;
}) {
  const forecastData = latestForecast.data;

  return (
    <Panel>
      <PanelHeader>
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-lilac-soft bg-lilac-soft text-brand"
            >
              <LineChart className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                {eyebrow}
              </p>
              <h2 className="mt-0.5 text-[15px] font-bold tracking-[-0.01em] text-ink">
                {title}
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
                {description}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-36">
              <span className={labelClass}>Horizon</span>
              <FieldSelect
                onChange={(event) => setHorizonDays(Number(event.target.value))}
                value={horizonDays}
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </FieldSelect>
            </label>

            {canRunForecast ? (
              <Button
                variant="primary"
                leadingIcon={<Sparkles className="h-4 w-4" />}
                disabled={selectedPharmacyId === undefined || isGenerating}
                onClick={() => onGenerate()}
              >
                {isGenerating ? "Generating..." : "Generate forecast"}
              </Button>
            ) : null}
          </div>
        </div>
      </PanelHeader>

      <PanelBody className="space-y-4">
        {generateError ? (
          <p className="rounded-xl border border-danger-border bg-danger-soft p-3 text-sm text-danger-ink">
            Could not generate forecast. Check your pharmacy scope and try again.
          </p>
        ) : null}

        {selectedPharmacyId === undefined ? (
          <EmptyState
            icon={<LineChart className="h-5 w-5" />}
            title="Select a pharmacy to view forecasting suggestions."
            className="py-8"
          />
        ) : null}

        {latestForecast.isLoading ? <SkeletonRows rows={4} /> : null}

        {latestForecast.isError ? (
          <EmptyState
            tone="danger"
            icon={<LineChart className="h-5 w-5" />}
            title="Could not load latest forecast."
            className="py-8"
          />
        ) : null}

        {latestForecast.isSuccess && forecastData === null ? (
          <EmptyState
            icon={<LineChart className="h-5 w-5" />}
            title="No forecast generated yet."
            className="py-8"
          />
        ) : null}

        {latestForecast.isSuccess && forecastData ? (
          <TableScroll>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-subtle px-4 py-3">
              <div>
                <p className="text-[13px] font-bold text-ink">
                  Latest forecast: {forecastData.horizon_days} days, model{" "}
                  {forecastData.model_version}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Generated {formatDate(forecastData.created_at)}
                </p>
              </div>
              <Badge variant="info">Forecast confidence</Badge>
            </div>
            {forecastData.items.length === 0 ? (
              <EmptyState
                icon={<LineChart className="h-5 w-5" />}
                title="No active stock items found for this pharmacy."
                className="py-8"
              />
            ) : (
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Product</TH>
                    <TH>Predicted usage</TH>
                    <TH>Current stock</TH>
                    <TH>Suggested review</TH>
                    <TH>Confidence</TH>
                    <TH>Rationale</TH>
                  </TR>
                </THead>
                <TBody>
                  {forecastData.items.map((item) => (
                    <ForecastRow item={item} key={item.id} />
                  ))}
                </TBody>
              </Table>
            )}
          </TableScroll>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function TransferSuggestionsPanel({
  canDismissTransferSuggestions,
  canGenerateTransferSuggestions,
  deadDays,
  dismissError,
  generateError,
  groupIds,
  isGenerating,
  onDismiss,
  onGenerate,
  selectedGroupId,
  setDeadDays,
  setSelectedGroupId,
  suggestions,
}: {
  canDismissTransferSuggestions: boolean;
  canGenerateTransferSuggestions: boolean;
  deadDays: number;
  dismissError: boolean;
  generateError: boolean;
  groupIds: number[];
  isGenerating: boolean;
  onDismiss: (suggestionId: number) => void;
  onGenerate: () => void;
  selectedGroupId: number | undefined;
  setDeadDays: (value: number) => void;
  setSelectedGroupId: (value: number | undefined) => void;
  suggestions: {
    data: TransferSuggestion[] | undefined;
    isError: boolean;
    isLoading: boolean;
    isSuccess: boolean;
  };
}) {
  return (
    <Panel>
      <PanelHeader>
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-lilac-soft bg-lilac-soft text-brand"
            >
              <ArrowRightLeft className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                Transfer suggestion
              </p>
              <h2 className="mt-0.5 text-[15px] font-bold tracking-[-0.01em] text-ink">
                Cross-branch stock suggestions
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
                Operational suggestions based on stock movement history. Human
                review required before transfer.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-44">
              <span className={labelClass}>Group</span>
              {groupIds.length > 0 ? (
                <FieldSelect
                  onChange={(event) =>
                    setSelectedGroupId(
                      event.target.value ? Number(event.target.value) : undefined,
                    )
                  }
                  value={selectedGroupId ?? ""}
                >
                  {groupIds.map((groupId) => (
                    <option key={groupId} value={groupId}>
                      Group {groupId}
                    </option>
                  ))}
                </FieldSelect>
              ) : (
                <input
                  className={selectClass}
                  min="1"
                  onChange={(event) =>
                    setSelectedGroupId(
                      event.target.value ? Number(event.target.value) : undefined,
                    )
                  }
                  placeholder="Group ID"
                  type="number"
                  value={selectedGroupId ?? ""}
                />
              )}
            </label>

            <label className="min-w-40">
              <span className={labelClass}>Dead stock window</span>
              <FieldSelect
                onChange={(event) => setDeadDays(Number(event.target.value))}
                value={deadDays}
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </FieldSelect>
            </label>

            {canGenerateTransferSuggestions ? (
              <Button
                variant="primary"
                leadingIcon={<Sparkles className="h-4 w-4" />}
                disabled={selectedGroupId === undefined || isGenerating}
                onClick={() => onGenerate()}
              >
                {isGenerating ? "Generating..." : "Generate transfer suggestions"}
              </Button>
            ) : null}
          </div>
        </div>
      </PanelHeader>

      <PanelBody className="space-y-4">
        {generateError ? (
          <p className="rounded-xl border border-danger-border bg-danger-soft p-3 text-sm text-danger-ink">
            Could not generate transfer suggestions. Check your group scope and
            try again.
          </p>
        ) : null}

        {dismissError ? (
          <p className="rounded-xl border border-danger-border bg-danger-soft p-3 text-sm text-danger-ink">
            Could not dismiss transfer suggestion.
          </p>
        ) : null}

        {selectedGroupId === undefined ? (
          <EmptyState
            icon={<ArrowRightLeft className="h-5 w-5" />}
            title="Select a group to view transfer suggestions."
            className="py-8"
          />
        ) : null}

        {suggestions.isLoading ? <SkeletonRows rows={4} /> : null}

        {suggestions.isError ? (
          <EmptyState
            tone="danger"
            icon={<ArrowRightLeft className="h-5 w-5" />}
            title="Could not load transfer suggestions."
            className="py-8"
          />
        ) : null}

        {suggestions.isSuccess && suggestions.data?.length === 0 ? (
          <EmptyState
            icon={<ArrowRightLeft className="h-5 w-5" />}
            title="No transfer suggestions to review."
            className="py-8"
          />
        ) : null}

        {suggestions.isSuccess && suggestions.data && suggestions.data.length > 0 ? (
          <TableScroll>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Product</TH>
                  <TH>Route</TH>
                  <TH>Suggested quantity</TH>
                  <TH>Confidence</TH>
                  <TH>Reason</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {suggestions.data.map((suggestion) => (
                  <TransferSuggestionRow
                    canDismiss={canDismissTransferSuggestions}
                    key={suggestion.id}
                    onDismiss={onDismiss}
                    suggestion={suggestion}
                  />
                ))}
              </TBody>
            </Table>
          </TableScroll>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function OpportunityRoadmap() {
  return (
    <details className="rounded-2xl border border-line bg-surface shadow-soft">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <span className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-lilac-soft bg-lilac-soft text-brand"
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold tracking-[-0.01em] text-ink">
              Future intelligence ideas
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted">
              Compact roadmap signals for later review.
            </span>
          </span>
        </span>
        <Badge variant="info">Roadmap</Badge>
      </summary>
      <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2 xl:grid-cols-4">
        {ROADMAP_IDEAS.map((idea) => {
          const Icon = idea.icon;
          return (
            <article
              className="rounded-xl border border-line bg-surface-subtle p-3"
              key={idea.title}
            >
              <div className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-lilac-soft text-brand"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-ink">
                    {idea.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {idea.description}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </details>
  );
}

export function StockAnalyticsScreen() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const pharmacies = useMemo(() => user?.pharmacies ?? [], [user?.pharmacies]);
  const isSuperintendentGroupView =
    user?.role === "SUPERINTENDENT" && pharmacies.length > 1;
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<
    number | undefined
  >(undefined);
  const groupIds = useMemo(
    () => user?.scope.group_ids ?? [],
    [user?.scope.group_ids],
  );
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(
    undefined,
  );
  const [signalHorizonDays, setSignalHorizonDays] = useState(28);
  const [horizonDays, setHorizonDays] = useState(30);
  const [deadDays, setDeadDays] = useState(30);
  const [reviewTransferSuggestion, setReviewTransferSuggestion] =
    useState<TransferSuggestion | null>(null);
  const analyticsPharmacyId = isSuperintendentGroupView
    ? undefined
    : selectedPharmacyId;
  const stockReviewQueueQuery = useStockReviewQueueQuery(
    analyticsPharmacyId,
    signalHorizonDays,
  );
  const mdsDemandQuery = useMdsDemandSignalQuery(
    analyticsPharmacyId,
    signalHorizonDays,
  );
  const expiryRiskQuery = useExpiryRiskQuery(analyticsPharmacyId);
  const latestForecastQuery = useLatestForecastQuery(selectedPharmacyId);
  const generateForecast = useGenerateForecast();
  const canViewTransferSuggestions = can("transfer_suggestion.view");
  const canGenerateTransferSuggestions = can("transfer_suggestion.generate");
  const canDismissTransferSuggestions = can("transfer_suggestion.dismiss");
  const transferSuggestionsQuery = useTransferSuggestionsQuery(
    selectedGroupId,
    canViewTransferSuggestions,
  );
  const generateTransferSuggestions = useGenerateTransferSuggestions();
  const dismissTransferSuggestion = useDismissTransferSuggestion(selectedGroupId);
  const canRunForecast = can("forecast.run");

  useEffect(() => {
    if (selectedPharmacyId === undefined && pharmacies.length > 0) {
      setSelectedPharmacyId(pharmacies[0].id);
    }
  }, [pharmacies, selectedPharmacyId]);

  useEffect(() => {
    if (selectedGroupId === undefined && groupIds.length > 0) {
      setSelectedGroupId(groupIds[0]);
    }
  }, [groupIds, selectedGroupId]);

  async function handleGenerateForecast() {
    if (selectedPharmacyId === undefined) {
      return;
    }

    await generateForecast.mutateAsync({
      pharmacy: selectedPharmacyId,
      horizon_days: horizonDays,
    });
  }

  async function handleGenerateTransferSuggestions() {
    if (selectedGroupId === undefined) {
      return;
    }

    await generateTransferSuggestions.mutateAsync({
      group: selectedGroupId,
      dead_days: deadDays,
    });
  }

  function handleDismissTransferSuggestion(suggestionId: number) {
    void dismissTransferSuggestion.mutateAsync(suggestionId);
  }

  const selectedPharmacy = pharmacies.find(
    (pharmacy) => pharmacy.id === selectedPharmacyId,
  );
  const visibleStockReviewQueue = useMemo(
    () =>
      isSuperintendentGroupView
        ? filterStockReviewQueue(stockReviewQueueQuery.data, selectedPharmacyId)
        : stockReviewQueueQuery.data,
    [isSuperintendentGroupView, selectedPharmacyId, stockReviewQueueQuery.data],
  );
  const visibleMdsDemand = useMemo(
    () =>
      isSuperintendentGroupView
        ? filterMdsDemandSignal(mdsDemandQuery.data, selectedPharmacyId)
        : mdsDemandQuery.data,
    [isSuperintendentGroupView, mdsDemandQuery.data, selectedPharmacyId],
  );
  const visibleExpiryRisk = useMemo(
    () =>
      isSuperintendentGroupView
        ? filterExpiryRisk(expiryRiskQuery.data, selectedPharmacyId)
        : expiryRiskQuery.data,
    [expiryRiskQuery.data, isSuperintendentGroupView, selectedPharmacyId],
  );
  const branchSummaries = useMemo(
    () =>
      buildBranchSummaries({
        expiryRisk: expiryRiskQuery.data,
        mdsDemand: mdsDemandQuery.data,
        pharmacies,
        queue: stockReviewQueueQuery.data,
        transferSuggestions: transferSuggestionsQuery.data,
      }),
    [
      expiryRiskQuery.data,
      mdsDemandQuery.data,
      pharmacies,
      stockReviewQueueQuery.data,
      transferSuggestionsQuery.data,
    ],
  );
  const branchTransferSuggestions = useMemo(
    () =>
      transferSuggestionsForBranch(
        transferSuggestionsQuery.data,
        selectedPharmacyId,
      ),
    [selectedPharmacyId, transferSuggestionsQuery.data],
  );
  const queueSummary = visibleStockReviewQueue?.summary;
  const mdsSummary = visibleMdsDemand?.summary;
  const expirySummary = visibleExpiryRisk?.summary;

  return (
    <div className="stagger space-y-4">
      <header className="rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
              Inventory analytics
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-ink">
                Stock Intelligence
              </h1>
              <Badge variant="info">Human review required</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
              {isSuperintendentGroupView
                ? "Simple group-level stock review for pharmacy operations."
                : "Operational signals for review before action."}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {!isSuperintendentGroupView && pharmacies.length > 0 ? (
              <label className="min-w-56">
                <span className={labelClass}>Pharmacy</span>
                <FieldSelect
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
                </FieldSelect>
              </label>
            ) : null}
            <label className="min-w-40">
              <span className={labelClass}>Signal horizon</span>
              <FieldSelect
                onChange={(event) =>
                  setSignalHorizonDays(Number(event.target.value))
                }
                value={signalHorizonDays}
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={28}>28 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </FieldSelect>
            </label>
          </div>
        </div>
      </header>

      {isSuperintendentGroupView ? (
        <BranchOverviewGrid
          isError={
            stockReviewQueueQuery.isError ||
            mdsDemandQuery.isError ||
            expiryRiskQuery.isError
          }
          isLoading={
            stockReviewQueueQuery.isLoading ||
            mdsDemandQuery.isLoading ||
            expiryRiskQuery.isLoading
          }
          onSelect={setSelectedPharmacyId}
          selectedPharmacyId={selectedPharmacyId}
          summaries={branchSummaries}
        />
      ) : null}

      {isSuperintendentGroupView && selectedPharmacy ? (
        <section
          aria-label="Selected branch intelligence"
          className="rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                Selected branch
              </p>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-ink">
                {selectedPharmacy.name}
              </h2>
            </div>
            <Badge variant="info">Branch intelligence</Badge>
          </div>
        </section>
      ) : null}

      <section
        aria-label="Stock intelligence KPI strip"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        <MetricCard
          label="Items to review"
          value={queueSummary ? formatNumber(queueSummary.total_items) : "-"}
          helper="Stock Review Queue"
          tone={(queueSummary?.high_risk ?? 0) > 0 ? "danger" : "neutral"}
        />
        <MetricCard
          label="MDS shortfalls"
          value={mdsSummary ? formatNumber(mdsSummary.total_shortfall_units) : "-"}
          helper={`${formatNumber(mdsSummary?.cycles_affected ?? 0)} cycles`}
          tone={(mdsSummary?.total_shortfall_units ?? 0) > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Expiry risk"
          value={
            expirySummary
              ? formatNumber(expirySummary.expiring_within_30_days_units)
              : "-"
          }
          helper="Units within 30 days"
          tone={
            (expirySummary?.expiring_within_30_days_units ?? 0) > 0
              ? "warning"
              : "neutral"
          }
        />
        <MetricCard
          label="Value at risk"
          value={
            expirySummary
              ? formatCurrencyValue(expirySummary.value_at_risk)
              : "-"
          }
          helper={`${formatNumber(expirySummary?.products_affected ?? 0)} products`}
          tone={(expirySummary?.products_affected ?? 0) > 0 ? "info" : "neutral"}
        />
        <MetricCard
          label="Low-confidence items"
          value={queueSummary ? formatNumber(queueSummary.low_confidence) : "-"}
          helper="Forecast confidence"
          tone={(queueSummary?.low_confidence ?? 0) > 0 ? "warning" : "neutral"}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
        <StockReviewQueuePanel
          data={visibleStockReviewQueue}
          isError={stockReviewQueueQuery.isError}
          isLoading={stockReviewQueueQuery.isLoading}
        />

        <aside className="space-y-4">
          <MdsDemandPanel
            data={visibleMdsDemand}
            isError={mdsDemandQuery.isError}
            isLoading={mdsDemandQuery.isLoading}
          />

          <ExpiryRiskPanel
            data={visibleExpiryRisk}
            isError={expiryRiskQuery.isError}
            isLoading={expiryRiskQuery.isLoading}
          />

          <ForecastConfidencePanel
            forecast={latestForecastQuery.data}
            lowConfidenceItems={queueSummary?.low_confidence}
          />
        </aside>
      </div>

      <ForecastPanel
        canRunForecast={canRunForecast}
        description={
          isSuperintendentGroupView && selectedPharmacy
            ? `Forecast controls use ${selectedPharmacy.name}. Review before action.`
            : undefined
        }
        eyebrow={
          isSuperintendentGroupView ? "Selected branch forecast" : undefined
        }
        generateError={generateForecast.isError}
        horizonDays={horizonDays}
        isGenerating={generateForecast.isPending}
        latestForecast={{
          data: latestForecastQuery.data,
          isError: latestForecastQuery.isError,
          isLoading: latestForecastQuery.isLoading,
          isSuccess: latestForecastQuery.isSuccess,
        }}
        onGenerate={() => void handleGenerateForecast()}
        selectedPharmacyId={selectedPharmacyId}
        setHorizonDays={setHorizonDays}
        title={
          isSuperintendentGroupView ? "Selected branch forecast" : undefined
        }
      />

      {isSuperintendentGroupView && canViewTransferSuggestions && selectedPharmacy ? (
        <BranchTransferSuggestionsPanel
          canGenerateTransferSuggestions={canGenerateTransferSuggestions}
          deadDays={deadDays}
          generateError={generateTransferSuggestions.isError}
          groupIds={groupIds}
          isGenerating={generateTransferSuggestions.isPending}
          onGenerate={() => void handleGenerateTransferSuggestions()}
          onReview={setReviewTransferSuggestion}
          selectedGroupId={selectedGroupId}
          selectedPharmacyName={selectedPharmacy.name}
          setDeadDays={setDeadDays}
          setSelectedGroupId={setSelectedGroupId}
          suggestions={{
            data: branchTransferSuggestions,
            isError: transferSuggestionsQuery.isError,
            isLoading: transferSuggestionsQuery.isLoading,
            isSuccess: transferSuggestionsQuery.isSuccess,
          }}
        />
      ) : null}

      {!isSuperintendentGroupView && canViewTransferSuggestions ? (
        <TransferSuggestionsPanel
          canDismissTransferSuggestions={canDismissTransferSuggestions}
          canGenerateTransferSuggestions={canGenerateTransferSuggestions}
          deadDays={deadDays}
          dismissError={dismissTransferSuggestion.isError}
          generateError={generateTransferSuggestions.isError}
          groupIds={groupIds}
          isGenerating={generateTransferSuggestions.isPending}
          onDismiss={handleDismissTransferSuggestion}
          onGenerate={() => void handleGenerateTransferSuggestions()}
          selectedGroupId={selectedGroupId}
          setDeadDays={setDeadDays}
          setSelectedGroupId={setSelectedGroupId}
          suggestions={{
            data: transferSuggestionsQuery.data,
            isError: transferSuggestionsQuery.isError,
            isLoading: transferSuggestionsQuery.isLoading,
            isSuccess: transferSuggestionsQuery.isSuccess,
          }}
        />
      ) : null}

      <OpportunityRoadmap />

      <ReviewTransferModal
        onClose={() => setReviewTransferSuggestion(null)}
        suggestion={reviewTransferSuggestion}
      />
    </div>
  );
}
