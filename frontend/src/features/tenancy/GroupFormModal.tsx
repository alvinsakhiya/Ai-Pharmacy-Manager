import { useEffect, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import {
  fieldErrorClass,
  inputClass,
  labelClass,
} from "../../components/ui/forms";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import { useCreateGroup, useUpdateGroup } from "./useTenancy";
import type { Group } from "./tenancyApi";

interface GroupFormModalProps {
  group: Group | null;
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

export function GroupFormModal({ group, isOpen, onClose }: GroupFormModalProps) {
  const { success, error: errorToast } = useToast();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(group?.name ?? "");
    setSlug(group?.slug ?? "");
    setIsActive(group?.is_active ?? true);
    setErrors({});
  }, [group, isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const nextErrors: FieldErrors = {};
    if (!name.trim()) {
      nextErrors.name = ["Name is required."];
    }
    if (!slug.trim()) {
      nextErrors.slug = ["Slug is required."];
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const body = {
      name: name.trim(),
      slug: slug.trim(),
      is_active: isActive,
    };

    try {
      if (group) {
        await updateGroup.mutateAsync({ id: group.id, body });
        success("Group updated", `${body.name} has been saved.`);
      } else {
        await createGroup.mutateAsync(body);
        success("Group created", `${body.name} is ready to use.`);
      }
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
      errorToast("Could not save group", "Please review the form and try again.");
    }
  }

  const isSaving = createGroup.isPending || updateGroup.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={group ? "Edit group" : "Create group"}
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

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
          Slug
          <input
            className={inputClass}
            onChange={(event) => setSlug(event.target.value)}
            required
            type="text"
            value={slug}
          />
          <FieldErrorList messages={errorMessages(errors, "slug")} />
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
            {isSaving ? "Saving..." : "Save group"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
