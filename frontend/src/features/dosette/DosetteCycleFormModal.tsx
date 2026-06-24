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

        <label className={labelClass}>
          Reference
          <input
            className={inputClass}
            onChange={(event) => setReference(event.target.value)}
            required
            type="text"
            value={reference}
          />
          <FieldErrorList messages={errorMessages(errors, "reference")} />
        </label>

        <label className={labelClass}>
          Frequency
          <select
            className={selectClass}
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
          <label className={labelClass}>
            Start date
            <input
              className={inputClass}
              onChange={(event) => setStartDate(event.target.value)}
              required
              type="date"
              value={startDate}
            />
            <FieldErrorList messages={errorMessages(errors, "start_date")} />
          </label>

          <label className={labelClass}>
            End date
            <input
              className={inputClass}
              onChange={(event) => setEndDate(event.target.value)}
              required
              type="date"
              value={endDate}
            />
            <FieldErrorList messages={errorMessages(errors, "end_date")} />
          </label>
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
