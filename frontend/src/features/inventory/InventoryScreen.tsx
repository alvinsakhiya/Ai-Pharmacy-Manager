import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { AddStockModal } from "./AddStockModal";
import type { StockItem } from "./inventoryApi";
import { useStockItemsQuery } from "./useInventory";
import { usePharmacyNames } from "./usePharmacyNames";

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
      ].join(" ")}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function StockRow({
  item,
  pharmacyName,
}: {
  item: StockItem;
  pharmacyName: (id: number) => string;
}) {
  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
        {item.medication_name}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {pharmacyName(item.pharmacy)}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {item.quantity_on_hand}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {formatDate(item.earliest_expiry)}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {item.reorder_level}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm">
        <StatusPill active={item.is_active} />
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
        <Link
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          to={`/inventory/${item.id}`}
        >
          View
        </Link>
      </td>
    </tr>
  );
}

export function InventoryScreen() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const pharmacies = user?.pharmacies ?? [];
  const canReceiveStock = can("stock.receive");
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<
    number | undefined
  >(undefined);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const stockItemsQuery = useStockItemsQuery(selectedPharmacyId);
  const { pharmacyName } = usePharmacyNames();

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-700">Stock overview</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Inventory
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Review pharmacy stock levels, earliest expiry dates, and batch
            status across the pharmacies in your permitted scope.
          </p>
        </div>

        {pharmacies.length > 1 || canReceiveStock ? (
          <div className="flex flex-col gap-3 sm:items-end">
            {canReceiveStock ? (
              <button
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                onClick={() => setAddStockOpen(true)}
                type="button"
              >
                Add Stock
              </button>
            ) : null}

            {pharmacies.length > 1 ? (
              <label className="min-w-56 text-sm font-medium text-slate-700">
                Pharmacy
                <select
                  className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  onChange={(event) =>
                    setSelectedPharmacyId(
                      event.target.value ? Number(event.target.value) : undefined,
                    )
                  }
                  value={selectedPharmacyId ?? ""}
                >
                  <option value="">All pharmacies</option>
                  {pharmacies.map((pharmacy) => (
                    <option key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
      </section>

      {stockItemsQuery.isLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Loading stock...
        </section>
      ) : null}

      {stockItemsQuery.isError ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <h2 className="text-lg font-bold text-red-900">
            Could not load inventory.
          </h2>
          <p className="mt-2 text-sm text-red-700">
            Please retry. Your session or permissions may need refreshing.
          </p>
          <button
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            onClick={() => void stockItemsQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </section>
      ) : null}

      {stockItemsQuery.isSuccess && stockItemsQuery.data.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No stock items yet.
        </section>
      ) : null}

      {stockItemsQuery.isSuccess && stockItemsQuery.data.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Medication
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pharmacy
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    On hand
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Earliest expiry
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Reorder level
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    View
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {stockItemsQuery.data.map((item) => (
                  <StockRow
                    item={item}
                    key={item.id}
                    pharmacyName={pharmacyName}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <AddStockModal
        defaultPharmacyId={selectedPharmacyId}
        isOpen={addStockOpen}
        onClose={() => setAddStockOpen(false)}
      />
    </div>
  );
}
