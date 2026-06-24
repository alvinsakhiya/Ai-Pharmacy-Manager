import { useState } from "react";

import { usePermissions } from "../../auth/usePermissions";
import {
  formLabel,
  type Medication,
} from "./catalogueApi";
import { MedicationFormModal } from "./MedicationFormModal";
import { useMedicationsQuery } from "./useCatalogue";

function packLabel(medication: Medication): string {
  if (medication.catalogue_product_pack_size == null) {
    return "—";
  }
  return `${medication.catalogue_product_pack_size}${
    medication.catalogue_product_pack_unit
      ? ` ${medication.catalogue_product_pack_unit}`
      : ""
  }`;
}

export function MedicationsScreen() {
  const { can } = usePermissions();
  const canManage = can("medication.manage");
  const medicationsQuery = useMedicationsQuery();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(
    null,
  );

  function openCreateModal() {
    setEditingMedication(null);
    setModalOpen(true);
  }

  function openEditModal(medication: Medication) {
    setEditingMedication(medication);
    setModalOpen(true);
  }

  const medications = medicationsQuery.data ?? [];
  const hasLegacyMedications = medications.some(
    (medication) => medication.catalogue_product === null,
  );

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-700">
            Catalogue / local library
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Medication Library
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Search and enable catalogue products used for stock, MDS/Dosette,
            and reports.
          </p>
        </div>
        {canManage ? (
          <button
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            onClick={openCreateModal}
            type="button"
          >
            Add from catalogue
          </button>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600 shadow-sm">
        This library shows catalogue products that are enabled for this
        pharmacy/group. Stock intake and MDS/Dosette workflows use this same
        catalogue, so staff do not need to type medicine names manually.
      </section>

      {medicationsQuery.isLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Loading medications...
        </section>
      ) : null}

      {medicationsQuery.isError ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <h2 className="text-lg font-bold text-red-900">
            Could not load medications.
          </h2>
          <p className="mt-2 text-sm text-red-700">
            Please retry. Your session or permissions may need refreshing.
          </p>
          <button
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            onClick={() => void medicationsQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </section>
      ) : null}

      {medicationsQuery.isSuccess && medicationsQuery.data.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No catalogue products enabled yet.
        </section>
      ) : null}

      {medicationsQuery.isSuccess && hasLegacyMedications ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800 shadow-sm">
          Legacy records were created before catalogue selection and should be
          reviewed.
        </section>
      ) : null}

      {medicationsQuery.isSuccess && medicationsQuery.data.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Catalogue product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Form
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pack
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Manufacturer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {medicationsQuery.data.map((medication) => (
                  <tr key={medication.id}>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
                      <div className="flex items-center gap-2">
                        <span>
                          {medication.catalogue_product_full_label ??
                            medication.name}
                        </span>
                        {medication.catalogue_product === null ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            Legacy
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {formLabel(medication.form)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {packLabel(medication)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {medication.manufacturer || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          medication.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500",
                        ].join(" ")}
                      >
                        {medication.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
                      {canManage ? (
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          onClick={() => openEditModal(medication)}
                          type="button"
                        >
                          Local settings
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <MedicationFormModal
        isOpen={isModalOpen}
        medication={editingMedication}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
