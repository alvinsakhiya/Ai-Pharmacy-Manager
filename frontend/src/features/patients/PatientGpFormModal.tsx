import { useEffect, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { inputClass, labelClass } from "../../components/ui/forms";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import type { PatientGp } from "./patientApi";
import { useUpdatePatientGp } from "./usePatients";

interface PatientGpFormModalProps {
  patientId: number;
  gp: PatientGp | null | undefined;
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY = {
  doctor_name: "",
  practice_name: "",
  practice_address: "",
  practice_postcode: "",
  practice_phone: "",
  practice_email: "",
};

export function PatientGpFormModal({
  patientId,
  gp,
  isOpen,
  onClose,
}: PatientGpFormModalProps) {
  const { success } = useToast();
  const updateGp = useUpdatePatientGp();
  const [form, setForm] = useState({ ...EMPTY });
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setForm({
      doctor_name: gp?.doctor_name ?? "",
      practice_name: gp?.practice_name ?? "",
      practice_address: gp?.practice_address ?? "",
      practice_postcode: gp?.practice_postcode ?? "",
      practice_phone: gp?.practice_phone ?? "",
      practice_email: gp?.practice_email ?? "",
    });
    setErrors({});
  }, [isOpen, gp]);

  function update(field: keyof typeof EMPTY, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    try {
      await updateGp.mutateAsync({ patientId, body: form });
      success("GP details updated");
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit GP details">
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            Doctor name
            <input
              className={inputClass}
              onChange={(event) => update("doctor_name", event.target.value)}
              type="text"
              value={form.doctor_name}
            />
          </label>
          <label className={labelClass}>
            Practice name
            <input
              className={inputClass}
              onChange={(event) => update("practice_name", event.target.value)}
              type="text"
              value={form.practice_name}
            />
          </label>
        </div>

        <label className={labelClass}>
          Practice address
          <input
            className={inputClass}
            onChange={(event) => update("practice_address", event.target.value)}
            type="text"
            value={form.practice_address}
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            Practice postcode
            <input
              className={inputClass}
              onChange={(event) =>
                update("practice_postcode", event.target.value)
              }
              type="text"
              value={form.practice_postcode}
            />
          </label>
          <label className={labelClass}>
            Practice phone
            <input
              className={`${inputClass} tnum`}
              onChange={(event) => update("practice_phone", event.target.value)}
              type="tel"
              value={form.practice_phone}
            />
          </label>
        </div>

        <label className={labelClass}>
          Practice email
          <input
            className={inputClass}
            onChange={(event) => update("practice_email", event.target.value)}
            type="email"
            value={form.practice_email}
          />
        </label>

        {errorMessages(errors, "detail").map((message) => (
          <p key={message} className="text-xs font-medium text-danger-ink">
            {message}
          </p>
        ))}

        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={updateGp.isPending}>
            {updateGp.isPending ? "Saving..." : "Save GP details"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
