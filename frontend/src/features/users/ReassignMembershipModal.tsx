import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../../auth/AuthContext";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";
import {
  fieldErrorClass,
  fieldHintClass,
  labelClass,
  selectClass,
} from "../../components/ui/forms";
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
    <ul className={`${fieldErrorClass} space-y-1`}>
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
  const { success, error: toastError } = useToast();
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
      success("Membership updated", `${user.email} reassigned.`);
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
      toastError("Could not update membership", "Check the highlighted fields.");
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

        <label className={labelClass}>
          Role
          <select
            className={selectClass}
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
          <label className={labelClass}>
            Group
            <select
              className={selectClass}
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

        {isGlobalRequester && role === "STOCK_EMPLOYEE" ? (
          <label className={labelClass}>
            Pharmacies
            <select
              className={`${selectClass} h-32`}
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
            <span className={fieldHintClass}>
              Hold Command or Control to select multiple pharmacies.
            </span>
            <FieldErrorList messages={errorMessages(errors, "pharmacy_ids")} />
          </label>
        ) : null}

        {!isGlobalRequester && ownPharmacy ? (
          <div className="rounded-xl border border-line bg-surface-subtle p-4">
            <p className="text-[13px] font-semibold text-ink-soft">Pharmacy</p>
            <p className="mt-1 text-sm text-muted">{ownPharmacy.name}</p>
          </div>
        ) : null}
        {!isGlobalRequester ? (
          <FieldErrorList messages={errorMessages(errors, "pharmacy_id")} />
        ) : null}

        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <Button onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={assignMembership.isPending}
            type="submit"
            variant="primary"
          >
            {assignMembership.isPending ? "Saving..." : "Save membership"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
