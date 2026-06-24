import { useEffect, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { labelClass, textareaClass } from "../../components/ui/forms";
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
    <ul className="mt-1.5 space-y-1 text-xs font-medium text-danger-ink">
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
  const { success } = useToast();
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
      success("Note added");
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

        <label className={labelClass}>
          Note body
          <textarea
            className={`${textareaClass} min-h-32`}
            onChange={(event) => setBody(event.target.value)}
            value={body}
          />
          <FieldErrorList messages={errorMessages(errors, "body")} />
        </label>

        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={createPatientNote.isPending}
          >
            {createPatientNote.isPending ? "Adding..." : "Add note"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
