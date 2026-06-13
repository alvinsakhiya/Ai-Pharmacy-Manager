import { useState } from "react";
import { TimerReset } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { Button, Card, EmptyState, StatusChip, TableSkeleton } from "../components/ui";
import { useFetch } from "../hooks/useFetch";
import { dateFmt, num, expiryBand } from "../lib/format";

const WINDOWS = [
  { key: "30", label: "1 month" },
  { key: "90", label: "3 months" },
  { key: "180", label: "6 months" },
];

export default function Expiry() {
  const [win, setWin] = useState("90");
  const { data, loading } = useFetch("/batches/", {
    params: { expiry_within: win, ordering: "expiry_date", page_size: 500 },
  });
  const expired = useFetch("/batches/", { params: { expired: "true", page_size: 500 } });

  const rows = data?.results || [];

  const columns = [
    { key: "medicine_label", header: "Medicine", render: (r) => <span className="font-medium">{r.medicine_label}</span> },
    { key: "batch_number", header: "Batch", render: (r) => <span className="tnum">{r.batch_number}</span> },
    { key: "expiry_date", header: "Expiry", render: (r) => dateFmt(r.expiry_date) },
    { key: "days_to_expiry", header: "Days left", align: "right",
      render: (r) => {
        const b = expiryBand(r.days_to_expiry);
        return <StatusChip icon={false} dot style={{ background: b.bg, color: b.text }}>{num(r.days_to_expiry)}d</StatusChip>;
      } },
    { key: "quantity_on_hand", header: "Units", align: "right", render: (r) => num(r.quantity_on_hand) },
    { key: "location", header: "Location", render: (r) => r.location || "—" },
  ];

  return (
    <>
      <PageHeader
        title="Expiry management"
        subtitle="Batches approaching expiry — act before waste occurs"
        actions={
          <div className="flex gap-1.5">
            {WINDOWS.map((w) => (
              <Button key={w.key} size="sm" variant={win === w.key ? "primary" : "secondary"} onClick={() => setWin(w.key)}>
                {w.label}
              </Button>
            ))}
          </div>
        }
      />

      {expired.data && expired.data.count > 0 && (
        <Card className="mb-4 border-danger/30 bg-danger-bg/40 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-body font-semibold text-danger-fg">
                {expired.data.count} expired batch{expired.data.count === 1 ? "" : "es"} still in stock
              </div>
              <div className="text-caption text-text-secondary">These must be quarantined and recorded as wastage.</div>
            </div>
            <StatusChip tone="danger">Action required</StatusChip>
          </div>
        </Card>
      )}

      <Card>
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={TimerReset} title="Nothing expiring in this window" hint="Stock looks healthy for the selected period." />
        ) : (
          <DataTable columns={columns} rows={rows} />
        )}
      </Card>
    </>
  );
}
