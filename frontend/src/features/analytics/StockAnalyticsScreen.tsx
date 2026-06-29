import { useEffect, useMemo, useState, type SelectHTMLAttributes } from "react";
import {
  ArrowRightLeft,
  Boxes,
  CalendarClock,
  ChevronDown,
  LineChart,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import type {
  ForecastItem,
  StockAnalyticsFlags,
  StockAnalyticsItem,
  TransferSuggestion,
} from "./analyticsApi";
import {
  useDismissTransferSuggestion,
  useGenerateForecast,
  useGenerateTransferSuggestions,
  useLatestForecastQuery,
  useStockAnalyticsOverviewQuery,
  useTransferSuggestionsQuery,
} from "./useAnalytics";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { KpiCard } from "../../components/ui/KpiCard";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
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

const ROADMAP_IDEAS = [
  "Expiry risk heatmap",
  "FEFO adherence monitor",
  "Stockout risk score",
  "Slow-moving stock detector",
  "MDS demand forecast",
  "Suggested order review list",
  "Transfer opportunity between branches",
  "Overstock warning",
  "Supplier lead-time sensitivity",
  "Seasonal demand notes",
  "Stock value at risk",
  "What changed this week insight summary",
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

/** A select that adopts house styling but keeps the label↔control wiring intact. */
function FieldSelect({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(selectClass, "appearance-none pr-9", className)} {...rest}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      />
    </div>
  );
}

function ForecastConfidence({ confidence }: { confidence: string }) {
  const percentage = Math.round(Number(confidence) * 100);
  const variant =
    percentage >= 75 ? "success" : percentage >= 50 ? "info" : "warning";

  return (
    <Badge variant={variant} dot>
      <span className="tnum">{percentage}% confidence</span>
    </Badge>
  );
}

function ConfidenceChip({ confidence }: { confidence: string }) {
  return <ForecastConfidence confidence={confidence} />;
}

function ForecastRow({ item }: { item: ForecastItem }) {
  return (
    <TR>
      <TD className="min-w-64">
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
      <TD className="min-w-96">
        <details className="group">
          <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 font-semibold text-brand transition-colors hover:text-brand-hover">
            <ChevronDown
              aria-hidden="true"
              className="h-3.5 w-3.5 transition-transform duration-150 ease-soft group-open:rotate-180"
            />
            Explanation
          </summary>
          <p className="mt-2 leading-relaxed text-ink-soft">{item.explanation}</p>
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
      <TD className="min-w-64">
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
      <TD className="min-w-96 leading-relaxed">{suggestion.reason}</TD>
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

function FlagBadges({ flags }: { flags: StockAnalyticsFlags }) {
  const activeFlags = FLAG_LABELS.filter((flag) => flags[flag.key]);

  if (activeFlags.length === 0) {
    return <span className="text-muted">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {activeFlags.map((flag) => (
        <Badge key={flag.key} variant="warning">
          {flag.label}
        </Badge>
      ))}
    </div>
  );
}

function ExpiryCell({ item }: { item: StockAnalyticsItem }) {
  if (!item.earliest_expiry) {
    return <span className="text-muted">-</span>;
  }

  const days = item.days_to_expiry;
  const heat =
    days === null
      ? "text-ink-soft"
      : days <= 0
        ? "text-fefo-expired"
        : days <= 30
          ? "text-fefo-d30"
          : days <= 90
            ? "text-fefo-d90"
            : days <= 180
              ? "text-fefo-d180"
              : "text-fefo-fresh";

  return (
    <span>
      <span className="tnum">{formatDate(item.earliest_expiry)}</span>
      {days !== null ? (
        <span className={cn("tnum block text-xs font-semibold", heat)}>
          {days} days
        </span>
      ) : null}
    </span>
  );
}

function AnalyticsRow({ item }: { item: StockAnalyticsItem }) {
  return (
    <TR>
      <TD className="whitespace-nowrap font-semibold text-ink">
        {item.medication_name}
      </TD>
      <TD className="tnum whitespace-nowrap">{item.pharmacy_id}</TD>
      <TD className="tnum whitespace-nowrap">{item.quantity_on_hand}</TD>
      <TD className="tnum whitespace-nowrap">{item.reorder_level}</TD>
      <TD className="whitespace-nowrap">
        <ExpiryCell item={item} />
      </TD>
      <TD>
        <FlagBadges flags={item.flags} />
      </TD>
      <TD className="tnum whitespace-nowrap font-semibold text-ink">
        {item.attention_score}
      </TD>
      <TD className="tnum whitespace-nowrap">
        {item.suggested_reorder_quantity}
      </TD>
      <TD>
        {item.reasons.length > 0 ? (
          <ul className="space-y-1 leading-relaxed">
            {item.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <span className="text-muted">-</span>
        )}
      </TD>
    </TR>
  );
}

function OpportunityRoadmap() {
  return (
    <Panel>
      <PanelHeader
        title="Opportunity roadmap"
        subtitle="Frontend-only AI enhancement ideas for demo discussion."
        icon={<Sparkles className="h-4 w-4" />}
        actions={<Badge variant="info">Suggested enhancement</Badge>}
      />
      <PanelBody>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ROADMAP_IDEAS.map((idea, index) => {
            const Icon =
              index % 4 === 0
                ? CalendarClock
                : index % 4 === 1
                  ? ShieldCheck
                  : index % 4 === 2
                    ? TrendingUp
                    : Boxes;
            return (
              <article
                className="rounded-xl border border-line bg-surface-subtle p-3"
                key={idea}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-lilac-soft text-brand"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-ink">{idea}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      Operational signal for review before action.
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-3 rounded-xl border border-info-border bg-info-soft px-3 py-2 text-xs font-semibold text-info-ink">
          These roadmap cards describe future operational signals for human
          review before action.
        </p>
      </PanelBody>
    </Panel>
  );
}

export function StockAnalyticsScreen() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const pharmacies = useMemo(() => user?.pharmacies ?? [], [user?.pharmacies]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<number | undefined>(
    undefined,
  );
  const groupIds = useMemo(() => user?.scope.group_ids ?? [], [user?.scope.group_ids]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(
    undefined,
  );
  const [horizonDays, setHorizonDays] = useState(30);
  const [deadDays, setDeadDays] = useState(30);
  const stockOverviewQuery = useStockAnalyticsOverviewQuery(selectedPharmacyId);
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

  return (
    <div className="stagger space-y-5">
      <PageHeader
        className="animate-fade-in-up"
        eyebrow="Inventory analytics"
        title="Stock Intelligence"
        subtitle="Explainable stock analytics based on inventory levels, expiry dates, and movement history."
      />

      <OpportunityRoadmap />

      {canViewTransferSuggestions ? (
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
                          event.target.value
                            ? Number(event.target.value)
                            : undefined,
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
                      className={cn(selectClass)}
                      min="1"
                      onChange={(event) =>
                        setSelectedGroupId(
                          event.target.value
                            ? Number(event.target.value)
                            : undefined,
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
                    disabled={
                      selectedGroupId === undefined ||
                      generateTransferSuggestions.isPending
                    }
                    onClick={() => void handleGenerateTransferSuggestions()}
                  >
                    {generateTransferSuggestions.isPending
                      ? "Generating..."
                      : "Generate transfer suggestions"}
                  </Button>
                ) : null}
              </div>
            </div>
          </PanelHeader>

          <PanelBody className="space-y-4">
            {generateTransferSuggestions.isError ? (
              <p className="rounded-xl border border-danger-border bg-danger-soft p-3 text-sm text-danger-ink">
                Could not generate transfer suggestions. Check your group scope and
                try again.
              </p>
            ) : null}

            {dismissTransferSuggestion.isError ? (
              <p className="rounded-xl border border-danger-border bg-danger-soft p-3 text-sm text-danger-ink">
                Could not dismiss transfer suggestion.
              </p>
            ) : null}

            {selectedGroupId === undefined ? (
              <EmptyState
                icon={<ArrowRightLeft className="h-5 w-5" />}
                title="Select a group to view transfer suggestions."
              />
            ) : null}

            {transferSuggestionsQuery.isLoading ? (
              <SkeletonRows rows={4} />
            ) : null}

            {transferSuggestionsQuery.isError ? (
              <EmptyState
                tone="danger"
                icon={<ArrowRightLeft className="h-5 w-5" />}
                title="Could not load transfer suggestions."
              />
            ) : null}

            {transferSuggestionsQuery.isSuccess &&
            transferSuggestionsQuery.data.length === 0 ? (
              <EmptyState
                icon={<ArrowRightLeft className="h-5 w-5" />}
                title="No transfer suggestions to review."
              />
            ) : null}

            {transferSuggestionsQuery.isSuccess &&
            transferSuggestionsQuery.data.length > 0 ? (
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
                    {transferSuggestionsQuery.data.map((suggestion) => (
                      <TransferSuggestionRow
                        canDismiss={canDismissTransferSuggestions}
                        key={suggestion.id}
                        onDismiss={handleDismissTransferSuggestion}
                        suggestion={suggestion}
                      />
                    ))}
                  </TBody>
                </Table>
              </TableScroll>
            ) : null}
          </PanelBody>
        </Panel>
      ) : null}

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
                  Forecast suggestion
                </p>
                <h2 className="mt-0.5 text-[15px] font-bold tracking-[-0.01em] text-ink">
                  Reorder forecasting
                </h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
                  Estimated demand based on stock movement history. Human review
                  required before ordering.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              {pharmacies.length > 0 ? (
                <label className="min-w-56">
                  <span className={labelClass}>Pharmacy</span>
                  <FieldSelect
                    onChange={(event) =>
                      setSelectedPharmacyId(
                        event.target.value
                          ? Number(event.target.value)
                          : undefined,
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
                  disabled={
                    selectedPharmacyId === undefined || generateForecast.isPending
                  }
                  onClick={() => void handleGenerateForecast()}
                >
                  {generateForecast.isPending
                    ? "Generating..."
                    : "Generate forecast"}
                </Button>
              ) : null}
            </div>
          </div>
        </PanelHeader>

        <PanelBody className="space-y-4">
          {generateForecast.isError ? (
            <p className="rounded-xl border border-danger-border bg-danger-soft p-3 text-sm text-danger-ink">
              Could not generate forecast. Check your pharmacy scope and try again.
            </p>
          ) : null}

          {selectedPharmacyId === undefined ? (
            <EmptyState
              icon={<LineChart className="h-5 w-5" />}
              title="Select a pharmacy to view forecasting suggestions."
            />
          ) : null}

          {latestForecastQuery.isLoading ? (
            <SkeletonRows rows={4} />
          ) : null}

          {latestForecastQuery.isError ? (
            <EmptyState
              tone="danger"
              icon={<LineChart className="h-5 w-5" />}
              title="Could not load latest forecast."
            />
          ) : null}

          {latestForecastQuery.isSuccess && latestForecastQuery.data === null ? (
            <EmptyState
              icon={<LineChart className="h-5 w-5" />}
              title="No forecast generated yet."
            />
          ) : null}

          {latestForecastQuery.isSuccess && latestForecastQuery.data !== null ? (
            <TableScroll>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-subtle px-4 py-3">
                <div>
                  <p className="text-[13px] font-bold text-ink">
                    Latest forecast: {latestForecastQuery.data.horizon_days} days,
                    model {latestForecastQuery.data.model_version}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Generated {formatDate(latestForecastQuery.data.created_at)}
                  </p>
                </div>
              </div>
              {latestForecastQuery.data.items.length === 0 ? (
                <EmptyState
                  icon={<LineChart className="h-5 w-5" />}
                  title="No active stock items found for this pharmacy."
                />
              ) : (
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Product</TH>
                      <TH>Predicted usage</TH>
                      <TH>Current stock</TH>
                      <TH>Suggested reorder</TH>
                      <TH>Confidence</TH>
                      <TH>Rationale</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {latestForecastQuery.data.items.map((item) => (
                      <ForecastRow item={item} key={item.id} />
                    ))}
                  </TBody>
                </Table>
              )}
            </TableScroll>
          ) : null}
        </PanelBody>
      </Panel>

      {stockOverviewQuery.isLoading ? (
        <Panel>
          <PanelBody>
            <SkeletonRows rows={6} />
          </PanelBody>
        </Panel>
      ) : null}

      {stockOverviewQuery.isError ? (
        <EmptyState
          tone="danger"
          icon={<PackageSearch className="h-6 w-6" />}
          title="Could not load stock intelligence."
          description="Please retry. Your session or permissions may need refreshing."
          action={
            <Button
              variant="danger"
              leadingIcon={<RefreshCw className="h-4 w-4" />}
              onClick={() => void stockOverviewQuery.refetch()}
            >
              Retry
            </Button>
          }
        />
      ) : null}

      {stockOverviewQuery.isSuccess ? (
        <>
          <section
            aria-label="Stock attention summary"
            className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {SUMMARY_LABELS.map((summary) => (
              <KpiCard
                key={summary.key}
                label={summary.label}
                value={stockOverviewQuery.data.summary[summary.key]}
              />
            ))}
          </section>

          {stockOverviewQuery.data.items.length === 0 ? (
            <EmptyState
              icon={<PackageSearch className="h-6 w-6" />}
              title="No stock analytics to display."
              description="Stock items in scope will appear here once movement and inventory data is available."
            />
          ) : (
            <Panel>
              <PanelHeader>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">
                    Attention table
                  </h2>
                  <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-muted">
                    Thresholds: near expiry{" "}
                    {stockOverviewQuery.data.thresholds.near_expiry_days} days, dead
                    stock {stockOverviewQuery.data.thresholds.dead_stock_days} days,
                    slow moving below{" "}
                    {stockOverviewQuery.data.thresholds.slow_moving_threshold} units
                    consumed.
                  </p>
                </div>
              </PanelHeader>
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Medication</TH>
                      <TH>Pharmacy</TH>
                      <TH>On hand</TH>
                      <TH>Reorder level</TH>
                      <TH>Expiry</TH>
                      <TH>Flags</TH>
                      <TH>Attention</TH>
                      <TH>Reorder</TH>
                      <TH>Reasons</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {stockOverviewQuery.data.items.map((item) => (
                      <AnalyticsRow item={item} key={item.stock_item_id} />
                    ))}
                  </TBody>
                </Table>
              </div>
            </Panel>
          )}
        </>
      ) : null}
    </div>
  );
}
