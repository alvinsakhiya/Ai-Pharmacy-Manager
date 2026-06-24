import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import {
  inputClass,
  labelClass,
  selectClass,
} from "../../components/ui/forms";
import {
  CatalogueProductSelect,
} from "../catalogue/CatalogueProductSelect";
import type { CatalogueProduct } from "../catalogue/catalogueApi";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import { cn } from "../../lib/cn";
import { FieldErrorList } from "./FieldErrorList";
import { useReceiveCatalogueStock } from "./useInventory";

interface AddStockModalProps {
  defaultPharmacyId?: number;
  isOpen: boolean;
  onClose: () => void;
}

function unitLabel(product: CatalogueProduct): string {
  return product.pack_unit || product.dose_form || "units";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

export function AddStockModal({
  defaultPharmacyId,
  isOpen,
  onClose,
}: AddStockModalProps) {
  const { user } = useAuth();
  const pharmacies = useMemo(() => user?.pharmacies ?? [], [user?.pharmacies]);
  const receiveStock = useReceiveCatalogueStock();
  const toast = useToast();
  const [pharmacy, setPharmacy] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogueProduct | null>(
    null,
  );
  const [packsReceived, setPacksReceived] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const initialPharmacy =
      defaultPharmacyId ?? (pharmacies.length === 1 ? pharmacies[0].id : undefined);
    setPharmacy(initialPharmacy ? String(initialPharmacy) : "");
    setSelectedProduct(null);
    setPacksReceived("");
    setBatchNumber("");
    setExpiryDate("");
    setReceivedAt("");
    setReference("");
    setErrors({});
  }, [defaultPharmacyId, isOpen, pharmacies]);

  const parsedPacks = Number(packsReceived);
  const packSize = selectedProduct?.pack_size ?? 1;
  const totalUnits =
    Number.isFinite(parsedPacks) && parsedPacks > 0
      ? parsedPacks * packSize
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const nextErrors: FieldErrors = {};
    if (!pharmacy) {
      nextErrors.pharmacy = ["Pharmacy is required."];
    }
    if (selectedProduct === null) {
      nextErrors.catalogue_product = ["Select a catalogue product."];
    }
    if (!batchNumber.trim()) {
      nextErrors.batch_number = ["Batch number is required."];
    }
    if (!expiryDate) {
      nextErrors.expiry_date = ["Expiry date is required."];
    }
    if (!packsReceived || !Number.isFinite(parsedPacks) || parsedPacks < 1) {
      nextErrors.packs_received = ["Packs received must be at least 1."];
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    if (selectedProduct === null) {
      return;
    }

    try {
      await receiveStock.mutateAsync({
        pharmacy: Number(pharmacy),
        catalogue_product: selectedProduct.id,
        packs_received: parsedPacks,
        batch_number: batchNumber.trim(),
        expiry_date: expiryDate,
        received_at: receivedAt || undefined,
        reference: reference.trim() || undefined,
      });
      toast.success("Stock added", `${selectedProduct.full_label} received.`);
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
      toast.error("Could not add stock", "Check the highlighted fields and try again.");
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Stock">
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        <label className={labelClass}>
          Pharmacy
          <select
            className={selectClass}
            onChange={(event) => setPharmacy(event.target.value)}
            required
            value={pharmacy}
          >
            <option value="">Select a pharmacy</option>
            {pharmacies.map((pharmacyOption) => (
              <option key={pharmacyOption.id} value={pharmacyOption.id}>
                {pharmacyOption.name}
              </option>
            ))}
          </select>
          <FieldErrorList messages={errorMessages(errors, "pharmacy")} />
        </label>

        <div>
          <CatalogueProductSelect
            onSelect={setSelectedProduct}
            selectedProduct={selectedProduct}
          />
          <FieldErrorList messages={errorMessages(errors, "catalogue_product")} />
        </div>

        {selectedProduct ? (
          <div className="rounded-xl bg-brand-soft p-3 text-sm">
            <p className="font-semibold text-brand-ink">
              {selectedProduct.full_label}
            </p>
            <p className="mt-1 text-brand-ink">
              Pack size:{" "}
              {selectedProduct.pack_size
                ? `${selectedProduct.pack_size} ${unitLabel(selectedProduct)}`
                : "Not specified"}
            </p>
          </div>
        ) : null}

        <label className={labelClass}>
          Packs received
          <input
            className={cn(inputClass, "tnum")}
            min="1"
            onChange={(event) => setPacksReceived(event.target.value)}
            required
            type="number"
            value={packsReceived}
          />
          <FieldErrorList messages={errorMessages(errors, "packs_received")} />
        </label>

        {selectedProduct && totalUnits !== null ? (
          <p className="tnum rounded-xl border border-line bg-surface-subtle p-3 text-sm font-medium text-ink-soft">
            {formatNumber(parsedPacks)} packs x {packSize}{" "}
            {unitLabel(selectedProduct)} = {formatNumber(totalUnits)}{" "}
            {unitLabel(selectedProduct)} added
          </p>
        ) : null}

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
          Received at
          <input
            className={cn(inputClass, "tnum")}
            onChange={(event) => setReceivedAt(event.target.value)}
            type="date"
            value={receivedAt}
          />
          <FieldErrorList messages={errorMessages(errors, "received_at")} />
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
            {receiveStock.isPending ? "Saving..." : "Add stock"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
