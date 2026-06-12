import { useState } from "react";
import MainLayout from "../layouts/MainLayout";
import { Package, Search } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import useApiResource from "../hooks/useApiResource";

function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const {
    data: batches,
    error,
    isLoading,
    reload,
  } = useApiResource(
    "/stock-batches/",
    "Inventory records could not be retrieved. Check the API connection and try again."
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredBatches = batches.filter((batch) =>
    [
      batch.medication_name,
      batch.medication_strength,
      batch.medication_form,
      batch.batch_number,
      batch.supplier,
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery))
  );

  return (
    <MainLayout>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500 mt-2">
            Track medication stock batches, quantities, suppliers and expiry dates.
          </p>
        </div>

        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-white transition hover:bg-slate-800"
        >
          <Package size={20} />
          Add Stock Batch
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 p-5 sm:p-6">
          <Search className="text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search inventory..."
            aria-label="Search inventory"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full text-slate-700 outline-none placeholder:text-slate-400"
          />
          {!isLoading && !error && (
            <span
              className="whitespace-nowrap text-xs font-medium text-slate-400"
              aria-live="polite"
            >
              {filteredBatches.length} result(s)
            </span>
          )}
        </div>

        {isLoading ? (
          <LoadingState label="Loading stock batches..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filteredBatches.length === 0 ? (
          <EmptyState
            title={normalizedQuery ? "No matching stock batches" : "No stock batches"}
            message={
              normalizedQuery
                ? "Try another medication, batch number or supplier."
                : "Stock batch records will appear here when they are available."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-sm text-slate-500">
                <tr>
                  <th className="px-6 py-4">Medication</th>
                  <th className="px-6 py-4">Batch</th>
                  <th className="px-6 py-4">Expiry Date</th>
                  <th className="px-6 py-4">Quantity</th>
                  <th className="px-6 py-4">Received</th>
                  <th className="px-6 py-4">Supplier</th>
                </tr>
              </thead>

              <tbody>
                {filteredBatches.map((batch) => (
                  <tr
                    key={batch.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {batch.medication_name} {batch.medication_strength}{" "}
                      {batch.medication_form}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {batch.batch_number}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {batch.expiry_date}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                        {batch.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {batch.received_date}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {batch.supplier || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default Inventory;
