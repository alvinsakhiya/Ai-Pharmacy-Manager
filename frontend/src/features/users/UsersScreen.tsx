import { useState } from "react";

import { usePermissions } from "../../auth/usePermissions";
import { CreateUserModal } from "./CreateUserModal";
import { UsersTable } from "./UsersTable";
import { useUsersQuery } from "./useUsers";

export function UsersScreen() {
  const { can } = usePermissions();
  const canManageUsers = can("user.manage");
  const usersQuery = useUsersQuery();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-700">User management</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Users
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            View users in your permitted scope, create new accounts, deactivate
            users, and issue temporary password resets.
          </p>
        </div>
        {canManageUsers ? (
          <button
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            onClick={() => setCreateModalOpen(true)}
            type="button"
          >
            Create user
          </button>
        ) : null}
      </section>

      {usersQuery.isLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Loading users...
        </section>
      ) : null}

      {usersQuery.isError ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <h2 className="text-lg font-bold text-red-900">
            Could not load users.
          </h2>
          <p className="mt-2 text-sm text-red-700">
            Please retry. If this continues, your session or permissions may
            need refreshing.
          </p>
          <button
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            onClick={() => void usersQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </section>
      ) : null}

      {usersQuery.isSuccess && usersQuery.data.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No users in your scope yet.
        </section>
      ) : null}

      {usersQuery.isSuccess && usersQuery.data.length > 0 ? (
        <UsersTable users={usersQuery.data} />
      ) : null}

      <CreateUserModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
