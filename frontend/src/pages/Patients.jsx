import { useState } from "react";
import { Search, UserRound } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import {
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  StatusChip,
  TableSkeleton,
  Button,
} from "../components/ui";
import { useFetch } from "../hooks/useFetch";
import { dateFmt } from "../lib/format";

export default function Patients() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dosette, setDosette] = useState("");
  const [selected, setSelected] = useState(null);

  const { data, loading } = useFetch("/patients/", {
    params: {
      search: q || undefined,
      status: status || undefined,
      is_dosette: dosette || undefined,
      page_size: 500,
    },
  });
  const detail = useFetch(`/patients/${selected?.id}/`, { skip: !selected });

  const columns = [
    { key: "patient_id", header: "Patient ID", render: (r) => <span className="font-medium tnum">{r.patient_id}</span> },
    { key: "full_name", header: "Name" },
    { key: "age", header: "Age", align: "right" },
    { key: "is_dosette", header: "Dosette", sortable: false, render: (r) =>
        r.is_dosette ? <StatusChip tone="info" icon={false} dot>Dosette</StatusChip> : <span className="text-text-tertiary">—</span> },
    { key: "allergies", header: "Allergies", sortable: false, render: (r) =>
        r.allergies ? <StatusChip tone="warning">{r.allergies}</StatusChip> : <span className="text-text-tertiary">None recorded</span> },
    { key: "status", header: "Status", render: (r) =>
        r.status === "active" ? <StatusChip tone="success" icon={false} dot>Active</StatusChip> : <StatusChip tone="neutral" icon={false}>Inactive</StatusChip> },
  ];

  return (
    <>
      <PageHeader title="Patients" subtitle="Pseudo-anonymised patient records" />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex flex-1 items-center gap-2 text-text-tertiary">
          <Search size={16} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, ID or postcode…" className="border-0 px-0 focus:ring-0" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
        <Select value={dosette} onChange={(e) => setDosette(e.target.value)} className="w-40">
          <option value="">All patients</option>
          <option value="true">Dosette only</option>
          <option value="false">Non-dosette</option>
        </Select>
      </Card>

      <Card>
        {loading ? (
          <TableSkeleton />
        ) : (data?.results || []).length === 0 ? (
          <EmptyState icon={UserRound} title="No patients found" hint="Adjust your search or filters." />
        ) : (
          <DataTable columns={columns} rows={data.results} onRowClick={setSelected} />
        )}
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.full_name} · ${selected.patient_id}` : ""}
        wide
        footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}
      >
        {detail.loading || !detail.data ? (
          <TableSkeleton rows={4} cols={2} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <KV label="Date of birth" v={dateFmt(detail.data.date_of_birth)} />
              <KV label="Age" v={detail.data.age} />
              <KV label="Phone" v={detail.data.phone || "—"} />
              <KV label="GP practice" v={detail.data.gp_practice || "—"} />
              <KV label="Prescriber" v={detail.data.gp_name || "—"} />
              <KV label="Postcode" v={detail.data.postcode || "—"} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Box title="Allergies" body={detail.data.allergies || "None recorded"} tone={detail.data.allergies ? "warning" : "neutral"} />
              <Box title="Special instructions" body={detail.data.special_instructions || "None"} />
            </div>
            <div>
              <h4 className="mb-2 text-micro uppercase text-text-tertiary">History</h4>
              {(detail.data.notes || []).length === 0 ? (
                <p className="text-body text-text-tertiary">No history entries.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.data.notes.map((n) => (
                    <li key={n.id} className="rounded-lg border border-border-subtle p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <StatusChip tone="neutral" icon={false}>{n.category}</StatusChip>
                        <span className="text-caption text-text-tertiary">{dateFmt(n.created_at)} · {n.author_name || "—"}</span>
                      </div>
                      <p className="text-body">{n.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function KV({ label, v }) {
  return (
    <div className="rounded-xl bg-subtle p-3">
      <div className="text-caption text-text-secondary">{label}</div>
      <div className="text-body font-semibold text-text-primary">{v}</div>
    </div>
  );
}
function Box({ title, body, tone }) {
  const bg = tone === "warning" ? "bg-warning-bg" : "bg-subtle";
  const fg = tone === "warning" ? "text-warning-fg" : "text-text-primary";
  return (
    <div className={`rounded-xl p-3 ${bg}`}>
      <div className="mb-1 text-micro uppercase text-text-tertiary">{title}</div>
      <div className={`text-body ${fg}`}>{body}</div>
    </div>
  );
}
