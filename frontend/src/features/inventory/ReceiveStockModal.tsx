import { useEffect, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/cn";
import { fieldHintClass, inputClass, labelClass } from "../../components/ui/forms";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import { FieldErrorList } from "./FieldErrorList";
import type { StockItemDetail } from "./inventoryApi";
import {
  currentDateTimeLocal,
  datePartFromDateTime,
  daysUntilDate,
  formatDateTimeSummary,
  formatNumber,
} from "./stockIntakeForm";
import { useReceiveStock } from "./useInventory";

interface ReceiveStockModalProps {
  stockItem: StockItemDetail;
  isOpen: boolean;
  onClose: () => void;
}

export function ReceiveStockModal({
  stockItem,
  isOpen,
  onClose,
}: ReceiveStockModalProps) {
  const receiveStock = useReceiveStock();
  const toast = useToast();
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [packPrice, setPackPrice] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setBatchNumber("");
    setExpiryDate("");
    setQuantity("");
    setReceivedAt(currentDateTimeLocal());
    setUnitPrice("");
    setPackPrice("");
    setReason("");
    setReference("");
    setErrors({});
  }, [isOpen]);

  const parsedQuantity = Number(quantity);
  const expiryDays = expiryDate ? daysUntilDate(expiryDate) : null;
  const expiryIsPast = expiryDays !== null && expiryDays < 0;
  const expiryIsSoon =
    expiryDays !== null && expiryDays >= 0 && expiryDays <= 90;
  const receivedDate = receivedAt ? datePartFromDateTime(receivedAt) : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const nextErrors: FieldErrors = {};
    if (!batchNumber.trim()) {
      nextErrors.batch_number = ["Batch number is required."];
    }
    if (!expiryDate) {
      nextErrors.expiry_date = ["Expiry date is required."];
    } else if (expiryIsPast) {
      nextErrors.expiry_date = ["Expiry date cannot be in the past."];
    } else if (receivedDate !== undefined && expiryDate < receivedDate) {
      nextErrors.expiry_date = [
        "Expiry date cannot be before the received date.",
      ];
    }
    if (!quantity || !Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
      nextErrors.quantity = ["Quantity must be a number of at least 1."];
    }
    if (!receivedAt) {
      nextErrors.received_at = ["Received date and time is required."];
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      await receiveStock.mutateAsync({
        pharmacy: stockItem.pharmacy,
        medication: stockItem.medication,
        batch_number: batchNumber.trim(),
        expiry_date: expiryDate,
        quantity: parsedQuantity,
        received_at: datePartFromDateTime(receivedAt),
        unit_price: unitPrice || undefined,
        pack_price: packPrice || undefined,
        reason: reason.trim() || undefined,
        reference: reference.trim() || undefined,
      });
      toast.success(
        "Stock received",
        `Batch ${batchNumber.trim()} added to ${stockItem.medication_name}.`,
      );
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
      toast.error("Could not receive stock", "Check the highlighted fields and try again.");
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Receive stock"
      description="Add a batch to this existing stock item after checking quantity, expiry, and receipt details."
      size="xl"
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,1fr)]">
          <div className="space-y-5">
            <section className="space-y-3 rounded-2xl border border-line bg-surface-subtle p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.06em] text-muted">
                  Existing stock item
                </p>
                <p className="mt-1 text-base font-bold text-ink">
                  {stockItem.medication_name}
                </p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-muted">On hand</dt>
                  <dd className="tnum mt-0.5 font-semibold text-ink">
                    {formatNumber(stockItem.quantity_on_hand)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">Reorder level</dt>
                  <dd className="tnum mt-0.5 font-semibold text-ink">
                    {formatNumber(stockItem.reorder_level)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">
                    Current unit price
                  </dt>
                  <dd className="tnum mt-0.5 font-semibold text-ink">
                    {stockItem.unit_price ? `£${stockItem.unit_price}` : "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">
                    Current box price
                  </dt>
                  <dd className="tnum mt-0.5 font-semibold text-ink">
                    {stockItem.pack_price ? `£${stockItem.pack_price}` : "Not set"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="space-y-3 rounded-2xl border border-line bg-surface-subtle p-4">
              <h3 className="text-sm font-bold text-ink">
                Receipt and stock summary
              </h3>
              <p className="text-xs leading-relaxed text-muted">
                Review quantity, batch, and expiry before receiving this stock.
              </p>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-muted">Batch number</dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {batchNumber.trim() || "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">Expiry date</dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {expiryDate || "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">
                    Received date and time
                  </dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {formatDateTimeSummary(receivedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">
                    Total units added
                  </dt>
                  <dd className="tnum mt-0.5 font-semibold text-ink">
                    {Number.isFinite(parsedQuantity) && parsedQuantity > 0
                      ? formatNumber(parsedQuantity)
                      : "Enter quantity"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <div className="space-y-5">
            <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
              <h3 className="text-sm font-bold text-ink">Batch details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Batch number
                  <input
                    className={inputClass}
                    onChange={(event) => setBatchNumber(event.target.value)}
                    required
                    type="text"
                    value={batchNumber}
                  />
                  <FieldErrorList messages={errorMessages(errors, "batch_number")} />
                </label>

                <label className={labelClass}>
                  Quantity
                  <input
                    className={cn(inputClass, "tnum")}
                    min="1"
                    onChange={(event) => setQuantity(event.target.value)}
                    required
                    type="number"
                    value={quantity}
                  />
                  <FieldErrorList messages={errorMessages(errors, "quantity")} />
                </label>

                <div>
                  <label
                    className={labelClass}
                    htmlFor="receive-stock-expiry-date"
                  >
                    Expiry date
                  </label>
                  <input
                    className={cn(inputClass, "tnum")}
                    id="receive-stock-expiry-date"
                    onChange={(event) => setExpiryDate(event.target.value)}
                    required
                    type="date"
                    value={expiryDate}
                  />
                  <span className={cn(fieldHintClass, "block")}>
                    Use the date printed on the pack or outer carton.
                  </span>
                  {expiryIsPast ? (
                    <p className="mt-1.5 text-xs font-semibold text-danger-ink">
                      This expiry date is in the past.
                    </p>
                  ) : null}
                  {expiryIsSoon ? (
                    <p className="mt-1.5 text-xs font-semibold text-warning-ink">
                      This batch expires soon. FEFO will prioritise it.
                    </p>
                  ) : null}
                  <FieldErrorList messages={errorMessages(errors, "expiry_date")} />
                </div>

                <label className={labelClass}>
                  Received date and time
                  <input
                    className={cn(inputClass, "tnum")}
                    onChange={(event) => setReceivedAt(event.target.value)}
                    required
                    type="datetime-local"
                    value={receivedAt}
                  />
                  <FieldErrorList messages={errorMessages(errors, "received_at")} />
                </label>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
              <h3 className="text-sm font-bold text-ink">Pricing and notes</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Unit price
                  <input
                    className={cn(inputClass, "tnum")}
                    min="0"
                    onChange={(event) => setUnitPrice(event.target.value)}
                    step="0.01"
                    type="number"
                    value={unitPrice}
                  />
                  <FieldErrorList messages={errorMessages(errors, "unit_price")} />
                </label>

                <label className={labelClass}>
                  Box price
                  <input
                    className={cn(inputClass, "tnum")}
                    min="0"
                    onChange={(event) => setPackPrice(event.target.value)}
                    step="0.01"
                    type="number"
                    value={packPrice}
                  />
                  <FieldErrorList messages={errorMessages(errors, "pack_price")} />
                </label>
              </div>

              <label className={labelClass}>
                Reason
                <input
                  className={inputClass}
                  onChange={(event) => setReason(event.target.value)}
                  type="text"
                  value={reason}
                />
                <FieldErrorList messages={errorMessages(errors, "reason")} />
              </label>

              <label className={labelClass}>
                Reference
                <input
                  className={inputClass}
                  onChange={(event) => setReference(event.target.value)}
                  type="text"
                  value={reference}
                />
                <FieldErrorList messages={errorMessages(errors, "reference")} />
              </label>
            </section>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={receiveStock.isPending}
            type="submit"
          >
            {receiveStock.isPending ? "Saving..." : "Receive stock"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
