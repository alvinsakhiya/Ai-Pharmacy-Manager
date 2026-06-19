import { useEffect, useState, type FormEvent } from "react";

import { Modal } from "../../components/ui/Modal";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import { FieldErrorList } from "./FieldErrorList";
import type { StockBatch } from "./inventoryApi";
import { useCountBatch } from "./useInventory";

interface CountBatchModalProps {
  batch: StockBatch;
  isOpen: boolean;
  onClose: () => void;
}

export function CountBatchModal({
  batch,
  isOpen,
  onClose,
}: CountBatchModalProps) {
  const countBatch = useCountBatch();
  const [countedQuantity, setCountedQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [noChangeNote, setNoChangeNote] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setCountedQuantity("");
    setReason("");
    setReference("");
    setErrors({});
    setNoChangeNote(false);
  }, [isOpen, batch.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setNoChangeNote(false);

    const parsedCountedQuantity = Number(countedQuantity);
    const nextErrors: FieldErrors = {};
    if (
      !countedQuantity ||
      !Number.isFinite(parsedCountedQuantity) ||
      parsedCountedQuantity < 0
    ) {
      nextErrors.counted_quantity = [
        "Counted quantity must be a number of at least 0.",
      ];
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      const response = await countBatch.mutateAsync({
        batchId: batch.id,
        body: {
          counted_quantity: parsedCountedQuantity,
          reason: reason.trim() || undefined,
          reference: reference.trim() || undefined,
        },
      });
      if (response.changed === false) {
        setNoChangeNote(true);
        return;
      }
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Cycle count ${batch.batch_number}`}
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />
        <FieldErrorList messages={errorMessages(errors, "batch")} />

        {noChangeNote ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No change recorded — counted quantity matched current stock.
          </p>
        ) : null}

        <label className="block text-sm font-medium text-slate-700">
          Counted quantity
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            min="0"
            onChange={(event) => setCountedQuantity(event.target.value)}
            required
            type="number"
            value={countedQuantity}
          />
          <FieldErrorList messages={errorMessages(errors, "counted_quantity")} />
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
            disabled={countBatch.isPending}
            type="submit"
          >
            {countBatch.isPending ? "Saving..." : "Record count"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
