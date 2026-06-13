import { useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Clock3,
  PackageCheck,
  PackageOpen,
  Plus,
  RotateCw,
  ShieldAlert,
  Truck,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import Badge from "../components/Badge";
import Button from "../components/Button";
import ClinicalMetric from "../components/ClinicalMetric";
import PageHeader from "../components/Header";
import ListToolbar from "../components/ListToolbar";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { Panel, PanelHeader } from "../components/Panel";
import SearchField from "../components/SearchField";
import TableShell from "../components/TableShell";
import useApiResource from "../hooks/useApiResource";
import useAuth from "../hooks/useAuth";
import useToast from "../hooks/useToast";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";
import {
  canActionDeliveries,
  canManageDeliveries,
} from "../utils/access";

const statuses = [
  ["PLANNED", "Planned"],
  ["READY", "Ready"],
  ["OUT_FOR_DELIVERY", "Out for delivery"],
  ["DELIVERED", "Delivered"],
  ["FAILED", "Delivery failed"],
  ["CANCELLED", "Cancelled"],
];

const windows = [
  ["ANYTIME", "Any time"],
  ["MORNING", "Morning"],
  ["AFTERNOON", "Afternoon"],
  ["EVENING", "Evening"],
];

const statusConfig = {
  PLANNED: { icon: Clock3, tone: "slate" },
  READY: { icon: PackageOpen, tone: "blue" },
  OUT_FOR_DELIVERY: { icon: Truck, tone: "warning" },
  DELIVERED: { icon: CheckCircle2, tone: "success" },
  FAILED: { icon: ShieldAlert, tone: "danger" },
  CANCELLED: { icon: Ban, tone: "slate" },
};

const emptySummary = {
  total_visible: 0,
  planned: 0,
  ready: 0,
  out_for_delivery: 0,
  delivered_today: 0,
  overdue: 0,
  unassigned: 0,
};

function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000
  );
  return localDate.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function readDeliveryError(error) {
  const data = error.response?.data;

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (data && typeof data === "object") {
    const firstMessage = Object.values(data).flat()[0];
    if (firstMessage) return String(firstMessage);
  }

  return "The delivery action could not be completed. Check the connection and try again.";
}

function DeliveryStatusBadge({ delivery }) {
  const config = statusConfig[delivery.status];

  return (
    <Badge icon={config?.icon} tone={config?.tone || "slate"}>
      {delivery.status_label}
    </Badge>
  );
}

function DeliveryForm({ assignees, onCancel, onSaved, patients }) {
  const toast = useToast();
  const [form, setForm] = useState({
    patient: "",
    scheduled_date: tomorrowDate(),
    delivery_window: "ANYTIME",
    assigned_user: "",
    instructions: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await api.post("/local-deliveries/", {
        ...form,
        patient: Number(form.patient),
        assigned_user: form.assigned_user
          ? Number(form.assigned_user)
          : null,
        instructions: form.instructions.trim(),
      });
      toast.success(
        "Local delivery scheduled",
        "The delivery is now available to authorised patient-care staff."
      );
      await onSaved();
      onCancel();
    } catch (requestError) {
      setError(readDeliveryError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel className="mb-6 overflow-hidden border-blue-200/70">
      <PanelHeader
        eyebrow="Patient-care workflow"
        icon={Plus}
        title="Schedule local delivery"
        description="Create an internal tracking record. No route, courier, address lookup or external service is used."
        action={
          <button
            type="button"
            aria-label="Close delivery form"
            className="glass-icon-button"
            onClick={onCancel}
          >
            <X aria-hidden="true" size={18} />
          </button>
        }
      />

      <form
        className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2"
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div>
          <label
            className="text-sm font-bold text-slate-700"
            htmlFor="delivery-patient"
          >
            Patient
          </label>
          <select
            id="delivery-patient"
            required
            className="field-control mt-2"
            value={form.patient}
            onChange={updateField("patient")}
          >
            <option value="">Select a patient</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.first_name} {patient.last_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="text-sm font-bold text-slate-700"
            htmlFor="delivery-assignee"
          >
            Assigned staff member
          </label>
          <select
            id="delivery-assignee"
            className="field-control mt-2"
            value={form.assigned_user}
            onChange={updateField("assigned_user")}
          >
            <option value="">Unassigned patient-care team</option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.display_name} - {assignee.roles.join(", ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="text-sm font-bold text-slate-700"
            htmlFor="delivery-date"
          >
            Scheduled date
          </label>
          <input
            id="delivery-date"
            required
            type="date"
            className="field-control mt-2"
            value={form.scheduled_date}
            onChange={updateField("scheduled_date")}
          />
        </div>

        <div>
          <label
            className="text-sm font-bold text-slate-700"
            htmlFor="delivery-window"
          >
            Delivery window
          </label>
          <select
            id="delivery-window"
            className="field-control mt-2"
            value={form.delivery_window}
            onChange={updateField("delivery_window")}
          >
            {windows.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label
            className="text-sm font-bold text-slate-700"
            htmlFor="delivery-instructions"
          >
            Internal handover instructions
          </label>
          <textarea
            id="delivery-instructions"
            rows="3"
            maxLength="1000"
            className="field-control mt-2 resize-y"
            placeholder="Optional local instructions. Avoid unnecessary sensitive detail."
            value={form.instructions}
            onChange={updateField("instructions")}
          />
        </div>

        {error && (
          <p
            className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm font-semibold text-rose-800 lg:col-span-2"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3 lg:col-span-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={!form.patient || !form.scheduled_date}
            loading={isSubmitting}
            type="submit"
          >
            Schedule delivery
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function DeliveryOutcomeForm({ delivery, mode, onCancel, onSaved }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isFailure = mode === "fail";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await api.post(`/local-deliveries/${delivery.id}/${mode}/`, {
        reason: reason.trim(),
      });
      toast.success(
        isFailure ? "Delivery outcome recorded" : "Delivery cancelled",
        isFailure
          ? "The unsuccessful attempt and reason are now recorded."
          : "The delivery was cancelled with an accountable reason."
      );
      await onSaved();
      onCancel();
    } catch (requestError) {
      setError(readDeliveryError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel className="mb-6 overflow-hidden border-rose-200/70">
      <PanelHeader
        eyebrow="Outcome control"
        icon={isFailure ? ShieldAlert : Ban}
        title={
          isFailure
            ? `Record failed delivery for ${delivery.patient_display}`
            : `Cancel delivery for ${delivery.patient_display}`
        }
        description="A reason is mandatory and retained as part of the local operational record."
        action={
          <button
            type="button"
            aria-label="Close delivery outcome form"
            className="glass-icon-button"
            onClick={onCancel}
          >
            <X aria-hidden="true" size={18} />
          </button>
        }
      />

      <form className="p-5 sm:p-6" onSubmit={handleSubmit}>
        <label
          className="text-sm font-bold text-slate-700"
          htmlFor="delivery-outcome-reason"
        >
          {isFailure ? "Failure reason" : "Cancellation reason"}
        </label>
        <textarea
          id="delivery-outcome-reason"
          required
          rows="3"
          maxLength="1000"
          className="field-control mt-2 resize-y"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />

        {error && (
          <p
            className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm font-semibold text-rose-800"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Keep delivery
          </Button>
          <Button
            disabled={!reason.trim()}
            loading={isSubmitting}
            type="submit"
            variant="danger"
          >
            {isFailure ? "Record failed attempt" : "Cancel delivery"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Deliveries() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = canManageDeliveries(user);
  const canAction = canActionDeliveries(user);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [pendingAction, setPendingAction] = useState("");

  const deliveryPath = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: "50",
    });
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (assignmentFilter) params.set("assigned", assignmentFilter);
    return `/local-deliveries/?${params.toString()}`;
  }, [assignmentFilter, page, searchQuery, statusFilter]);

  const {
    data: deliveryData,
    error: deliveryError,
    isLoading,
    isReloading,
    reload: reloadDeliveries,
  } = useApiResource(
    deliveryPath,
    "Local deliveries could not be retrieved.",
    { count: 0, next: null, previous: null, results: [] }
  );
  const {
    data: summary,
    reload: reloadSummary,
  } = useApiResource(
    "/local-deliveries/summary/",
    "Delivery summary could not be retrieved.",
    emptySummary
  );
  const { data: patients } = useApiResource(
    canManage ? "/patients/" : "",
    "Patients could not be retrieved."
  );
  const { data: assignees } = useApiResource(
    canManage ? "/local-deliveries/assignees/" : "",
    "Delivery assignees could not be retrieved."
  );

  const deliveries = deliveryData?.results || [];
  const totalDeliveries = deliveryData?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalDeliveries / 50));

  const reloadAll = async () => {
    await Promise.allSettled([reloadDeliveries(), reloadSummary()]);
  };

  const updateFilter = (setter) => (value) => {
    setPage(1);
    setter(value);
  };

  const performAction = async (delivery, action) => {
    const actionKey = `${delivery.id}-${action}`;
    setPendingAction(actionKey);

    try {
      await api.post(`/local-deliveries/${delivery.id}/${action}/`, {});
      toast.success(
        "Delivery updated",
        "The local delivery lifecycle and audit history are now current."
      );
      await reloadAll();
    } catch (requestError) {
      toast.error("Delivery action failed", readDeliveryError(requestError));
    } finally {
      setPendingAction("");
    }
  };

  const deliveryActions = (delivery) => {
    if (!canAction) return null;

    const assignedToUser = delivery.assigned_user === user?.id;
    const canActOnAssigned = assignedToUser || canManage;
    const isOpen = !["DELIVERED", "FAILED", "CANCELLED"].includes(
      delivery.status
    );

    return (
      <div className="flex flex-wrap gap-2">
        {["PLANNED", "READY"].includes(delivery.status)
          && !delivery.assigned_user && (
            <Button
              icon={UserPlus}
              loading={pendingAction === `${delivery.id}-claim`}
              variant="secondary"
              onClick={() => performAction(delivery, "claim")}
            >
              Claim
            </Button>
          )}
        {delivery.status === "PLANNED"
          && delivery.assigned_user
          && canActOnAssigned && (
            <Button
              icon={PackageOpen}
              loading={pendingAction === `${delivery.id}-ready`}
              onClick={() => performAction(delivery, "ready")}
            >
              Mark ready
            </Button>
          )}
        {delivery.status === "READY"
          && delivery.assigned_user
          && canActOnAssigned && (
            <Button
              icon={Truck}
              loading={pendingAction === `${delivery.id}-dispatch`}
              onClick={() => performAction(delivery, "dispatch")}
            >
              Send out
            </Button>
          )}
        {delivery.status === "OUT_FOR_DELIVERY" && canActOnAssigned && (
          <>
            <Button
              icon={CheckCircle2}
              loading={pendingAction === `${delivery.id}-deliver`}
              onClick={() => performAction(delivery, "deliver")}
            >
              Delivered
            </Button>
            <Button
              icon={ShieldAlert}
              variant="danger"
              onClick={() => setOutcome({ delivery, mode: "fail" })}
            >
              Could not deliver
            </Button>
          </>
        )}
        {canManage && isOpen && (
          <Button
            icon={Ban}
            variant="secondary"
            onClick={() => setOutcome({ delivery, mode: "cancel" })}
          >
            Cancel
          </Button>
        )}
      </div>
    );
  };

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Local patient-care coordination"
        icon={PackageCheck}
        title="Local deliveries"
        description="Track internal patient deliveries from planning to outcome without external courier, route or public-service integration."
        actions={
          <>
            {canManage && (
              <Button icon={Plus} onClick={() => setShowForm(true)}>
                Schedule delivery
              </Button>
            )}
            <Button
              icon={RotateCw}
              loading={isReloading}
              variant="secondary"
              onClick={reloadAll}
            >
              Refresh deliveries
            </Button>
          </>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ClinicalMetric
          icon={Clock3}
          label="Planned"
          tone="neutral"
          value={summary?.planned || 0}
          description={`${summary?.unassigned || 0} unassigned`}
        />
        <ClinicalMetric
          icon={PackageOpen}
          label="Ready"
          tone="info"
          value={summary?.ready || 0}
          description="Prepared for handover"
        />
        <ClinicalMetric
          icon={Truck}
          label="Out now"
          tone="attention"
          value={summary?.out_for_delivery || 0}
          description={`${summary?.overdue || 0} overdue`}
        />
        <ClinicalMetric
          icon={CheckCircle2}
          label="Delivered today"
          tone="ready"
          value={summary?.delivered_today || 0}
          description="Completed local records"
        />
      </section>

      {showForm && canManage && (
        <DeliveryForm
          assignees={assignees}
          patients={patients}
          onCancel={() => setShowForm(false)}
          onSaved={reloadAll}
        />
      )}

      {outcome && (
        <DeliveryOutcomeForm
          delivery={outcome.delivery}
          mode={outcome.mode}
          onCancel={() => setOutcome(null)}
          onSaved={reloadAll}
        />
      )}

      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow="Internal delivery register"
          icon={PackageCheck}
          title="Patient delivery workflow"
          description="Status, assignment and outcome remain visible without exposing information to inventory-only roles."
        />

        <ListToolbar
          shown={!isLoading && !deliveryError ? deliveries.length : null}
          total={!isLoading && !deliveryError ? totalDeliveries : null}
          unit="deliveries on this page"
          filters={
            <div className="grid gap-3 sm:grid-cols-2 xl:flex">
              <label className="sr-only" htmlFor="delivery-status-filter">
                Filter by delivery status
              </label>
              <select
                id="delivery-status-filter"
                className="field-control min-w-44 font-semibold"
                value={statusFilter}
                onChange={(event) =>
                  updateFilter(setStatusFilter)(event.target.value)
                }
              >
                <option value="">All statuses</option>
                {statuses.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <label className="sr-only" htmlFor="delivery-assigned-filter">
                Filter by delivery assignment
              </label>
              <select
                id="delivery-assigned-filter"
                className="field-control min-w-44 font-semibold"
                value={assignmentFilter}
                onChange={(event) =>
                  updateFilter(setAssignmentFilter)(event.target.value)
                }
              >
                <option value="">All assignments</option>
                <option value="me">Assigned to me</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
          }
        >
          <SearchField
            label="Search local deliveries"
            placeholder="Search patient, assignee or instructions..."
            value={searchQuery}
            onChange={(value) => {
              setPage(1);
              setSearchQuery(value);
            }}
          />
        </ListToolbar>

        {isLoading ? (
          <LoadingState label="Loading local deliveries..." />
        ) : deliveryError ? (
          <ErrorState message={deliveryError} onRetry={reloadAll} />
        ) : deliveries.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="No matching local deliveries"
            message="Adjust the filters or schedule a local patient delivery."
            action={
              canManage ? (
                <Button icon={Plus} onClick={() => setShowForm(true)}>
                  Schedule first delivery
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <TableShell
                label="Local patient deliveries"
                minWidth="1120px"
              >
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">Schedule</th>
                    <th scope="col">Status</th>
                    <th scope="col">Assignment</th>
                    <th scope="col">Internal detail</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id}>
                      <td>
                        <p className="font-black text-slate-950">
                          {delivery.patient_display}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Local record #{delivery.id}
                        </p>
                      </td>
                      <td>
                        <p className="font-bold text-slate-800">
                          {formatDate(delivery.scheduled_date)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {delivery.delivery_window_label}
                        </p>
                        {delivery.is_overdue && (
                          <Badge className="mt-2" tone="danger">
                            Overdue
                          </Badge>
                        )}
                      </td>
                      <td>
                        <DeliveryStatusBadge delivery={delivery} />
                      </td>
                      <td>
                        <p className="flex items-center gap-2 font-bold text-slate-700">
                          <UserRound
                            aria-hidden="true"
                            size={15}
                            className="text-slate-400"
                          />
                          {delivery.assigned_user_display}
                        </p>
                      </td>
                      <td className="max-w-xs">
                        <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                          {delivery.instructions || "No internal instructions"}
                        </p>
                        {delivery.outcome_notes && (
                          <p className="mt-2 line-clamp-2 text-xs font-semibold text-rose-700">
                            Outcome: {delivery.outcome_notes}
                          </p>
                        )}
                      </td>
                      <td>{deliveryActions(delivery)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>

            <div className="grid gap-4 p-4 lg:hidden">
              {deliveries.map((delivery) => (
                <article
                  key={delivery.id}
                  className="rounded-3xl border border-white/80 bg-white/55 p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.13em] text-blue-700">
                        {delivery.delivery_window_label}
                      </p>
                      <h2 className="mt-1 text-lg font-black text-slate-950">
                        {delivery.patient_display}
                      </h2>
                    </div>
                    <DeliveryStatusBadge delivery={delivery} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/70 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Date
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-800">
                        {formatDate(delivery.scheduled_date)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/70 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Assigned
                      </p>
                      <p className="mt-1 truncate text-sm font-bold text-slate-800">
                        {delivery.assigned_user_display}
                      </p>
                    </div>
                  </div>

                  {delivery.is_overdue && (
                    <Badge className="mt-4" tone="danger">
                      Overdue delivery
                    </Badge>
                  )}

                  {(delivery.instructions || delivery.outcome_notes) && (
                    <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/55 p-4">
                      {delivery.instructions && (
                        <p className="text-sm leading-6 text-slate-600">
                          {delivery.instructions}
                        </p>
                      )}
                      {delivery.outcome_notes && (
                        <p className="mt-2 text-sm font-semibold text-rose-700">
                          Outcome: {delivery.outcome_notes}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-4">{deliveryActions(delivery)}</div>
                </article>
              ))}
            </div>

            <nav
              className="flex flex-col gap-3 border-t border-white/75 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              aria-label="Local delivery pagination"
            >
              <p className="text-sm font-semibold text-slate-500">
                Page {page} of {totalPages} - {totalDeliveries} total deliveries
              </p>
              <div className="flex gap-3">
                <Button
                  disabled={!deliveryData.previous}
                  variant="secondary"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  disabled={!deliveryData.next}
                  variant="secondary"
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </nav>
          </>
        )}
      </Panel>
    </MainLayout>
  );
}

export default Deliveries;
