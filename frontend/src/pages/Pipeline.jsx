/**
 * Dispensing pipeline board — a store-wide view of every job moving through the
 * pharmacy (New → Picking → Accuracy check → Ready → Collected, or parked as an
 * Issue). Inspired by a real dispensing queue but original in our design language.
 *
 * Accessibility: movement is button-driven (no drag-drop dependency), every control
 * is keyboard-focusable and ARIA-labelled, and status/priority are shown by icon +
 * text (never colour alone). Role rules mirror the backend (the API enforces them).
 */
import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, Bot, CalendarClock, CheckCircle2, ClipboardCheck,
  ClipboardList, Inbox, Loader, PackageCheck, RefreshCw, ScanLine, Search,
  ShieldAlert, Truck, User as UserIcon, X,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Button, Card, EmptyState, ErrorState, Modal, Select, Skeleton, StatusChip, cx, useToast } from "../components/ui";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import { dateFmt as fmtDate } from "../lib/format";

const STATUS = {
  new: { label: "New", tone: "neutral", icon: Inbox },
  picking_required: { label: "Picking required", tone: "warning", icon: ClipboardList },
  picking_in_progress: { label: "Picking in progress", tone: "info", icon: Loader },
  picked: { label: "Picked", tone: "info", icon: PackageCheck },
  accuracy_check: { label: "Accuracy check", tone: "warning", icon: ScanLine },
  ready: { label: "Ready", tone: "success", icon: CheckCircle2 },
  issue_found: { label: "Issue found", tone: "danger", icon: AlertTriangle },
  collected: { label: "Collected / Delivered", tone: "success", icon: Truck },
};

// Canonical forward step + the verb shown on the button.
const NEXT = {
  new: "picking_required",
  picking_required: "picking_in_progress",
  picking_in_progress: "picked",
  picked: "accuracy_check",
  accuracy_check: "ready",
  ready: "collected",
};
const FORWARD_LABEL = {
  picking_required: "Move to picking",
  picking_in_progress: "Start picking",
  picked: "Mark picked",
  accuracy_check: "Send to check",
  ready: "Accuracy check ✓",
  collected: "Mark collected",
};

const JOB_TYPE_LABEL = { prescription: "Prescription", dosette: "Dosette", stock_issue: "Stock issue" };
const PRIORITY_TONE = { urgent: "danger", high: "warning", normal: "neutral", low: "neutral" };
// Literal classes so Tailwind's JIT keeps them in the build (no dynamic strings).
const TONE_TEXT = {
  neutral: "text-text-secondary", warning: "text-warning-fg",
  info: "text-info-fg", success: "text-success-fg", danger: "text-danger-fg",
};

// Mirror of the backend role rules (the API is the source of truth; this just
// decides which controls to show).
function canTransition(role, from, to) {
  if (role === "administrator") return true;
  if (to === "ready") return role === "pharmacist";
  if (from === "issue_found") return role === "pharmacist";
  return role === "dispenser" || role === "pharmacist";
}

export default function Pipeline() {
  const { user } = useAuth();
  const role = user?.role;
  const toast = useToast();

  const [filters, setFilters] = useState({ job_type: "", priority: "", mine: false, include_collected: false });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null); // job id mid-action
  const [issueFor, setIssueFor] = useState(null); // job awaiting an issue note
  const [resolveFor, setResolveFor] = useState(null); // issue job being resolved
  const [detail, setDetail] = useState(null); // { job, history, loading }

  const params = useMemo(() => {
    const p = {};
    if (filters.job_type) p.job_type = filters.job_type;
    if (filters.priority) p.priority = filters.priority;
    if (filters.mine) p.mine = 1;
    if (filters.include_collected) p.include_collected = 1;
    if (q.trim()) p.q = q.trim();
    return p;
  }, [filters, q]);

  const board = useFetch("/workflow-jobs/board/", { params });

  const act = useCallback(async (jobId, path, body) => {
    setBusy(jobId);
    try {
      await api.post(`/workflow-jobs/${jobId}/${path}/`, body);
      await board.refetch();
      toast?.success("Job updated");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Action not permitted";
      toast?.error(typeof msg === "string" ? msg : "Action failed");
    } finally {
      setBusy(null);
    }
  }, [board, toast]);

  const openDetail = useCallback(async (job) => {
    setDetail({ job, history: [], loading: true });
    try {
      const res = await api.get(`/workflow-jobs/${job.id}/history/`);
      setDetail({ job, history: res.data, loading: false });
    } catch {
      setDetail({ job, history: [], loading: false });
    }
  }, []);

  const ai = board.data?.ai_summary;

  return (
    <>
      <PageHeader
        title="Dispensing pipeline"
        subtitle="Every job across all patients, from new to collected — with AI prompts."
        actions={
          <Button variant="secondary" size="sm" onClick={() => board.refetch()} aria-label="Refresh board">
            <RefreshCw size={15} className={board.loading ? "animate-spin" : ""} /> Refresh
          </Button>
        }
      />

      {/* AI summary */}
      {ai && (
        <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
          <span className="inline-flex items-center gap-1.5 text-caption font-medium text-text-secondary">
            <Bot size={15} className="text-accent" aria-hidden="true" /> AI prompts:
          </span>
          <StatusChip tone={ai.overdue ? "danger" : "neutral"}>{ai.overdue} overdue</StatusChip>
          <StatusChip tone={ai.needs_pharmacist ? "warning" : "neutral"} icon={false}>
            {ai.needs_pharmacist} need pharmacist
          </StatusChip>
          <StatusChip tone={ai.stock_warnings ? "warning" : "neutral"} icon={false}>
            {ai.stock_warnings} stock warnings
          </StatusChip>
          <StatusChip tone={ai.due_soon ? "info" : "neutral"} icon={false}>{ai.due_soon} due soon</StatusChip>
          <span className="ms-auto text-caption text-text-tertiary">{board.data.total} active jobs</span>
        </Card>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex h-9 items-center gap-2 rounded-md border border-border-subtle bg-app px-3">
          <Search size={15} className="text-text-tertiary" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patient or job…"
            aria-label="Search jobs by patient or title"
            className="h-full w-48 bg-transparent text-body text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear search" className="rounded p-0.5 text-text-tertiary hover:bg-subtle">
              <X size={14} />
            </button>
          )}
        </div>
        <Select aria-label="Filter by job type" value={filters.job_type} onChange={(e) => setFilters((f) => ({ ...f, job_type: e.target.value }))} className="w-40">
          <option value="">All job types</option>
          <option value="prescription">Prescription</option>
          <option value="dosette">Dosette</option>
          <option value="stock_issue">Stock issue</option>
        </Select>
        <Select aria-label="Filter by priority" value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))} className="w-36">
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </Select>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border-subtle px-3 text-body text-text-secondary">
          <input type="checkbox" checked={filters.mine} onChange={(e) => setFilters((f) => ({ ...f, mine: e.target.checked }))} className="accent-accent" />
          Assigned to me
        </label>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border-subtle px-3 text-body text-text-secondary">
          <input type="checkbox" checked={filters.include_collected} onChange={(e) => setFilters((f) => ({ ...f, include_collected: e.target.checked }))} className="accent-accent" />
          Show collected
        </label>
      </div>

      {/* Board */}
      {board.error ? (
        <ErrorState onRetry={board.refetch} message="Could not load the pipeline board." />
      ) : board.loading && !board.data ? (
        <BoardSkeleton />
      ) : board.data.total === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No jobs match" hint="Try clearing the filters or search." />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3" role="list" aria-label="Pipeline columns">
          {board.data.columns
            .filter((c) => filters.include_collected || c.status !== "collected" || c.count > 0)
            .map((col) => (
              <Column
                key={col.status}
                col={col}
                role={role}
                busy={busy}
                onForward={(job) => act(job.id, "transition", { to_status: NEXT[job.status] })}
                onIssue={(job) => setIssueFor(job)}
                onResolve={(job) => setResolveFor(job)}
                onOpen={openDetail}
              />
            ))}
        </div>
      )}

      {/* Raise-issue modal */}
      <IssueModal job={issueFor} onClose={() => setIssueFor(null)}
        onSubmit={async (note) => { await act(issueFor.id, "raise-issue", { note }); setIssueFor(null); }} />

      {/* Resolve-issue modal */}
      <ResolveModal job={resolveFor} onClose={() => setResolveFor(null)}
        onSubmit={async (to_status, note) => { await act(resolveFor.id, "resolve-issue", { to_status, note }); setResolveFor(null); }} />

      {/* Job detail / history modal */}
      <DetailModal detail={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function Column({ col, role, busy, onForward, onIssue, onResolve, onOpen }) {
  const meta = STATUS[col.status];
  const Icon = meta.icon;
  return (
    <section role="listitem" aria-label={`${meta.label}, ${col.count} jobs`}
      className="flex w-[280px] flex-shrink-0 flex-col rounded-xl bg-app/60">
      <header className="flex items-center gap-2 rounded-t-xl border-b border-border-subtle bg-surface px-3 py-2.5">
        <Icon size={16} className={TONE_TEXT[meta.tone]} aria-hidden="true" />
        <h2 className="text-body font-semibold text-text-primary">{meta.label}</h2>
        <span className="ms-auto rounded-full bg-subtle px-2 py-0.5 text-caption font-semibold text-text-secondary tnum">{col.count}</span>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 320px)" }}>
        {col.jobs.length === 0 ? (
          <p className="px-2 py-6 text-center text-caption text-text-tertiary">— None —</p>
        ) : (
          col.jobs.map((job) => (
            <JobCard key={job.id} job={job} role={role} busy={busy === job.id}
              onForward={onForward} onIssue={onIssue} onResolve={onResolve} onOpen={onOpen} />
          ))
        )}
      </div>
    </section>
  );
}

function JobCard({ job, role, busy, onForward, onIssue, onResolve, onOpen }) {
  const next = NEXT[job.status];
  const showForward = next && canTransition(role, job.status, next);
  const forwardBlocked = next && !showForward; // e.g. dispenser at accuracy_check
  const canIssue = job.status !== "issue_found" && job.status !== "collected";
  const isIssue = job.status === "issue_found";
  const canResolve = isIssue && canTransition(role, "issue_found", "picking_required");

  return (
    <Card className={cx("p-2.5", job.is_overdue && "ring-1 ring-danger/50")}>
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => onOpen(job)} className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring rounded">
          <span className="block truncate text-body font-semibold text-text-primary hover:text-accent">{job.patient_name}</span>
          <span className="block text-caption text-text-tertiary tnum">
            DOB {fmtDate(job.patient_dob)} · {job.patient_ref}
          </span>
        </button>
        <StatusChip tone={PRIORITY_TONE[job.priority]} icon={false}>{job.priority_display}</StatusChip>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-text-secondary">
        <span className="rounded bg-subtle px-1.5 py-0.5 font-medium">{JOB_TYPE_LABEL[job.job_type] || job.job_type}</span>
        {job.due_date && (
          <span className={cx("inline-flex items-center gap-1", job.is_overdue && "font-semibold text-danger-fg")}>
            <CalendarClock size={12} aria-hidden="true" />
            {job.is_overdue ? `Overdue ${Math.abs(job.days_to_due)}d` : `Due ${fmtDate(job.due_date)}`}
          </span>
        )}
        {job.assigned_to_name && (
          <span className="inline-flex items-center gap-1"><UserIcon size={12} aria-hidden="true" />{job.assigned_to_name}</span>
        )}
      </div>

      {job.ai && (
        <div className={cx("mt-2 flex items-start gap-1.5 rounded-lg p-2 text-caption",
          job.ai.severity === "danger" ? "bg-danger-bg text-danger-fg"
            : job.ai.severity === "warning" ? "bg-warning-bg text-warning-fg" : "bg-info-bg text-info-fg")}>
          <ShieldAlert size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span><span className="font-semibold">AI</span> ({Math.round(job.ai.confidence * 100)}%): {job.ai.reason}</span>
        </div>
      )}

      {isIssue && job.issue_notes && (
        <p className="mt-1.5 text-caption text-danger-fg">Issue: {job.issue_notes}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {showForward && (
          <Button size="sm" onClick={() => onForward(job)} disabled={busy}>
            {FORWARD_LABEL[next]} <ArrowRight size={14} />
          </Button>
        )}
        {forwardBlocked && (
          <span className="text-caption text-text-tertiary" title="Pharmacist only">{FORWARD_LABEL[next]} — pharmacist only</span>
        )}
        {canResolve && (
          <Button size="sm" onClick={() => onResolve(job)} disabled={busy}>Resolve</Button>
        )}
        {isIssue && !canResolve && (
          <span className="text-caption text-text-tertiary">Awaiting pharmacist</span>
        )}
        {canIssue && (
          <Button variant="ghost" size="sm" onClick={() => onIssue(job)} disabled={busy} className="text-danger-fg">
            <AlertTriangle size={14} /> Issue
          </Button>
        )}
      </div>
    </Card>
  );
}

function IssueModal({ job, onClose, onSubmit }) {
  const [note, setNote] = useState("");
  if (!job) return null;
  return (
    <Modal open={!!job} onClose={onClose} title={`Raise an issue — ${job.patient_name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={!note.trim()} onClick={() => onSubmit(note.trim())}>Raise issue</Button></>}>
      <label htmlFor="issue-note" className="mb-1 block text-caption text-text-secondary">Describe the issue</label>
      <textarea id="issue-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus
        placeholder="e.g. Omeprazole stock below requirement"
        className="w-full rounded-md border border-border-strong bg-surface p-2.5 text-body focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring" />
    </Modal>
  );
}

function ResolveModal({ job, onClose, onSubmit }) {
  const [to, setTo] = useState("picking_required");
  const [note, setNote] = useState("");
  if (!job) return null;
  // Where an issue can route back into the flow.
  const targets = ["picking_required", "picking_in_progress", "picked", "accuracy_check", "ready"];
  return (
    <Modal open={!!job} onClose={onClose} title={`Resolve issue — ${job.patient_name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSubmit(to, note.trim())}>Resolve</Button></>}>
      <label htmlFor="resolve-to" className="mb-1 block text-caption text-text-secondary">Return job to</label>
      <Select id="resolve-to" value={to} onChange={(e) => setTo(e.target.value)} className="mb-3 w-full">
        {targets.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
      </Select>
      <label htmlFor="resolve-note" className="mb-1 block text-caption text-text-secondary">Resolution note (optional)</label>
      <input id="resolve-note" value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Alternative batch used"
        className="w-full rounded-md border border-border-strong bg-surface p-2.5 text-body focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring" />
    </Modal>
  );
}

function DetailModal({ detail, onClose }) {
  if (!detail) return null;
  const { job, history, loading } = detail;
  return (
    <Modal open={!!detail} onClose={onClose} title={`${job.patient_name} · ${STATUS[job.status]?.label}`} wide>
      <div className="grid grid-cols-2 gap-3 text-caption">
        <KV label="Patient ID" v={job.patient_ref} />
        <KV label="Date of birth" v={fmtDate(job.patient_dob)} />
        <KV label="Job type" v={JOB_TYPE_LABEL[job.job_type] || job.job_type} />
        <KV label="Priority" v={job.priority_display} />
        <KV label="Due" v={job.due_date ? fmtDate(job.due_date) : "—"} />
        <KV label="Assigned" v={job.assigned_to_name || "Unassigned"} />
      </div>
      {job.ai && (
        <div className="mt-3 rounded-lg bg-accent-soft p-3 text-body text-text-primary">
          <span className="font-semibold">AI suggestion</span> ({Math.round(job.ai.confidence * 100)}%): {job.ai.reason}
        </div>
      )}
      <h4 className="mb-2 mt-4 text-micro uppercase text-text-tertiary">Status history</h4>
      {loading ? (
        <Skeleton className="h-24" />
      ) : history.length === 0 ? (
        <p className="text-caption text-text-tertiary">No history yet.</p>
      ) : (
        <ol className="space-y-2">
          {history.map((h) => (
            <li key={h.id} className="flex items-start gap-3 text-caption">
              <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-accent" aria-hidden="true" />
              <div>
                <div className="text-body text-text-primary">
                  {h.from_status ? `${STATUS[h.from_status]?.label || h.from_status} → ` : ""}{STATUS[h.to_status]?.label || h.to_status}
                </div>
                <div className="text-text-tertiary">{h.changed_by_label} · {new Date(h.timestamp).toLocaleString("en-GB")}{h.note ? ` · ${h.note}` : ""}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

function KV({ label, v }) {
  return (
    <div className="rounded-md bg-subtle px-2.5 py-1.5">
      <div className="text-text-tertiary">{label}</div>
      <div className="font-semibold text-text-primary">{v}</div>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {["a", "b", "c", "d", "e"].map((k) => (
        <div key={k} className="w-[280px] flex-shrink-0 space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ))}
    </div>
  );
}
