import { useEffect, useState, type FormEvent } from "react";

import { Modal } from "../../components/ui/Modal";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import type { Pharmacy } from "./tenancyApi";
import {
  useCreatePharmacy,
  useGroupsQuery,
  useUpdatePharmacy,
} from "./useTenancy";

interface PharmacyFormModalProps {
  pharmacy: Pharmacy | null;
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

export function PharmacyFormModal({
  pharmacy,
  isOpen,
  onClose,
}: PharmacyFormModalProps) {
  const groupsQuery = useGroupsQuery();
  const createPharmacy = useCreatePharmacy();
  const updatePharmacy = useUpdatePharmacy();
  const [group, setGroup] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setGroup(pharmacy ? String(pharmacy.group) : "");
    setName(pharmacy?.name ?? "");
    setCode(pharmacy?.code ?? "");
    setAddress(pharmacy?.address ?? "");
    setPostcode(pharmacy?.postcode ?? "");
    setIsActive(pharmacy?.is_active ?? true);
    setErrors({});
  }, [isOpen, pharmacy]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const nextErrors: FieldErrors = {};
    if (!group) {
      nextErrors.group = ["Group is required."];
    }
    if (!name.trim()) {
      nextErrors.name = ["Name is required."];
    }
    if (!code.trim()) {
      nextErrors.code = ["Code is required."];
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const body = {
      group: Number(group),
      name: name.trim(),
      code: code.trim(),
      address: address.trim(),
      postcode: postcode.trim(),
      is_active: isActive,
    };

    try {
      if (pharmacy) {
        await updatePharmacy.mutateAsync({ id: pharmacy.id, body });
      } else {
        await createPharmacy.mutateAsync(body);
      }
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
    }
  }

  const isSaving = createPharmacy.isPending || updatePharmacy.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={pharmacy ? "Edit pharmacy" : "Create pharmacy"}
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        <label className="block text-sm font-medium text-slate-700">
          Group
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
          <FieldErrorList messages={errorMessages(errors, "group")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Name
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setName(event.target.value)}
            required
            type="text"
            value={name}
          />
          <FieldErrorList messages={errorMessages(errors, "name")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Code
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setCode(event.target.value)}
            required
            type="text"
            value={code}
          />
          <FieldErrorList messages={errorMessages(errors, "code")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Address
          <textarea
            className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setAddress(event.target.value)}
            value={address}
          />
          <FieldErrorList messages={errorMessages(errors, "address")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Postcode
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setPostcode(event.target.value)}
            type="text"
            value={postcode}
          />
          <FieldErrorList messages={errorMessages(errors, "postcode")} />
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
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Save pharmacy"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
