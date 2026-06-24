import { useEffect, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import {
  fieldErrorClass,
  inputClass,
  labelClass,
  selectClass,
  textareaClass,
} from "../../components/ui/forms";
import { useToast } from "../../components/ui/Toast";
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
    <ul className={fieldErrorClass}>
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
  const { success } = useToast();
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
        success("Medication line updated", line.medication_name);
      } else {
        await createMedication.mutateAsync(body);
        success("Medication line added");
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

        <label className={labelClass}>
          Medication
          <select
            className={selectClass}
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
          <p className="rounded-xl border border-danger-border bg-danger-soft p-3 text-sm text-danger-ink">
            Could not load medication options.
          </p>
        ) : null}

        <label className={labelClass}>
          Dose instructions
          <textarea
            className={textareaClass}
            onChange={(event) => setDoseInstructions(event.target.value)}
            value={doseInstructions}
          />
          <FieldErrorList messages={errorMessages(errors, "dose_instructions")} />
        </label>

        <fieldset className="rounded-xl border border-line bg-surface-subtle/60 p-4">
          <legend className="px-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            Doses per slot
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Morning
              <input
                className={`${inputClass} tnum`}
                min={0}
                onChange={(event) => setQuantityMorning(event.target.value)}
                type="number"
                value={quantityMorning}
              />
              <FieldErrorList messages={errorMessages(errors, "quantity_morning")} />
            </label>

            <label className={labelClass}>
              Lunchtime
              <input
                className={`${inputClass} tnum`}
                min={0}
                onChange={(event) => setQuantityLunchtime(event.target.value)}
                type="number"
                value={quantityLunchtime}
              />
              <FieldErrorList
                messages={errorMessages(errors, "quantity_lunchtime")}
              />
            </label>

            <label className={labelClass}>
              Evening
              <input
                className={`${inputClass} tnum`}
                min={0}
                onChange={(event) => setQuantityEvening(event.target.value)}
                type="number"
                value={quantityEvening}
              />
              <FieldErrorList messages={errorMessages(errors, "quantity_evening")} />
            </label>

            <label className={labelClass}>
              Bedtime
              <input
                className={`${inputClass} tnum`}
                min={0}
                onChange={(event) => setQuantityBedtime(event.target.value)}
                type="number"
                value={quantityBedtime}
              />
              <FieldErrorList messages={errorMessages(errors, "quantity_bedtime")} />
            </label>
          </div>
        </fieldset>

        <label className={labelClass}>
          Start date
          <input
            className={inputClass}
            onChange={(event) => setStartDate(event.target.value)}
            type="date"
            value={startDate}
          />
          <FieldErrorList messages={errorMessages(errors, "start_date")} />
        </label>

        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={isSaving || medicationsQuery.isLoading}
            type="submit"
            variant="primary"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
