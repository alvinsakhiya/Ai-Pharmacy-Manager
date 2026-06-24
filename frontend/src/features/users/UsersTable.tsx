import { useState } from "react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import {
  Table,
  TableScroll,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "../../components/ui/Table";
import { useToast } from "../../components/ui/Toast";
import { useDeactivateUser } from "./useUsers";
import type { ManagedUser } from "./usersApi";
import { ReassignMembershipModal } from "./ReassignMembershipModal";
import { ResetPasswordModal } from "./ResetPasswordModal";

interface UsersTableProps {
  users: ManagedUser[];
}

function formatRole(role: string | null): string {
  return role ? role.replace("_", " ") : "No role";
}

export function UsersTable({ users }: UsersTableProps) {
  const { user: currentUser } = useAuth();
  const { can } = usePermissions();
  const canManageUsers = can("user.manage");
  const deactivateUser = useDeactivateUser();
  const { success, error: toastError } = useToast();
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [reassignTarget, setReassignTarget] = useState<ManagedUser | null>(
    null,
  );

  async function handleDeactivate(user: ManagedUser) {
    if (!window.confirm(`Deactivate ${user.email}?`)) {
      return;
    }
    try {
      await deactivateUser.mutateAsync(user.id);
      success("User deactivated", `${user.email} can no longer sign in.`);
    } catch {
      toastError("Could not deactivate user", "Please try again.");
    }
  }

  return (
    <>
      <TableScroll>
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Email</TH>
              <TH>Full name</TH>
              <TH>Role</TH>
              <TH>Pharmacy</TH>
              <TH>Status</TH>
              <TH>Password</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((managedUser) => {
              const isCurrentUser = managedUser.id === currentUser?.id;
              const showDeactivate =
                canManageUsers && managedUser.is_active && !isCurrentUser;
              const showReset = canManageUsers;
              const showReassign = canManageUsers && !isCurrentUser;

              return (
                <TR key={managedUser.id}>
                  <TD className="whitespace-nowrap font-semibold text-ink">
                    {managedUser.email}
                  </TD>
                  <TD className="whitespace-nowrap">
                    {managedUser.full_name || "—"}
                  </TD>
                  <TD className="whitespace-nowrap">
                    {formatRole(managedUser.role)}
                  </TD>
                  <TD className="whitespace-nowrap">
                    {managedUser.pharmacy?.name ?? "—"}
                  </TD>
                  <TD className="whitespace-nowrap">
                    <Badge
                      dot
                      variant={managedUser.is_active ? "success" : "neutral"}
                    >
                      {managedUser.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TD>
                  <TD className="whitespace-nowrap">
                    {managedUser.must_change_password ? (
                      <Badge variant="warning">Must change</Badge>
                    ) : (
                      <Badge variant="neutral">Current</Badge>
                    )}
                  </TD>
                  <TD className="whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      {showDeactivate ? (
                        <Button
                          onClick={() => void handleDeactivate(managedUser)}
                          size="sm"
                          type="button"
                          variant="danger"
                        >
                          Deactivate
                        </Button>
                      ) : null}
                      {showReset ? (
                        <Button
                          onClick={() => setResetTarget(managedUser)}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Reset password
                        </Button>
                      ) : null}
                      {showReassign ? (
                        <Button
                          onClick={() => setReassignTarget(managedUser)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Reassign membership
                        </Button>
                      ) : null}
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableScroll>

      <ResetPasswordModal
        onClose={() => setResetTarget(null)}
        user={resetTarget}
      />
      <ReassignMembershipModal
        onClose={() => setReassignTarget(null)}
        user={reassignTarget}
      />
    </>
  );
}
