import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users as UsersIcon,
  UserX,
} from "lucide-react";

import { usePermissions } from "../../auth/usePermissions";
import { Button } from "../../components/ui/Button";
import { Panel, PanelBody } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { KpiCard } from "../../components/ui/KpiCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { inputClass, labelClass } from "../../components/ui/forms";
import { CreateUserModal } from "./CreateUserModal";
import { UsersTable } from "./UsersTable";
import { useUsersQuery } from "./useUsers";
import type { ManagedUser } from "./usersApi";

const EMPTY_USERS: ManagedUser[] = [];

function formatRole(role: string | null): string {
  if (!role) return "No role";
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function plural(value: number, singular: string, pluralLabel = `${singular}s`) {
  return `${value.toLocaleString()} ${value === 1 ? singular : pluralLabel}`;
}

function userMatchesSearch(user: ManagedUser, searchTerm: string): boolean {
  const searchable = [
    user.full_name,
    user.email,
    formatRole(user.role),
    user.pharmacy?.name ?? "",
    user.is_active ? "active" : "inactive",
    user.must_change_password ? "must change password" : "password current",
  ]
    .join(" ")
    .toLowerCase();

  return searchable.includes(searchTerm);
}

export function UsersScreen() {
  const { can } = usePermissions();
  const canManageUsers = can("user.manage");
  const usersQuery = useUsersQuery();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const users = usersQuery.data ?? EMPTY_USERS;
  const trimmedSearch = searchTerm.trim().toLowerCase();
  const filteredUsers = useMemo(() => {
    if (!trimmedSearch) {
      return users;
    }

    return users.filter((user) => userMatchesSearch(user, trimmedSearch));
  }, [trimmedSearch, users]);

  const summary = useMemo(() => {
    const active = users.filter((user) => user.is_active).length;
    const inactive = users.length - active;
    const admins = users.filter((user) => user.role === "ADMIN").length;
    const pharmacists = users.filter((user) => user.role === "PHARMACIST").length;
    const pharmacies = new Set(
      users
        .map((user) => user.pharmacy?.name)
        .filter((name): name is string => Boolean(name)),
    );
    const passwordChanges = users.filter(
      (user) => user.must_change_password,
    ).length;

    return {
      active,
      inactive,
      admins,
      pharmacists,
      pharmacies: pharmacies.size,
      passwordChanges,
    };
  }, [users]);

  return (
    <div className="space-y-5">
      <PageHeader
        className="animate-fade-in-up"
        eyebrow="User management"
        title="Users"
        subtitle="Manage staff access, roles, and pharmacy membership."
        actions={
          canManageUsers ? (
            <Button
              leadingIcon={<UserPlus className="h-4 w-4" />}
              onClick={() => setCreateModalOpen(true)}
              type="button"
              variant="primary"
            >
              Create user
            </Button>
          ) : null
        }
      />

      {usersQuery.isSuccess ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Active users"
            value={summary.active.toLocaleString()}
            note={`${plural(summary.inactive, "inactive account")} in scope`}
            icon={<UserCheck className="h-4 w-4" />}
          />
          <KpiCard
            label="Inactive users"
            value={summary.inactive.toLocaleString()}
            note={`${plural(users.length, "total account")} loaded`}
            icon={<UserX className="h-4 w-4" />}
          />
          <KpiCard
            label="Admins"
            value={summary.admins.toLocaleString()}
            note={`${plural(summary.pharmacists, "pharmacist")} in scope`}
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <KpiCard
            label="Pharmacies represented"
            value={summary.pharmacies.toLocaleString()}
            note={`${plural(summary.passwordChanges, "password reset")} pending`}
            icon={<Building2 className="h-4 w-4" />}
          />
        </section>
      ) : null}

      {usersQuery.isLoading ? (
        <Panel>
          <PanelBody>
            <SkeletonRows rows={6} />
          </PanelBody>
        </Panel>
      ) : null}

      {usersQuery.isError ? (
        <EmptyState
          tone="danger"
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Could not load users."
          description="Please retry. If this continues, your session or permissions may need refreshing."
          action={
            <Button
              onClick={() => void usersQuery.refetch()}
              type="button"
              variant="danger"
            >
              Retry
            </Button>
          }
        />
      ) : null}

      {usersQuery.isSuccess && usersQuery.data.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-6 w-6" />}
          title="No users in your scope yet."
          description="Create the first account to give your team access to this workspace."
          action={
            canManageUsers ? (
              <Button
                leadingIcon={<UserPlus className="h-4 w-4" />}
                onClick={() => setCreateModalOpen(true)}
                type="button"
                variant="primary"
              >
                Create user
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {usersQuery.isSuccess && users.length > 0 ? (
        <Panel>
          <PanelBody>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <label className={`${labelClass} w-full lg:max-w-md`}>
                Search users
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  />
                  <input
                    className={`${inputClass} pl-9`}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Name, email, role, pharmacy, or status"
                    type="search"
                    value={searchTerm}
                  />
                </div>
              </label>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                <span className="font-semibold text-ink-soft">
                  Showing {filteredUsers.length.toLocaleString()} of{" "}
                  {users.length.toLocaleString()}
                </span>
                {searchTerm ? (
                  <Button
                    onClick={() => setSearchTerm("")}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Clear search
                  </Button>
                ) : null}
              </div>
            </div>
          </PanelBody>
        </Panel>
      ) : null}

      {usersQuery.isSuccess && users.length > 0 && filteredUsers.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="No users match this search."
          description="Try a different name, email, role, pharmacy, or status."
          action={
            <Button
              onClick={() => setSearchTerm("")}
              type="button"
              variant="secondary"
            >
              Clear search
            </Button>
          }
        />
      ) : null}

      {usersQuery.isSuccess && filteredUsers.length > 0 ? (
        <UsersTable totalUsers={users.length} users={filteredUsers} />
      ) : null}

      <CreateUserModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
