import { useMemo, useState } from "react";
import {
  Eye,
  FileClock,
  LogIn,
  LogOut,
  Pencil,
  PlusCircle,
  RotateCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import PageHeader from "../components/Header";
import Badge from "../components/Badge";
import Button from "../components/Button";
import SearchField from "../components/SearchField";
import { Panel } from "../components/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import ListToolbar from "../components/ListToolbar";
import TableShell from "../components/TableShell";
import useApiResource from "../hooks/useApiResource";

const actionConfig = {
  CREATE: { icon: PlusCircle, tone: "success" },
  UPDATE: { icon: Pencil, tone: "blue" },
  DELETE: { icon: Trash2, tone: "danger" },
  ACCESS: { icon: Eye, tone: "slate" },
  GENERATE: { icon: Sparkles, tone: "purple" },
  LOGIN: { icon: LogIn, tone: "success" },
  LOGOUT: { icon: LogOut, tone: "warning" },
};

const actionOptions = [
  ["", "All actions"],
  ["CREATE", "Created"],
  ["UPDATE", "Updated"],
  ["DELETE", "Deleted"],
  ["ACCESS", "Accessed"],
  ["GENERATE", "Generated"],
  ["LOGIN", "Logged in"],
  ["LOGOUT", "Logged out"],
];

function formatAuditTimestamp(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function ActionBadge({ event }) {
  const config = actionConfig[event.action] || actionConfig.ACCESS;

  return (
    <Badge icon={config.icon} tone={config.tone}>
      {event.action} · {event.action_label}
    </Badge>
  );
}

function AuditLog() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  const auditPath = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: "50",
    });

    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    if (actionFilter) {
      params.set("action", actionFilter);
    }
    if (entityFilter.trim()) {
      params.set("entity_type", entityFilter.trim());
    }

    return `/audit-events/?${params.toString()}`;
  }, [actionFilter, entityFilter, page, searchQuery]);

  const {
    data,
    error,
    isLoading,
    isReloading,
    reload,
  } = useApiResource(
    auditPath,
    "Audit history could not be retrieved. Check the API connection and try again.",
    { count: 0, next: null, previous: null, results: [] }
  );

  const events = data?.results || [];
  const totalEvents = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalEvents / 50));

  const resetPageAndSet = (setter) => (value) => {
    setPage(1);
    setter(value);
  };

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Governance and traceability"
        title="Audit history"
        description="Review an append-only record of staff actions and safety workflow access. Audit events cannot be edited or deleted."
        icon={FileClock}
        actions={
          <Button
            icon={RotateCw}
            loading={isReloading}
            variant="secondary"
            onClick={reload}
          >
            Refresh history
          </Button>
        }
      />

      <section
        className="clinical-grid mb-6 rounded-[1.5rem] border border-blue-200/70 bg-blue-50/55 p-5 sm:p-6"
        aria-labelledby="audit-integrity-heading"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-white/70 text-blue-800 shadow-sm">
            <FileClock aria-hidden="true" size={21} />
          </div>
          <div>
            <h2
              id="audit-integrity-heading"
              className="text-base font-bold text-slate-950"
            >
              Append-only governance record
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Summaries contain record identifiers and changed field names only.
              Patient notes, medication instructions, passwords and authentication
              tokens are never written to this history.
            </p>
          </div>
        </div>
      </section>

      <Panel className="overflow-hidden">
        <ListToolbar
          shown={!isLoading && !error ? events.length : null}
          total={!isLoading && !error ? totalEvents : null}
          unit="events on this page"
          filters={
            <div className="grid gap-3 sm:grid-cols-2 lg:flex">
              <label className="sr-only" htmlFor="audit-action-filter">
                Filter by action
              </label>
              <select
                id="audit-action-filter"
                className="field-control min-w-44 font-semibold"
                value={actionFilter}
                onChange={(event) =>
                  resetPageAndSet(setActionFilter)(event.target.value)
                }
              >
                {actionOptions.map(([value, label]) => (
                  <option key={value || "all"} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <label className="sr-only" htmlFor="audit-entity-filter">
                Filter by exact entity type
              </label>
              <input
                id="audit-entity-filter"
                className="field-control min-w-48"
                value={entityFilter}
                placeholder="Entity type, e.g. Patient"
                onChange={(event) =>
                  resetPageAndSet(setEntityFilter)(event.target.value)
                }
              />
            </div>
          }
        >
          <SearchField
            id="audit-search"
            label="Search audit history"
            placeholder="Search actor, entity, summary or request path..."
            value={searchQuery}
            onChange={resetPageAndSet(setSearchQuery)}
          />
        </ListToolbar>

        {isLoading ? (
          <LoadingState label="Loading immutable audit history..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : events.length === 0 ? (
          <EmptyState
            icon={FileClock}
            title="No matching audit events"
            message="Adjust the search or filters. New governed actions will appear here automatically."
          />
        ) : (
          <>
            <TableShell
              className="hidden lg:block"
              label="Immutable pharmacy audit history"
              minWidth="1160px"
            >
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Safe summary</th>
                  <th>Request path</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap text-sm font-semibold text-slate-600">
                      {formatAuditTimestamp(event.timestamp)}
                    </td>
                    <td className="font-bold text-slate-900">
                      {event.actor_display}
                    </td>
                    <td>
                      <ActionBadge event={event} />
                    </td>
                    <td>
                      <p className="font-bold text-slate-900">{event.entity_type}</p>
                      <p className="mt-1 font-mono text-xs text-slate-400">
                        {event.entity_identifier
                          ? `Record #${event.entity_identifier}`
                          : "Workspace event"}
                      </p>
                    </td>
                    <td className="max-w-md text-sm leading-6 text-slate-600">
                      {event.summary}
                    </td>
                    <td className="font-mono text-xs text-slate-500">
                      {event.request_path || "Not recorded"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>

            <div className="divide-y divide-slate-100 lg:hidden">
              {events.map((event) => (
                <article key={event.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">{event.entity_type}</p>
                      <p className="mt-1 font-mono text-xs text-slate-400">
                        {event.entity_identifier
                          ? `Record #${event.entity_identifier}`
                          : "Workspace event"}
                      </p>
                    </div>
                    <ActionBadge event={event} />
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {event.summary}
                  </p>

                  <dl className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="font-semibold text-slate-400">Actor</dt>
                      <dd className="text-right font-bold text-slate-800">
                        {event.actor_display}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="font-semibold text-slate-400">Time</dt>
                      <dd className="text-right font-semibold text-slate-700">
                        {formatAuditTimestamp(event.timestamp)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="font-semibold text-slate-400">Path</dt>
                      <dd className="max-w-52 truncate text-right font-mono text-xs text-slate-600">
                        {event.request_path || "Not recorded"}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <nav
              className="flex flex-col gap-3 border-t border-white/75 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              aria-label="Audit history pagination"
            >
              <p className="text-sm font-semibold text-slate-500">
                Page {page} of {totalPages} · {totalEvents} total events
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

export default AuditLog;
