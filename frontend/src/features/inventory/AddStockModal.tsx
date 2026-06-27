import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import {
  fieldHintClass,
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
import {
  currentDateTimeLocal,
  datePartFromDateTime,
  daysUntilDate,
  formatDateTimeSummary,
  formatNumber,
} from "./stockIntakeForm";
import { useReceiveCatalogueStock } from "./useInventory";

interface AddStockModalProps {
  defaultPharmacyId?: number;
  isOpen: boolean;
  onClose: () => void;
}

function unitLabel(product: CatalogueProduct): string {
  return product.pack_unit || product.dose_form || "units";
}

function productSourceLabel(product: CatalogueProduct): string {
  if (!product.source) {
    return "Reference data";
  }
  if (product.source === "TRUD_DMD") {
    return "TRUD dm+d";
  }
  return product.source;
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
    setReceivedAt(currentDateTimeLocal());
    setReference("");
    setErrors({});
  }, [defaultPharmacyId, isOpen, pharmacies]);

  const selectedPharmacy = pharmacies.find(
    (pharmacyOption) => String(pharmacyOption.id) === pharmacy,
  );
  const parsedPacks = Number(packsReceived);
  const packSize = selectedProduct?.pack_size ?? 1;
  const totalUnits =
    Number.isFinite(parsedPacks) && parsedPacks > 0
      ? parsedPacks * packSize
      : null;
  const expiryDays = expiryDate ? daysUntilDate(expiryDate) : null;
  const expiryIsPast = expiryDays !== null && expiryDays < 0;
  const expiryIsSoon =
    expiryDays !== null && expiryDays >= 0 && expiryDays <= 90;
  const receivedDate = receivedAt ? datePartFromDateTime(receivedAt) : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const nextErrors: FieldErrors = {};
    if (!pharmacy) {
      nextErrors.pharmacy = ["Pharmacy is required."];
    }
    if (selectedProduct === null) {
      nextErrors.catalogue_product = ["Select a dm+d medicine/product."];
    }
    if (!batchNumber.trim()) {
      nextErrors.batch_number = ["Batch number is required."];
    }
    if (!expiryDate) {
      nextErrors.expiry_date = ["Expiry date is required."];
    } else if (expiryIsPast) {
      nextErrors.expiry_date = ["Expiry date cannot be in the past."];
    } else if (receivedDate !== undefined && expiryDate < receivedDate) {
      nextErrors.expiry_date = [
        "Expiry date cannot be before the received date.",
      ];
    }
    if (!packsReceived || !Number.isFinite(parsedPacks) || parsedPacks < 1) {
      nextErrors.packs_received = ["Packs received must be at least 1."];
    }
    if (!receivedAt) {
      nextErrors.received_at = ["Received date and time is required."];
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
        received_at: datePartFromDateTime(receivedAt),
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Stock"
      description="Choose a medicine from imported dm+d reference data, then review batch and receipt details before saving."
      size="xl"
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FieldErrorList messages={errorMessages(errors, "detail")} />
        <FieldErrorList messages={errorMessages(errors, "non_field_errors")} />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.95fr)]">
          <section className="space-y-4 rounded-2xl border border-line bg-surface-subtle p-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.06em] text-brand">
                Step 1
              </p>
              <h3 className="mt-1 text-base font-bold text-ink">
                Select medicine from dm+d
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Choose a medicine from imported dm+d reference data. The selected
                pack details are used to calculate stock units before receipt.
              </p>
            </div>

            <CatalogueProductSelect
              label="dm+d medicine/product"
              placeholder="Search dm+d reference data by medicine, strength, form, or pack"
              loadingText="Searching dm+d reference data..."
              errorText="Could not search dm+d reference data. Please retry."
              emptyText="No dm+d medicine/products found."
              onSelect={setSelectedProduct}
              selectedProduct={selectedProduct}
            />
            <FieldErrorList messages={errorMessages(errors, "catalogue_product")} />

            {selectedProduct ? (
              <div className="rounded-xl border border-brand/20 bg-brand-soft p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.06em] text-brand">
                      Selected dm+d medicine
                    </p>
                    <p className="mt-1 font-semibold leading-relaxed text-brand-ink">
                      {selectedProduct.full_label}
                    </p>
                  </div>
                  <span className="rounded-full border border-brand/20 bg-surface px-2.5 py-1 text-xs font-bold text-brand">
                    {productSourceLabel(selectedProduct)}
                  </span>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold text-muted">
                      Medicine/product
                    </dt>
                    <dd className="mt-0.5 font-semibold text-brand-ink">
                      {selectedProduct.display_name || selectedProduct.full_label}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted">Strength</dt>
                    <dd className="mt-0.5 font-semibold text-brand-ink">
                      {selectedProduct.strength || "Not specified"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted">Form</dt>
                    <dd className="mt-0.5 font-semibold text-brand-ink">
                      {selectedProduct.dose_form || "Not specified"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted">Pack size</dt>
                    <dd className="mt-0.5 font-semibold text-brand-ink">
                      {selectedProduct.pack_size
                        ? `${selectedProduct.pack_size} ${unitLabel(selectedProduct)}`
                        : "Not specified"}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-line-strong bg-surface px-4 py-5 text-sm text-muted">
                Search dm+d reference data to select the medicine/product before
                entering batch details.
              </div>
            )}
          </section>

          <div className="space-y-5">
            <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.06em] text-brand">
                  Step 2
                </p>
                <h3 className="mt-1 text-base font-bold text-ink">
                  Pack and batch details
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Review batch and expiry before saving.
                </p>
              </div>

              {pharmacies.length === 1 && selectedPharmacy ? (
                <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2 text-sm font-semibold text-ink">
                  Receiving into: {selectedPharmacy.name}
                </div>
              ) : (
                <label className={labelClass}>
                  Receiving pharmacy
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
              )}

              <div className="grid gap-4 sm:grid-cols-2">
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
                  <FieldErrorList
                    messages={errorMessages(errors, "packs_received")}
                  />
                </label>

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

                <div>
                  <label className={labelClass} htmlFor="add-stock-expiry-date">
                    Expiry date
                  </label>
                  <input
                    className={cn(inputClass, "tnum")}
                    id="add-stock-expiry-date"
                    onChange={(event) => setExpiryDate(event.target.value)}
                    required
                    type="date"
                    value={expiryDate}
                  />
                  <span className={cn(fieldHintClass, "block")}>
                    Use the date printed on the pack or outer carton.
                  </span>
                  {expiryIsPast ? (
                    <p className="mt-1.5 text-xs font-semibold text-danger-ink">
                      This expiry date is in the past.
                    </p>
                  ) : null}
                  {expiryIsSoon ? (
                    <p className="mt-1.5 text-xs font-semibold text-warning-ink">
                      This batch expires soon. FEFO will prioritise it.
                    </p>
                  ) : null}
                  <FieldErrorList messages={errorMessages(errors, "expiry_date")} />
                </div>

                <label className={labelClass}>
                  Received date and time
                  <input
                    className={cn(inputClass, "tnum")}
                    onChange={(event) => setReceivedAt(event.target.value)}
                    required
                    type="datetime-local"
                    value={receivedAt}
                  />
                  <FieldErrorList messages={errorMessages(errors, "received_at")} />
                </label>
              </div>

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
            </section>

            <section className="space-y-3 rounded-2xl border border-line bg-surface-subtle p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.06em] text-brand">
                  Step 3
                </p>
                <h3 className="mt-1 text-base font-bold text-ink">
                  Receipt and stock summary
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Pack and unit totals are calculated before stock is received.
                </p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-muted">
                    Selected pharmacy
                  </dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {selectedPharmacy?.name ?? "Not selected"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">
                    Selected dm+d medicine
                  </dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {selectedProduct?.full_label ?? "Not selected"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">Batch number</dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {batchNumber.trim() || "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">Expiry date</dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {expiryDate || "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">
                    Received date and time
                  </dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {formatDateTimeSummary(receivedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">
                    Total units added
                  </dt>
                  <dd className="mt-0.5 font-semibold text-ink">
                    {selectedProduct && totalUnits !== null
                      ? `${formatNumber(parsedPacks)} packs × ${packSize} ${unitLabel(
                          selectedProduct,
                        )} = ${formatNumber(totalUnits)} ${unitLabel(
                          selectedProduct,
                        )} added`
                      : "Select medicine and enter packs"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>

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
