import { useEffect, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/cn";
import { inputClass, labelClass } from "../../components/ui/forms";
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
    setReceivedAt("");
    setUnitPrice("");
    setPackPrice("");
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
        pack_price: packPrice || undefined,
        reason: reason.trim() || undefined,
        reference: reference.trim() || undefined,
      });
      toast.success("Stock received", `Batch ${batchNumber.trim()} added to ${stockItem.medication_name}.`);
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
      toast.error("Could not receive stock", "Check the highlighted fields and try again.");
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Receive stock">
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

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
          Expiry date
          <input
            className={cn(inputClass, "tnum")}
            onChange={(event) => setExpiryDate(event.target.value)}
            required
            type="date"
            value={expiryDate}
          />
          <FieldErrorList messages={errorMessages(errors, "expiry_date")} />
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

        <label className={labelClass}>
          Received at
          <input
            className={cn(inputClass, "tnum")}
            onChange={(event) => setReceivedAt(event.target.value)}
            type="date"
            value={receivedAt}
          />
          <FieldErrorList messages={errorMessages(errors, "received_at")} />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
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
