import { useState } from "react";
import { ClipboardList, Download, Plus } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import {
  Button,
  Card,
  EmptyState,
  Modal,
  StatusChip,
  TableSkeleton,
  useToast,
} from "../components/ui";
import { useFetch } from "../hooks/useFetch";
import api, { tokenStore } from "../api/client";
import { dateFmt, num } from "../lib/format";

export default function Picking() {
  const toast = useToast();
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, refetch } = useFetch("/picking-lists/", { params: { page_size: 100 } });
  const detail = useFetch(`/picking-lists/${selected?.id}/`, { skip: !selected });

  async function generate() {
    setBusy(true);
    try {
      const monday = new Date();
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      await api.post("/picking-lists/generate/", {
        period_start: monday.toISOString().slice(0, 10),
        weeks: 1,
      });
      toast.success("Picking list generated");
      refetch();
    } catch {
      toast.error("Could not generate picking list");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item) {
    await api.post(`/picking-items/${item.id}/toggle-picked/`);
    detail.refetch();
  }

  function exportPdf(id) {
    // Authenticated download via fetch -> blob (keeps Bearer header).
    fetch(`/api/picking-lists/${id}/export-pdf/`, {
      headers: { Authorization: `Bearer ${tokenStore.access}` },
    })
      .then((r) => r.blob())
      .then((b) => {
        const url = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = url;
        a.download = `picking-${id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  const statusTone = { open: "neutral", in_progress: "warning", complete: "success" };

  return (
    <>
      <PageHeader
        title="Picking lists"
        subtitle="Aggregated weekly preparation requirements"
        actions={<Button onClick={generate} disabled={busy}><Plus size={16} /> Generate weekly list</Button>}
      />

      <Card>
        {loading ? (
          <TableSkeleton />
        ) : (data?.results || []).length === 0 ? (
          <EmptyState icon={ClipboardList} title="No picking lists yet" hint="Generate one to aggregate this week's dosette requirements." action={<Button onClick={generate}>Generate weekly list</Button>} />
        ) : (
          <DataTable
            rows={data.results}
            onRowClick={setSelected}
            columns={[
              { key: "name", header: "List", render: (r) => <span className="font-medium">{r.name}</span> },
              { key: "period_start", header: "Period", render: (r) => `${dateFmt(r.period_start)} – ${dateFmt(r.period_end)}` },
              { key: "item_count", header: "Lines", align: "right" },
              { key: "progress", header: "Progress", align: "right", render: (r) => (
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-subtle">
                      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${r.progress}%` }} />
                    </div>
                    <span className="tnum text-caption text-text-secondary">{r.progress}%</span>
                  </div>
                ) },
              { key: "status", header: "Status", render: (r) => <StatusChip tone={statusTone[r.status]} icon={false} dot>{r.status.replace("_", " ")}</StatusChip> },
            ]}
          />
        )}
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => exportPdf(selected.id)}><Download size={16} /> Export PDF</Button>
            <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
          </>
        }
      >
        {detail.loading || !detail.data ? (
          <TableSkeleton rows={6} cols={4} />
        ) : (
          <DataTable
            dense
            sortable={false}
            rows={detail.data.items || []}
            columns={[
              { key: "is_picked", header: "✓", sortable: false, render: (it) => (
                  <input
                    type="checkbox"
                    checked={it.is_picked}
                    onChange={() => toggle(it)}
                    aria-label={`Mark ${it.medicine_label} as ${it.is_picked ? "not picked" : "picked"}`}
                    className="h-4 w-4 accent-[#4F46E5]"
                  />
                ) },
              { key: "medicine_label", header: "Medicine", render: (it) => <span className={it.is_picked ? "text-text-tertiary line-through" : "font-medium"}>{it.medicine_label}</span> },
              { key: "quantity_required", header: "Required", align: "right", render: (it) => num(it.quantity_required) },
              { key: "quantity_available", header: "Available", align: "right", render: (it) => (
                  <span className={it.is_short ? "font-semibold text-danger-fg" : ""}>{num(it.quantity_available)}</span>
                ) },
              { key: "patient_count", header: "Patients", align: "right" },
              { key: "short", header: "", sortable: false, render: (it) => it.is_short && <StatusChip tone="danger">Short</StatusChip> },
            ]}
          />
        )}
      </Modal>
    </>
  );
}
