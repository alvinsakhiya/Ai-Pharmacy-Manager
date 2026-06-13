import { useMemo, useState } from "react";
import {
  AlarmClock,
  Ban,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  DoorOpen,
  ListTodo,
  PencilLine,
  PlayCircle,
  Plus,
  RotateCw,
  ShieldAlert,
  Store,
  UserPlus,
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
import ListToolbar from "../components/ListToolbar";
import TableShell from "../components/TableShell";
import useApiResource from "../hooks/useApiResource";
import useAuth from "../hooks/useAuth";
import useToast from "../hooks/useToast";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";
import {
  canActionOperationalTasks,
  canManageOperations,
} from "../utils/access";

const priorities = [
  ["LOW", "Low"],
  ["MEDIUM", "Medium"],
  ["HIGH", "High"],
  ["CRITICAL", "Critical"],
];

const categories = [
  ["GENERAL", "General operations"],
  ["STOCK", "Stock"],
  ["DOSETTE", "Dosette"],
  ["DELIVERY", "Delivery"],
  ["GOVERNANCE", "Governance"],
];

const statuses = [
  ["TODO", "To do"],
  ["IN_PROGRESS", "In progress"],
  ["COMPLETED", "Completed"],
  ["CANCELLED", "Cancelled"],
];

const days = [
  [0, "Monday"],
  [1, "Tuesday"],
  [2, "Wednesday"],
  [3, "Thursday"],
  [4, "Friday"],
  [5, "Saturday"],
  [6, "Sunday"],
];

const priorityConfig = {
  LOW: { icon: Clock3, tone: "slate" },
  MEDIUM: { icon: CircleAlert, tone: "blue" },
  HIGH: { icon: AlarmClock, tone: "warning" },
  CRITICAL: { icon: ShieldAlert, tone: "danger" },
};

const statusConfig = {
  TODO: { icon: ListTodo, tone: "purple" },
  IN_PROGRESS: { icon: PlayCircle, tone: "blue" },
  COMPLETED: { icon: CheckCircle2, tone: "success" },
  CANCELLED: { icon: Ban, tone: "slate" },
};

const emptySummary = {
  total_visible: 0,
  to_do: 0,
  in_progress: 0,
  completed: 0,
  critical: 0,
  overdue: 0,
  unassigned: 0,
};

function formatTimestamp(value) {
  if (!value) return "Not scheduled";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function readOperationsError(error) {
  const data = error.response?.data;

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (data && typeof data === "object") {
    const firstMessage = Object.values(data).flat()[0];
    if (firstMessage) return String(firstMessage);
  }

  return "The operations action could not be completed. Check the connection and try again.";
}

function TaskBadge({ task, type }) {
  const isPriority = type === "priority";
  const value = isPriority ? task.priority : task.status;
  const label = isPriority ? task.priority_label : task.status_label;
  const config = (isPriority ? priorityConfig : statusConfig)[value];

  return (
    <Badge icon={config?.icon} tone={config?.tone || "slate"}>
      {label}
    </Badge>
  );
}

function TaskForm({ assignees, onCancel, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "GENERAL",
    priority: "MEDIUM",
    assigned_user: "",
    due_at: "",
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
      await api.post("/operational-tasks/", {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        assigned_user: form.assigned_user
          ? Number(form.assigned_user)
          : null,
        due_at: form.due_at
          ? new Date(form.due_at).toISOString()
          : null,
      });
      toast.success(
        "Operational task created",
        "The task is now visible to the selected staff member or authorised team."
      );
      await onSaved();
      onCancel();
    } catch (requestError) {
      setError(readOperationsError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel className="mb-6 overflow-hidden border-blue-200/70">
      <PanelHeader
        eyebrow="Manager workflow"
        icon={Plus}
        title="Create operational task"
        description="Assign local work with a clear priority, category and due time. No external task service is used."
        action={
          <button
            type="button"
            aria-label="Close task form"
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
          <label className="text-sm font-bold text-slate-700" htmlFor="task-title">
            Task title
          </label>
          <input
            id="task-title"
            required
            maxLength={200}
            className="field-control mt-2"
            placeholder="For example: Complete end-of-day stock review"
            value={form.title}
            onChange={updateField("title")}
          />
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="task-assignee">
            Assigned staff member
          </label>
          <select
            id="task-assignee"
            className="field-control mt-2"
            value={form.assigned_user}
            onChange={updateField("assigned_user")}
          >
            <option value="">Unassigned team task</option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.display_name} · {assignee.roles.join(", ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="task-category">
            Category
          </label>
          <select
            id="task-category"
            className="field-control mt-2"
            value={form.category}
            onChange={updateField("category")}
          >
            {categories.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="task-priority">
            Priority
          </label>
          <select
            id="task-priority"
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
          <label className="text-sm font-bold text-slate-700" htmlFor="task-due-at">
            Due date and time
          </label>
          <input
            id="task-due-at"
            type="datetime-local"
            className="field-control mt-2"
            value={form.due_at}
            onChange={updateField("due_at")}
          />
        </div>

        <div className="lg:col-span-2">
          <label className="text-sm font-bold text-slate-700" htmlFor="task-description">
            Description
          </label>
          <textarea
            id="task-description"
            maxLength={3000}
            rows={4}
            className="field-control mt-2 resize-y"
            value={form.description}
            onChange={updateField("description")}
          />
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
            icon={Plus}
            loading={isSubmitting}
            disabled={!form.title.trim()}
          >
            Create task
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function CancellationForm({ task, onCancel, onSaved }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await api.post(`/operational-tasks/${task.id}/cancel/`, {
        reason: reason.trim(),
      });
      toast.success(
        "Task cancelled",
        "The reason and lifecycle change are retained for operational review."
      );
      await onSaved();
      onCancel();
    } catch (requestError) {
      setError(readOperationsError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel className="mb-6 overflow-hidden border-rose-200/70">
      <PanelHeader
        eyebrow="Manager cancellation"
        icon={Ban}
        title={`Cancel ${task.title}`}
        description="Provide a concise reason. Cancelled tasks become read-only."
        action={
          <button
            type="button"
            aria-label="Close cancellation form"
            className="glass-icon-button"
            onClick={onCancel}
          >
            <X aria-hidden="true" size={18} />
          </button>
        }
      />
      <form className="p-5 sm:p-6" onSubmit={handleSubmit}>
        <label className="text-sm font-bold text-slate-700" htmlFor="task-cancel-reason">
          Cancellation reason
        </label>
        <textarea
          id="task-cancel-reason"
          required
          maxLength={500}
          rows={3}
          className="field-control mt-2 resize-y"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {error && (
          <p
            className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Keep task
          </Button>
          <Button
            type="submit"
            icon={Ban}
            loading={isSubmitting}
            disabled={!reason.trim()}
            variant="danger"
          >
            Cancel task
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function OpeningHourEditor({ openingHour, day, onCancel, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    opening_time: openingHour?.opening_time?.slice(0, 5) || "09:00",
    closing_time: openingHour?.closing_time?.slice(0, 5) || "17:00",
    is_closed: openingHour?.is_closed || false,
    notes: openingHour?.notes || "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      day_of_week: day[0],
      opening_time: form.is_closed ? null : form.opening_time,
      closing_time: form.is_closed ? null : form.closing_time,
      is_closed: form.is_closed,
      notes: form.notes.trim(),
    };

    try {
      if (openingHour) {
        await api.patch(`/opening-hours/${openingHour.id}/`, payload);
      } else {
        await api.post("/opening-hours/", payload);
      }
      toast.success(
        "Opening hours updated",
        `${day[1]} is now configured in the local pharmacy workspace.`
      );
      await onSaved();
      onCancel();
    } catch (requestError) {
      setError(readOperationsError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel className="mb-6 overflow-hidden border-blue-200/70">
      <PanelHeader
        eyebrow="Manager configuration"
        icon={DoorOpen}
        title={`Configure ${day[1]}`}
        description="Maintain local display hours only. This does not publish to an external directory."
        action={
          <button
            type="button"
            aria-label="Close opening hours form"
            className="glass-icon-button"
            onClick={onCancel}
          >
            <X aria-hidden="true" size={18} />
          </button>
        }
      />
      <form
        className="grid gap-5 p-5 sm:p-6 lg:grid-cols-3"
        onSubmit={handleSubmit}
      >
        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="opening-time">
            Opening time
          </label>
          <input
            id="opening-time"
            type="time"
            required={!form.is_closed}
            disabled={form.is_closed}
            className="field-control mt-2"
            value={form.opening_time}
            onChange={updateField("opening_time")}
          />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="closing-time">
            Closing time
          </label>
          <input
            id="closing-time"
            type="time"
            required={!form.is_closed}
            disabled={form.is_closed}
            className="field-control mt-2"
            value={form.closing_time}
            onChange={updateField("closing_time")}
          />
        </div>
        <label className="flex items-center gap-3 self-end rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            checked={form.is_closed}
            onChange={updateField("is_closed")}
          />
          Closed all day
        </label>
        <div className="lg:col-span-3">
          <label className="text-sm font-bold text-slate-700" htmlFor="opening-notes">
            Notes
          </label>
          <input
            id="opening-notes"
            maxLength={250}
            className="field-control mt-2"
            placeholder="Optional local note"
            value={form.notes}
            onChange={updateField("notes")}
          />
        </div>
        {error && (
          <p
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 lg:col-span-3"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3 lg:col-span-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" icon={DoorOpen} loading={isSubmitting}>
            Save opening hours
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Operations() {
  const { user } = useAuth();
  const toast = useToast();
  const isManager = canManageOperations(user);
  const canUseTaskActions = canActionOperationalTasks(user);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [cancelTask, setCancelTask] = useState(null);
  const [editingHour, setEditingHour] = useState(null);
  const [pendingAction, setPendingAction] = useState("");

  const taskPath = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: "50",
    });
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    return `/operational-tasks/?${params.toString()}`;
  }, [categoryFilter, page, priorityFilter, searchQuery, statusFilter]);

  const {
    data: taskData,
    error: taskError,
    isLoading: tasksLoading,
    isReloading: tasksReloading,
    reload: reloadTasks,
  } = useApiResource(
    taskPath,
    "Operational tasks could not be retrieved.",
    { count: 0, next: null, previous: null, results: [] }
  );
  const {
    data: summary,
    reload: reloadSummary,
  } = useApiResource(
    "/operational-tasks/summary/",
    "Operational task summary could not be retrieved.",
    emptySummary
  );
  const {
    data: openingHours,
    error: hoursError,
    isLoading: hoursLoading,
    reload: reloadHours,
  } = useApiResource(
    "/opening-hours/",
    "Opening hours could not be retrieved."
  );
  const {
    data: assignees,
  } = useApiResource(
    isManager ? "/operational-tasks/assignees/" : "",
    "Task assignees could not be retrieved."
  );

  const tasks = taskData?.results || [];
  const totalTasks = taskData?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalTasks / 50));

  const reloadAll = async () => {
    await Promise.allSettled([
      reloadTasks(),
      reloadSummary(),
      reloadHours(),
    ]);
  };

  const changeFilter = (setter) => (value) => {
    setPage(1);
    setter(value);
  };

  const performTaskAction = async (task, action) => {
    const actionKey = `${task.id}-${action}`;
    setPendingAction(actionKey);

    try {
      await api.post(`/operational-tasks/${task.id}/${action}/`, {});
      toast.success(
        "Task updated",
        `The task lifecycle is now ${action === "claim" ? "assigned" : action.replace("_", " ")}.`
      );
      await reloadAll();
    } catch (requestError) {
      toast.error("Task action failed", readOperationsError(requestError));
    } finally {
      setPendingAction("");
    }
  };

  const taskActions = (task) => {
    if (!canUseTaskActions) return null;

    const isAssignedToUser = task.assigned_user === user?.id;
    const managerCanAct = isManager;

    return (
      <div className="flex flex-wrap gap-2">
        {task.status === "TODO" && !task.assigned_user && (
          <Button
            icon={UserPlus}
            loading={pendingAction === `${task.id}-claim`}
            variant="secondary"
            onClick={() => performTaskAction(task, "claim")}
          >
            Claim
          </Button>
        )}
        {task.status === "TODO"
          && task.assigned_user
          && (isAssignedToUser || managerCanAct) && (
            <Button
              icon={PlayCircle}
              loading={pendingAction === `${task.id}-start`}
              onClick={() => performTaskAction(task, "start")}
            >
              Start
            </Button>
          )}
        {task.status === "IN_PROGRESS"
          && (isAssignedToUser || managerCanAct) && (
            <Button
              icon={CheckCircle2}
              loading={pendingAction === `${task.id}-complete`}
              onClick={() => performTaskAction(task, "complete")}
            >
              Complete
            </Button>
          )}
        {isManager
          && !["COMPLETED", "CANCELLED"].includes(task.status) && (
            <Button
              icon={Ban}
              variant="danger"
              onClick={() => setCancelTask(task)}
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
        eyebrow="Local pharmacy coordination"
        title="Operations workspace"
        description="Coordinate internal pharmacy tasks and maintain local opening hours without external workflow integrations."
        icon={ListTodo}
        actions={
          <>
            {isManager && (
              <Button icon={Plus} onClick={() => setShowTaskForm(true)}>
                New task
              </Button>
            )}
            <Button
              icon={RotateCw}
              loading={tasksReloading}
              variant="secondary"
              onClick={reloadAll}
            >
              Refresh operations
            </Button>
          </>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ClinicalMetric
          icon={ListTodo}
          label="To do"
          tone="info"
          value={summary?.to_do || 0}
          description={`${summary?.unassigned || 0} unassigned`}
        />
        <ClinicalMetric
          icon={PlayCircle}
          label="In progress"
          tone="attention"
          value={summary?.in_progress || 0}
          description="Active staff work"
        />
        <ClinicalMetric
          icon={ShieldAlert}
          label="Critical"
          tone={(summary?.critical || 0) > 0 ? "critical" : "ready"}
          value={summary?.critical || 0}
          description={`${summary?.overdue || 0} overdue`}
        />
        <ClinicalMetric
          icon={CheckCircle2}
          label="Completed"
          tone="ready"
          value={summary?.completed || 0}
          description="Visible completed tasks"
        />
      </section>

      {showTaskForm && isManager && (
        <TaskForm
          assignees={assignees}
          onCancel={() => setShowTaskForm(false)}
          onSaved={reloadAll}
        />
      )}

      {cancelTask && (
        <CancellationForm
          task={cancelTask}
          onCancel={() => setCancelTask(null)}
          onSaved={reloadAll}
        />
      )}

      {editingHour && (
        <OpeningHourEditor
          key={editingHour.day[0]}
          day={editingHour.day}
          openingHour={editingHour.openingHour}
          onCancel={() => setEditingHour(null)}
          onSaved={reloadHours}
        />
      )}

      <Panel className="mb-6 overflow-hidden">
        <PanelHeader
          eyebrow="Local configuration"
          icon={Store}
          title="Pharmacy opening hours"
          description="A simple weekly reference for staff. Only Managers can change this local configuration."
        />

        {hoursLoading ? (
          <LoadingState label="Loading opening hours..." />
        ) : hoursError ? (
          <ErrorState message={hoursError} onRetry={reloadHours} />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4 xl:grid-cols-7">
            {days.map((day) => {
              const openingHour = openingHours.find(
                (item) => item.day_of_week === day[0]
              );
              return (
                <article
                  key={day[0]}
                  className="rounded-2xl border border-white/80 bg-white/48 p-4 shadow-sm"
                >
                  <p className="text-sm font-black text-slate-950">{day[1]}</p>
                  {openingHour ? (
                    openingHour.is_closed ? (
                      <Badge className="mt-3" icon={DoorOpen} tone="slate">
                        Closed
                      </Badge>
                    ) : (
                      <p className="mt-3 font-black text-blue-800">
                        {openingHour.opening_time?.slice(0, 5)}-
                        {openingHour.closing_time?.slice(0, 5)}
                      </p>
                    )
                  ) : (
                    <p className="mt-3 text-sm font-semibold text-slate-400">
                      Not configured
                    </p>
                  )}
                  {openingHour?.notes && (
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {openingHour.notes}
                    </p>
                  )}
                  {isManager && (
                    <Button
                      className="mt-4 w-full px-3"
                      icon={PencilLine}
                      variant="secondary"
                      onClick={() =>
                        setEditingHour({ day, openingHour })
                      }
                    >
                      Configure
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel className="overflow-hidden">
        <ListToolbar
          shown={!tasksLoading && !taskError ? tasks.length : null}
          total={!tasksLoading && !taskError ? totalTasks : null}
          unit="tasks on this page"
          filters={
            <div className="grid gap-3 sm:grid-cols-3 xl:flex">
              <label className="sr-only" htmlFor="task-status-filter">
                Filter by task status
              </label>
              <select
                id="task-status-filter"
                className="field-control min-w-40 font-semibold"
                value={statusFilter}
                onChange={(event) =>
                  changeFilter(setStatusFilter)(event.target.value)
                }
              >
                <option value="">All statuses</option>
                {statuses.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <label className="sr-only" htmlFor="task-category-filter">
                Filter by task category
              </label>
              <select
                id="task-category-filter"
                className="field-control min-w-44 font-semibold"
                value={categoryFilter}
                onChange={(event) =>
                  changeFilter(setCategoryFilter)(event.target.value)
                }
              >
                <option value="">All categories</option>
                {categories.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <label className="sr-only" htmlFor="task-priority-filter">
                Filter by task priority
              </label>
              <select
                id="task-priority-filter"
                className="field-control min-w-36 font-semibold"
                value={priorityFilter}
                onChange={(event) =>
                  changeFilter(setPriorityFilter)(event.target.value)
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
            id="task-search"
            label="Search operational tasks"
            placeholder="Search task, description or assignee..."
            value={searchQuery}
            onChange={changeFilter(setSearchQuery)}
          />
        </ListToolbar>

        {tasksLoading ? (
          <LoadingState label="Loading operational tasks..." />
        ) : taskError ? (
          <ErrorState message={taskError} onRetry={reloadTasks} />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No matching operational tasks"
            message="Adjust the filters or create a local task for the pharmacy team."
            action={
              isManager ? (
                <Button icon={Plus} onClick={() => setShowTaskForm(true)}>
                  Create first task
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <TableShell
              className="hidden xl:block"
              label="Operational pharmacy tasks"
              minWidth="1320px"
            >
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Category / priority</th>
                  <th>Status</th>
                  <th>Assignment</th>
                  <th>Due</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td className="max-w-lg">
                      <p className="font-bold text-slate-950">{task.title}</p>
                      {task.description && (
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                          {task.description}
                        </p>
                      )}
                    </td>
                    <td>
                      <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">
                        {task.category_label}
                      </p>
                      <TaskBadge task={task} type="priority" />
                    </td>
                    <td>
                      <TaskBadge task={task} type="status" />
                    </td>
                    <td>
                      <p className="flex items-center gap-2 font-bold text-slate-800">
                        <UserRound aria-hidden="true" size={16} />
                        {task.assigned_user_display}
                      </p>
                    </td>
                    <td className="text-sm font-semibold text-slate-600">
                      <p>{formatTimestamp(task.due_at)}</p>
                      {task.is_overdue && (
                        <Badge className="mt-2" tone="danger">
                          Overdue
                        </Badge>
                      )}
                    </td>
                    <td>{taskActions(task)}</td>
                  </tr>
                ))}
              </tbody>
            </TableShell>

            <div className="grid gap-4 p-4 md:grid-cols-2 xl:hidden">
              {tasks.map((task) => (
                <article
                  key={task.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-blue-600">
                        {task.category_label}
                      </p>
                      <h2 className="mt-1 font-bold text-slate-950">
                        {task.title}
                      </h2>
                    </div>
                    <TaskBadge task={task} type="status" />
                  </div>
                  {task.description && (
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {task.description}
                    </p>
                  )}
                  <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-400">Priority</span>
                      <TaskBadge task={task} type="priority" />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-400">Assigned</span>
                      <span className="text-right font-bold text-slate-700">
                        {task.assigned_user_display}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-400">Due</span>
                      <span className="text-right font-bold text-slate-700">
                        {formatTimestamp(task.due_at)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4">{taskActions(task)}</div>
                </article>
              ))}
            </div>

            <nav
              className="flex flex-col gap-3 border-t border-white/75 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              aria-label="Operational task pagination"
            >
              <p className="text-sm font-semibold text-slate-500">
                Page {page} of {totalPages} - {totalTasks} total tasks
              </p>
              <div className="flex gap-3">
                <Button
                  disabled={!taskData.previous}
                  variant="secondary"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  disabled={!taskData.next}
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

export default Operations;
