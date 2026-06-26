import { useEffect, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import {
  fieldErrorClass,
  inputClass,
  labelClass,
  selectClass,
} from "../../components/ui/forms";
import { useToast } from "../../components/ui/Toast";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import {
  CYCLE_FREQUENCY_OPTIONS,
  type DosetteCycle,
  type DosetteCycleWriteBody,
} from "./dosetteApi";
import { useCreateDosetteCycle, useUpdateDosetteCycle } from "./useDosette";

interface DosetteCycleFormModalProps {
  patientId: number;
  cycle: DosetteCycle | null;
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_CYCLE_FREQUENCY = "FOUR_WEEKLY";

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function addCalendarMonths(value: Date, months: number): Date {
  const next = new Date(value);
  const originalDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, lastDay));
  return next;
}

function calculatedCycleEndDate(
  startDate: string,
  frequency: string,
): string {
  const parsedStart = parseIsoDate(startDate);
  if (!parsedStart) {
    return "";
  }

  if (frequency === "MONTHLY") {
    return toIsoDate(addDays(addCalendarMonths(parsedStart, 1), -1));
  }

  const daysByFrequency: Record<string, number> = {
    WEEKLY: 7,
    FORTNIGHTLY: 14,
    FOUR_WEEKLY: 28,
  };
  const days = daysByFrequency[frequency] ?? daysByFrequency.FOUR_WEEKLY;
  return toIsoDate(addDays(parsedStart, days - 1));
}

function formatPreviewDate(value: string): string {
  const date = parseIsoDate(value);
  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function FieldErrorList({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <ul className={fieldErrorClass}>
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

export function DosetteCycleFormModal({
  patientId,
  cycle,
  isOpen,
  onClose,
}: DosetteCycleFormModalProps) {
  const createCycle = useCreateDosetteCycle(patientId);
  const updateCycle = useUpdateDosetteCycle(patientId);
  const { success } = useToast();
  const [reference, setReference] = useState("");
  const [frequency, setFrequency] = useState(DEFAULT_CYCLE_FREQUENCY);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setReference(cycle?.reference ?? "");
    setFrequency(cycle?.frequency ?? DEFAULT_CYCLE_FREQUENCY);
    setStartDate(cycle?.start_date ?? "");
    setEndDate(
      cycle?.start_date && cycle?.frequency
        ? calculatedCycleEndDate(cycle.start_date, cycle.frequency)
        : "",
    );
    setErrors({});
  }, [isOpen, cycle]);

  useEffect(() => {
    setEndDate(calculatedCycleEndDate(startDate, frequency));
  }, [frequency, startDate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const nextErrors: FieldErrors = {};
    if (!reference.trim()) {
      nextErrors.reference = ["Reference is required."];
    }
    if (!startDate) {
      nextErrors.start_date = ["Start date is required."];
    }
    const calculatedEndDate = calculatedCycleEndDate(startDate, frequency);
    if (!calculatedEndDate) {
      nextErrors.end_date = ["End date is required."];
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const body: DosetteCycleWriteBody = {
      reference: reference.trim(),
      frequency,
      start_date: startDate,
      end_date: calculatedEndDate,
    };

    try {
      if (cycle) {
        await updateCycle.mutateAsync({ id: cycle.id, body });
        success("Cycle updated", body.reference);
      } else {
        await createCycle.mutateAsync(body);
        success("Cycle created", body.reference);
      }
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
    }
  }

  const isSaving = createCycle.isPending || updateCycle.isPending;
  const title = cycle ? "Edit cycle" : "Add cycle";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        <div className={labelClass}>
          <label htmlFor="dosette-cycle-reference">Reference</label>
          <input
            className={inputClass}
            id="dosette-cycle-reference"
            onChange={(event) => setReference(event.target.value)}
            required
            type="text"
            value={reference}
          />
          <FieldErrorList messages={errorMessages(errors, "reference")} />
        </div>

        <div className={labelClass}>
          <label htmlFor="dosette-cycle-frequency">Frequency</label>
          <select
            className={selectClass}
            id="dosette-cycle-frequency"
            onChange={(event) => setFrequency(event.target.value)}
            value={frequency}
          >
            {CYCLE_FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs font-medium text-muted">
            Most Dosette cycles are prepared as a 4-week supply; choose another
            period when the pack schedule needs it.
          </p>
          <FieldErrorList messages={errorMessages(errors, "frequency")} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className={labelClass}>
            <label htmlFor="dosette-cycle-start-date">Start date</label>
            <input
              className={inputClass}
              id="dosette-cycle-start-date"
              onChange={(event) => setStartDate(event.target.value)}
              required
              type="date"
              value={startDate}
            />
            <FieldErrorList messages={errorMessages(errors, "start_date")} />
          </div>

          <div className={labelClass}>
            <label htmlFor="dosette-cycle-end-date">End date</label>
            <input
              className={inputClass}
              id="dosette-cycle-end-date"
              readOnly
              required
              type="date"
              value={endDate}
            />
            <p className="text-xs font-medium text-muted">
              Calculated end date:{" "}
              {endDate ? formatPreviewDate(endDate) : "Select a start date"}
            </p>
            <FieldErrorList messages={errorMessages(errors, "end_date")} />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button disabled={isSaving} type="submit" variant="primary">
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
