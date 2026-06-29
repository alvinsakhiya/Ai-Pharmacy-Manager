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

function userInitial(user: ManagedUser): string {
  return (user.full_name || user.email).slice(0, 1).toUpperCase();
}

function userGroups(users: ManagedUser[]) {
  return [
    {
      label: "Active users",
      description: "Team members who can currently sign in.",
      users: users.filter((user) => user.is_active),
    },
    {
      label: "Inactive users",
      description: "Accounts kept for access history and review.",
      users: users.filter((user) => !user.is_active),
    },
  ].filter((group) => group.users.length > 0);
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
      <section className="space-y-4" aria-label="Team access cards">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold tracking-[-0.01em] text-ink">
              Team access
            </h2>
            <p className="mt-1 text-sm text-muted">
              Role, membership, and account status from the current user list.
            </p>
          </div>
          <Badge variant="neutral">
            {users.length.toLocaleString()} of {totalUsers.toLocaleString()} shown
          </Badge>
        </div>

        {userGroups(users).map((group) => (
          <section
            aria-labelledby={`user-group-${group.label.toLowerCase().replaceAll(" ", "-")}`}
            className="space-y-3"
            key={group.label}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3
                  id={`user-group-${group.label.toLowerCase().replaceAll(" ", "-")}`}
                  className="text-sm font-extrabold text-ink"
                >
                  {group.label}
                </h3>
                <p className="mt-1 text-xs font-medium text-muted">
                  {group.description}
                </p>
              </div>
              <Badge variant="neutral">
                {group.users.length.toLocaleString()} shown
              </Badge>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              {group.users.map((managedUser) => {
                const isCurrentUser = managedUser.id === currentUser?.id;
                const showDeactivate =
                  canManageUsers && managedUser.is_active && !isCurrentUser;
                const showReset = canManageUsers;
                const showReassign = canManageUsers && !isCurrentUser;

                return (
                  <article
                    className="rounded-2xl border border-line bg-surface p-4 shadow-soft transition-colors duration-200 ease-soft hover:border-line-strong"
                    key={managedUser.id}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full border text-sm font-extrabold",
                            managedUser.is_active
                              ? "border-lilac-soft bg-lilac-soft text-brand"
                              : "border-line bg-surface-subtle text-muted",
                          )}
                        >
                          {userInitial(managedUser)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-ink">
                              {managedUser.full_name || "Name not recorded"}
                            </h4>
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

                      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                        <Badge
                          dot
                          variant={managedUser.is_active ? "success" : "neutral"}
                        >
                          {managedUser.is_active ? "Active" : "Inactive"}
                        </Badge>
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
                      </div>
                    </div>

                    <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2.5">
                        <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                          Role
                        </dt>
                        <dd className="mt-1">
                          <Badge
                            icon={<ShieldCheck className="h-3.5 w-3.5" />}
                            variant={roleTone(managedUser.role)}
                          >
                            {formatRole(managedUser.role)}
                          </Badge>
                        </dd>
                      </div>
                      <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2.5">
                        <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                          Membership
                        </dt>
                        <dd className="mt-1 flex items-start gap-2 text-sm font-semibold text-ink">
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
                        </dd>
                      </div>
                      <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2.5">
                        <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                          Status
                        </dt>
                        <dd className="mt-1">
                          <Badge
                            dot
                            variant={managedUser.is_active ? "success" : "neutral"}
                          >
                            {managedUser.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                      <p className="text-xs font-medium text-muted">
                        Team access and role changes follow existing permissions.
                      </p>
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
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
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
