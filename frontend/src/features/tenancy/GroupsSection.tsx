import { useState } from "react";

import { usePermissions } from "../../auth/usePermissions";
import { GroupFormModal } from "./GroupFormModal";
import type { Group } from "./tenancyApi";
import { useGroupsQuery } from "./useTenancy";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function GroupsSection() {
  const { can } = usePermissions();
  const canManageGroups = can("group.manage");
  const groupsQuery = useGroupsQuery();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  function openCreateModal() {
    setEditingGroup(null);
    setModalOpen(true);
  }

  function openEditModal(group: Group) {
    setEditingGroup(group);
    setModalOpen(true);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Groups</h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage pharmacy organisation groups.
          </p>
        </div>
        {canManageGroups ? (
          <button
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            onClick={openCreateModal}
            type="button"
          >
            Create group
          </button>
        ) : null}
      </div>

      {groupsQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Loading groups...
        </div>
      ) : null}

      {groupsQuery.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <h3 className="text-lg font-bold text-red-900">
            Could not load groups.
          </h3>
          <p className="mt-2 text-sm text-red-700">
            Please retry. Your session or permissions may need refreshing.
          </p>
          <button
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            onClick={() => void groupsQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      {groupsQuery.isSuccess && groupsQuery.data.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No groups yet.
        </div>
      ) : null}

      {groupsQuery.isSuccess && groupsQuery.data.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {groupsQuery.data.map((group) => (
                  <tr key={group.id}>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
                      {group.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {group.slug}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          group.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500",
                        ].join(" ")}
                      >
                        {group.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {formatDate(group.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
                      {canManageGroups ? (
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          onClick={() => openEditModal(group)}
                          type="button"
                        >
                          Edit
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <GroupFormModal
        group={editingGroup}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </section>
  );
}
