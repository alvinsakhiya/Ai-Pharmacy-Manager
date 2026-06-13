import { useMemo, useState } from "react";
import {
  AlarmClock,
  BellRing,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  MailOpen,
  Megaphone,
  Plus,
  RotateCw,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import PageHeader from "../components/Header";
import Badge from "../components/Badge";
import Button from "../components/Button";
import ClinicalMetric from "../components/ClinicalMetric";
import SearchField from "../components/SearchField";
import { Panel, PanelHeader } from "../components/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import ListToolbar from "../components/ListToolbar";
import useApiResource from "../hooks/useApiResource";
import useAuth from "../hooks/useAuth";
import useToast from "../hooks/useToast";
import api from "../services/api";
import { canManageNotifications } from "../utils/access";
import { formatDate } from "../utils/helpers";

const priorities = [
  ["LOW", "Low"],
  ["MEDIUM", "Medium"],
  ["HIGH", "High"],
  ["CRITICAL", "Critical"],
];

const statuses = [
  ["NEW", "New"],
  ["READ", "Read"],
  ["ACKNOWLEDGED", "Acknowledged"],
  ["RESOLVED", "Resolved"],
];

const priorityConfig = {
  LOW: { icon: BellRing, tone: "slate" },
  MEDIUM: { icon: CircleAlert, tone: "blue" },
  HIGH: { icon: AlarmClock, tone: "warning" },
  CRITICAL: { icon: ShieldAlert, tone: "danger" },
};

const statusConfig = {
  NEW: { icon: BellRing, tone: "purple" },
  READ: { icon: MailOpen, tone: "blue" },
  ACKNOWLEDGED: { icon: CheckCheck, tone: "warning" },
  RESOLVED: { icon: CheckCircle2, tone: "success" },
};

function formatTimestamp(value) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function readNotificationError(error) {
  const data = error.response?.data;

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (data && typeof data === "object") {
    const firstMessage = Object.values(data).flat()[0];
    if (firstMessage) return String(firstMessage);
  }

  return "The notification action could not be completed. Check the connection and try again.";
}

function NotificationBadge({ notification, kind }) {
  const isPriority = kind === "priority";
  const value = isPriority ? notification.priority : notification.status;
  const label = isPriority
    ? notification.priority_label
    : notification.status_label;
  const config = (isPriority ? priorityConfig : statusConfig)[value];

  return (
    <Badge icon={config?.icon} tone={config?.tone || "slate"}>
      {label}
    </Badge>
  );
}

function NotificationForm({ assignees, onCancel, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: "",
    message: "",
    priority: "MEDIUM",
    assigned_user: "",
    due_date: "",
    expiry_date: "",
    related_entity_type: "",
    related_entity_id: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };
  const datesInvalid = Boolean(
    form.due_date
      && form.expiry_date
      && form.due_date > form.expiry_date
  );
  const hasRelatedType = Boolean(form.related_entity_type.trim());
  const hasRelatedId = Boolean(form.related_entity_id.trim());
  const relationIncomplete = hasRelatedType !== hasRelatedId;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await api.post("/notifications/", {
        ...form,
        title: form.title.trim(),
        message: form.message.trim(),
        assigned_user: form.assigned_user
          ? Number(form.assigned_user)
          : null,
        due_date: form.due_date || null,
        expiry_date: form.expiry_date || null,
        related_entity_type: form.related_entity_type.trim(),
        related_entity_id: form.related_entity_id.trim(),
      });
      toast.success(
        "Notification created",
        "The notification is now available to the selected recipient."
      );
      await onSaved();
      onCancel();
    } catch (requestError) {
      setError(readNotificationError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel className="mb-6 overflow-hidden border-blue-200/70">
      <PanelHeader
        eyebrow="Manager workflow"
        icon={Megaphone}
        title="Create operational notification"
        description="Assign a traceable pharmacy task or publish a read-only notice to all authorised staff."
        action={
          <button
            type="button"
            aria-label="Close notification form"
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
          <label className="text-sm font-bold text-slate-700" htmlFor="notification-title">
            Title
          </label>
          <input
            id="notification-title"
            required
            maxLength={200}
            className="field-control mt-2"
            placeholder="For example: Review critical stock shortage"
            value={form.title}
            onChange={updateField("title")}
          />
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="notification-priority">
            Priority
          </label>
          <select
            id="notification-priority"
            className="field-control mt-2"
            value={form.priority}
            onChange={updateField("priority")}
          >
            {priorities.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="notification-assignee">
            Assigned staff member
          </label>
          <select
            id="notification-assignee"
            className="field-control mt-2"
            value={form.assigned_user}
            onChange={updateField("assigned_user")}
          >
            <option value="">All authorised staff (read-only notice)</option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.display_name} · {assignee.roles.join(", ")}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Only the named recipient or a Manager can progress an assigned
            notification. General notices remain Manager-controlled.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-bold text-slate-700" htmlFor="notification-due">
              Due date
            </label>
            <input
              id="notification-due"
              type="date"
              className="field-control mt-2"
              value={form.due_date}
              onChange={updateField("due_date")}
            />
          </div>
          <div>
            <label className="text-sm font-bold text-slate-700" htmlFor="notification-expiry">
              Expiry date
            </label>
            <input
              id="notification-expiry"
              type="date"
              className="field-control mt-2"
              value={form.expiry_date}
              onChange={updateField("expiry_date")}
            />
          </div>
          {datesInvalid && (
            <p className="text-xs font-semibold text-rose-700 sm:col-span-2" role="alert">
              Expiry date cannot be before the due date.
            </p>
          )}
        </div>

        <div className="lg:col-span-2">
          <label className="text-sm font-bold text-slate-700" htmlFor="notification-message">
            Message
          </label>
          <textarea
            id="notification-message"
            required
            maxLength={3000}
            rows={5}
            className="field-control mt-2 resize-y"
            placeholder="Explain the operational action or information clearly..."
            value={form.message}
            onChange={updateField("message")}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Do not include passwords, tokens, or unnecessary patient-identifiable
            information. {form.message.length} / 3,000
          </p>
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="related-entity-type">
            Related record type
          </label>
          <input
            id="related-entity-type"
            maxLength={100}
            className="field-control mt-2"
            placeholder="Optional, e.g. Medication"
            value={form.related_entity_type}
            onChange={updateField("related_entity_type")}
          />
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="related-entity-id">
            Related record identifier
          </label>
          <input
            id="related-entity-id"
            maxLength={100}
            className="field-control mt-2"
            placeholder="Optional, e.g. 42"
            value={form.related_entity_id}
            onChange={updateField("related_entity_id")}
          />
          {relationIncomplete && (
            <p className="mt-2 text-xs font-semibold text-rose-700" role="alert">
              Record type and identifier must be supplied together.
            </p>
          )}
        </div>

        {error && (
          <div
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 lg:col-span-2"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3 lg:col-span-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            icon={Megaphone}
            loading={isSubmitting}
            disabled={
              !form.title.trim()
              || !form.message.trim()
              || datesInvalid
              || relationIncomplete
            }
          >
            Create notification
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function NotificationActions({
  canAct,
  notification,
  onAction,
  onOpenResolution,
  pendingAction,
}) {
  if (!canAct || notification.status === "RESOLVED") return null;

  return (
    <div className="flex flex-wrap gap-2">
      {notification.status === "NEW" && (
        <Button
          icon={MailOpen}
          loading={pendingAction === "mark-read"}
          variant="secondary"
          onClick={() => onAction(notification, "mark-read")}
        >
          Mark read
        </Button>
      )}
      {["NEW", "READ"].includes(notification.status) && (
        <Button
          icon={CheckCheck}
          loading={pendingAction === "acknowledge"}
          onClick={() => onAction(notification, "acknowledge")}
        >
          Acknowledge
        </Button>
      )}
      {notification.status === "ACKNOWLEDGED" && (
        <Button
          icon={ClipboardCheck}
          onClick={() => onOpenResolution(notification)}
        >
          Resolve
        </Button>
      )}
    </div>
  );
}

function NotificationCenter() {
  const { user } = useAuth();
  const toast = useToast();
  const isManager = canManageNotifications(user);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [resolvingNotification, setResolvingNotification] = useState(null);
  const [resolutionReason, setResolutionReason] = useState("");
  const [actionState, setActionState] = useState("");
  const [actionError, setActionError] = useState("");

  const notificationPath = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: "50",
    });

    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);

    return `/notifications/?${params.toString()}`;
  }, [page, priorityFilter, searchQuery, statusFilter]);

  const {
    data,
    error,
    isLoading,
    isReloading,
    reload,
  } = useApiResource(
    notificationPath,
    "Notifications could not be retrieved. Check the API connection and try again.",
    { count: 0, next: null, previous: null, results: [] }
  );
  const { data: summary, reload: reloadSummary } = useApiResource(
    "/notifications/summary/",
    "",
    null
  );
  const { data: assignees } = useApiResource(
    isManager ? "/notifications/assignees/" : null,
    "",
    []
  );

  const notifications = data?.results || [];
  const totalNotifications = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalNotifications / 50));

  const refreshAll = async () => {
    await Promise.all([reload(), reloadSummary()]);
  };

  const resetPageAndSet = (setter) => (value) => {
    setPage(1);
    setter(value);
  };

  const runLifecycleAction = async (notification, action, payload = {}) => {
    const key = `${notification.id}:${action}`;
    setActionState(key);
    setActionError("");

    try {
      await api.post(`/notifications/${notification.id}/${action}/`, payload);
      toast.success(
        action === "mark-read"
          ? "Notification marked as read"
          : action === "acknowledge"
            ? "Notification acknowledged"
            : "Notification resolved",
        "The lifecycle history has been updated."
      );
      await refreshAll();
      if (action === "resolve") {
        setResolvingNotification(null);
        setResolutionReason("");
      }
    } catch (requestError) {
      setActionError(readNotificationError(requestError));
    } finally {
      setActionState("");
    }
  };

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Operational coordination"
        title="Notification centre"
        description="Review assigned pharmacy actions, acknowledge responsibility and record a clear resolution outcome."
        icon={BellRing}
        actions={
          <>
            {isManager && (
              <Button icon={Plus} onClick={() => setShowCreateForm(true)}>
                New notification
              </Button>
            )}
            <Button
              icon={RotateCw}
              loading={isReloading}
              variant="secondary"
              onClick={refreshAll}
            >
              Refresh inbox
            </Button>
          </>
        }
      />

      {summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <ClinicalMetric
            description="Awaiting first review"
            icon={BellRing}
            label="New"
            tone="info"
            value={summary.new}
          />
          <ClinicalMetric
            description="Still open"
            icon={Clock3}
            label="Unresolved"
            tone="attention"
            value={summary.unresolved}
          />
          <ClinicalMetric
            description="Highest urgency"
            icon={ShieldAlert}
            label="Critical"
            tone="critical"
            value={summary.critical}
          />
          <ClinicalMetric
            description="Past due date"
            icon={AlarmClock}
            label="Overdue"
            tone="critical"
            value={summary.overdue}
          />
        </div>
      )}

      {showCreateForm && isManager && (
        <NotificationForm
          assignees={assignees}
          onCancel={() => setShowCreateForm(false)}
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

      <Panel className="overflow-hidden">
        <ListToolbar
          shown={!isLoading && !error ? notifications.length : null}
          total={!isLoading && !error ? totalNotifications : null}
          unit="notifications on this page"
          filters={
            <div className="grid gap-3 sm:grid-cols-2 lg:flex">
              <label className="sr-only" htmlFor="notification-status-filter">
                Filter by status
              </label>
              <select
                id="notification-status-filter"
                className="field-control min-w-44 font-semibold"
                value={statusFilter}
                onChange={(event) =>
                  resetPageAndSet(setStatusFilter)(event.target.value)
                }
              >
                <option value="">All statuses</option>
                {statuses.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <label className="sr-only" htmlFor="notification-priority-filter">
                Filter by priority
              </label>
              <select
                id="notification-priority-filter"
                className="field-control min-w-44 font-semibold"
                value={priorityFilter}
                onChange={(event) =>
                  resetPageAndSet(setPriorityFilter)(event.target.value)
                }
              >
                <option value="">All priorities</option>
                {priorities.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          <SearchField
            id="notification-search"
            label="Search notifications"
            placeholder="Search title, message, assignee or related record..."
            value={searchQuery}
            onChange={resetPageAndSet(setSearchQuery)}
          />
        </ListToolbar>

        {isLoading ? (
          <LoadingState label="Loading notification inbox..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title="No matching notifications"
            message="Adjust the filters or wait for a Manager to assign a new pharmacy action."
          />
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => {
                const canAct = Boolean(
                  isManager || notification.assigned_user === user?.id
                );
                const pendingAction = actionState.startsWith(
                  `${notification.id}:`
                )
                  ? actionState.split(":")[1]
                  : "";
                const isResolving =
                  resolvingNotification?.id === notification.id;

                return (
                  <article
                    key={notification.id}
                    className={`p-4 sm:p-6 ${
                      notification.is_expired
                        ? "signal-pattern-critical"
                        : notification.is_overdue
                          ? "signal-pattern-attention"
                          : ""
                    }`}
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <NotificationBadge
                            kind="priority"
                            notification={notification}
                          />
                          <NotificationBadge
                            kind="status"
                            notification={notification}
                          />
                          {notification.is_overdue && (
                            <Badge icon={AlarmClock} tone="danger">
                              Overdue
                            </Badge>
                          )}
                          {notification.is_expired && (
                            <Badge icon={CalendarClock} tone="danger">
                              Expired notice
                            </Badge>
                          )}
                        </div>

                        <h2 className="mt-3 text-lg font-bold tracking-tight text-slate-950">
                          {notification.title}
                        </h2>
                        <p className="mt-2 max-w-4xl whitespace-pre-line text-sm leading-6 text-slate-600">
                          {notification.message}
                        </p>

                        <dl className="mt-4 grid gap-3 rounded-2xl bg-slate-50/80 p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <dt className="micro-label">Assigned to</dt>
                            <dd className="mt-1 flex items-center gap-2 font-bold text-slate-800">
                              <UserRound aria-hidden="true" size={15} />
                              {notification.assigned_user_display}
                            </dd>
                          </div>
                          <div>
                            <dt className="micro-label">Due date</dt>
                            <dd className="mt-1 font-bold text-slate-700">
                              {notification.due_date
                                ? formatDate(notification.due_date)
                                : "No due date"}
                            </dd>
                          </div>
                          <div>
                            <dt className="micro-label">Expiry date</dt>
                            <dd className="mt-1 font-bold text-slate-700">
                              {notification.expiry_date
                                ? formatDate(notification.expiry_date)
                                : "No expiry date"}
                            </dd>
                          </div>
                          <div>
                            <dt className="micro-label">Created</dt>
                            <dd className="mt-1 font-bold text-slate-700">
                              {formatTimestamp(notification.created_at)}
                            </dd>
                          </div>
                          {notification.related_entity_type && (
                            <div className="sm:col-span-2">
                              <dt className="micro-label">Related record</dt>
                              <dd className="mt-1 font-mono font-bold text-slate-700">
                                {notification.related_entity_type} #
                                {notification.related_entity_id}
                              </dd>
                            </div>
                          )}
                          {notification.status === "RESOLVED" && (
                            <div className="sm:col-span-2">
                              <dt className="micro-label">Resolution</dt>
                              <dd className="mt-1 leading-6 text-slate-700">
                                {notification.resolution_reason}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      <div className="shrink-0">
                        <NotificationActions
                          canAct={canAct}
                          notification={notification}
                          pendingAction={pendingAction}
                          onAction={runLifecycleAction}
                          onOpenResolution={(item) => {
                            setResolvingNotification(item);
                            setResolutionReason("");
                            setActionError("");
                          }}
                        />
                      </div>
                    </div>

                    {isResolving && (
                      <form
                        className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5"
                        onSubmit={(event) => {
                          event.preventDefault();
                          runLifecycleAction(notification, "resolve", {
                            resolution_reason: resolutionReason.trim(),
                          });
                        }}
                      >
                        <label
                          className="text-sm font-bold text-slate-800"
                          htmlFor={`resolution-${notification.id}`}
                        >
                          Resolution reason
                        </label>
                        <textarea
                          id={`resolution-${notification.id}`}
                          required
                          maxLength={500}
                          rows={3}
                          className="field-control mt-2 resize-y"
                          placeholder="Explain what action completed this notification..."
                          value={resolutionReason}
                          onChange={(event) =>
                            setResolutionReason(event.target.value)
                          }
                        />
                        <div className="mt-3 flex flex-wrap justify-end gap-3">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setResolvingNotification(null);
                              setResolutionReason("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            icon={CheckCircle2}
                            loading={pendingAction === "resolve"}
                            disabled={!resolutionReason.trim()}
                          >
                            Confirm resolution
                          </Button>
                        </div>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>

            <nav
              className="flex flex-col gap-3 border-t border-white/75 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              aria-label="Notification pagination"
            >
              <p className="text-sm font-semibold text-slate-500">
                Page {page} of {totalPages} · {totalNotifications} total
                notifications
              </p>
              <div className="flex gap-3">
                <Button
                  disabled={!data.previous}
                  variant="secondary"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  disabled={!data.next}
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

export default NotificationCenter;
