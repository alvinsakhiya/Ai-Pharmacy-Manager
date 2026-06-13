import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Mail,
  PackagePlus,
  PackageSearch,
  PencilLine,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import Badge from "../components/Badge";
import Button from "../components/Button";
import ClinicalMetric from "../components/ClinicalMetric";
import PageHeader from "../components/Header";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { Panel, PanelHeader } from "../components/Panel";
import SearchField from "../components/SearchField";
import useApiResource from "../hooks/useApiResource";
import useToast from "../hooks/useToast";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";

const initialSuggestions = {
  summary: {
    total_suggestions: 0,
    ready_to_draft: 0,
    supplier_attention: 0,
    outstanding_units: 0,
  },
  items: [],
};

const orderStatusConfig = {
  DRAFT: { icon: ClipboardList, tone: "blue" },
  REVIEWED: { icon: CheckCircle2, tone: "success" },
  ARCHIVED: { icon: Archive, tone: "slate" },
};

const supplierStatusConfig = {
  READY: { icon: CheckCircle2, tone: "success" },
  SUPPLIER_REQUIRED: { icon: AlertTriangle, tone: "danger" },
  SUPPLIER_INACTIVE: { icon: AlertTriangle, tone: "warning" },
};

function formatTimestamp(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function readOrderingError(error) {
  const data = error.response?.data;

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (data && typeof data === "object") {
    const firstMessage = Object.values(data).flat()[0];
    if (firstMessage) {
      return String(firstMessage);
    }
  }

  return "The supplier or draft-order action could not be completed. Check the connection and try again.";
}

function SupplierForm({ supplier, onCancel, onSaved }) {
  const toast = useToast();
  const isEditing = Boolean(supplier);
  const [form, setForm] = useState(() => ({
    name: supplier?.name || "",
    contact_name: supplier?.contact_name || "",
    email: supplier?.email || "",
    phone: supplier?.phone || "",
    account_reference: supplier?.account_reference || "",
    lead_time_days: String(supplier?.lead_time_days ?? 2),
    notes: supplier?.notes || "",
    is_active: supplier?.is_active ?? true,
  }));
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const leadTime = Number(form.lead_time_days);
  const isValid =
    form.name.trim()
    && Number.isInteger(leadTime)
    && leadTime >= 0
    && leadTime <= 365;

  const updateField = (field) => (event) => {
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const payload = {
      ...form,
      name: form.name.trim(),
      contact_name: form.contact_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      account_reference: form.account_reference.trim(),
      lead_time_days: leadTime,
      notes: form.notes.trim(),
    };

    try {
      if (isEditing) {
        await api.patch(`/suppliers/${supplier.id}/`, payload);
      } else {
        await api.post("/suppliers/", payload);
      }
      toast.success(
        isEditing ? "Supplier updated" : "Supplier created",
        "The supplier directory is ready for preferred-medication assignment."
      );
      await onSaved();
      onCancel();
    } catch (requestError) {
      setError(readOrderingError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel className="mb-6 overflow-hidden border-blue-200/70">
      <PanelHeader
        eyebrow="Local supplier directory"
        icon={Building2}
        title={isEditing ? `Update ${supplier.name}` : "Add supplier"}
        description="Maintain local contact and planning details only. No credentials or external ordering integration are stored."
        action={
          <button
            type="button"
            aria-label="Close supplier form"
            className="glass-icon-button"
            onClick={onCancel}
          >
            <X aria-hidden="true" size={18} />
          </button>
        }
      />

      <form
        className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2 xl:grid-cols-3"
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="supplier-name">
            Supplier name
          </label>
          <input
            id="supplier-name"
            required
            maxLength={150}
            className="field-control mt-2"
            value={form.name}
            onChange={updateField("name")}
          />
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="supplier-contact">
            Contact name
          </label>
          <input
            id="supplier-contact"
            maxLength={150}
            className="field-control mt-2"
            value={form.contact_name}
            onChange={updateField("contact_name")}
          />
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="supplier-account">
            Internal account reference
          </label>
          <input
            id="supplier-account"
            maxLength={100}
            className="field-control mt-2"
            value={form.account_reference}
            onChange={updateField("account_reference")}
          />
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="supplier-email">
            Email
          </label>
          <input
            id="supplier-email"
            type="email"
            className="field-control mt-2"
            value={form.email}
            onChange={updateField("email")}
          />
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="supplier-phone">
            Phone
          </label>
          <input
            id="supplier-phone"
            maxLength={50}
            className="field-control mt-2"
            value={form.phone}
            onChange={updateField("phone")}
          />
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="supplier-lead-time">
            Planning lead time
          </label>
          <input
            id="supplier-lead-time"
            type="number"
            min="0"
            max="365"
            step="1"
            required
            className="field-control mt-2"
            value={form.lead_time_days}
            onChange={updateField("lead_time_days")}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Informational days used for local planning only.
          </p>
        </div>

        <div className="lg:col-span-2 xl:col-span-3">
          <label className="text-sm font-bold text-slate-700" htmlFor="supplier-notes">
            Notes
          </label>
          <textarea
            id="supplier-notes"
            maxLength={2000}
            rows={3}
            className="field-control mt-2 resize-y"
            value={form.notes}
            onChange={updateField("notes")}
          />
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm font-bold text-slate-700 lg:col-span-2 xl:col-span-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            checked={form.is_active}
            onChange={updateField("is_active")}
          />
          Active for new internal draft orders
        </label>

        {error && (
          <div
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 lg:col-span-2 xl:col-span-3"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3 lg:col-span-2 xl:col-span-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            icon={Save}
            loading={isSubmitting}
            disabled={!isValid}
          >
            {isEditing ? "Save supplier" : "Create supplier"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function SuggestionStatusBadge({ suggestion }) {
  const config =
    supplierStatusConfig[suggestion.supplier_status]
    || supplierStatusConfig.SUPPLIER_REQUIRED;

  return (
    <Badge icon={config.icon} tone={config.tone}>
      {suggestion.supplier_status_label}
    </Badge>
  );
}

function OrderStatusBadge({ order }) {
  const config = orderStatusConfig[order.status] || orderStatusConfig.DRAFT;

  return (
    <Badge icon={config.icon} tone={config.tone}>
      {order.status_label}
    </Badge>
  );
}

function Ordering() {
  const toast = useToast();
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierSelections, setSupplierSelections] = useState({});
  const [pendingAction, setPendingAction] = useState("");
  const [actionError, setActionError] = useState("");
  const supplierResource = useApiResource(
    "/suppliers/",
    "The supplier directory could not be loaded."
  );
  const suggestionResource = useApiResource(
    "/draft-purchase-orders/suggestions/",
    "Reorder suggestions could not be calculated.",
    initialSuggestions
  );
  const orderResource = useApiResource(
    "/draft-purchase-orders/",
    "Draft purchase orders could not be loaded."
  );

  const suppliers = Array.isArray(supplierResource.data)
    ? supplierResource.data
    : [];
  const orders = Array.isArray(orderResource.data) ? orderResource.data : [];
  const suggestions = useMemo(
    () =>
      Array.isArray(suggestionResource.data.items)
        ? suggestionResource.data.items
        : initialSuggestions.items,
    [suggestionResource.data.items]
  );
  const summary =
    suggestionResource.data.summary || initialSuggestions.summary;
  const activeSuppliers = suppliers.filter((supplier) => supplier.is_active);
  const normalizedSupplierSearch = supplierSearch.trim().toLowerCase();
  const filteredSuppliers = suppliers.filter((supplier) =>
    [
      supplier.name,
      supplier.contact_name,
      supplier.email,
      supplier.account_reference,
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedSupplierSearch))
  );
  const supplierAttention = suggestions.filter(
    (item) => item.supplier_status !== "READY"
  );
  const readyGroups = useMemo(() => {
    const groups = new Map();

    suggestions
      .filter((item) => item.supplier_status === "READY")
      .forEach((item) => {
        if (!groups.has(item.preferred_supplier_id)) {
          groups.set(item.preferred_supplier_id, {
            supplierId: item.preferred_supplier_id,
            supplierName: item.preferred_supplier_name,
            items: [],
          });
        }
        groups.get(item.preferred_supplier_id).items.push(item);
      });

    return [...groups.values()];
  }, [suggestions]);
  const isLoading =
    supplierResource.isLoading
    || suggestionResource.isLoading
    || orderResource.isLoading;
  const error =
    supplierResource.error
    || suggestionResource.error
    || orderResource.error;

  const refreshAll = async () => {
    await Promise.allSettled([
      supplierResource.reload(),
      suggestionResource.reload(),
      orderResource.reload(),
    ]);
  };

  const assignSupplier = async (suggestion) => {
    const selectedSupplier = Number(
      supplierSelections[suggestion.medication_id]
      ?? suggestion.preferred_supplier_id
    );
    if (!selectedSupplier) return;

    setPendingAction(`assign:${suggestion.medication_id}`);
    setActionError("");
    try {
      await api.patch(`/medications/${suggestion.medication_id}/`, {
        preferred_supplier: selectedSupplier,
      });
      toast.success(
        "Preferred supplier assigned",
        `${suggestion.medication} can now enter a supplier draft.`
      );
      await Promise.all([
        supplierResource.reload(),
        suggestionResource.reload(),
      ]);
    } catch (requestError) {
      setActionError(readOrderingError(requestError));
    } finally {
      setPendingAction("");
    }
  };

  const createDraft = async (group) => {
    setPendingAction(`draft:${group.supplierId}`);
    setActionError("");
    try {
      const response = await api.post(
        "/draft-purchase-orders/create-from-suggestions/",
        {
          supplier: group.supplierId,
          medication_ids: group.items.map((item) => item.medication_id),
          notes: "Generated from outstanding stock recommendations for internal review.",
        }
      );
      toast.success(
        "Internal draft created",
        `${response.data.reference} contains ${response.data.items.length} medication lines.`
      );
      await Promise.all([
        suggestionResource.reload(),
        orderResource.reload(),
      ]);
    } catch (requestError) {
      setActionError(readOrderingError(requestError));
    } finally {
      setPendingAction("");
    }
  };

  const updateOrderStatus = async (order, nextStatus) => {
    setPendingAction(`order:${order.id}:${nextStatus}`);
    setActionError("");
    try {
      await api.patch(`/draft-purchase-orders/${order.id}/`, {
        status: nextStatus,
      });
      toast.success(
        nextStatus === "REVIEWED" ? "Draft reviewed" : "Draft archived",
        `${order.reference} remains an internal planning record.`
      );
      await Promise.all([
        suggestionResource.reload(),
        orderResource.reload(),
      ]);
    } catch (requestError) {
      setActionError(readOrderingError(requestError));
    } finally {
      setPendingAction("");
    }
  };

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Internal procurement planning"
        title="Suppliers and draft orders"
        description="Maintain preferred suppliers and convert outstanding stock recommendations into reviewable local drafts without transmitting orders externally."
        icon={Truck}
        actions={
          <>
            <Button
              icon={Plus}
              onClick={() => {
                setEditingSupplier(null);
                setShowSupplierForm(true);
              }}
            >
              Add supplier
            </Button>
            <Button
              icon={RefreshCw}
              variant="secondary"
              loading={
                supplierResource.isReloading
                || suggestionResource.isReloading
                || orderResource.isReloading
              }
              onClick={refreshAll}
            >
              Refresh workflow
            </Button>
          </>
        }
      />

      {!isLoading && !error && (
        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <ClinicalMetric
            description="Available for new drafts"
            icon={Building2}
            label="Active suppliers"
            tone="info"
            value={activeSuppliers.length}
          />
          <ClinicalMetric
            description="Outstanding medication lines"
            icon={PackagePlus}
            label="Reorder lines"
            tone="critical"
            value={summary.total_suggestions}
          />
          <ClinicalMetric
            description="Preferred supplier ready"
            icon={CheckCircle2}
            label="Ready to draft"
            tone="ready"
            value={summary.ready_to_draft}
          />
          <ClinicalMetric
            description="Assignment needs review"
            icon={AlertTriangle}
            label="Supplier attention"
            tone="attention"
            value={summary.supplier_attention}
          />
          <ClinicalMetric
            description="Across current suggestions"
            icon={ClipboardList}
            label="Outstanding units"
            tone="info"
            value={summary.outstanding_units}
          />
        </section>
      )}

      {showSupplierForm && (
        <SupplierForm
          key={editingSupplier?.id || "new-supplier"}
          supplier={editingSupplier}
          onCancel={() => {
            setShowSupplierForm(false);
            setEditingSupplier(null);
          }}
          onSaved={refreshAll}
        />
      )}

      {actionError && (
        <div
          className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900"
          role="alert"
        >
          {actionError}
        </div>
      )}

      {isLoading ? (
        <Panel>
          <LoadingState label="Loading supplier and ordering workflow..." />
        </Panel>
      ) : error ? (
        <Panel>
          <ErrorState message={error} onRetry={refreshAll} />
        </Panel>
      ) : (
        <div className="space-y-6">
          <Panel className="overflow-hidden">
            <PanelHeader
              eyebrow="Outstanding recommendations"
              icon={PackagePlus}
              title="Reorder suggestions"
              description="Open draft quantities are deducted automatically, preventing the same recommendation from being drafted twice."
            />

            {suggestions.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No outstanding reorder suggestions"
                message="Current usable stock and open internal drafts cover the configured stock targets."
              />
            ) : (
              <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-2">
                {readyGroups.map((group) => (
                  <article
                    key={group.supplierId}
                    className="rounded-2xl border border-cyan-200 bg-cyan-50/55 p-4 signal-pattern-ready sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Badge icon={CheckCircle2} tone="success">
                          Ready for internal draft
                        </Badge>
                        <h3 className="mt-3 text-lg font-bold text-slate-950">
                          {group.supplierName}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {group.items.length} medication line
                          {group.items.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Button
                        icon={ClipboardList}
                        loading={pendingAction === `draft:${group.supplierId}`}
                        onClick={() => createDraft(group)}
                      >
                        Create internal draft
                      </Button>
                    </div>

                    <ul className="mt-5 divide-y divide-cyan-100 rounded-2xl border border-white/80 bg-white/70">
                      {group.items.map((item) => (
                        <li
                          key={item.medication_id}
                          className="p-4"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-bold text-slate-900">
                                {item.medication}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                {item.current_stock} available · target {item.target_stock}
                              </p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-xl font-black text-slate-950">
                                {item.outstanding_quantity}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                units to draft
                              </p>
                            </div>
                          </div>

                          {activeSuppliers.length > 1 && (
                            <div className="mt-3 grid gap-2 border-t border-cyan-100 pt-3 sm:grid-cols-[1fr_auto]">
                              <div>
                                <label
                                  className="sr-only"
                                  htmlFor={`supplier-change-${item.medication_id}`}
                                >
                                  Change preferred supplier for {item.medication}
                                </label>
                                <select
                                  id={`supplier-change-${item.medication_id}`}
                                  className="field-control"
                                  value={
                                    supplierSelections[item.medication_id]
                                    ?? item.preferred_supplier_id
                                  }
                                  onChange={(event) =>
                                    setSupplierSelections((current) => ({
                                      ...current,
                                      [item.medication_id]: event.target.value,
                                    }))
                                  }
                                >
                                  {activeSuppliers.map((supplier) => (
                                    <option key={supplier.id} value={supplier.id}>
                                      {supplier.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <Button
                                icon={Save}
                                variant="secondary"
                                loading={
                                  pendingAction
                                  === `assign:${item.medication_id}`
                                }
                                disabled={
                                  Number(
                                    supplierSelections[item.medication_id]
                                    ?? item.preferred_supplier_id
                                  ) === item.preferred_supplier_id
                                }
                                onClick={() => assignSupplier(item)}
                              >
                                Change supplier
                              </Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}

                {supplierAttention.map((suggestion) => (
                  <article
                    key={suggestion.medication_id}
                    className="rounded-2xl border border-amber-200 bg-amber-50/55 p-4 signal-pattern-attention sm:p-5"
                  >
                    <SuggestionStatusBadge suggestion={suggestion} />
                    <h3 className="mt-3 text-lg font-bold text-slate-950">
                      {suggestion.medication}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {suggestion.outstanding_quantity} units are suggested.
                      Assign an active preferred supplier before creating a draft.
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div>
                        <label
                          className="sr-only"
                          htmlFor={`supplier-assignment-${suggestion.medication_id}`}
                        >
                          Preferred supplier for {suggestion.medication}
                        </label>
                        <select
                          id={`supplier-assignment-${suggestion.medication_id}`}
                          className="field-control"
                          value={
                            supplierSelections[suggestion.medication_id] || ""
                          }
                          onChange={(event) =>
                            setSupplierSelections((current) => ({
                              ...current,
                              [suggestion.medication_id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Select active supplier</option>
                          {activeSuppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        icon={Save}
                        variant="secondary"
                        loading={
                          pendingAction
                          === `assign:${suggestion.medication_id}`
                        }
                        disabled={
                          !supplierSelections[suggestion.medication_id]
                        }
                        onClick={() => assignSupplier(suggestion)}
                      >
                        Assign supplier
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader
              eyebrow="Review lifecycle"
              icon={ClipboardList}
              title="Internal draft purchase orders"
              description="Drafts are local planning records only. Reviewed and archived statuses do not submit, claim or transmit an order."
            />

            {orders.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No internal draft orders"
                message="Create a draft from a supplier-ready reorder recommendation."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <article key={order.id} className="p-4 sm:p-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <OrderStatusBadge order={order} />
                          <Badge icon={Building2} tone="slate">
                            {order.supplier_name}
                          </Badge>
                        </div>
                        <h3 className="mt-3 text-lg font-bold text-slate-950">
                          {order.reference}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Created {formatTimestamp(order.created_at)} by{" "}
                          {order.created_by_display}
                        </p>

                        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                          {order.items.map((item) => (
                            <li
                              key={item.id}
                              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                            >
                              <p className="font-bold text-slate-900">
                                {item.medication_name}
                              </p>
                              <p className="mt-1 text-sm font-black text-blue-700">
                                {item.quantity} units
                              </p>
                              <p className="mt-2 text-xs leading-5 text-slate-500">
                                {item.rationale}
                              </p>
                            </li>
                          ))}
                        </ul>
                        {order.notes && (
                          <p className="mt-4 rounded-xl bg-blue-50/70 px-4 py-3 text-sm leading-6 text-slate-600">
                            {order.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-3">
                        {order.status === "DRAFT" && (
                          <Button
                            icon={CheckCircle2}
                            loading={
                              pendingAction
                              === `order:${order.id}:REVIEWED`
                            }
                            onClick={() =>
                              updateOrderStatus(order, "REVIEWED")
                            }
                          >
                            Mark reviewed
                          </Button>
                        )}
                        {order.status !== "ARCHIVED" && (
                          <Button
                            icon={Archive}
                            variant="secondary"
                            loading={
                              pendingAction
                              === `order:${order.id}:ARCHIVED`
                            }
                            onClick={() =>
                              updateOrderStatus(order, "ARCHIVED")
                            }
                          >
                            Archive
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader
              eyebrow="Supplier governance"
              icon={Building2}
              title="Supplier directory"
              description="Deactivate suppliers rather than deleting them so draft-order history remains explainable."
            />
            <div className="border-b border-white/75 p-4 sm:p-5">
              <SearchField
                id="supplier-search"
                label="Search suppliers"
                placeholder="Search supplier, contact, email or account reference..."
                value={supplierSearch}
                onChange={setSupplierSearch}
              />
            </div>

            {filteredSuppliers.length === 0 ? (
              <EmptyState
                icon={PackageSearch}
                title={
                  normalizedSupplierSearch
                    ? "No matching suppliers"
                    : "No suppliers recorded"
                }
                message={
                  normalizedSupplierSearch
                    ? "Adjust the supplier search."
                    : "Add the first local supplier to assign medication preferences."
                }
                action={
                  !normalizedSupplierSearch ? (
                    <Button
                      icon={Plus}
                      onClick={() => {
                        setEditingSupplier(null);
                        setShowSupplierForm(true);
                      }}
                    >
                      Add supplier
                    </Button>
                  ) : null
                }
              />
            ) : (
              <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
                {filteredSuppliers.map((supplier) => (
                  <article
                    key={supplier.id}
                    className="rounded-2xl border border-white/80 bg-white/55 p-4 shadow-sm backdrop-blur-xl"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge
                          icon={supplier.is_active ? CheckCircle2 : Archive}
                          tone={supplier.is_active ? "success" : "slate"}
                        >
                          {supplier.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <h3 className="mt-3 text-lg font-bold text-slate-950">
                          {supplier.name}
                        </h3>
                      </div>
                      <Button
                        icon={PencilLine}
                        variant="secondary"
                        onClick={() => {
                          setEditingSupplier(supplier);
                          setShowSupplierForm(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>

                    <dl className="mt-4 grid gap-3 text-sm">
                      <div className="flex items-start gap-3">
                        <UserRound
                          aria-hidden="true"
                          className="mt-0.5 text-slate-400"
                          size={16}
                        />
                        <div>
                          <dt className="micro-label">Contact</dt>
                          <dd className="mt-1 font-semibold text-slate-700">
                            {supplier.contact_name || "Not recorded"}
                          </dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Mail
                          aria-hidden="true"
                          className="mt-0.5 text-slate-400"
                          size={16}
                        />
                        <div className="min-w-0">
                          <dt className="micro-label">Email</dt>
                          <dd className="mt-1 truncate font-semibold text-slate-700">
                            {supplier.email || "Not recorded"}
                          </dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Phone
                          aria-hidden="true"
                          className="mt-0.5 text-slate-400"
                          size={16}
                        />
                        <div>
                          <dt className="micro-label">Phone</dt>
                          <dd className="mt-1 font-semibold text-slate-700">
                            {supplier.phone || "Not recorded"}
                          </dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Clock3
                          aria-hidden="true"
                          className="mt-0.5 text-slate-400"
                          size={16}
                        />
                        <div>
                          <dt className="micro-label">Planning profile</dt>
                          <dd className="mt-1 font-semibold text-slate-700">
                            {supplier.lead_time_days} day
                            {supplier.lead_time_days === 1 ? "" : "s"} lead time ·{" "}
                            {supplier.preferred_medication_count} preferred
                            medicine
                            {supplier.preferred_medication_count === 1 ? "" : "s"}
                          </dd>
                        </div>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </MainLayout>
  );
}

export default Ordering;
