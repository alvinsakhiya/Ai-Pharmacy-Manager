import { useMemo, useState } from "react";
import { Boxes, PackagePlus, Pencil, Plus, Search } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  StatusChip,
  TableSkeleton,
} from "../components/ui";
import { BatchForm, MedicineForm } from "../components/StockForms";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { gbp, num, dateFmt, expiryBand } from "../lib/format";

function ExpiryChip({ days }) {
  const b = expiryBand(days);
  return (
    <StatusChip icon={false} dot style={{ background: b.bg, color: b.text }}>
      {b.label}
    </StatusChip>
  );
}

export default function Stock() {
  const { can } = useAuth();
  const canEdit = can("pharmacist", "administrator");
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [medFormOpen, setMedFormOpen] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const { data, loading, error, refetch } = useFetch("/medicines/", {
    params: { search: q || undefined, page_size: 500 },
  });
  const detail = useFetch(`/medicines/${selected?.id}/`, { skip: !selected });

  const rows = useMemo(() => {
    let list = data?.results || [];
    if (lowOnly) list = list.filter((m) => m.is_low_stock);
    return list;
  }, [data, lowOnly]);

  const columns = [
    { key: "label", header: "Medicine", render: (r) => (
        <div>
          <div className="font-medium text-text-primary">{r.label}</div>
          <div className="text-caption text-text-tertiary">{r.manufacturer_name || "—"}</div>
        </div>
      ) },
    { key: "quantity_on_hand", header: "On hand", align: "right",
      sortAccessor: (r) => r.quantity_on_hand,
      render: (r) => <span className="tnum">{num(r.quantity_on_hand)}</span> },
    { key: "reorder_level", header: "Reorder lvl", align: "right",
      render: (r) => <span className="tnum text-text-secondary">{num(r.reorder_level)}</span> },
    { key: "status", header: "Status", sortable: false, render: (r) =>
        r.is_low_stock ? (
          <StatusChip tone="warning">Low stock</StatusChip>
        ) : (
          <StatusChip tone="success" icon={false} dot>In stock</StatusChip>
        ) },
    { key: "stock_value", header: "Value", align: "right",
      sortAccessor: (r) => r.stock_value, render: (r) => <span className="tnum">{gbp(r.stock_value)}</span> },
    { key: "supplier_name", header: "Supplier", render: (r) => r.supplier_name || "—" },
  ];

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle="FEFO inventory — batch & expiry tracked"
        actions={
          <div className="flex gap-2">
            <Button
              variant={lowOnly ? "primary" : "secondary"}
              onClick={() => setLowOnly((v) => !v)}
            >
              {lowOnly ? "Showing low stock" : "Low stock only"}
            </Button>
            {canEdit && (
              <Button onClick={() => { setEditingMed(null); setMedFormOpen(true); }}>
                <Plus size={16} /> New medicine
              </Button>
            )}
          </div>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex items-center gap-2 text-text-tertiary">
          <Search size={16} />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or strength…"
            className="border-0 px-0 focus:ring-0"
          />
        </div>
      </Card>

      <Card>
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Boxes} title="No medicines found" hint="Try a different search or clear the low-stock filter." />
        ) : (
          <DataTable columns={columns} rows={rows} onRowClick={setSelected} />
        )}
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.label}
        wide
        footer={
          <>
            {canEdit && (
              <>
                <Button variant="secondary" onClick={() => setBatchOpen(true)}>
                  <PackagePlus size={15} /> Goods in
                </Button>
                <Button variant="secondary" onClick={() => { setEditingMed(detail.data || selected); setMedFormOpen(true); }}>
                  <Pencil size={15} /> Edit
                </Button>
              </>
            )}
            <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
          </>
        }
      >
        {detail.loading || !detail.data ? (
          <TableSkeleton rows={4} cols={4} />
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Stat label="On hand" value={num(detail.data.quantity_on_hand)} />
              <Stat label="Reorder level" value={num(detail.data.reorder_level)} />
              <Stat label="Stock value" value={gbp(detail.data.stock_value)} />
            </div>
            <h4 className="mb-2 text-micro uppercase text-text-tertiary">Batches · FEFO order (soonest expiry first)</h4>
            <DataTable
              dense
              sortable={false}
              rows={detail.data.batches || []}
              columns={[
                { key: "batch_number", header: "Batch" },
                { key: "expiry_date", header: "Expiry", render: (b) => dateFmt(b.expiry_date) },
                { key: "expiry_band", header: "FEFO", render: (b) => <ExpiryChip days={b.days_to_expiry} /> },
                { key: "quantity_on_hand", header: "Units", align: "right", render: (b) => num(b.quantity_on_hand) },
                { key: "location", header: "Loc", render: (b) => b.location || "—" },
              ]}
            />
          </>
        )}
      </Modal>

      <MedicineForm
        open={medFormOpen}
        medicine={editingMed}
        onClose={() => setMedFormOpen(false)}
        onSaved={() => { refetch(); if (selected) detail.refetch(); }}
      />
      <BatchForm
        open={batchOpen}
        medicine={detail.data || selected}
        onClose={() => setBatchOpen(false)}
        onSaved={() => { refetch(); detail.refetch(); }}
      />
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-subtle p-3">
      <div className="text-caption text-text-secondary">{label}</div>
      <div className="text-title font-semibold tnum">{value}</div>
    </div>
  );
}
