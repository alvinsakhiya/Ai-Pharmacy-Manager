import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  BellOff,
  CalendarClock,
  ClipboardCheck,
  Clock3,
  Filter,
  ListChecks,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { KpiCard } from "../../components/ui/KpiCard";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { SearchSuggestions } from "../../components/ui/SearchSuggestions";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { inputClass, labelClass, selectClass } from "../../components/ui/forms";
import { cn } from "../../lib/cn";
import { scopeLabel } from "../../lib/scope";
import { matchesSearchTokens, suggestionsFor } from "../../lib/smartSearch";
import type {
  WorkQueueItem,
  WorkQueuePriority,
} from "./notificationsApi";
import { useWorkQueueQuery } from "./useNotifications";
import {
  formatWorkQueueDate,
  formatWorkQueueDateTime,
  workQueueActionLabel,
  workQueuePriorityLabel,
  workQueueStatusLabel,
  workQueueTypeLabel,
} from "./workQueueDisplay";

type FilterValue = "all";

interface GroupConfig {
  key:
    | "mds_preparation"
    | "stock_review"
    | "expiry_review"
    | "reviews"
    | "action_needed";
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
  matches: (item: WorkQueueItem) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

const OPERATIONAL_GROUPS: GroupConfig[] = [
  {
    key: "mds_preparation",
    title: "MDS preparation",
    subtitle: "Prepare reminders, due supply, and trays waiting for check.",
    icon: ShieldCheck,
    accent: "border-lilac-soft bg-lilac-soft text-brand",
    matches: isMdsItem,
    emptyTitle: "MDS reminders will appear here when available.",
    emptyDescription:
      "Work Queue is using existing data only. Prepare reminders can be surfaced here when backend reminder items are present.",
  },
  {
    key: "stock_review",
    title: "Stock review",
    subtitle: "Stock signals that need review before action.",
    icon: PackageCheck,
    accent: "border-info-border bg-info-soft text-info-ink",
    matches: (item) => isStockItem(item) && !isExpiryItem(item),
  },
  {
    key: "expiry_review",
    title: "Expiry review",
    subtitle: "Expiry and near-expiry stock signals.",
    icon: CalendarClock,
    accent: "border-warning-border bg-warning-soft text-warning-ink",
    matches: isExpiryItem,
  },
  {
    key: "reviews",
    title: "Reviews",
    subtitle: "Pending review records that need operational follow-up.",
    icon: ClipboardCheck,
    accent: "border-line-strong bg-surface-sunken text-ink-soft",
    matches: isReviewItem,
  },
  {
    key: "action_needed",
    title: "Action needed",
    subtitle: "Other queue items still needing review before action.",
    icon: AlertTriangle,
    accent: "border-danger-border bg-danger-soft text-danger-ink",
    matches: (item) =>
      !isMdsItem(item) &&
      !isStockItem(item) &&
      !isExpiryItem(item) &&
      !isReviewItem(item),
  },
];

const PRIORITY_BADGES: Record<WorkQueuePriority, BadgeVariant> = {
  urgent: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
};

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function isDueTodayOrOverdue(item: WorkQueueItem, today = new Date()): boolean {
  if (!item.due_date) {
    return item.status === "OVERDUE";
  }
  return parseDateOnly(item.due_date) <= startOfDay(today);
}

function isDueToday(item: WorkQueueItem, today = new Date()): boolean {
  if (!item.due_date) {
    return false;
  }
  return parseDateOnly(item.due_date).getTime() === startOfDay(today).getTime();
}

function dueTone(item: WorkQueueItem): BadgeVariant {
  if (item.status === "OVERDUE") {
    return "danger";
  }
  if (item.due_date && isDueTodayOrOverdue(item)) {
    return "warning";
  }
  return "neutral";
}

function isMdsItem(item: WorkQueueItem): boolean {
  return item.type.startsWith("MDS_");
}

function isStockItem(item: WorkQueueItem): boolean {
  return item.type.startsWith("STOCK_");
}

function isExpiryItem(item: WorkQueueItem): boolean {
  return /expir/i.test([item.type, item.title, item.reason].join(" "));
}

function isReviewItem(item: WorkQueueItem): boolean {
  return item.type.startsWith("REVIEW_");
}

function isOverdue(item: WorkQueueItem): boolean {
  return item.status === "OVERDUE";
}

function isDueSoon(item: WorkQueueItem): boolean {
  return item.group === "due_soon" || item.status === "DUE_SOON";
}

function dueStatusLabel(item: WorkQueueItem, today = new Date()): string {
  if (isOverdue(item)) {
    return "Overdue";
  }
  if (isDueTodayOrOverdue(item, today)) {
    return "Due now";
  }
  if (isDueSoon(item)) {
    return "Due soon";
  }
  return workQueueStatusLabel(item.status);
}

function operationalActionLabel(item: WorkQueueItem): string {
  if (isMdsItem(item)) {
    return item.status === "WAITING_CHECK" || item.type.includes("WAITING_CHECK")
      ? "Check tray"
      : "Prepare tray";
  }
  if (isExpiryItem(item)) {
    return "Expiry review";
  }
  if (isStockItem(item)) {
    return "Check stock";
  }
  if (isReviewItem(item)) {
    return "Review before action";
  }
  return item.action_label || "Action needed";
}

function cycleRange(item: WorkQueueItem): string | null {
  if (!item.cycle_start_date && !item.cycle_end_date) {
    return null;
  }
  return `${formatWorkQueueDate(item.cycle_start_date)} - ${formatWorkQueueDate(
    item.cycle_end_date,
  )}`;
}

function uniqueTypes(items: WorkQueueItem[]): string[] {
  return Array.from(new Set(items.map((item) => item.type))).sort((a, b) =>
    workQueueTypeLabel(a).localeCompare(workQueueTypeLabel(b)),
  );
}

function uniquePharmacies(items: WorkQueueItem[]) {
  const pharmacies = new Map<number, string>();
  for (const item of items) {
    pharmacies.set(
      item.pharmacy_id,
      item.pharmacy_name || `Pharmacy ${item.pharmacy_id}`,
    );
  }
  return Array.from(pharmacies, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function taskSearchFields(item: WorkQueueItem) {
  return [
    item.title,
    item.reason,
    item.type,
    item.status,
    item.priority,
    item.pharmacy_name,
    item.patient_reference,
    item.cycle_reference,
    item.action_label,
    item.due_date,
  ];
}

function activeFilterLabel({
  priorityFilter,
  typeFilter,
  pharmacyFilter,
  searchQuery,
}: {
  priorityFilter: FilterValue | WorkQueuePriority;
  typeFilter: FilterValue | string;
  pharmacyFilter: FilterValue | string;
  searchQuery: string;
}): string {
  const active = [
    priorityFilter !== "all",
    typeFilter !== "all",
    pharmacyFilter !== "all",
    searchQuery.trim().length > 0,
  ].filter(Boolean).length;

  return active === 0
    ? "All tasks"
    : `${active} active filter${active === 1 ? "" : "s"}`;
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  if (value === null || value === "") {
    return null;
  }

  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function WorkQueueCard({ item }: { item: WorkQueueItem }) {
  const range = cycleRange(item);
  const dueLabel = item.due_date
    ? formatWorkQueueDate(item.due_date)
    : "No due date";
  const pharmacy = item.pharmacy_name || `Pharmacy ${item.pharmacy_id}`;
  const prepareFrom = isMdsItem(item) ? formatWorkQueueDate(item.cycle_start_date) : null;

  return (
    <article className="interactive-card flex min-h-[230px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
      <div className="flex flex-1 flex-col gap-3.5 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant={PRIORITY_BADGES[item.priority]} dot>
              {workQueuePriorityLabel(item.priority)}
            </Badge>
            <Badge variant={dueTone(item)}>{dueStatusLabel(item)}</Badge>
            <Badge variant="info">{workQueueTypeLabel(item.type)}</Badge>
            <Badge variant="neutral">{operationalActionLabel(item)}</Badge>
          </div>
          <h3 className="mt-3 text-[17px] font-extrabold tracking-[-0.01em] text-ink">
            {item.title}
          </h3>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">
            {item.reason}
          </p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <Detail label="Patient ref" value={item.patient_reference} />
            <Detail label="Action type" value={operationalActionLabel(item)} />
            <Detail label="Due date" value={dueLabel} />
            <Detail label="Prepare from" value={prepareFrom} />
            <Detail label="Cycle ref" value={item.cycle_reference} />
            <Detail label="Cycle range" value={range} />
            <Detail label="Pharmacy" value={pharmacy} />
          </dl>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <Badge variant="info">Review before action</Badge>
          <Link
            aria-label={`Open record: ${workQueueActionLabel(item)}`}
            to={item.action_href}
            className={cn(
              "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full",
              "border border-line-strong bg-surface px-4 text-sm font-semibold text-ink-soft",
              "shadow-elev-1 transition-all duration-200 ease-soft hover:-translate-y-px",
              "hover:bg-surface-subtle hover:text-ink focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2",
              "focus-visible:ring-offset-canvas",
            )}
          >
            {workQueueActionLabel(item)}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function GroupSection({
  group,
  items,
}: {
  group: GroupConfig;
  items: WorkQueueItem[];
}) {
  const Icon = group.icon;

  if (items.length === 0 && !group.emptyTitle) {
    return null;
  }

  return (
    <section
      className="rounded-2xl border border-line bg-surface-subtle p-4 sm:p-5"
      aria-labelledby={`work-queue-${group.key}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full border shadow-elev-1",
              group.accent,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={`work-queue-${group.key}`}
              className="text-lg font-extrabold text-ink"
            >
              {group.title}
            </h2>
            <p className="mt-1 text-sm text-muted">{group.subtitle}</p>
          </div>
        </div>
        <span className="tnum rounded-full border border-line bg-surface px-3 py-1 text-sm font-bold text-ink-soft shadow-elev-1">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface px-4 py-5">
          <h3 className="text-sm font-extrabold text-ink">{group.emptyTitle}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {group.emptyDescription}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {items.map((item) => (
            <WorkQueueCard item={item} key={item.id} />
          ))}
        </div>
      )}
    </section>
  );
}

export function WorkQueueScreen() {
  const { user } = useAuth();
  const workQueueQuery = useWorkQueueQuery();
  const [priorityFilter, setPriorityFilter] = useState<
    FilterValue | WorkQueuePriority
  >("all");
  const [typeFilter, setTypeFilter] = useState<FilterValue | string>("all");
  const [pharmacyFilter, setPharmacyFilter] = useState<FilterValue | string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const userScopeLabel = user ? scopeLabel(user) : "Scope unavailable";
  const today = useMemo(() => new Date(), []);
  const dateLabel = useMemo(
    () =>
      today.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [today],
  );

  const items = useMemo(
    () => workQueueQuery.data?.items ?? [],
    [workQueueQuery.data?.items],
  );
  const typeOptions = useMemo(() => uniqueTypes(items), [items]);
  const pharmacyOptions = useMemo(() => uniquePharmacies(items), [items]);
  const priorityOptions = useMemo(
    () =>
      (["urgent", "high", "medium", "low"] as WorkQueuePriority[]).filter(
        (priority) => items.some((item) => item.priority === priority),
      ),
    [items],
  );

  const filteredItems = useMemo(
    () => {
      const query = searchQuery.trim().toLowerCase();
      return items.filter((item) => {
        if (priorityFilter !== "all" && item.priority !== priorityFilter) {
          return false;
        }
        if (typeFilter !== "all" && item.type !== typeFilter) {
          return false;
        }
        if (
          pharmacyFilter !== "all" &&
          String(item.pharmacy_id) !== pharmacyFilter
        ) {
          return false;
        }
        if (query && !matchesSearchTokens(query, taskSearchFields(item))) {
          return false;
        }
        return true;
      });
    },
    [items, pharmacyFilter, priorityFilter, searchQuery, typeFilter],
  );

  const operationalGroups = useMemo(
    () =>
      OPERATIONAL_GROUPS.map((group) => ({
        group,
        items: filteredItems.filter(group.matches),
      })),
    [filteredItems],
  );

  const visibleSummary = useMemo(
    () => ({
      dueToday: filteredItems.filter((item) => isDueToday(item, today)).length,
      overdue: filteredItems.filter(isOverdue).length,
      dueSoon: filteredItems.filter((item) => isDueSoon(item)).length,
      mdsPrep: filteredItems.filter(isMdsItem).length,
      stockReview: filteredItems.filter(isStockItem).length,
      expiryReview: filteredItems.filter(isExpiryItem).length,
      dueNow: filteredItems.filter((item) => isDueTodayOrOverdue(item, today))
        .length,
    }),
    [filteredItems, today],
  );

  const filterLabel = activeFilterLabel({
    pharmacyFilter,
    priorityFilter,
    searchQuery,
    typeFilter,
  });
  const taskSuggestions = suggestionsFor({
    items,
    query: searchQuery,
    getId: (item) => item.id,
    getLabel: (item) => item.title,
    getDescription: (item) =>
      `${workQueueTypeLabel(item.type)} · ${item.patient_reference || item.pharmacy_name}`,
    getFields: taskSearchFields,
  });

  return (
    <div className="space-y-5">
      <header className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
              Operational queue
            </p>
            <h1 className="mt-1.5 text-[30px] font-extrabold tracking-[-0.025em] text-ink sm:text-[34px]">
              Work Queue
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              Review pharmacy tasks that need attention before action.
            </p>
          </div>
          <Button
            variant="secondary"
            leadingIcon={<RefreshCw className="h-4 w-4" />}
            disabled={workQueueQuery.isFetching}
            onClick={() => void workQueueQuery.refetch()}
          >
            Refresh
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{userScopeLabel}</Badge>
          <Badge variant="info">Human review required</Badge>
          <Badge variant="neutral">{filterLabel}</Badge>
          <Badge variant="neutral">{dateLabel}</Badge>
          {workQueueQuery.data ? (
            <Badge variant="neutral">
              Generated{" "}
              {formatWorkQueueDateTime(workQueueQuery.data.generated_at)}
            </Badge>
          ) : null}
        </div>
      </header>

      {workQueueQuery.isLoading ? (
        <Panel>
          <PanelHeader title="Work Queue" subtitle="Loading work queue..." />
          <PanelBody>
            <SkeletonRows rows={5} />
          </PanelBody>
        </Panel>
      ) : null}

      {workQueueQuery.isError ? (
        <EmptyState
          tone="danger"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
          title="Could not load work queue."
          description="Please retry. Your session or permissions may need refreshing."
          action={
            <Button
              variant="danger"
              onClick={() => void workQueueQuery.refetch()}
            >
              Retry
            </Button>
          }
        />
      ) : null}

      {workQueueQuery.isSuccess ? (
        <>
          <section
            aria-label="Work queue summary"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"
          >
            <KpiCard
              label="Due today"
              value={visibleSummary.dueToday}
              note={`${visibleSummary.dueNow} due now or earlier`}
              icon={<CalendarClock className="h-4 w-4" />}
            />
            <KpiCard
              label="Overdue"
              value={visibleSummary.overdue}
              note="Needs review before action"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <KpiCard
              label="Due soon"
              value={visibleSummary.dueSoon}
              note="Suggested preparation window"
              icon={<Clock3 className="h-4 w-4" />}
            />
            <KpiCard
              label="MDS prep"
              value={visibleSummary.mdsPrep}
              note="Prepare tray and check records"
              icon={<ShieldCheck className="h-4 w-4" />}
            />
            <KpiCard
              label="Stock review"
              value={visibleSummary.stockReview}
              note="Check stock before action"
              icon={<PackageCheck className="h-4 w-4" />}
            />
            <KpiCard
              label="Expiry review"
              value={visibleSummary.expiryReview}
              note={`${workQueueQuery.data.summary.total} open tasks in source view`}
              icon={<CalendarClock className="h-4 w-4" />}
            />
          </section>

          {workQueueQuery.data.items.length > 0 ? (
            <Panel>
              <PanelHeader
                title="Queue controls"
                subtitle={`${filteredItems.length} of ${workQueueQuery.data.items.length} tasks shown`}
                icon={<Filter className="h-4 w-4" aria-hidden="true" />}
              />
              <PanelBody>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className={labelClass}>
                    <label htmlFor="work-queue-search">Search tasks</label>
                    <div className="relative">
                      <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                      />
                      <input
                        id="work-queue-search"
                        className={cn(inputClass, "pl-9")}
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Title, reason, pharmacy..."
                      />
                    </div>
                    <SearchSuggestions
                      suggestions={taskSuggestions}
                      onPick={(suggestion) => setSearchQuery(suggestion.label)}
                      label="Task matches"
                    />
                  </div>
                  <label>
                    <span className={labelClass}>Priority</span>
                    <select
                      className={selectClass}
                      value={priorityFilter}
                      onChange={(event) =>
                        setPriorityFilter(
                          event.target.value as FilterValue | WorkQueuePriority,
                        )
                      }
                    >
                      <option value="all">All priorities</option>
                      {priorityOptions.map((priority) => (
                        <option value={priority} key={priority}>
                          {workQueuePriorityLabel(priority)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={labelClass}>Task type</span>
                    <select
                      className={selectClass}
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value)}
                    >
                      <option value="all">All task types</option>
                      {typeOptions.map((type) => (
                        <option value={type} key={type}>
                          {workQueueTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {pharmacyOptions.length > 1 ? (
                    <label>
                      <span className={labelClass}>Pharmacy</span>
                      <select
                        className={selectClass}
                        value={pharmacyFilter}
                        onChange={(event) =>
                          setPharmacyFilter(event.target.value)
                        }
                      >
                        <option value="all">All pharmacies</option>
                        {pharmacyOptions.map((pharmacy) => (
                          <option value={pharmacy.id} key={pharmacy.id}>
                            {pharmacy.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
                  <Sparkles
                    className="h-3.5 w-3.5 text-brand"
                    aria-hidden="true"
                  />
                  <span>{filterLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>Existing queue data only</span>
                </div>
              </PanelBody>
            </Panel>
          ) : null}

          {workQueueQuery.data.items.length === 0 ? (
            <EmptyState
              icon={<BellOff className="h-5 w-5" aria-hidden="true" />}
              title="No tasks match the current view."
              description="There are no operational signals in this queue view."
            />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="h-5 w-5" aria-hidden="true" />}
              title="No tasks match the current view."
              description="Adjust the filters or refresh the queue."
            />
          ) : (
            <div className="space-y-8">
              {operationalGroups.map(({ group, items: groupItems }) => (
                <GroupSection
                  group={group}
                  items={groupItems}
                  key={group.key}
                />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
