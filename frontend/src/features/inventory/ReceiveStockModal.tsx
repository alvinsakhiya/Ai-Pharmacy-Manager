import { useEffect, useState, type FormEvent } from "react";

import { Modal } from "../../components/ui/Modal";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import { FieldErrorList } from "./FieldErrorList";
import type { StockItemDetail } from "./inventoryApi";
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
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
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
    setReceivedAt("");
    setUnitPrice("");
    setReason("");
    setReference("");
    setErrors({});
  }, [isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const parsedQuantity = Number(quantity);
    const nextErrors: FieldErrors = {};
    if (!batchNumber.trim()) {
      nextErrors.batch_number = ["Batch number is required."];
    }
    if (!expiryDate) {
      nextErrors.expiry_date = ["Expiry date is required."];
    }
    if (!quantity || !Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
      nextErrors.quantity = ["Quantity must be a number of at least 1."];
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
        received_at: receivedAt || undefined,
        unit_price: unitPrice || undefined,
        reason: reason.trim() || undefined,
        reference: reference.trim() || undefined,
      });
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Receive stock">
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        <label className="block text-sm font-medium text-slate-700">
          Batch number
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setBatchNumber(event.target.value)}
            required
            type="text"
            value={batchNumber}
          />
          <FieldErrorList messages={errorMessages(errors, "batch_number")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Expiry date
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setExpiryDate(event.target.value)}
            required
            type="date"
            value={expiryDate}
          />
          <FieldErrorList messages={errorMessages(errors, "expiry_date")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Quantity
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            min="1"
            onChange={(event) => setQuantity(event.target.value)}
            required
            type="number"
            value={quantity}
          />
          <FieldErrorList messages={errorMessages(errors, "quantity")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Received at
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setReceivedAt(event.target.value)}
            type="date"
            value={receivedAt}
          />
          <FieldErrorList messages={errorMessages(errors, "received_at")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Unit price
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            min="0"
            onChange={(event) => setUnitPrice(event.target.value)}
            step="0.01"
            type="number"
            value={unitPrice}
          />
          <FieldErrorList messages={errorMessages(errors, "unit_price")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Reason
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setReason(event.target.value)}
            type="text"
            value={reason}
          />
          <FieldErrorList messages={errorMessages(errors, "reason")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Reference
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setReference(event.target.value)}
            type="text"
            value={reference}
          />
          <FieldErrorList messages={errorMessages(errors, "reference")} />
        </label>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={receiveStock.isPending}
            type="submit"
          >
            {receiveStock.isPending ? "Saving..." : "Receive stock"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
