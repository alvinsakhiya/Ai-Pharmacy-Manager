import { useMemo, useState } from "react";

import { usePermissions } from "../../auth/usePermissions";
import { PharmacyFormModal } from "./PharmacyFormModal";
import type { Pharmacy } from "./tenancyApi";
import { useGroupsQuery, usePharmaciesQuery } from "./useTenancy";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function PharmaciesSection() {
  const { can } = usePermissions();
  const canManagePharmacies = can("pharmacy.manage");
  const pharmaciesQuery = usePharmaciesQuery();
  const groupsQuery = useGroupsQuery();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState<Pharmacy | null>(null);

  const groupIdToName = useMemo(() => {
    return new Map((groupsQuery.data ?? []).map((group) => [group.id, group.name]));
  }, [groupsQuery.data]);

  function openCreateModal() {
    setEditingPharmacy(null);
    setModalOpen(true);
  }

  function openEditModal(pharmacy: Pharmacy) {
    setEditingPharmacy(pharmacy);
    setModalOpen(true);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Pharmacies</h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage pharmacies within organisation groups.
          </p>
        </div>
        {canManagePharmacies ? (
          <button
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            onClick={openCreateModal}
            type="button"
          >
            Create pharmacy
          </button>
        ) : null}
      </div>

      {pharmaciesQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Loading pharmacies...
        </div>
      ) : null}

      {pharmaciesQuery.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <h3 className="text-lg font-bold text-red-900">
            Could not load pharmacies.
          </h3>
          <p className="mt-2 text-sm text-red-700">
            Please retry. Your session or permissions may need refreshing.
          </p>
          <button
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            onClick={() => void pharmaciesQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      {pharmaciesQuery.isSuccess && pharmaciesQuery.data.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No pharmacies yet.
        </div>
      ) : null}

      {pharmaciesQuery.isSuccess && pharmaciesQuery.data.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Group
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Postcode
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
                {pharmaciesQuery.data.map((pharmacy) => (
                  <tr key={pharmacy.id}>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
                      {pharmacy.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {pharmacy.code}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {groupIdToName.get(pharmacy.group) ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {pharmacy.postcode || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          pharmacy.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500",
                        ].join(" ")}
                      >
                        {pharmacy.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {formatDate(pharmacy.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
                      {canManagePharmacies ? (
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          onClick={() => openEditModal(pharmacy)}
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

      <PharmacyFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        pharmacy={editingPharmacy}
      />
    </section>
  );
}
