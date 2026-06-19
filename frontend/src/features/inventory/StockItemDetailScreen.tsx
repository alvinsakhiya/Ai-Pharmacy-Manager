import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { usePermissions } from "../../auth/usePermissions";
import { AdjustBatchModal } from "./AdjustBatchModal";
import { CountBatchModal } from "./CountBatchModal";
import { ReceiveStockModal } from "./ReceiveStockModal";
import { TransferBatchModal } from "./TransferBatchModal";
import type { StockBatch } from "./inventoryApi";
import { useStockItemQuery } from "./useInventory";
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

function DetailValue({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function BatchRow({
  batch,
  canManage,
  canTransfer,
  onAdjust,
  onCount,
  onTransfer,
}: {
  batch: StockBatch;
  canManage: boolean;
  canTransfer: boolean;
  onAdjust: (batch: StockBatch) => void;
  onCount: (batch: StockBatch) => void;
  onTransfer: (batch: StockBatch) => void;
}) {
  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
        {batch.batch_number}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {formatDate(batch.expiry_date)}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {batch.quantity}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {batch.quantity_received}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {formatDate(batch.received_at)}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm">
        <StatusPill active={batch.is_active} />
      </td>
      {canManage || canTransfer ? (
        <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
          <div className="flex justify-end gap-2">
            {canManage ? (
              <>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  onClick={() => onAdjust(batch)}
                  type="button"
                >
                  Adjust
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  onClick={() => onCount(batch)}
                  type="button"
                >
                  Count
                </button>
              </>
            ) : null}
            {canTransfer ? (
              <button
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                onClick={() => onTransfer(batch)}
                type="button"
              >
                Transfer
              </button>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

export function StockItemDetailScreen() {
  const { can } = usePermissions();
  const { stockItemId } = useParams();
  const parsedStockItemId = Number(stockItemId);
  const isValidStockItemId = Number.isFinite(parsedStockItemId);
  const stockItemQuery = useStockItemQuery(parsedStockItemId);
  const { pharmacyName } = usePharmacyNames();
  const canManage = can("stock.manage");
  const canTransfer = can("stock.transfer");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [batchAction, setBatchAction] = useState<{
    type: "adjust" | "count" | "transfer";
    batch: StockBatch;
  } | null>(null);

  if (!isValidStockItemId) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
        <h1 className="text-lg font-bold text-red-900">
          This stock item was not found or is outside your access.
        </h1>
        <Link
          className="mt-4 inline-flex rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          to="/inventory"
        >
          Back to inventory
        </Link>
      </section>
    );
  }

  if (stockItemQuery.isLoading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
        Loading stock...
      </section>
    );
  }

  if (stockItemQuery.isError || !stockItemQuery.data) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
        <h1 className="text-lg font-bold text-red-900">
          This stock item was not found or is outside your access.
        </h1>
        <p className="mt-2 text-sm text-red-700">
          Please return to the inventory list or retry after refreshing your
          session.
        </p>
        <Link
          className="mt-4 inline-flex rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          to="/inventory"
        >
          Back to inventory
        </Link>
      </section>
    );
  }

  const stockItem = stockItemQuery.data;

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex text-sm font-semibold text-teal-700 transition hover:text-teal-900"
        to="/inventory"
      >
        Back to inventory
      </Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">
              {pharmacyName(stockItem.pharmacy)}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              {stockItem.medication_name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill active={stockItem.is_active} />
            {canManage ? (
              <button
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                onClick={() => setReceiveOpen(true)}
                type="button"
              >
                Receive stock
              </button>
            ) : null}
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <DetailValue label="On hand" value={stockItem.quantity_on_hand} />
          <DetailValue
            label="Earliest expiry"
            value={formatDate(stockItem.earliest_expiry)}
          />
          <DetailValue label="Reorder level" value={stockItem.reorder_level} />
          <DetailValue label="Unit price" value={stockItem.unit_price ?? "—"} />
          <DetailValue
            label="Pharmacy"
            value={pharmacyName(stockItem.pharmacy)}
          />
        </dl>
      </section>

      {stockItem.batches.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No batches recorded for this stock item.
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-950">Batches</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Batch number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Expiry date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Quantity received
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Received at
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  {canManage || canTransfer ? (
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {stockItem.batches.map((batch) => (
                  <BatchRow
                    batch={batch}
                    canManage={canManage}
                    canTransfer={canTransfer}
                    key={batch.id}
                    onAdjust={(nextBatch) =>
                      setBatchAction({ type: "adjust", batch: nextBatch })
                    }
                    onCount={(nextBatch) =>
                      setBatchAction({ type: "count", batch: nextBatch })
                    }
                    onTransfer={(nextBatch) =>
                      setBatchAction({ type: "transfer", batch: nextBatch })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ReceiveStockModal
        isOpen={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        stockItem={stockItem}
      />
      {batchAction?.type === "adjust" ? (
        <AdjustBatchModal
          batch={batchAction.batch}
          isOpen
          onClose={() => setBatchAction(null)}
        />
      ) : null}
      {batchAction?.type === "count" ? (
        <CountBatchModal
          batch={batchAction.batch}
          isOpen
          onClose={() => setBatchAction(null)}
        />
      ) : null}
      {batchAction?.type === "transfer" ? (
        <TransferBatchModal
          batch={batchAction.batch}
          isOpen
          onClose={() => setBatchAction(null)}
          sourcePharmacyId={stockItem.pharmacy}
        />
      ) : null}
    </div>
  );
}
