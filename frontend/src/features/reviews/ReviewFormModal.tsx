import { useEffect, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import {
  fieldErrorClass,
  inputClass,
  labelClass,
  selectClass,
  textareaClass,
} from "../../components/ui/forms";
import { cn } from "../../lib/cn";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import type { DosetteCycle } from "../dosette/dosetteApi";
import type { Patient } from "../patients/patientApi";
import type { ReviewCreateBody, ReviewPriority } from "./reviewsApi";
import { useCreateReview } from "./useReviews";

interface ReviewFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  fixedPatientId?: number;
  patientOptions?: Array<Pick<Patient, "id" | "patient_reference">>;
  patientCycles?: Array<Pick<DosetteCycle, "id" | "reference">>;
  onCreated?: () => void;
}

function FieldErrorList({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <ul className={cn(fieldErrorClass, "space-y-1")}>
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

export function ReviewFormModal({
  isOpen,
  onClose,
  fixedPatientId,
  patientOptions = [],
  patientCycles = [],
  onCreated,
}: ReviewFormModalProps) {
  const createReview = useCreateReview();
  const { success, error } = useToast();
  const [patientId, setPatientId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [priority, setPriority] = useState<ReviewPriority>("ROUTINE");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setPatientId(fixedPatientId === undefined ? "" : String(fixedPatientId));
    setCycleId("");
    setPriority("ROUTINE");
    setDueDate("");
    setNotes("");
    setErrors({});
  }, [fixedPatientId, isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const selectedPatientId =
      fixedPatientId === undefined ? Number(patientId) : fixedPatientId;
    if (!Number.isFinite(selectedPatientId) || selectedPatientId <= 0) {
      setErrors({ patient: ["Patient is required."] });
      return;
    }

    const body: ReviewCreateBody = {
      patient: selectedPatientId,
      priority,
      due_date: dueDate || null,
      notes: notes.trim(),
    };

    if (fixedPatientId !== undefined && cycleId) {
      body.dosette_cycle = Number(cycleId);
    }

    try {
      await createReview.mutateAsync(body);
      success("Review created");
      onCreated?.();
      onClose();
    } catch (caught) {
      setErrors(normalizeErrors(caught));
      error("Could not create review");
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New review">
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        {fixedPatientId === undefined ? (
          <label className={labelClass}>
            Patient
            <select
              className={selectClass}
              onChange={(event) => setPatientId(event.target.value)}
              required
              value={patientId}
            >
              <option value="">Select patient</option>
              {patientOptions.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.patient_reference}
                </option>
              ))}
            </select>
            <FieldErrorList messages={errorMessages(errors, "patient")} />
          </label>
        ) : null}

        {fixedPatientId !== undefined && patientCycles.length > 0 ? (
          <label className={labelClass}>
            Dosette / MDS cycle
            <select
              className={selectClass}
              onChange={(event) => setCycleId(event.target.value)}
              value={cycleId}
            >
              <option value="">No cycle</option>
              {patientCycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.reference}
                </option>
              ))}
            </select>
            <FieldErrorList messages={errorMessages(errors, "dosette_cycle")} />
          </label>
        ) : null}

        <label className={labelClass}>
          Priority
          <select
            className={selectClass}
            onChange={(event) =>
              setPriority(event.target.value as ReviewPriority)
            }
            value={priority}
          >
            <option value="ROUTINE">Routine</option>
            <option value="ATTENTION">Attention</option>
            <option value="URGENT">Urgent</option>
          </select>
          <FieldErrorList messages={errorMessages(errors, "priority")} />
        </label>

        <label className={labelClass}>
          Due date
          <input
            className={inputClass}
            onChange={(event) => setDueDate(event.target.value)}
            type="date"
            value={dueDate}
          />
          <FieldErrorList messages={errorMessages(errors, "due_date")} />
        </label>

        <label className={labelClass}>
          Notes
          <textarea
            className={textareaClass}
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
          <FieldErrorList messages={errorMessages(errors, "notes")} />
        </label>

        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={createReview.isPending}
          >
            {createReview.isPending ? "Saving..." : "Create review"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
