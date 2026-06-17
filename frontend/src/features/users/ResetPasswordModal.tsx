import { useState, type FormEvent } from "react";

import { Modal } from "../../components/ui/Modal";
import { useResetPassword } from "./useUsers";
import type { ManagedUser } from "./usersApi";
import { errorMessages, normalizeErrors, type FieldErrors } from "./userErrors";

interface ResetPasswordModalProps {
  user: ManagedUser | null;
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

export function ResetPasswordModal({ user, onClose }: ResetPasswordModalProps) {
  const resetPassword = useResetPassword();
  const [newPassword, setNewPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }

    setErrors({});

    if (!newPassword) {
      setErrors({ new_password: ["New temporary password is required."] });
      return;
    }

    try {
      await resetPassword.mutateAsync({
        id: user.id,
        newPassword,
      });
      setNewPassword("");
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
    }
  }

  return (
    <Modal
      isOpen={user !== null}
      onClose={onClose}
      title={`Reset password for ${user?.email ?? "user"}`}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        <label className="block text-sm font-medium text-slate-700">
          New temporary password
          <input
            autoComplete="new-password"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />
          <span className="mt-2 block text-xs text-slate-500">
            Use at least 8 characters and avoid entirely numeric passwords.
          </span>
          <FieldErrorList messages={errorMessages(errors, "new_password")} />
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
            disabled={resetPassword.isPending}
            type="submit"
          >
            {resetPassword.isPending ? "Resetting..." : "Reset password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
