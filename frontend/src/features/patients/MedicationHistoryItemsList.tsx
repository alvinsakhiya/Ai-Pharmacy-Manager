import { useEffect, useMemo, useState } from "react";
import { Pill, Search } from "lucide-react";

import { Badge, type BadgeVariant } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { inputClass, selectClass } from "../../components/ui/forms";
import { cn } from "../../lib/cn";
import type {
  DosetteCycle,
  PatientMedicationLine,
} from "../dosette/dosetteApi";

const NOT_RECORDED = "Not recorded";

const TIME_SLOTS = [
  { key: "quantity_morning", label: "Morning" },
  { key: "quantity_lunchtime", label: "Lunchtime" },
  { key: "quantity_evening", label: "Evening" },
  { key: "quantity_bedtime", label: "Bedtime" },
] as const;

type StatusFilter = "all" | "active" | "discontinued";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All medications" },
  { value: "active", label: "Active only" },
  { value: "discontinued", label: "Discontinued only" },
];

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return NOT_RECORDED;
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

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return NOT_RECORDED;
  }
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

function formatTimingValue(
  value: string | null | undefined,
  actor?: string | null,
): string {
  if (!value) {
    return NOT_RECORDED;
  }

  const formatted = formatDateTime(value);
  const trimmedActor = actor?.trim();
  return trimmedActor ? `${formatted} by ${trimmedActor}` : formatted;
}

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function medicationDescriptor(line: PatientMedicationLine): string {
  const parts = [
    line.strength?.trim(),
    line.form ? formatLabel(line.form) : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" - ") : "Strength/form not recorded";
}

function totalDailyDose(line: PatientMedicationLine): number {
  return TIME_SLOTS.reduce((total, slot) => total + line[slot.key], 0);
}

function dosageInstructions(line: PatientMedicationLine): string {
  return line.dose_instructions.trim() || "Dosage instructions not recorded.";
}

function appearanceLabel(line: PatientMedicationLine): string {
  const parts = [line.colour?.trim(), line.shape?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : NOT_RECORDED;
}

// --- Dosette event helpers (real event timestamps only; never planned/draft) ---
function cycleEventDate(cycle: DosetteCycle): string | null {
  return cycle.deducted_at ?? cycle.checked_at ?? cycle.prepared_at;
}

function cycleEventType(cycle: DosetteCycle): string {
  if (cycle.deducted_at) {
    return "Stock deducted";
  }
  if (cycle.checked_at) {
    return "Checked";
  }
  if (cycle.prepared_at) {
    return "Prepared";
  }
  return NOT_RECORDED;
}

function sortTimestamp(value: string | null | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function latestByDate(
  cycles: DosetteCycle[],
  dateFor: (cycle: DosetteCycle) => string | null | undefined,
): DosetteCycle | null {
  return (
    cycles
      .map((cycle) => ({ cycle, timestamp: sortTimestamp(dateFor(cycle)) }))
      .filter((item) => item.timestamp > Number.NEGATIVE_INFINITY)
      .sort((left, right) => right.timestamp - left.timestamp)[0]?.cycle ?? null
  );
}

function latestRecordedEventDate(
  cycles: DosetteCycle[],
  medicationLines: PatientMedicationLine[],
): string | null {
  const timestamps = [
    ...cycles.flatMap((cycle) => [
      cycle.deducted_at,
      cycle.checked_at,
      cycle.prepared_at,
      cycle.created_at,
    ]),
    ...medicationLines.map((line) => line.created_at),
  ];

  return (
    timestamps
      .filter((value): value is string => Boolean(value))
      .map((value) => ({ value, timestamp: sortTimestamp(value) }))
      .filter((item) => item.timestamp > Number.NEGATIVE_INFINITY)
      .sort((left, right) => right.timestamp - left.timestamp)[0]?.value ?? null
  );
}

/** Most recent cycle that has actually been prepared/checked/deducted. */
function latestDispensedCycle(cycles: DosetteCycle[]): DosetteCycle | null {
  return latestByDate(cycles, cycleEventDate);
}

/** Most recent cycle overall for reference context, using real record timestamps. */
function latestCycle(cycles: DosetteCycle[]): DosetteCycle | null {
  return latestByDate(
    cycles,
    (cycle) => cycleEventDate(cycle) ?? cycle.created_at,
  );
}

function DoseSlots({ line }: { line: PatientMedicationLine }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TIME_SLOTS.map((slot) => {
        const dosed = line[slot.key] > 0;
        return (
          <span
            className={cn(
              "tnum inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
              dosed
                ? "border-line-strong bg-surface text-ink"
                : "border-line bg-surface-subtle text-muted",
            )}
            key={slot.key}
          >
            {slot.label} {line[slot.key]}
          </span>
        );
      })}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
        {label}
      </p>
      <p className="tnum mt-1 text-lg font-extrabold text-ink">{value}</p>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-muted">
        {label}
      </span>
      <span className="text-xs font-semibold text-ink-soft">{value}</span>
    </div>
  );
}

function TimingItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-muted">
        {label}
      </p>
      <p className="tnum mt-1 text-xs font-semibold leading-relaxed text-ink-soft">
        {value}
      </p>
    </div>
  );
}

function MedicationTimingGrid({
  line,
  preparedCycle,
  checkedCycle,
  deductedCycle,
  compact = false,
}: {
  line: PatientMedicationLine;
  preparedCycle: DosetteCycle | null;
  checkedCycle: DosetteCycle | null;
  deductedCycle: DosetteCycle | null;
  compact?: boolean;
}) {
  const items = [
    {
      label: "Prepared",
      value: formatTimingValue(
        preparedCycle?.prepared_at,
        preparedCycle?.prepared_by_email,
      ),
    },
    {
      label: "Checked",
      value: formatTimingValue(
        checkedCycle?.checked_at,
        checkedCycle?.checked_by_email,
      ),
    },
    {
      label: "Stock deducted",
      value: formatTimingValue(deductedCycle?.deducted_at),
    },
    {
      label: "Recorded",
      value: formatTimingValue(line.created_at),
    },
  ];

  return (
    <div
      aria-label="Latest event timing"
      className={cn(
        "grid gap-2",
        compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4",
      )}
    >
      {items.map((item) => (
        <TimingItem key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}

function MedicationCard({
  line,
  isSelected,
  eventDate,
  eventType,
  latest,
  preparedCycle,
  checkedCycle,
  deductedCycle,
  onSelect,
}: {
  line: PatientMedicationLine;
  isSelected: boolean;
  eventDate: string | null;
  eventType: string;
  latest: DosetteCycle | null;
  preparedCycle: DosetteCycle | null;
  checkedCycle: DosetteCycle | null;
  deductedCycle: DosetteCycle | null;
  onSelect: (id: number) => void;
}) {
  const statusVariant: BadgeVariant = line.is_active ? "success" : "neutral";

  return (
    <button
      aria-selected={isSelected}
      className={cn(
        "block w-full rounded-2xl border border-l-4 p-4 text-left shadow-soft transition-all duration-150 ease-soft focus-ring",
        isSelected
          ? "border-info border-l-info bg-info-soft/50 ring-1 ring-info/30"
          : "border-line border-l-transparent bg-surface hover:-translate-y-px hover:border-line-strong hover:shadow-elev-1",
      )}
      onClick={() => onSelect(line.id)}
      role="option"
      type="button"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-ink">{line.medication_name}</span>
        <Badge variant="neutral">{medicationDescriptor(line)}</Badge>
        <Badge dot variant={statusVariant}>
          {line.is_active ? "Active" : "Discontinued"}
        </Badge>
        <Badge variant={eventDate ? "info" : "neutral"}>{eventType}</Badge>
      </div>

      <div className="mt-3 space-y-2">
        <DoseSlots line={line} />
        <p className="text-[13px] leading-relaxed text-ink-soft">
          {dosageInstructions(line)}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-line pt-3">
        <MetaItem label="Last recorded event" value={formatDateTime(eventDate)} />
        {latest ? (
          <span className="text-xs font-semibold text-ink-soft">
            Latest cycle {latest.reference} · {formatLabel(latest.status)}
          </span>
        ) : null}
        <MetaItem label="Appearance" value={appearanceLabel(line)} />
        <MetaItem label="Start date" value={formatDate(line.start_date)} />
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
          Timing
        </p>
        <MedicationTimingGrid
          checkedCycle={checkedCycle}
          compact
          deductedCycle={deductedCycle}
          line={line}
          preparedCycle={preparedCycle}
        />
      </div>
    </button>
  );
}

function SelectedMedicationPanel({
  line,
  eventDate,
  eventType,
  latest,
  preparedCycle,
  checkedCycle,
  deductedCycle,
}: {
  line: PatientMedicationLine;
  eventDate: string | null;
  eventType: string;
  latest: DosetteCycle | null;
  preparedCycle: DosetteCycle | null;
  checkedCycle: DosetteCycle | null;
  deductedCycle: DosetteCycle | null;
}) {
  const total = totalDailyDose(line);
  const rows: Array<{ label: string; value: string }> = [
    {
      label: "Daily dose",
      value: total > 0 ? `${total} per day` : NOT_RECORDED,
    },
    {
      label: "Latest event",
      value: eventDate
        ? `${eventType} · ${formatDateTime(eventDate)}`
        : NOT_RECORDED,
    },
    {
      label: "Latest cycle",
      value: latest
        ? `${latest.reference} · ${formatLabel(latest.status)}`
        : NOT_RECORDED,
    },
    { label: "Appearance", value: appearanceLabel(line) },
    { label: "Start date", value: formatDate(line.start_date) },
  ];
  const cycleRows: Array<{ label: string; value: string }> = [
    {
      label: "Cycle reference",
      value: latest?.reference ?? NOT_RECORDED,
    },
    {
      label: "Cycle status",
      value: latest ? formatLabel(latest.status) : NOT_RECORDED,
    },
    {
      label: "Prepared at",
      value: formatTimingValue(latest?.prepared_at, latest?.prepared_by_email),
    },
    {
      label: "Checked at",
      value: formatTimingValue(latest?.checked_at, latest?.checked_by_email),
    },
    {
      label: "Stock deducted at",
      value: formatTimingValue(latest?.deducted_at),
    },
  ];

  return (
    <aside
      aria-label="Selected medication"
      className="h-fit rounded-2xl border border-line bg-surface-subtle p-4 shadow-soft lg:sticky lg:top-4"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
        Selected medication
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-bold text-ink">{line.medication_name}</h4>
        <Badge dot variant={line.is_active ? "success" : "neutral"}>
          {line.is_active ? "Active" : "Discontinued"}
        </Badge>
      </div>
      <p className="mt-1 text-xs font-semibold text-muted">
        {medicationDescriptor(line)}
      </p>

      <div className="mt-3">
        <DoseSlots line={line} />
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
        {dosageInstructions(line)}
      </p>

      <dl className="mt-4 space-y-2.5 border-t border-line pt-3">
        {rows.map((row) => (
          <div className="flex items-start justify-between gap-3" key={row.label}>
            <dt className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted">
              {row.label}
            </dt>
            <dd className="text-right text-xs font-semibold text-ink-soft">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 border-t border-line pt-3">
        <h5 className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
          Latest event timing
        </h5>
        <div className="mt-3">
          <MedicationTimingGrid
            checkedCycle={checkedCycle}
            deductedCycle={deductedCycle}
            line={line}
            preparedCycle={preparedCycle}
          />
        </div>
      </div>

      <dl className="mt-4 space-y-2.5 border-t border-line pt-3">
        <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
          Cycle context
        </dt>
        {cycleRows.map((row) => (
          <div className="flex items-start justify-between gap-3" key={row.label}>
            <dt className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted">
              {row.label}
            </dt>
            <dd className="text-right text-xs font-semibold text-ink-soft">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

interface MedicationHistoryItemsListProps {
  medicationLines: PatientMedicationLine[];
  cycles: DosetteCycle[];
}

export function MedicationHistoryItemsList({
  medicationLines,
  cycles,
}: MedicationHistoryItemsListProps) {
  const [selectedId, setSelectedId] = useState<number | null>(
    () => medicationLines[0]?.id ?? null,
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const dispensed = useMemo(() => latestDispensedCycle(cycles), [cycles]);
  const latest = useMemo(() => latestCycle(cycles), [cycles]);
  const latestPrepared = useMemo(
    () => latestByDate(cycles, (cycle) => cycle.prepared_at),
    [cycles],
  );
  const latestChecked = useMemo(
    () => latestByDate(cycles, (cycle) => cycle.checked_at),
    [cycles],
  );
  const latestDeducted = useMemo(
    () => latestByDate(cycles, (cycle) => cycle.deducted_at),
    [cycles],
  );
  const recordedEventDate = useMemo(
    () => latestRecordedEventDate(cycles, medicationLines),
    [cycles, medicationLines],
  );
  const eventDate = dispensed ? cycleEventDate(dispensed) : null;
  const eventType = dispensed ? cycleEventType(dispensed) : NOT_RECORDED;

  const activeCount = useMemo(
    () => medicationLines.filter((line) => line.is_active).length,
    [medicationLines],
  );
  const discontinuedCount = medicationLines.length - activeCount;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return medicationLines.filter((line) => {
      if (statusFilter === "active" && !line.is_active) {
        return false;
      }
      if (statusFilter === "discontinued" && line.is_active) {
        return false;
      }
      if (query) {
        const haystack = [
          line.medication_name,
          line.dose_instructions,
          line.strength ?? "",
          line.form ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [medicationLines, search, statusFilter]);

  useEffect(() => {
    if (medicationLines.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!medicationLines.some((line) => line.id === selectedId)) {
      setSelectedId(medicationLines[0].id);
    }
  }, [medicationLines, selectedId]);

  const selectedLine =
    medicationLines.find((line) => line.id === selectedId) ?? null;

  return (
    <section
      aria-label="Patient medication history"
      className="space-y-4 rounded-2xl border border-line bg-surface-subtle/60 p-3 sm:p-4"
    >
      <div
        aria-label="Medication history summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryStat label="Active medications" value={String(activeCount)} />
        <SummaryStat
          label="Discontinued medications"
          value={String(discontinuedCount)}
        />
        <SummaryStat
          label="Latest recorded event"
          value={formatDateTime(recordedEventDate)}
        />
        <SummaryStat
          label="Latest prepared time"
          value={formatDateTime(latestPrepared?.prepared_at)}
        />
        <SummaryStat
          label="Latest checked time"
          value={formatDateTime(latestChecked?.checked_at)}
        />
        <SummaryStat
          label="Latest stock deducted time"
          value={formatDateTime(latestDeducted?.deducted_at)}
        />
        <SummaryStat label="Dosette cycles" value={String(cycles.length)} />
      </div>

      {medicationLines.length === 0 ? (
        <EmptyState
          icon={<Pill className="h-6 w-6" />}
          title="No medication history recorded yet."
          description="Dosette and dispensing records will appear here once prepared. Human review required."
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Search medications</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              />
              <input
                className={cn(inputClass, "pl-9")}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search medication name or instructions"
                type="search"
                value={search}
              />
            </label>
            <label className="sm:w-56">
              <span className="sr-only">Filter by status</span>
              <select
                className={selectClass}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                value={statusFilter}
              >
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <div
              aria-label="Medication items"
              className="space-y-2.5"
              role="listbox"
            >
              {filtered.length === 0 ? (
                <EmptyState
                  icon={<Search className="h-6 w-6" />}
                  title="No medications match your search or filter."
                  description="Clear the search or choose a different status filter."
                />
              ) : (
                filtered.map((line) => (
                  <MedicationCard
                    checkedCycle={latestChecked}
                    deductedCycle={latestDeducted}
                    eventDate={eventDate}
                    eventType={eventType}
                    isSelected={selectedId === line.id}
                    key={line.id}
                    latest={latest}
                    line={line}
                    onSelect={setSelectedId}
                    preparedCycle={latestPrepared}
                  />
                ))
              )}
            </div>

            {selectedLine ? (
              <SelectedMedicationPanel
                checkedCycle={latestChecked}
                deductedCycle={latestDeducted}
                eventDate={eventDate}
                eventType={eventType}
                latest={latest}
                line={selectedLine}
                preparedCycle={latestPrepared}
              />
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
