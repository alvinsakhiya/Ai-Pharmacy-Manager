import { useEffect, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/cn";
import {
  fieldHintClass,
  inputClass,
  labelClass,
} from "../../components/ui/forms";
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
  const toast = useToast();
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
      toast.success("Batch adjusted", `Batch ${batch.batch_number} updated.`);
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
      toast.error("Could not adjust batch", "Check the highlighted fields and try again.");
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Stock adjustment — ${batch.batch_number}`}
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />
        <FieldErrorList messages={errorMessages(errors, "batch")} />

        <div>
          <label className={labelClass} htmlFor="adjust-batch-delta">
            Increase / decrease quantity
          </label>
          <input
            aria-describedby="adjust-batch-delta-help"
            className={cn(inputClass, "tnum")}
            id="adjust-batch-delta"
            onChange={(event) => setDelta(event.target.value)}
            required
            type="number"
            value={delta}
          />
          <p id="adjust-batch-delta-help" className={fieldHintClass}>
            Enter a positive number to add stock, or a negative number to remove it.
          </p>
          <FieldErrorList messages={errorMessages(errors, "delta")} />
        </div>

        <label className={labelClass}>
          Why are you adjusting?
          <input
            className={inputClass}
            onChange={(event) => setReason(event.target.value)}
            required
            type="text"
            value={reason}
          />
          <FieldErrorList messages={errorMessages(errors, "reason")} />
        </label>

        <label className={labelClass}>
          Optional note
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
            disabled={adjustBatch.isPending}
            type="submit"
          >
            {adjustBatch.isPending ? "Saving..." : "Save adjustment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
