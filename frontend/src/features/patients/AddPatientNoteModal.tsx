import { useEffect, useState, type FormEvent } from "react";

import { Modal } from "../../components/ui/Modal";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import { useCreatePatientNote } from "./usePatients";

interface AddPatientNoteModalProps {
  patientId: number;
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

export function AddPatientNoteModal({
  patientId,
  isOpen,
  onClose,
}: AddPatientNoteModalProps) {
  const createPatientNote = useCreatePatientNote();
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setBody("");
    setErrors({});
  }, [isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setErrors({ body: ["Note body is required."] });
      return;
    }

    try {
      await createPatientNote.mutateAsync({
        patientId,
        body: { body: trimmedBody },
      });
      setBody("");
      setErrors({});
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add note">
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        <label className="block text-sm font-medium text-slate-700">
          Note body
          <textarea
            className="mt-2 min-h-32 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setBody(event.target.value)}
            value={body}
          />
          <FieldErrorList messages={errorMessages(errors, "body")} />
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
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={createPatientNote.isPending}
            type="submit"
          >
            {createPatientNote.isPending ? "Adding..." : "Add note"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
