import { useState } from "react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
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
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [reassignTarget, setReassignTarget] = useState<ManagedUser | null>(null);

  async function handleDeactivate(user: ManagedUser) {
    if (!window.confirm(`Deactivate ${user.email}?`)) {
      return;
    }
    await deactivateUser.mutateAsync(user.id);
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Full name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pharmacy
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Password
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {users.map((managedUser) => {
                const isCurrentUser = managedUser.id === currentUser?.id;
                const showDeactivate =
                  canManageUsers && managedUser.is_active && !isCurrentUser;
                const showReset = canManageUsers;
                const showReassign = canManageUsers && !isCurrentUser;

                return (
                  <tr key={managedUser.id}>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
                      {managedUser.email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {managedUser.full_name || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {formatRole(managedUser.role)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {managedUser.pharmacy?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          managedUser.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500",
                        ].join(" ")}
                      >
                        {managedUser.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {managedUser.must_change_password
                        ? "Must change"
                        : "Current"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        {showDeactivate ? (
                          <button
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            onClick={() => void handleDeactivate(managedUser)}
                            type="button"
                          >
                            Deactivate
                          </button>
                        ) : null}
                        {showReset ? (
                          <button
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                            onClick={() => setResetTarget(managedUser)}
                            type="button"
                          >
                            Reset password
                          </button>
                        ) : null}
                        {showReassign ? (
                          <button
                            className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                            onClick={() => setReassignTarget(managedUser)}
                            type="button"
                          >
                            Reassign membership
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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
