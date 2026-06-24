import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { Modal } from "../../components/ui/Modal";
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
    <ul className="mt-2 space-y-1 text-sm text-red-700">
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
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            Select a canonical catalogue product. Name, strength, form, pack
            size, and manufacturer are controlled by the catalogue to reduce
            spelling and strength errors.
          </p>
        ) : null}

        <label className="block text-sm font-medium text-slate-700">
          Group
          {groupReadOnly ? (
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 shadow-sm"
              disabled
              readOnly
              type="text"
              value={groupDisplayValue}
            />
          ) : (
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
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
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Ask an administrator or superintendent to add the first catalogue
            product for this group.
          </p>
        ) : null}

        {medication ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              {medication.catalogue_product_full_label ?? medication.name}
            </p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Form</dt>
                <dd className="font-medium text-slate-800">
                  {formLabel(medication.form)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Strength</dt>
                <dd className="font-medium text-slate-800">
                  {medication.strength}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Manufacturer</dt>
                <dd className="font-medium text-slate-800">
                  {medication.manufacturer || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Pack</dt>
                <dd className="font-medium text-slate-800">
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
              <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm">
                <p className="font-semibold text-teal-900">
                  {selectedProduct.full_label}
                </p>
                <p className="mt-1 text-teal-800">
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

        <label className="block text-sm font-medium text-slate-700">
          Notes
          <textarea
            className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
          <FieldErrorList messages={errorMessages(errors, "notes")} />
        </label>

        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
          <input
            checked={isActive}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            onChange={(event) => setIsActive(event.target.checked)}
            type="checkbox"
          />
          Active
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
            disabled={submitDisabled}
            type="submit"
          >
            {isSaving
              ? "Saving..."
              : medication
                ? "Save local settings"
                : "Add from catalogue"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
