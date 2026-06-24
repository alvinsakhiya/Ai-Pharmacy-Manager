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
    <ul className={`${fieldErrorClass} space-y-1`}>
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
  const { success, error: errorToast } = useToast();
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
        success("Pharmacy updated", `${body.name} has been saved.`);
      } else {
        await createPharmacy.mutateAsync(body);
        success("Pharmacy created", `${body.name} is ready to use.`);
      }
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
      errorToast(
        "Could not save pharmacy",
        "Please review the form and try again.",
      );
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

        <label className={labelClass}>
          Group
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
          <FieldErrorList messages={errorMessages(errors, "group")} />
        </label>

        <label className={labelClass}>
          Name
          <input
            className={inputClass}
            onChange={(event) => setName(event.target.value)}
            required
            type="text"
            value={name}
          />
          <FieldErrorList messages={errorMessages(errors, "name")} />
        </label>

        <label className={labelClass}>
          Code
          <input
            className={inputClass}
            onChange={(event) => setCode(event.target.value)}
            required
            type="text"
            value={code}
          />
          <FieldErrorList messages={errorMessages(errors, "code")} />
        </label>

        <label className={labelClass}>
          Address
          <textarea
            className={textareaClass}
            onChange={(event) => setAddress(event.target.value)}
            value={address}
          />
          <FieldErrorList messages={errorMessages(errors, "address")} />
        </label>

        <label className={labelClass}>
          Postcode
          <input
            className={inputClass}
            onChange={(event) => setPostcode(event.target.value)}
            type="text"
            value={postcode}
          />
          <FieldErrorList messages={errorMessages(errors, "postcode")} />
        </label>

        <label className="flex items-center gap-2.5 text-[13px] font-semibold text-ink-soft">
          <input
            checked={isActive}
            className="h-4 w-4 rounded border-line-strong text-brand focus:ring-2 focus:ring-brand-ring/60"
            onChange={(event) => setIsActive(event.target.checked)}
            type="checkbox"
          />
          Active
        </label>

        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save pharmacy"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
