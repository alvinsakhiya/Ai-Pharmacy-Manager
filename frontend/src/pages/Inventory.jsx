import { useState } from "react";
import {
  CalendarCheck,
  Factory,
  Hash,
  PackageOpen,
  RotateCw,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import PageHeader from "../components/Header";
import Badge from "../components/Badge";
import Button from "../components/Button";
import SearchField from "../components/SearchField";
import { Panel } from "../components/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import useApiResource from "../hooks/useApiResource";
import {
  formatDate,
  getExpiryStatus,
  getQuantityStatus,
} from "../utils/helpers";

function MedicationIdentity({ batch }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
        <PackageOpen size={19} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-900">{batch.medication_name}</p>
        <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">
          {batch.medication_strength} / {batch.medication_form}
        </p>
      </div>
    </div>
  );
}

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

  const expiredCount = batches.filter(
    (batch) => getExpiryStatus(batch.expiry_date).tone === "danger"
  ).length;
  const lowStockCount = batches.filter(
    (batch) => getQuantityStatus(batch.quantity).tone !== "success"
  ).length;

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Medication stock"
        title="Inventory management"
        description="Monitor batch quantities, supplier provenance and expiry status from one operational view."
        icon={PackageOpen}
        actions={
          <Button icon={RotateCw} variant="secondary" onClick={reload}>
            Refresh stock
          </Button>
        }
      />

      {!isLoading && !error && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <div className="surface-card px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total batches
            </p>
            <p className="mt-1 text-xl font-black text-slate-950">{batches.length}</p>
          </div>
          <div className="surface-card px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Low / no stock
            </p>
            <p className="mt-1 text-xl font-black text-amber-700">{lowStockCount}</p>
          </div>
          <div className="surface-card col-span-2 px-4 py-3 sm:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Expired batches
            </p>
            <p className="mt-1 text-xl font-black text-red-700">{expiredCount}</p>
          </div>
        </div>
      )}

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 p-4 sm:p-5 lg:flex-row lg:items-center">
          <SearchField
            id="inventory-search"
            label="Search inventory"
            placeholder="Search medicine, strength, batch or supplier..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
          {!isLoading && !error && (
            <div className="flex items-center justify-between gap-3 lg:justify-end">
              <Badge dot tone="blue">
                {filteredBatches.length} shown
              </Badge>
              <span className="text-xs font-semibold text-slate-400">
                {batches.length} total
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <LoadingState label="Loading stock batches..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filteredBatches.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title={normalizedQuery ? "No matching stock batches" : "No stock batches"}
            message={
              normalizedQuery
                ? "Try another medicine, strength, batch number or supplier."
                : "Stock batch records will appear here when they are available."
            }
          />
        ) : (
          <>
            <div className="scrollbar-thin hidden overflow-x-auto md:block">
              <table className="data-table min-w-[1040px]">
                <thead>
                  <tr>
                    <th>Medication</th>
                    <th>Batch</th>
                    <th>Expiry status</th>
                    <th>Quantity</th>
                    <th>Received</th>
                    <th>Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((batch) => {
                    const expiry = getExpiryStatus(batch.expiry_date);
                    const quantity =
                      expiry.tone === "danger"
                        ? { label: "Quarantine", tone: "danger" }
                        : getQuantityStatus(batch.quantity);

                    return (
                      <tr key={batch.id}>
                        <td>
                          <MedicationIdentity batch={batch} />
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Hash className="text-slate-400" size={15} />
                            <span className="font-mono text-sm font-bold text-slate-700">
                              {batch.batch_number}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1.5">
                            <Badge tone={expiry.tone}>{expiry.label}</Badge>
                            <span className="text-xs font-medium text-slate-400">
                              {formatDate(batch.expiry_date)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-base font-black text-slate-900">
                              {batch.quantity}
                            </span>
                            <Badge tone={quantity.tone}>{quantity.label}</Badge>
                          </div>
                        </td>
                        <td className="text-sm font-semibold text-slate-600">
                          {formatDate(batch.received_date)}
                        </td>
                        <td>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Factory className="text-slate-400" size={16} />
                            {batch.supplier || "Not recorded"}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {filteredBatches.map((batch) => {
                const expiry = getExpiryStatus(batch.expiry_date);
                const quantity =
                  expiry.tone === "danger"
                    ? { label: "Quarantine", tone: "danger" }
                    : getQuantityStatus(batch.quantity);

                return (
                  <article key={batch.id} className="p-4 sm:p-5">
                    <MedicationIdentity batch={batch} />

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge tone={expiry.tone}>{expiry.label}</Badge>
                      <Badge tone={quantity.tone}>
                        {batch.quantity} units / {quantity.label}
                      </Badge>
                    </div>

                    <dl className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="flex items-center gap-2 text-slate-400">
                          <Hash size={15} />
                          Batch
                        </dt>
                        <dd className="font-mono font-bold text-slate-700">
                          {batch.batch_number}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="flex items-center gap-2 text-slate-400">
                          <CalendarCheck size={15} />
                          Expiry
                        </dt>
                        <dd className="font-semibold text-slate-700">
                          {formatDate(batch.expiry_date)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="flex items-center gap-2 text-slate-400">
                          <Factory size={15} />
                          Supplier
                        </dt>
                        <dd className="max-w-[60%] text-right font-semibold text-slate-700">
                          {batch.supplier || "Not recorded"}
                        </dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </Panel>
    </MainLayout>
  );
}

export default Inventory;
