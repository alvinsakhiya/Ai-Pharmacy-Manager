import { useMemo, useState } from "react";
import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Plus,
  RotateCw,
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
  canCompleteAppointments,
  canManageAppointments,
} from "../utils/access";

const appointmentTypes = [
  ["GENERAL", "General appointment"],
  ["PATIENT_REVIEW", "Patient review"],
  ["DOSETTE_REVIEW", "Dosette review"],
  ["SUPPLIER", "Supplier meeting"],
  ["STAFF", "Staff meeting"],
  ["OTHER", "Other"],
];

const statuses = [
  ["SCHEDULED", "Scheduled"],
  ["COMPLETED", "Completed"],
  ["CANCELLED", "Cancelled"],
];

const emptySummary = {
  total_visible: 0,
  scheduled_today: 0,
  upcoming: 0,
  overdue: 0,
  completed_today: 0,
  unassigned: 0,
  next: null,
};

function localDateTime(date) {
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000
  );
  return local.toISOString().slice(0, 16);
}

function defaultTimes() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60_000);
  return {
    scheduled_start: localDateTime(start),
    scheduled_end: localDateTime(end),
  };
}

function formatTimestamp(value) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function readAppointmentError(error) {
  const data = error.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (data && typeof data === "object") {
    const firstMessage = Object.values(data).flat()[0];
    if (firstMessage) return String(firstMessage);
  }
  return "The appointment action could not be completed. Check the connection and try again.";
}

function StatusBadge({ appointment }) {
  const config = {
    SCHEDULED: { icon: CalendarClock, tone: "blue" },
    COMPLETED: { icon: CheckCircle2, tone: "success" },
    CANCELLED: { icon: Ban, tone: "slate" },
  }[appointment.status];

  return (
    <Badge icon={config?.icon} tone={config?.tone || "slate"}>
      {appointment.status_label}
    </Badge>
  );
}

function AppointmentForm({ assignees, onCancel, onSaved, patients }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: "",
    appointment_type: "GENERAL",
    patient: "",
    assigned_user: "",
    notes: "",
    ...defaultTimes(),
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const needsPatient = ["PATIENT_REVIEW", "DOSETTE_REVIEW"].includes(
    form.appointment_type
  );

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await api.post("/operational-appointments/", {
        ...form,
        title: form.title.trim(),
        patient: form.patient ? Number(form.patient) : null,
        assigned_user: form.assigned_user
          ? Number(form.assigned_user)
          : null,
        scheduled_start: new Date(form.scheduled_start).toISOString(),
        scheduled_end: new Date(form.scheduled_end).toISOString(),
        notes: form.notes.trim(),
      });
      toast.success(
        "Appointment scheduled",
        "The local diary and authorised patient-care view are now current."
      );
      await onSaved();
      onCancel();
    } catch (requestError) {
      setError(readAppointmentError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel className="mb-6 overflow-hidden border-blue-200/70">
      <PanelHeader
        eyebrow="Local planning"
        icon={Plus}
        title="Schedule operational appointment"
        description="Create a local pharmacy diary entry without external calendar, booking, messaging or NHS integration."
        action={
          <button
            type="button"
            aria-label="Close appointment form"
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
          <label className="text-sm font-bold text-slate-700" htmlFor="appointment-title">
            Appointment title
          </label>
          <input
            id="appointment-title"
            required
            maxLength="200"
            className="field-control mt-2"
            value={form.title}
            onChange={updateField("title")}
          />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="appointment-type">
            Appointment type
          </label>
          <select
            id="appointment-type"
            className="field-control mt-2"
            value={form.appointment_type}
            onChange={updateField("appointment_type")}
          >
            {appointmentTypes.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="appointment-patient">
            Patient {needsPatient ? "(required)" : "(optional)"}
          </label>
          <select
            id="appointment-patient"
            required={needsPatient}
            className="field-control mt-2"
            value={form.patient}
            onChange={updateField("patient")}
          >
            <option value="">No patient linked</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.first_name} {patient.last_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="appointment-assignee">
            Assigned staff member
          </label>
          <select
            id="appointment-assignee"
            className="field-control mt-2"
            value={form.assigned_user}
            onChange={updateField("assigned_user")}
          >
            <option value="">Unassigned</option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.display_name} - {assignee.roles.join(", ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="appointment-start">
            Start
          </label>
          <input
            id="appointment-start"
            required
            type="datetime-local"
            className="field-control mt-2"
            value={form.scheduled_start}
            onChange={updateField("scheduled_start")}
          />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="appointment-end">
            End
          </label>
          <input
            id="appointment-end"
            required
            type="datetime-local"
            className="field-control mt-2"
            value={form.scheduled_end}
            onChange={updateField("scheduled_end")}
          />
        </div>
        <div className="lg:col-span-2">
          <label className="text-sm font-bold text-slate-700" htmlFor="appointment-notes">
            Internal notes
          </label>
          <textarea
            id="appointment-notes"
            rows="3"
            maxLength="2000"
            className="field-control mt-2 resize-y"
            value={form.notes}
            onChange={updateField("notes")}
          />
        </div>
        {error && (
          <p className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm font-semibold text-rose-800 lg:col-span-2" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3 lg:col-span-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button
            disabled={!form.title.trim() || (needsPatient && !form.patient)}
            loading={isSubmitting}
            type="submit"
          >
            Schedule appointment
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function OutcomeForm({ appointment, mode, onCancel, onSaved }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCancel = mode === "cancel";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      await api.post(`/operational-appointments/${appointment.id}/${mode}/`, {
        [isCancel ? "reason" : "outcome"]: text.trim(),
      });
      toast.success(
        isCancel ? "Appointment cancelled" : "Appointment completed",
        "The local appointment outcome and audit history are now current."
      );
      await onSaved();
      onCancel();
    } catch (requestError) {
      setError(readAppointmentError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel className="mb-6 overflow-hidden">
      <PanelHeader
        eyebrow="Appointment outcome"
        icon={isCancel ? Ban : CheckCircle2}
        title={`${isCancel ? "Cancel" : "Complete"} ${appointment.title}`}
        description={
          isCancel
            ? "A cancellation reason is required."
            : "Add an optional, concise local outcome."
        }
        action={
          <button type="button" aria-label="Close appointment outcome form" className="glass-icon-button" onClick={onCancel}>
            <X aria-hidden="true" size={18} />
          </button>
        }
      />
      <form className="p-5 sm:p-6" onSubmit={handleSubmit}>
        <label className="text-sm font-bold text-slate-700" htmlFor="appointment-outcome">
          {isCancel ? "Cancellation reason" : "Outcome"}
        </label>
        <textarea
          id="appointment-outcome"
          required={isCancel}
          rows="3"
          maxLength="2000"
          className="field-control mt-2 resize-y"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        {error && <p className="mt-4 text-sm font-semibold text-rose-800" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>Keep scheduled</Button>
          <Button disabled={isCancel && !text.trim()} loading={isSubmitting} type="submit" variant={isCancel ? "danger" : "primary"}>
            {isCancel ? "Cancel appointment" : "Complete appointment"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Appointments() {
  const { user } = useAuth();
  const canManage = canManageAppointments(user);
  const canComplete = canCompleteAppointments(user);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const path = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), page_size: "50" });
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("appointment_type", typeFilter);
    return `/operational-appointments/?${params.toString()}`;
  }, [page, search, statusFilter, typeFilter]);

  const resource = useApiResource(
    path,
    "Operational appointments could not be retrieved.",
    { count: 0, next: null, previous: null, results: [] }
  );
  const summaryResource = useApiResource(
    "/operational-appointments/summary/",
    "Appointment summary could not be retrieved.",
    emptySummary
  );
  const { data: patients } = useApiResource(
    canManage ? "/patients/" : "",
    "Patients could not be retrieved."
  );
  const { data: assignees } = useApiResource(
    canManage ? "/operational-appointments/assignees/" : "",
    "Appointment assignees could not be retrieved."
  );
  const appointments = resource.data?.results || [];
  const total = resource.data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));
  const summary = summaryResource.data;

  const reloadAll = async () => {
    await Promise.allSettled([resource.reload(), summaryResource.reload()]);
  };

  const actions = (appointment) => {
    if (appointment.status !== "SCHEDULED") return null;
    const canCompleteThis = canComplete
      && (canManage || appointment.assigned_user === user?.id);
    return (
      <div className="flex flex-wrap gap-2">
        {canCompleteThis && (
          <Button icon={CheckCircle2} onClick={() => setOutcome({ appointment, mode: "complete" })}>
            Complete
          </Button>
        )}
        {canManage && (
          <Button icon={Ban} variant="secondary" onClick={() => setOutcome({ appointment, mode: "cancel" })}>
            Cancel
          </Button>
        )}
      </div>
    );
  };

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Local pharmacy diary"
        icon={CalendarDays}
        title="Operational appointments"
        description="Coordinate pharmacy reviews and meetings without external calendar, messaging, booking or NHS integration."
        actions={
          <>
            {canManage && <Button icon={Plus} onClick={() => setShowForm(true)}>Schedule appointment</Button>}
            <Button icon={RotateCw} loading={resource.isReloading} variant="secondary" onClick={reloadAll}>Refresh diary</Button>
          </>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ClinicalMetric icon={CalendarDays} label="Today" tone="info" value={summary?.scheduled_today || 0} description="Scheduled appointments" />
        <ClinicalMetric icon={CalendarClock} label="Upcoming" tone="neutral" value={summary?.upcoming || 0} description={`${summary?.unassigned || 0} unassigned`} />
        <ClinicalMetric icon={Clock3} label="Overdue" tone={(summary?.overdue || 0) > 0 ? "critical" : "ready"} value={summary?.overdue || 0} description="Needs outcome review" />
        <ClinicalMetric icon={CalendarCheck} label="Completed today" tone="ready" value={summary?.completed_today || 0} description="Recorded outcomes" />
      </section>

      {summary?.next && (
        <Panel className="mb-6 overflow-hidden border-blue-200/70">
          <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">Next appointment</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">{summary.next.title}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {formatTimestamp(summary.next.scheduled_start)} - {summary.next.assigned_user_display}
              </p>
            </div>
            <Badge icon={CalendarClock} tone="blue">{summary.next.appointment_type_label}</Badge>
          </div>
        </Panel>
      )}

      {showForm && canManage && <AppointmentForm assignees={assignees} patients={patients} onCancel={() => setShowForm(false)} onSaved={reloadAll} />}
      {outcome && <OutcomeForm {...outcome} onCancel={() => setOutcome(null)} onSaved={reloadAll} />}

      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="Agenda" icon={CalendarDays} title="Appointment register" description="Patient context, assignment and outcomes remain within the local authorised workspace." />
        <ListToolbar
          shown={!resource.isLoading && !resource.error ? appointments.length : null}
          total={!resource.isLoading && !resource.error ? total : null}
          unit="appointments on this page"
          filters={
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sr-only" htmlFor="appointment-status-filter">Filter appointment status</label>
              <select id="appointment-status-filter" className="field-control font-semibold" value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }}>
                <option value="">All statuses</option>
                {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <label className="sr-only" htmlFor="appointment-type-filter">Filter appointment type</label>
              <select id="appointment-type-filter" className="field-control font-semibold" value={typeFilter} onChange={(event) => { setPage(1); setTypeFilter(event.target.value); }}>
                <option value="">All types</option>
                {appointmentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          }
        >
          <SearchField label="Search appointments" placeholder="Search title, patient, assignee or notes..." value={search} onChange={(value) => { setPage(1); setSearch(value); }} />
        </ListToolbar>

        {resource.isLoading ? <LoadingState label="Loading operational appointments..." /> : resource.error ? <ErrorState message={resource.error} onRetry={reloadAll} /> : appointments.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No matching appointments" message="Adjust the filters or schedule a local pharmacy appointment." action={canManage ? <Button icon={Plus} onClick={() => setShowForm(true)}>Schedule first appointment</Button> : null} />
        ) : (
          <>
            <div className="hidden lg:block">
              <TableShell label="Operational appointments" minWidth="1080px">
                <thead><tr><th scope="col">Appointment</th><th scope="col">Schedule</th><th scope="col">Patient</th><th scope="col">Assignment</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
                <tbody>
                  {appointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td><p className="font-black text-slate-950">{appointment.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">{appointment.appointment_type_label}</p></td>
                      <td><p className="font-bold text-slate-800">{formatTimestamp(appointment.scheduled_start)}</p>{appointment.is_overdue && <Badge className="mt-2" tone="danger">Overdue</Badge>}</td>
                      <td><p className="font-bold text-slate-700">{appointment.patient_display || "No patient linked"}</p></td>
                      <td><p className="flex items-center gap-2 font-bold text-slate-700"><UserRound aria-hidden="true" size={15} />{appointment.assigned_user_display}</p></td>
                      <td><StatusBadge appointment={appointment} /></td>
                      <td>{actions(appointment)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>
            <div className="grid gap-4 p-4 lg:hidden">
              {appointments.map((appointment) => (
                <article key={appointment.id} className="rounded-3xl border border-white/80 bg-white/55 p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="text-xs font-black uppercase tracking-wider text-blue-700">{appointment.appointment_type_label}</p><h2 className="mt-1 text-lg font-black text-slate-950">{appointment.title}</h2></div>
                    <StatusBadge appointment={appointment} />
                  </div>
                  <p className="mt-4 font-bold text-slate-800">{formatTimestamp(appointment.scheduled_start)}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-white/70 p-3"><p className="text-xs font-black text-slate-400">Patient</p><p className="mt-1 font-bold text-slate-700">{appointment.patient_display || "Not linked"}</p></div>
                    <div className="rounded-2xl bg-white/70 p-3"><p className="text-xs font-black text-slate-400">Assigned</p><p className="mt-1 font-bold text-slate-700">{appointment.assigned_user_display}</p></div>
                  </div>
                  {appointment.outcome_notes && <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">Outcome: {appointment.outcome_notes}</p>}
                  <div className="mt-4">{actions(appointment)}</div>
                </article>
              ))}
            </div>
            <nav className="flex flex-col gap-3 border-t border-white/75 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5" aria-label="Appointment pagination">
              <p className="text-sm font-semibold text-slate-500">Page {page} of {totalPages} - {total} total appointments</p>
              <div className="flex gap-3">
                <Button disabled={!resource.data.previous} variant="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
                <Button disabled={!resource.data.next} variant="secondary" onClick={() => setPage((current) => current + 1)}>Next</Button>
              </div>
            </nav>
          </>
        )}
      </Panel>
    </MainLayout>
  );
}

export default Appointments;
