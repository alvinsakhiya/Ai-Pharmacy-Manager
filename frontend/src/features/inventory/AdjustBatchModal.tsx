import { useEffect, useState, type FormEvent } from "react";

import { Modal } from "../../components/ui/Modal";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import { FieldErrorList } from "./FieldErrorList";
import type { StockBatch } from "./inventoryApi";
import { useAdjustBatch } from "./useInventory";

interface AdjustBatchModalProps {
  batch: StockBatch;
  isOpen: boolean;
  onClose: () => void;
}

export function AdjustBatchModal({
  batch,
  isOpen,
  onClose,
}: AdjustBatchModalProps) {
  const adjustBatch = useAdjustBatch();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDelta("");
    setReason("");
    setReference("");
    setErrors({});
  }, [isOpen, batch.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const parsedDelta = Number(delta);
    const nextErrors: FieldErrors = {};
    if (!delta || !Number.isFinite(parsedDelta)) {
      nextErrors.delta = ["Delta is required."];
    } else if (parsedDelta === 0) {
      nextErrors.delta = ["Delta cannot be zero."];
    }
    if (!reason.trim()) {
      nextErrors.reason = ["Reason is required."];
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      await adjustBatch.mutateAsync({
        batchId: batch.id,
        body: {
          delta: parsedDelta,
          reason: reason.trim(),
          reference: reference.trim() || undefined,
        },
      });
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Adjust batch ${batch.batch_number}`}
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />
        <FieldErrorList messages={errorMessages(errors, "batch")} />

        <label className="block text-sm font-medium text-slate-700">
          Delta
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setDelta(event.target.value)}
            required
            type="number"
            value={delta}
          />
          <FieldErrorList messages={errorMessages(errors, "delta")} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Reason
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            onChange={(event) => setReason(event.target.value)}
            required
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
            disabled={adjustBatch.isPending}
            type="submit"
          >
            {adjustBatch.isPending ? "Saving..." : "Adjust batch"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
