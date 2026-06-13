import { useState } from "react";
import { ScrollText } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { Card, EmptyState, Select, TableSkeleton, StatusChip } from "../components/ui";
import { useFetch } from "../hooks/useFetch";
import { dateTimeFmt } from "../lib/format";

const ACTION_TONE = {
  login: "info",
  create: "success",
  update: "neutral",
  delete: "danger",
  dispense: "info",
  check: "success",
  adjust: "warning",
  waste: "danger",
};

export default function AuditLog() {
  const [action, setAction] = useState("");
  const { data, loading } = useFetch("/audit-logs/", {
    params: { action: action || undefined, ordering: "-timestamp", page_size: 200 },
  });

  const rows = data?.results || [];

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Full traceability of actions across the platform"
        actions={
          <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-44">
            <option value="">All actions</option>
            {Object.keys(ACTION_TONE).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        }
      />

      <Card>
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="No audit entries" hint="Actions you take will be recorded here." />
        ) : (
          <DataTable
            rows={rows}
            columns={[
              { key: "timestamp", header: "When", render: (r) => dateTimeFmt(r.timestamp) },
              { key: "actor_label", header: "Actor", render: (r) => <span className="font-medium">{r.actor_label}</span> },
              { key: "action", header: "Action", render: (r) => <StatusChip tone={ACTION_TONE[r.action] || "neutral"} icon={false} dot>{r.action}</StatusChip> },
              { key: "summary", header: "Summary" },
              { key: "entity", header: "Entity", render: (r) => <span className="text-caption text-text-tertiary">{r.entity}</span> },
            ]}
          />
        )}
      </Card>
    </>
  );
}
