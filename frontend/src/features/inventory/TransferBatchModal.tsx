import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useAuth } from "../../auth/AuthContext";
import { Modal } from "../../components/ui/Modal";
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
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
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
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No other pharmacy is available to transfer to.
          </p>
        ) : null}

        <label className="block text-sm font-medium text-slate-700">
          Destination pharmacy
          <select
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
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
            disabled={transferBatch.isPending || !hasDestinations}
            type="submit"
          >
            {transferBatch.isPending ? "Saving..." : "Transfer stock"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
