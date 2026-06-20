import { useEffect, useState, type FormEvent } from "react";

import { Modal } from "../../components/ui/Modal";
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
    <ul className="mt-2 space-y-1 text-sm text-red-700">
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
      onCreated?.();
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New review">
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        {fixedPatientId === undefined ? (
          <label className="block text-sm font-medium text-slate-700">
            Patient
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
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
          <label className="block text-sm font-medium text-slate-700">
            Dosette / MDS cycle
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
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

        <label className="block text-sm font-medium text-slate-700">
          Priority
          <select
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
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

        <label className="block text-sm font-medium text-slate-700">
          Due date
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setDueDate(event.target.value)}
            type="date"
            value={dueDate}
          />
          <FieldErrorList messages={errorMessages(errors, "due_date")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Notes
          <textarea
            className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
          <FieldErrorList messages={errorMessages(errors, "notes")} />
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
            disabled={createReview.isPending}
            type="submit"
          >
            {createReview.isPending ? "Saving..." : "Create review"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
