import { useEffect, useState, type FormEvent } from "react";

import { Modal } from "../../components/ui/Modal";
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

function FieldErrorList({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <ul className="mt-2 space-y-1 text-sm text-red-700">
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
  const [reference, setReference] = useState("");
  const [frequency, setFrequency] = useState("WEEKLY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setReference(cycle?.reference ?? "");
    setFrequency(cycle?.frequency ?? "WEEKLY");
    setStartDate(cycle?.start_date ?? "");
    setEndDate(cycle?.end_date ?? "");
    setErrors({});
  }, [isOpen, cycle]);

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
    if (!endDate) {
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
      end_date: endDate,
    };

    try {
      if (cycle) {
        await updateCycle.mutateAsync({ id: cycle.id, body });
      } else {
        await createCycle.mutateAsync(body);
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

        <label className="block text-sm font-medium text-slate-700">
          Reference
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setReference(event.target.value)}
            required
            type="text"
            value={reference}
          />
          <FieldErrorList messages={errorMessages(errors, "reference")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Frequency
          <select
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setFrequency(event.target.value)}
            value={frequency}
          >
            {CYCLE_FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldErrorList messages={errorMessages(errors, "frequency")} />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Start date
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              onChange={(event) => setStartDate(event.target.value)}
              required
              type="date"
              value={startDate}
            />
            <FieldErrorList messages={errorMessages(errors, "start_date")} />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            End date
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              onChange={(event) => setEndDate(event.target.value)}
              required
              type="date"
              value={endDate}
            />
            <FieldErrorList messages={errorMessages(errors, "end_date")} />
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
