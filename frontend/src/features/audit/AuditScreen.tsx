import { useState } from "react";

import { usePermissions } from "../../auth/usePermissions";
import { AUDIT_ACTION_OPTIONS } from "./auditActions";
import type { AuditEvent } from "./auditApi";
import { useAuditEventsQuery } from "./useAudit";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTarget(event: AuditEvent): string {
  if (!event.target_type || !event.target_id) {
    return "—";
  }

  return `${event.target_type} #${event.target_id}`;
}

function formatMetadata(metadata: Record<string, unknown>): string {
  const serialized = JSON.stringify(metadata);
  return serialized.length > 90 ? `${serialized.slice(0, 87)}...` : serialized;
}

export function AuditScreen() {
  const { role } = usePermissions();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const auditQuery = useAuditEventsQuery({ page, action });

  const data = auditQuery.data;
  const results = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const previousPage = data?.previous ?? null;
  const nextPage = data?.next ?? null;
  const isSuperintendentEmpty =
    auditQuery.isSuccess && results.length === 0 && role === "SUPERINTENDENT";

  function handleActionChange(nextAction: string) {
    setAction(nextAction);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-teal-700">Audit</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Audit Log
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Review read-only audit events in your permitted scope. Backend
          tenancy rules remain the source of truth for visibility.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label
          className="block text-sm font-semibold text-slate-700"
          htmlFor="audit-action-filter"
        >
          Action
        </label>
        <select
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 sm:max-w-xs"
          id="audit-action-filter"
          onChange={(event) => handleActionChange(event.target.value)}
          value={action}
        >
          <option value="">All actions</option>
          {AUDIT_ACTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>

      {auditQuery.isLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Loading audit events...
        </section>
      ) : null}

      {auditQuery.isError ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <h2 className="text-lg font-bold text-red-900">
            Could not load audit events.
          </h2>
          <p className="mt-2 text-sm text-red-700">
            Please retry. If this continues, your session or permissions may
            need refreshing.
          </p>
          <button
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            onClick={() => void auditQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </section>
      ) : null}

      {auditQuery.isSuccess && results.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          {isSuperintendentEmpty
            ? "Group-level audit visibility is limited in this phase."
            : "No audit events."}
        </section>
      ) : null}

      {auditQuery.isSuccess && results.length > 0 ? (
        <section className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      When
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Target
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      IP
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {results.map((event) => (
                    <tr key={event.id}>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                        {formatDateTime(event.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
                        {event.action}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                        {event.actor_email || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                        {event.actor_role || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                        {formatTarget(event)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                        {event.ip_address ?? "—"}
                      </td>
                      <td className="max-w-xs truncate px-4 py-4 font-mono text-xs text-slate-600">
                        {formatMetadata(event.metadata)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {results.length} of {totalCount}
            </p>
            <div className="flex items-center gap-3">
              <button
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                disabled={previousPage === null || page === 1}
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                type="button"
              >
                Prev
              </button>
              <span className="font-medium text-slate-700">Page {page}</span>
              <button
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                disabled={nextPage === null}
                onClick={() => setPage((currentPage) => currentPage + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
