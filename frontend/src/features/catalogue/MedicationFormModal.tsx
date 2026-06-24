import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Info } from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import {
  fieldErrorClass,
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
import { listGroups } from "../tenancy/tenancyApi";
import { CatalogueProductSelect } from "./CatalogueProductSelect";
import { formLabel, type CatalogueProduct, type Medication } from "./catalogueApi";
import {
  useCreateMedication,
  useMedicationsQuery,
  useUpdateMedication,
} from "./useCatalogue";

interface MedicationFormModalProps {
  medication: Medication | null;
  isOpen: boolean;
  onClose: () => void;
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

function firstGroupFromMedications(medications: Medication[] = []) {
  return medications[0]?.group ?? null;
}

export function MedicationFormModal({
  medication,
  isOpen,
  onClose,
}: MedicationFormModalProps) {
  const { user } = useAuth();
  const { isGlobal } = usePermissions();
  const medicationsQuery = useMedicationsQuery();
  const groupsQuery = useQuery({
    queryKey: ["groups", "list"],
    queryFn: listGroups,
    enabled: isOpen && medication === null && isGlobal,
  });
  const createMedication = useCreateMedication();
  const updateMedication = useUpdateMedication();
  const [group, setGroup] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogueProduct | null>(
    null,
  );
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});

  const derivedGroup = useMemo(() => {
    if (medication) {
      return medication.group;
    }
    if (isGlobal) {
      return null;
    }
    return (
      user?.scope.group_ids[0] ??
      firstGroupFromMedications(medicationsQuery.data) ??
      null
    );
  }, [isGlobal, medication, medicationsQuery.data, user?.scope.group_ids]);

  const hasResolvableGroup = isGlobal || derivedGroup !== null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setGroup(medication ? String(medication.group) : "");
    setSelectedProduct(null);
    setNotes(medication?.notes ?? "");
    setIsActive(medication?.is_active ?? true);
    setErrors({});
  }, [isOpen, medication]);

  useEffect(() => {
    if (!isOpen || medication || isGlobal || derivedGroup === null) {
      return;
    }

    setGroup(String(derivedGroup));
  }, [derivedGroup, isGlobal, isOpen, medication]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const resolvedGroup = medication
      ? medication.group
      : Number(group || derivedGroup);

    const nextErrors: FieldErrors = {};
    if (!resolvedGroup) {
      nextErrors.group = ["Group is required."];
    }
    if (!medication && selectedProduct === null) {
      nextErrors.catalogue_product = ["Select a catalogue product."];
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const body = {
      group: resolvedGroup,
      catalogue_product: selectedProduct?.id,
      notes: notes.trim(),
      is_active: isActive,
    };

    try {
      if (medication) {
        await updateMedication.mutateAsync({
          id: medication.id,
          body: {
            notes: notes.trim(),
            is_active: isActive,
          },
        });
      } else {
        await createMedication.mutateAsync(body);
      }
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
    }
  }

  const isSaving = createMedication.isPending || updateMedication.isPending;
  const groupReadOnly = medication !== null || !isGlobal;
  const groupDisplayValue = group || (derivedGroup === null ? "" : String(derivedGroup));
  const submitDisabled = isSaving || !hasResolvableGroup;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={medication ? "Edit local library settings" : "Add product from catalogue"}
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        {!medication ? (
          <p className="rounded-xl border border-line bg-surface-subtle p-3 text-sm text-ink-soft">
            Select a canonical catalogue product. Name, strength, form, pack
            size, and manufacturer are controlled by the catalogue to reduce
            spelling and strength errors.
          </p>
        ) : null}

        <label className={labelClass}>
          Group
          {groupReadOnly ? (
            <input
              className={selectClass}
              disabled
              readOnly
              type="text"
              value={groupDisplayValue}
            />
          ) : (
            <select
              className={selectClass}
              onChange={(event) => setGroup(event.target.value)}
              required
              value={group}
            >
              <option value="">Select a group</option>
              {(groupsQuery.data ?? []).map((groupOption) => (
                <option key={groupOption.id} value={groupOption.id}>
                  {groupOption.name}
                </option>
              ))}
            </select>
          )}
          <FieldErrorList messages={errorMessages(errors, "group")} />
        </label>

        {!hasResolvableGroup ? (
          <p className="flex items-start gap-2 rounded-xl border border-warning-border bg-warning-soft p-3 text-sm text-warning-ink">
            <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Ask an administrator or superintendent to add the first catalogue
              product for this group.
            </span>
          </p>
        ) : null}

        {medication ? (
          <div className="rounded-xl border border-line bg-surface-subtle p-4">
            <p className="text-sm font-bold text-ink">
              {medication.catalogue_product_full_label ?? medication.name}
            </p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                  Form
                </dt>
                <dd className="mt-0.5 font-medium text-ink-soft">
                  {formLabel(medication.form)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                  Strength
                </dt>
                <dd className="mt-0.5 font-medium text-ink-soft tnum">
                  {medication.strength}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                  Manufacturer
                </dt>
                <dd className="mt-0.5 font-medium text-ink-soft">
                  {medication.manufacturer || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                  Pack
                </dt>
                <dd className="mt-0.5 font-medium text-ink-soft tnum">
                  {medication.catalogue_product_pack_size == null
                    ? "—"
                    : `${medication.catalogue_product_pack_size}${
                        medication.catalogue_product_pack_unit
                          ? ` ${medication.catalogue_product_pack_unit}`
                          : ""
                      }`}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <div>
            <CatalogueProductSelect
              onSelect={setSelectedProduct}
              selectedProduct={selectedProduct}
            />
            <FieldErrorList messages={errorMessages(errors, "catalogue_product")} />
            {selectedProduct ? (
              <div className="mt-3 rounded-xl bg-brand-soft p-3 text-sm">
                <p className="font-bold text-brand-ink">
                  {selectedProduct.full_label}
                </p>
                <p className="mt-1 text-brand-ink">
                  {selectedProduct.dose_form}
                  {selectedProduct.strength ? `, ${selectedProduct.strength}` : ""}
                  {selectedProduct.manufacturer
                    ? `, ${selectedProduct.manufacturer}`
                    : ""}
                </p>
              </div>
            ) : null}
          </div>
        )}

        <label className={labelClass}>
          Notes
          <textarea
            className={textareaClass}
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
          <FieldErrorList messages={errorMessages(errors, "notes")} />
        </label>

        <label className="flex items-center gap-3 text-[13px] font-semibold text-ink-soft">
          <input
            checked={isActive}
            className="h-4 w-4 rounded border-line-strong text-brand focus:ring-brand-ring"
            onChange={(event) => setIsActive(event.target.checked)}
            type="checkbox"
          />
          Active
        </label>

        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={submitDisabled}>
            {isSaving
              ? "Saving..."
              : medication
                ? "Save local settings"
                : "Add from catalogue"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
