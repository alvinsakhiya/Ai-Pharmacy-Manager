import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../../auth/AuthContext";
import { Modal } from "../../components/ui/Modal";
import { buildAssignMembershipBody } from "./assignmentBody";
import { roleOptionsFor } from "./roleOptions";
import { useAssignMembership } from "./useUsers";
import {
  listGroupsForPicker,
  listPharmaciesForPicker,
  type ManagedUser,
} from "./usersApi";
import { errorMessages, normalizeErrors, type FieldErrors } from "./userErrors";

interface ReassignMembershipModalProps {
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

export function ReassignMembershipModal({
  user,
  onClose,
}: ReassignMembershipModalProps) {
  const { user: currentUser } = useAuth();
  const assignMembership = useAssignMembership();
  const roleOptions = useMemo(() => roleOptionsFor(currentUser), [currentUser]);
  const isGlobalRequester = currentUser?.scope.is_global ?? false;
  const ownPharmacy = !isGlobalRequester ? currentUser?.pharmacies[0] : undefined;

  const [role, setRole] = useState(roleOptions[0]?.value ?? "DISPENSER");
  const [groupId, setGroupId] = useState("");
  const [pharmacyId, setPharmacyId] = useState("");
  const [pharmacyIds, setPharmacyIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});

  const isOpen = user !== null;
  const groupsQuery = useQuery({
    queryKey: ["groups", "picker"],
    queryFn: listGroupsForPicker,
    enabled: isOpen && isGlobalRequester,
  });
  const pharmaciesQuery = useQuery({
    queryKey: ["pharmacies", "picker"],
    queryFn: listPharmaciesForPicker,
    enabled: isOpen && isGlobalRequester,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setRole(roleOptions[0]?.value ?? "DISPENSER");
    setGroupId("");
    setPharmacyId("");
    setPharmacyIds([]);
    setErrors({});
  }, [isOpen, roleOptions]);

  const selectedGroupPharmacies = (pharmaciesQuery.data ?? []).filter(
    (pharmacy) => String(pharmacy.group) === groupId,
  );

  function validate(): FieldErrors {
    const nextErrors: FieldErrors = {};

    if (!role) {
      nextErrors.role = ["Role is required."];
    }

    if (isGlobalRequester && role === "SUPERINTENDENT" && !groupId) {
      nextErrors.group_id = ["Group is required for this role."];
    }

    if (isGlobalRequester && role === "STOCK_EMPLOYEE") {
      if (!groupId) {
        nextErrors.group_id = ["Group is required for this role."];
      }
      if (pharmacyIds.length === 0) {
        nextErrors.pharmacy_ids = [
          "Select at least one pharmacy for this role.",
        ];
      }
    }

    if (
      isGlobalRequester &&
      (role === "PHARMACIST" || role === "DISPENSER") &&
      !pharmacyId
    ) {
      nextErrors.pharmacy_id = ["Pharmacy is required for this role."];
    }

    if (
      !isGlobalRequester &&
      (role === "PHARMACIST" || role === "DISPENSER") &&
      !ownPharmacy
    ) {
      nextErrors.pharmacy_id = ["Your account has no assigned pharmacy."];
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }

    setErrors({});
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      await assignMembership.mutateAsync({
        id: user.id,
        body: buildAssignMembershipBody({
          role,
          isGlobalRequester,
          ownPharmacyId: ownPharmacy?.id,
          groupId,
          pharmacyId,
          pharmacyIds,
        }),
      });
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reassign membership — ${user?.email ?? ""}`}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        <label className="block text-sm font-medium text-slate-700">
          Role
          <select
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => {
              setRole(event.target.value);
              setGroupId("");
              setPharmacyId("");
              setPharmacyIds([]);
            }}
            value={role}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldErrorList messages={errorMessages(errors, "role")} />
        </label>

        {isGlobalRequester &&
        (role === "SUPERINTENDENT" || role === "STOCK_EMPLOYEE") ? (
          <label className="block text-sm font-medium text-slate-700">
            Group
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              onChange={(event) => {
                setGroupId(event.target.value);
                setPharmacyIds([]);
              }}
              required
              value={groupId}
            >
              <option value="">Select a group</option>
              {(groupsQuery.data ?? []).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <FieldErrorList messages={errorMessages(errors, "group_id")} />
          </label>
        ) : null}

        {isGlobalRequester &&
        (role === "PHARMACIST" || role === "DISPENSER") ? (
          <label className="block text-sm font-medium text-slate-700">
            Pharmacy
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
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

        {isGlobalRequester && role === "STOCK_EMPLOYEE" ? (
          <label className="block text-sm font-medium text-slate-700">
            Pharmacies
            <select
              className="mt-2 h-32 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
              multiple
              onChange={(event) =>
                setPharmacyIds(
                  Array.from(event.target.selectedOptions).map(
                    (option) => option.value,
                  ),
                )
              }
              value={pharmacyIds}
            >
              {selectedGroupPharmacies.map((pharmacy) => (
                <option key={pharmacy.id} value={pharmacy.id}>
                  {pharmacy.name}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-xs text-slate-500">
              Hold Command or Control to select multiple pharmacies.
            </span>
            <FieldErrorList messages={errorMessages(errors, "pharmacy_ids")} />
          </label>
        ) : null}

        {!isGlobalRequester && ownPharmacy ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">Pharmacy</p>
            <p className="mt-1 text-sm text-slate-600">{ownPharmacy.name}</p>
          </div>
        ) : null}
        {!isGlobalRequester ? (
          <FieldErrorList messages={errorMessages(errors, "pharmacy_id")} />
        ) : null}

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
            disabled={assignMembership.isPending}
            type="submit"
          >
            {assignMembership.isPending ? "Saving..." : "Save membership"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
