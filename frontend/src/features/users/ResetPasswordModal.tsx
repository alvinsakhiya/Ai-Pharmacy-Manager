import { useState, type FormEvent } from "react";

import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";
import {
  fieldErrorClass,
  fieldHintClass,
  inputClass,
  labelClass,
} from "../../components/ui/forms";
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
    <ul className={`${fieldErrorClass} space-y-1`}>
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

export function ResetPasswordModal({ user, onClose }: ResetPasswordModalProps) {
  const resetPassword = useResetPassword();
  const { success, error: toastError } = useToast();
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
      success("Password reset", `${user.email} must set a new password.`);
      setNewPassword("");
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
      toastError("Could not reset password", "Check the highlighted field.");
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

        <label className={labelClass}>
          New temporary password
          <input
            autoComplete="new-password"
            className={inputClass}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />
          <span className={fieldHintClass}>
            Use at least 8 characters and avoid entirely numeric passwords.
          </span>
          <FieldErrorList messages={errorMessages(errors, "new_password")} />
        </label>

        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <Button onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={resetPassword.isPending}
            type="submit"
            variant="primary"
          >
            {resetPassword.isPending ? "Resetting..." : "Reset password"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
