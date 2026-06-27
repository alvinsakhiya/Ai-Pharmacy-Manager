import { useState } from "react";
import {
  Building2,
  CalendarDays,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { Badge, type BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import {
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "../../components/ui/Table";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/cn";
import { useDeactivateUser } from "./useUsers";
import type { ManagedUser } from "./usersApi";
import { ReassignMembershipModal } from "./ReassignMembershipModal";
import { ResetPasswordModal } from "./ResetPasswordModal";

interface UsersTableProps {
  users: ManagedUser[];
  totalUsers: number;
}

function formatRole(role: string | null): string {
  if (!role) return "No role";
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function roleTone(role: string | null): BadgeVariant {
  switch (role) {
    case "ADMIN":
      return "brand";
    case "SUPERINTENDENT":
      return "info";
    case "PHARMACIST":
      return "success";
    case "STOCK_EMPLOYEE":
      return "warning";
    default:
      return "neutral";
  }
}

function formatJoined(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function UsersTable({ users, totalUsers }: UsersTableProps) {
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
      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-base font-extrabold tracking-[-0.01em] text-ink">
              Staff directory
            </h2>
            <p className="mt-1 text-sm text-muted">
              Role, membership, and account status from the current user list.
            </p>
          </div>
          <Badge variant="neutral">
            {users.length.toLocaleString()} of {totalUsers.toLocaleString()} shown
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Staff member</TH>
                <TH>Role</TH>
                <TH>Membership</TH>
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
                  <TR key={managedUser.id} className="group">
                    <TD className="min-w-[260px]">
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full border text-sm font-extrabold",
                            managedUser.is_active
                              ? "border-lilac-soft bg-lilac-soft text-brand"
                              : "border-line bg-surface-subtle text-muted",
                          )}
                        >
                          {(managedUser.full_name || managedUser.email)
                            .slice(0, 1)
                            .toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-ink">
                              {managedUser.full_name || "Name not recorded"}
                            </p>
                            {isCurrentUser ? (
                              <Badge variant="brand">You</Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 break-all text-sm font-semibold text-ink-soft">
                            <Mail aria-hidden="true" className="h-3.5 w-3.5" />
                            {managedUser.email}
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                            <CalendarDays
                              aria-hidden="true"
                              className="h-3.5 w-3.5"
                            />
                            Joined {formatJoined(managedUser.date_joined)}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD className="min-w-[150px] whitespace-nowrap">
                      <Badge
                        icon={<ShieldCheck className="h-3.5 w-3.5" />}
                        variant={roleTone(managedUser.role)}
                      >
                        {formatRole(managedUser.role)}
                      </Badge>
                    </TD>
                    <TD className="min-w-[190px]">
                      <div className="flex items-start gap-2 text-sm font-semibold text-ink">
                        {managedUser.pharmacy ? (
                          <Building2
                            aria-hidden="true"
                            className="mt-0.5 h-4 w-4 shrink-0 text-muted"
                          />
                        ) : (
                          <UserRound
                            aria-hidden="true"
                            className="mt-0.5 h-4 w-4 shrink-0 text-muted"
                          />
                        )}
                        <span className="break-words">
                          {managedUser.pharmacy?.name ?? "Global or unassigned"}
                        </span>
                      </div>
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
                        <Badge
                          icon={<KeyRound className="h-3.5 w-3.5" />}
                          variant="warning"
                        >
                          Must change
                        </Badge>
                      ) : (
                        <Badge
                          icon={<KeyRound className="h-3.5 w-3.5" />}
                          variant="neutral"
                        >
                          Current
                        </Badge>
                      )}
                    </TD>
                    <TD className="min-w-[300px] text-right">
                      <div className="flex flex-wrap justify-end gap-2">
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
        </div>
      </section>

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
