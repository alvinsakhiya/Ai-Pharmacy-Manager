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
  const toast = useToast();
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
      toast.success("Count recorded", `Batch ${batch.batch_number} count saved.`);
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
      toast.error("Could not record count", "Check the highlighted fields and try again.");
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Stock count — ${batch.batch_number}`}
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />
        <FieldErrorList messages={errorMessages(errors, "batch")} />

        {noChangeNote ? (
          <p className="rounded-xl border border-warning-border bg-warning-soft p-3 text-sm text-warning-ink">
            No change recorded — counted quantity matched current stock.
          </p>
        ) : null}

        <label className={labelClass}>
          Counted quantity
          <input
            className={cn(inputClass, "tnum")}
            min="0"
            onChange={(event) => setCountedQuantity(event.target.value)}
            required
            type="number"
            value={countedQuantity}
          />
          <FieldErrorList messages={errorMessages(errors, "counted_quantity")} />
        </label>

        <label className={labelClass}>
          Reason for count
          <input
            className={inputClass}
            onChange={(event) => setReason(event.target.value)}
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
            disabled={countBatch.isPending}
            type="submit"
          >
            {countBatch.isPending ? "Saving..." : "Record count"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
