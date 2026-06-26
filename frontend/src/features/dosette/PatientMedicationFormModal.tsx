import { useEffect, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import {
  fieldErrorClass,
  inputClass,
  labelClass,
  textareaClass,
} from "../../components/ui/forms";
import { useToast } from "../../components/ui/Toast";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import { CatalogueProductSelect } from "../catalogue/CatalogueProductSelect";
import type { CatalogueProduct } from "../catalogue/catalogueApi";
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

function productPackLabel(product: CatalogueProduct): string {
  if (product.pack_size === null) {
    return "Not specified";
  }
  return `${product.pack_size}${product.pack_unit ? ` ${product.pack_unit}` : ""}`;
}

export function PatientMedicationFormModal({
  patientId,
  line,
  isOpen,
  onClose,
}: PatientMedicationFormModalProps) {
  const createMedication = useCreatePatientMedication(patientId);
  const updateMedication = useUpdatePatientMedication(patientId);
  const { success } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<CatalogueProduct | null>(
    null,
  );
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

    setSelectedProduct(null);
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
    if (!line && selectedProduct === null) {
      nextErrors.catalogue_product = ["Select a catalogue product."];
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const body: PatientMedicationWriteBody = {
      dose_instructions: doseInstructions.trim(),
      quantity_morning: toQuantity(quantityMorning),
      quantity_lunchtime: toQuantity(quantityLunchtime),
      quantity_evening: toQuantity(quantityEvening),
      quantity_bedtime: toQuantity(quantityBedtime),
      start_date: startDate || null,
    };
    if (line) {
      body.medication = line.medication;
    } else if (selectedProduct) {
      body.catalogue_product = selectedProduct.id;
    }

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

        {line ? (
          <div
            aria-label="Selected medication"
            className="rounded-xl border border-line bg-surface-subtle p-4 text-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-muted">
              Medication
            </p>
            <p className="mt-1 font-semibold text-ink">{line.medication_name}</p>
            <p className="mt-1 text-ink-soft">
              {[line.strength, line.form].filter(Boolean).join(" / ") ||
                "Strength and form not specified"}
            </p>
          </div>
        ) : (
          <div>
            <CatalogueProductSelect
              onSelect={setSelectedProduct}
              selectedProduct={selectedProduct}
            />
            <FieldErrorList messages={errorMessages(errors, "catalogue_product")} />
            <FieldErrorList messages={errorMessages(errors, "medication")} />

            {selectedProduct ? (
              <div
                aria-label="Selected catalogue product"
                className="mt-3 rounded-xl border border-brand/20 bg-brand-soft p-3 text-sm"
              >
                <p className="text-xs font-bold uppercase tracking-[0.06em] text-brand">
                  Selected catalogue product
                </p>
                <p className="mt-1 font-semibold text-brand-ink">
                  {selectedProduct.full_label}
                </p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-semibold text-muted">Strength</dt>
                    <dd className="mt-0.5 font-semibold text-brand-ink">
                      {selectedProduct.strength || "Not specified"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted">Form</dt>
                    <dd className="mt-0.5 font-semibold text-brand-ink">
                      {selectedProduct.dose_form || "Not specified"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted">Pack size</dt>
                    <dd className="mt-0.5 font-semibold text-brand-ink">
                      {productPackLabel(selectedProduct)}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </div>
        )}

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
            disabled={isSaving}
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
