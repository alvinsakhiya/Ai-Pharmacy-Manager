import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useAuth } from "../../auth/AuthContext";
import { Modal } from "../../components/ui/Modal";
import {
  CatalogueProductSelect,
} from "../catalogue/CatalogueProductSelect";
import type { CatalogueProduct } from "../catalogue/catalogueApi";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
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
      onClose();
    } catch (error) {
      setErrors(normalizeErrors(error));
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Stock">
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        <label className="block text-sm font-medium text-slate-700">
          Pharmacy
          <select
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
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
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm">
            <p className="font-semibold text-teal-900">
              {selectedProduct.full_label}
            </p>
            <p className="mt-1 text-teal-800">
              Pack size:{" "}
              {selectedProduct.pack_size
                ? `${selectedProduct.pack_size} ${unitLabel(selectedProduct)}`
                : "Not specified"}
            </p>
          </div>
        ) : null}

        <label className="block text-sm font-medium text-slate-700">
          Packs received
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            min="1"
            onChange={(event) => setPacksReceived(event.target.value)}
            required
            type="number"
            value={packsReceived}
          />
          <FieldErrorList messages={errorMessages(errors, "packs_received")} />
        </label>

        {selectedProduct && totalUnits !== null ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700">
            {formatNumber(parsedPacks)} packs x {packSize}{" "}
            {unitLabel(selectedProduct)} = {formatNumber(totalUnits)}{" "}
            {unitLabel(selectedProduct)} added
          </p>
        ) : null}

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
            {receiveStock.isPending ? "Saving..." : "Add stock"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
