import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/cn";
import {
  inputClass,
  labelClass,
  selectClass,
} from "../../components/ui/forms";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import { FieldErrorList } from "./FieldErrorList";
import type { StockBatch } from "./inventoryApi";
import { useTransferBatch } from "./useInventory";

interface TransferBatchModalProps {
  batch: StockBatch;
  sourcePharmacyId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function TransferBatchModal({
  batch,
  sourcePharmacyId,
  isOpen,
  onClose,
}: TransferBatchModalProps) {
  const { user } = useAuth();
  const transferBatch = useTransferBatch();
  const toast = useToast();
  const [destinationPharmacy, setDestinationPharmacy] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const destinations = useMemo(
    () =>
      (user?.pharmacies ?? []).filter(
        (pharmacy) => pharmacy.id !== sourcePharmacyId,
      ),
    [sourcePharmacyId, user?.pharmacies],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDestinationPharmacy("");
    setQuantity("");
    setReason("");
    setReference("");
    setErrors({});
  }, [isOpen, batch.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const parsedQuantity = Number(quantity);
    const nextErrors: FieldErrors = {};
    if (!destinationPharmacy) {
      nextErrors.destination_pharmacy = ["Select a destination pharmacy."];
    }
    if (!quantity || !Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
      nextErrors.quantity = ["Quantity must be at least 1."];
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      await transferBatch.mutateAsync({
        batchId: batch.id,
        body: {
          destination_pharmacy: Number(destinationPharmacy),
          quantity: parsedQuantity,
          reason: reason.trim() || undefined,
          reference: reference.trim() || undefined,
        },
      });
      toast.success("Stock transferred", `Batch ${batch.batch_number} moved.`);
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
      toast.error("Could not transfer stock", "Check the highlighted fields and try again.");
    }
  }

  const hasDestinations = destinations.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Transfer batch ${batch.batch_number}`}
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />
        <FieldErrorList messages={errorMessages(errors, "batch")} />

        {!hasDestinations ? (
          <p className="rounded-xl border border-warning-border bg-warning-soft p-3 text-sm text-warning-ink">
            No other pharmacy is available to transfer to.
          </p>
        ) : null}

        <label className={labelClass}>
          Destination pharmacy
          <select
            className={selectClass}
            disabled={!hasDestinations}
            onChange={(event) => setDestinationPharmacy(event.target.value)}
            required
            value={destinationPharmacy}
          >
            <option value="">Select a pharmacy</option>
            {destinations.map((pharmacy) => (
              <option key={pharmacy.id} value={pharmacy.id}>
                {pharmacy.name}
              </option>
            ))}
          </select>
          <FieldErrorList
            messages={errorMessages(errors, "destination_pharmacy")}
          />
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
            disabled={transferBatch.isPending || !hasDestinations}
            type="submit"
          >
            {transferBatch.isPending ? "Saving..." : "Transfer stock"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
