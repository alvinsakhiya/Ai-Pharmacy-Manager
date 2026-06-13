import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertOctagon,
  ArrowLeftRight,
  CalendarCheck,
  Factory,
  Hash,
  PackageMinus,
  PackageOpen,
  RotateCw,
  Scale,
  X,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import PageHeader from "../components/Header";
import Badge from "../components/Badge";
import Button from "../components/Button";
import SearchField from "../components/SearchField";
import { Panel } from "../components/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import ClinicalMetric from "../components/ClinicalMetric";
import ListToolbar from "../components/ListToolbar";
import TableShell from "../components/TableShell";
import useApiResource from "../hooks/useApiResource";
import useAuth from "../hooks/useAuth";
import useToast from "../hooks/useToast";
import api from "../services/api";
import { canManageInventory } from "../utils/access";
import { buttonClassName } from "../utils/styles";
import {
  formatDate,
  getExpiryStatus,
  getQuantityStatus,
} from "../utils/helpers";

const movementOptions = [
  ["ADJUSTMENT", "Adjustment"],
  ["RECEIVED", "Received"],
  ["CORRECTION", "Correction"],
  ["PICKING_ALLOCATION", "Picking allocation"],
  ["WASTE_QUARANTINE", "Waste / quarantine"],
];

function readAdjustmentError(error) {
  const data = error.response?.data;

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (data && typeof data === "object") {
    const firstMessage = Object.values(data).flat()[0];
    if (firstMessage) {
      return String(firstMessage);
    }
  }

  return "The stock adjustment could not be saved. Check the connection and try again.";
}

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

function StockAdjustmentPanel({ batch, onClose, onSaved }) {
  const toast = useToast();
  const [movementType, setMovementType] = useState("ADJUSTMENT");
  const [quantityChange, setQuantityChange] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const numericChange = Number(quantityChange);
  const projectedQuantity =
    quantityChange !== "" && Number.isFinite(numericChange)
      ? batch.quantity + numericChange
      : null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await api.post(`/stock-batches/${batch.id}/adjust/`, {
        movement_type: movementType,
        quantity_change: numericChange,
        reason,
      });
      const movement = response.data.movement;

      toast.success(
        "Stock balance updated",
        `${batch.batch_number}: ${movement.quantity_before} → ${movement.quantity_after}.`
      );
      await onSaved();
      onClose();
    } catch (requestError) {
      setError(readAdjustmentError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel className="mb-6 overflow-hidden border-blue-200/70">
      <div className="flex items-start justify-between gap-4 border-b border-white/75 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
            <Scale aria-hidden="true" size={20} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
              Controlled stock adjustment
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">
              {batch.medication_name} · Batch {batch.batch_number}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Current recorded quantity:{" "}
              <strong className="text-slate-800">{batch.quantity}</strong>
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close stock adjustment"
          className="glass-icon-button"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      <form
        className="grid gap-5 p-5 sm:p-6 lg:grid-cols-3"
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div>
          <label
            className="text-sm font-bold text-slate-700"
            htmlFor="movement-type"
          >
            Movement type
          </label>
          <select
            id="movement-type"
            className="field-control mt-2"
            value={movementType}
            onChange={(event) => setMovementType(event.target.value)}
          >
            {movementOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Received stock uses a positive change. Picking and waste movements
            use a negative change.
          </p>
        </div>

        <div>
          <label
            className="text-sm font-bold text-slate-700"
            htmlFor="quantity-change"
          >
            Signed quantity change
          </label>
          <input
            id="quantity-change"
            type="number"
            step="1"
            required
            className="field-control mt-2"
            placeholder="For example: 20 or -5"
            value={quantityChange}
            onChange={(event) => setQuantityChange(event.target.value)}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {projectedQuantity == null
              ? "Enter a whole-number increase or decrease."
              : projectedQuantity < 0
                ? "The projected balance cannot be below zero."
                : `Projected balance: ${projectedQuantity}`}
          </p>
        </div>

        <div>
          <label
            className="text-sm font-bold text-slate-700"
            htmlFor="adjustment-reason"
          >
            Reason
          </label>
          <textarea
            id="adjustment-reason"
            required
            maxLength={300}
            rows={3}
            className="field-control mt-2 resize-y"
            placeholder="Record why this stock balance is changing..."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Required for traceability. Do not enter patient-identifiable
            information.
          </p>
        </div>

        {error && (
          <div
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 lg:col-span-3"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3 lg:col-span-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            icon={Scale}
            loading={isSubmitting}
            disabled={
              !reason.trim()
              || !Number.isInteger(numericChange)
              || numericChange === 0
              || projectedQuantity < 0
            }
          >
            Record movement
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(null);
  const { user } = useAuth();
  const canAdjustStock = canManageInventory(user);
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
          <>
            {canAdjustStock && (
              <Link
                to="/stock-movements"
                className={buttonClassName("secondary")}
              >
                <ArrowLeftRight aria-hidden="true" size={18} />
                Movement history
              </Link>
            )}
            <Button icon={RotateCw} variant="secondary" onClick={reload}>
              Refresh stock
            </Button>
          </>
        }
      />

      {!isLoading && !error && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <ClinicalMetric
            description="Tracked stock records"
            icon={PackageOpen}
            label="Total batches"
            tone="info"
            value={batches.length}
          />
          <ClinicalMetric
            description="Replenishment review"
            icon={PackageMinus}
            label="Low / no stock"
            tone="attention"
            value={lowStockCount}
          />
          <ClinicalMetric
            description="Quarantine required"
            icon={AlertOctagon}
            label="Expired batches"
            tone="critical"
            value={expiredCount}
          />
        </div>
      )}

      {selectedBatch && (
        <StockAdjustmentPanel
          key={selectedBatch.id}
          batch={selectedBatch}
          onClose={() => setSelectedBatch(null)}
          onSaved={reload}
        />
      )}

      <Panel className="overflow-hidden">
        <ListToolbar
          shown={!isLoading && !error ? filteredBatches.length : null}
          total={!isLoading && !error ? batches.length : null}
          unit="batches shown"
        >
          <SearchField
            id="inventory-search"
            label="Search inventory"
            placeholder="Search medicine, strength, batch or supplier..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </ListToolbar>

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
            <TableShell
              className="hidden md:block"
              label="Medication stock batches and safety status"
              minWidth="1040px"
            >
                <thead>
                  <tr>
                    <th>Medication</th>
                    <th>Batch</th>
                    <th>Expiry status</th>
                    <th>Quantity</th>
                    <th>Received</th>
                    <th>Supplier</th>
                    {canAdjustStock && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((batch) => {
                    const expiry = getExpiryStatus(batch.expiry_date);
                    const quantity =
                      expiry.tone === "danger"
                        ? { code: "STOP", label: "Quarantine", tone: "danger" }
                        : getQuantityStatus(batch.quantity);

                    return (
                      <tr
                        key={batch.id}
                        className={
                          expiry.tone === "danger" ? "signal-pattern-critical" : undefined
                        }
                      >
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
                            <Badge tone={expiry.tone}>
                              {expiry.code} · {expiry.label}
                            </Badge>
                            <span className="text-xs font-medium text-slate-400">
                              {formatDate(batch.expiry_date)}
                            </span>
                            <span className="text-xs font-bold text-slate-600">
                              {expiry.action}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-base font-black text-slate-900">
                              {batch.quantity}
                            </span>
                            <Badge tone={quantity.tone}>
                              {quantity.code || "STOP"} · {quantity.label}
                            </Badge>
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
                        {canAdjustStock && (
                          <td>
                            <Button
                              icon={Scale}
                              variant="secondary"
                              onClick={() => setSelectedBatch(batch)}
                            >
                              Adjust
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
            </TableShell>

            <div className="divide-y divide-slate-100 md:hidden">
              {filteredBatches.map((batch) => {
                const expiry = getExpiryStatus(batch.expiry_date);
                const quantity =
                  expiry.tone === "danger"
                    ? { code: "STOP", label: "Quarantine", tone: "danger" }
                    : getQuantityStatus(batch.quantity);

                return (
                  <article key={batch.id} className="p-4 sm:p-5">
                    <MedicationIdentity batch={batch} />

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge tone={expiry.tone}>
                        {expiry.code} · {expiry.label}
                      </Badge>
                      <Badge tone={quantity.tone}>
                        {quantity.code || "STOP"} · {batch.quantity} units / {quantity.label}
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
                    {canAdjustStock && (
                      <Button
                        className="mt-4 w-full"
                        icon={Scale}
                        variant="secondary"
                        onClick={() => setSelectedBatch(batch)}
                      >
                        Record stock adjustment
                      </Button>
                    )}
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
