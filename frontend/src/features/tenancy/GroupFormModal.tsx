import { useEffect, useState, type FormEvent } from "react";

import { Modal } from "../../components/ui/Modal";
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
    <ul className="mt-2 space-y-1 text-sm text-red-700">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

export function GroupFormModal({ group, isOpen, onClose }: GroupFormModalProps) {
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
      } else {
        await createGroup.mutateAsync(body);
      }
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
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
          Slug
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setSlug(event.target.value)}
            required
            type="text"
            value={slug}
          />
          <FieldErrorList messages={errorMessages(errors, "slug")} />
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
            {isSaving ? "Saving..." : "Save group"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
