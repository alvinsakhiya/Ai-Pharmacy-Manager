import { useEffect, useMemo, useState } from "react";
import { Pill } from "lucide-react";

import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { cn } from "../../lib/cn";
import type {
  DosetteCycle,
  PatientMedicationLine,
} from "../dosette/dosetteApi";

const NOT_RECORDED = "Not recorded";
const DASH = "—";

const MEDICATION_TIME_SLOTS: Array<{
  key: keyof Pick<
    PatientMedicationLine,
    | "quantity_morning"
    | "quantity_lunchtime"
    | "quantity_evening"
    | "quantity_bedtime"
  >;
  label: string;
  shortLabel: string;
}> = [
  { key: "quantity_morning", label: "Morning", shortLabel: "M" },
  { key: "quantity_lunchtime", label: "Lunchtime", shortLabel: "L" },
  { key: "quantity_evening", label: "Evening", shortLabel: "E" },
  { key: "quantity_bedtime", label: "Bedtime", shortLabel: "B" },
];

const COLUMN_CLASS =
  "grid min-w-[880px] grid-cols-[minmax(18rem,2fr)_5.5rem_3.5rem_8.5rem_8rem_8rem] items-center gap-3";

function formatDate(value: string): string {
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
  return MEDICATION_TIME_SLOTS.reduce((total, slot) => total + line[slot.key], 0);
}

function quantityPrescribed(line: PatientMedicationLine): string {
  const total = totalDailyDose(line);
  return total > 0 ? `${total} daily` : DASH;
}

function compactDose(line: PatientMedicationLine): string {
  const total = totalDailyDose(line);
  if (total === 0) {
    return "No slot dose";
  }

  return MEDICATION_TIME_SLOTS.map(
    (slot) => `${slot.shortLabel}${line[slot.key]}`,
  ).join(" ");
}

function slotInstruction(line: PatientMedicationLine): string {
  return MEDICATION_TIME_SLOTS.map(
    (slot) => `${slot.label} ${line[slot.key]}`,
  ).join(" · ");
}

function instructionText(line: PatientMedicationLine): string {
  const instructions = line.dose_instructions.trim();
  const text = instructions || "Dosage instructions not recorded.";
  return `${slotInstruction(line)} — ${text}`;
}

function cycleEventDate(cycle: DosetteCycle): string | null {
  return cycle.deducted_at ?? cycle.checked_at ?? cycle.prepared_at;
}

function sortTimestamp(value: string | null | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function latestCycleByDate(
  cycles: DosetteCycle[],
  dateForCycle: (cycle: DosetteCycle) => string | null | undefined,
): DosetteCycle | null {
  const sortedCycles = cycles
    .map((cycle) => ({
      cycle,
      timestamp: sortTimestamp(dateForCycle(cycle)),
    }))
    .filter((item) => item.timestamp > Number.NEGATIVE_INFINITY)
    .sort((left, right) => right.timestamp - left.timestamp);

  return sortedCycles[0]?.cycle ?? null;
}

function latestCycle(cycles: DosetteCycle[]): DosetteCycle | null {
  return latestCycleByDate(
    cycles,
    (cycle) => cycleEventDate(cycle) ?? cycle.start_date ?? cycle.updated_at,
  );
}

function latestDispensedCycle(cycles: DosetteCycle[]): DosetteCycle | null {
  return latestCycleByDate(cycles, cycleEventDate);
}

function lastDispensed(cycle: DosetteCycle | null): string {
  const dispensedDate = cycle ? cycleEventDate(cycle) : null;
  if (!dispensedDate) {
    return NOT_RECORDED;
  }

  return formatDate(dispensedDate);
}

function latestCycleContext(cycle: DosetteCycle | null): string | null {
  if (cycle === null) {
    return null;
  }
  return `Latest cycle ${cycle.reference} · ${formatLabel(cycle.status)}`;
}

interface MedicationHistoryItemsListProps {
  medicationLines: PatientMedicationLine[];
  cycles: DosetteCycle[];
}

export function MedicationHistoryItemsList({
  medicationLines,
  cycles,
}: MedicationHistoryItemsListProps) {
  const [selectedMedicationId, setSelectedMedicationId] = useState<number | null>(
    () => medicationLines[0]?.id ?? null,
  );
  const latest = useMemo(() => latestCycle(cycles), [cycles]);
  const latestDispensed = useMemo(() => latestDispensedCycle(cycles), [cycles]);
  const cycleContext = latestCycleContext(latest);

  useEffect(() => {
    if (medicationLines.length === 0) {
      setSelectedMedicationId(null);
      return;
    }

    if (!medicationLines.some((line) => line.id === selectedMedicationId)) {
      setSelectedMedicationId(medicationLines[0].id);
    }
  }, [medicationLines, selectedMedicationId]);

  return (
    <section
      aria-labelledby="medication-items-title"
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft"
    >
      <div className="flex flex-col gap-1.5 border-b border-line bg-surface-subtle px-4 py-3 sm:px-5">
        <h3 id="medication-items-title" className="text-sm font-bold text-ink">
          Medication Items
        </h3>
        <p className="text-xs leading-relaxed text-muted">
          Dispensing and Dosette history shown from pharmacy records. Human review
          required.
        </p>
      </div>

      {medicationLines.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={<Pill className="h-6 w-6" />}
            title="No medication history recorded yet."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div
            className={cn(
              COLUMN_CLASS,
              "sticky top-0 z-10 border-b border-line bg-surface px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted sm:px-5",
            )}
          >
            <span>Description</span>
            <span>Price</span>
            <span>#</span>
            <span>Last Dispensed</span>
            <span>Qty Prescribed</span>
            <span>Dose</span>
          </div>

          <div
            aria-label="Medication Items"
            className="max-h-[24rem] divide-y divide-line overflow-y-auto"
            role="listbox"
          >
            {medicationLines.map((line) => {
              const isSelected = selectedMedicationId === line.id;
              return (
                <button
                  aria-selected={isSelected}
                  className={cn(
                    "block w-full px-4 py-3 text-left transition-colors duration-150 ease-soft focus-ring sm:px-5",
                    isSelected
                      ? "bg-info text-white shadow-inner"
                      : "bg-surface text-ink hover:bg-surface-subtle",
                  )}
                  key={line.id}
                  onClick={() => setSelectedMedicationId(line.id)}
                  role="option"
                  type="button"
                >
                  <div className={COLUMN_CLASS}>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-bold">
                          {line.medication_name}
                        </span>
                        <Badge variant={line.is_active ? "success" : "neutral"}>
                          {line.is_active ? "Active" : "Discontinued"}
                        </Badge>
                      </div>
                      <p
                        className={cn(
                          "mt-0.5 truncate text-xs font-semibold",
                          isSelected ? "text-white/80" : "text-muted",
                        )}
                      >
                        {medicationDescriptor(line)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tnum">{DASH}</span>
                    <span className="text-sm font-semibold tnum">{DASH}</span>
                    <span className="text-sm font-semibold tnum">
                      {lastDispensed(latestDispensed)}
                    </span>
                    <span className="text-sm font-semibold tnum">
                      {quantityPrescribed(line)}
                    </span>
                    <span className="text-sm font-semibold tnum">
                      {compactDose(line)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "mt-2 min-w-[880px] rounded-lg border px-3 py-2 text-[13px] font-semibold leading-relaxed",
                      isSelected
                        ? "border-white/30 bg-white/15 text-white"
                        : "border-info-border bg-info-soft text-info-ink",
                    )}
                  >
                    <p>{instructionText(line)}</p>
                    {cycleContext ? (
                      <p
                        className={cn(
                          "mt-1 text-xs",
                          isSelected ? "text-white/80" : "text-info-ink/75",
                        )}
                      >
                        {cycleContext}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
