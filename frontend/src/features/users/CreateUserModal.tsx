import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../../auth/AuthContext";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";
import {
  fieldErrorClass,
  fieldHintClass,
  inputClass,
  labelClass,
  selectClass,
} from "../../components/ui/forms";
import { listPharmaciesForPicker } from "./usersApi";
import { roleOptionsFor } from "./roleOptions";
import { useCreateUser } from "./useUsers";
import { errorMessages, normalizeErrors, type FieldErrors } from "./userErrors";

interface CreateUserModalProps {
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

export function CreateUserModal({ isOpen, onClose }: CreateUserModalProps) {
  const { user } = useAuth();
  const createUser = useCreateUser();
  const { success, error: toastError } = useToast();
  const roleOptions = useMemo(() => roleOptionsFor(user), [user]);
  const isGlobal = user?.scope.is_global ?? false;
  const fixedPharmacy = !isGlobal ? user?.pharmacies[0] : undefined;

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [role, setRole] = useState(roleOptions[0]?.value ?? "DISPENSER");
  const [pharmacyId, setPharmacyId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const pharmaciesQuery = useQuery({
    queryKey: ["pharmacies", "picker"],
    queryFn: listPharmaciesForPicker,
    enabled: isOpen && isGlobal,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setEmail("");
    setFullName("");
    setTemporaryPassword("");
    setRole(roleOptions[0]?.value ?? "DISPENSER");
    setPharmacyId("");
    setErrors({});
  }, [isOpen, roleOptions]);

  const showPharmacyPicker = isGlobal && role !== "ADMIN";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const nextErrors: FieldErrors = {};
    if (!email.trim()) {
      nextErrors.email = ["Email is required."];
    }
    if (!fullName.trim()) {
      nextErrors.full_name = ["Full name is required."];
    }
    if (!temporaryPassword) {
      nextErrors.password = ["Temporary password is required."];
    }
    if (showPharmacyPicker && !pharmacyId) {
      nextErrors.pharmacy_id = ["Pharmacy is required for this role."];
    }
    if (!isGlobal && !fixedPharmacy && role !== "ADMIN") {
      nextErrors.pharmacy_id = ["Your account has no assigned pharmacy."];
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const selectedPharmacyId =
      role === "ADMIN"
        ? null
        : isGlobal
          ? Number(pharmacyId)
          : fixedPharmacy?.id;

    try {
      await createUser.mutateAsync({
        email: email.trim(),
        full_name: fullName.trim(),
        password: temporaryPassword,
        role,
        pharmacy_id: selectedPharmacyId,
      });
      success("User created", `${email.trim()} can now sign in.`);
      onClose();
    } catch (error) {
      const normalized = normalizeErrors(error);
      setErrors(normalized);
      toastError("Could not create user", "Check the highlighted fields.");
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create user">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        <label className={labelClass}>
          Email
          <input
            autoComplete="email"
            className={inputClass}
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <FieldErrorList messages={errorMessages(errors, "email")} />
        </label>

        <label className={labelClass}>
          Full name
          <input
            autoComplete="name"
            className={inputClass}
            onChange={(event) => setFullName(event.target.value)}
            required
            type="text"
            value={fullName}
          />
          <FieldErrorList messages={errorMessages(errors, "full_name")} />
        </label>

        <label className={labelClass}>
          Temporary password
          <input
            autoComplete="new-password"
            className={inputClass}
            onChange={(event) => setTemporaryPassword(event.target.value)}
            required
            type="password"
            value={temporaryPassword}
          />
          <span className={fieldHintClass}>
            Use at least 8 characters and avoid entirely numeric passwords.
          </span>
          <FieldErrorList messages={errorMessages(errors, "password")} />
        </label>

        <label className={labelClass}>
          Role
          <select
            className={selectClass}
            onChange={(event) => setRole(event.target.value)}
            value={role}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {showPharmacyPicker ? (
          <label className={labelClass}>
            Pharmacy
            <select
              className={selectClass}
              onChange={(event) => setPharmacyId(event.target.value)}
              required
              value={pharmacyId}
            >
              <option value="">Select a pharmacy</option>
              {(pharmaciesQuery.data ?? []).map((pharmacy) => (
                <option key={pharmacy.id} value={pharmacy.id}>
                  {pharmacy.name}
                </option>
              ))}
            </select>
            <FieldErrorList messages={errorMessages(errors, "pharmacy_id")} />
          </label>
        ) : null}

        {!isGlobal && fixedPharmacy ? (
          <div className="rounded-xl border border-line bg-surface-subtle p-4">
            <p className="text-[13px] font-semibold text-ink-soft">Pharmacy</p>
            <p className="mt-1 text-sm text-muted">{fixedPharmacy.name}</p>
          </div>
        ) : null}

        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <Button onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={createUser.isPending}
            type="submit"
            variant="primary"
          >
            {createUser.isPending ? "Creating..." : "Create user"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
