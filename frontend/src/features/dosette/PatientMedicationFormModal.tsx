import { useEffect, useState, type FormEvent } from "react";

import { Modal } from "../../components/ui/Modal";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import { useMedicationsQuery } from "../catalogue/useCatalogue";
import type { PatientMedicationLine, PatientMedicationWriteBody } from "./dosetteApi";
import {
  useCreatePatientMedication,
  useUpdatePatientMedication,
} from "./useDosette";

interface PatientMedicationFormModalProps {
  patientId: number;
  line: PatientMedicationLine | null;
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

function toQuantity(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

export function PatientMedicationFormModal({
  patientId,
  line,
  isOpen,
  onClose,
}: PatientMedicationFormModalProps) {
  const medicationsQuery = useMedicationsQuery();
  const createMedication = useCreatePatientMedication(patientId);
  const updateMedication = useUpdatePatientMedication(patientId);
  const [medication, setMedication] = useState("");
  const [doseInstructions, setDoseInstructions] = useState("");
  const [quantityMorning, setQuantityMorning] = useState("0");
  const [quantityLunchtime, setQuantityLunchtime] = useState("0");
  const [quantityEvening, setQuantityEvening] = useState("0");
  const [quantityBedtime, setQuantityBedtime] = useState("0");
  const [startDate, setStartDate] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setMedication(line ? String(line.medication) : "");
    setDoseInstructions(line?.dose_instructions ?? "");
    setQuantityMorning(String(line?.quantity_morning ?? 0));
    setQuantityLunchtime(String(line?.quantity_lunchtime ?? 0));
    setQuantityEvening(String(line?.quantity_evening ?? 0));
    setQuantityBedtime(String(line?.quantity_bedtime ?? 0));
    setStartDate(line?.start_date ?? "");
    setErrors({});
  }, [isOpen, line]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const nextErrors: FieldErrors = {};
    if (!line && !medication) {
      nextErrors.medication = ["Medication is required."];
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const body: PatientMedicationWriteBody = {
      medication: line ? line.medication : Number(medication),
      dose_instructions: doseInstructions.trim(),
      quantity_morning: toQuantity(quantityMorning),
      quantity_lunchtime: toQuantity(quantityLunchtime),
      quantity_evening: toQuantity(quantityEvening),
      quantity_bedtime: toQuantity(quantityBedtime),
      start_date: startDate || null,
    };

    try {
      if (line) {
        await updateMedication.mutateAsync({ id: line.id, body });
      } else {
        await createMedication.mutateAsync(body);
      }
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
    }
  }

  const isSaving = createMedication.isPending || updateMedication.isPending;
  const title = line ? "Edit medication line" : "Add medication";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        <label className="block text-sm font-medium text-slate-700">
          Medication
          <select
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 disabled:bg-slate-50 disabled:text-slate-600"
            disabled={line !== null || medicationsQuery.isLoading}
            onChange={(event) => setMedication(event.target.value)}
            required
            value={medication}
          >
            <option value="">Select a medication</option>
            {medicationsQuery.data?.map((medicationOption) => (
              <option key={medicationOption.id} value={medicationOption.id}>
                {medicationOption.name} {medicationOption.strength}
              </option>
            ))}
          </select>
          <FieldErrorList messages={errorMessages(errors, "medication")} />
        </label>

        {medicationsQuery.isError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Could not load medication options.
          </p>
        ) : null}

        <label className="block text-sm font-medium text-slate-700">
          Dose instructions
          <textarea
            className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setDoseInstructions(event.target.value)}
            value={doseInstructions}
          />
          <FieldErrorList messages={errorMessages(errors, "dose_instructions")} />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Morning
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              min={0}
              onChange={(event) => setQuantityMorning(event.target.value)}
              type="number"
              value={quantityMorning}
            />
            <FieldErrorList messages={errorMessages(errors, "quantity_morning")} />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Lunchtime
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              min={0}
              onChange={(event) => setQuantityLunchtime(event.target.value)}
              type="number"
              value={quantityLunchtime}
            />
            <FieldErrorList messages={errorMessages(errors, "quantity_lunchtime")} />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Evening
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              min={0}
              onChange={(event) => setQuantityEvening(event.target.value)}
              type="number"
              value={quantityEvening}
            />
            <FieldErrorList messages={errorMessages(errors, "quantity_evening")} />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Bedtime
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              min={0}
              onChange={(event) => setQuantityBedtime(event.target.value)}
              type="number"
              value={quantityBedtime}
            />
            <FieldErrorList messages={errorMessages(errors, "quantity_bedtime")} />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Start date
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setStartDate(event.target.value)}
            type="date"
            value={startDate}
          />
          <FieldErrorList messages={errorMessages(errors, "start_date")} />
        </label>

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
            disabled={isSaving || medicationsQuery.isLoading}
            type="submit"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
