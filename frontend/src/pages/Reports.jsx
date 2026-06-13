import { useState } from "react";
import {
  Boxes,
  CalendarClock,
  Download,
  LineChart,
  PackageX,
  PoundSterling,
  Users,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { Button, Card, Modal, Skeleton } from "../components/ui";
import api, { tokenStore } from "../api/client";

const REPORTS = [
  { key: "stock-valuation", title: "Stock valuation", icon: PoundSterling, desc: "Units, unit cost and total value by medicine." },
  { key: "expiry", title: "Expiry report", icon: PackageX, desc: "Batches expiring within the next 6 months." },
  { key: "low-stock", title: "Low stock", icon: Boxes, desc: "Medicines at or below their reorder level." },
  { key: "dosette-workload", title: "Dosette workload", icon: CalendarClock, desc: "Active plans, medicine counts and reviews." },
  { key: "forecasting", title: "Forecasting & reorder", icon: LineChart, desc: "Demand forecast and reorder recommendations." },
  { key: "patient-summary", title: "Patient summary", icon: Users, desc: "Pseudo-anonymised patient overview." },
];

function download(key, fmt) {
  fetch(`/api/reports/${key}/?format=${fmt}`, {
    headers: { Authorization: `Bearer ${tokenStore.access}` },
  })
    .then((r) => r.blob())
    .then((b) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${key}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    });
}

export default function Reports() {
  const [open, setOpen] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  async function view(key) {
    setOpen(key);
    setLoading(true);
    setReport(null);
    try {
      const { data } = await api.get(`/reports/${key}/`);
      setReport(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Reports" subtitle="Generate and export operational reports (PDF / CSV)" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.key} className="flex flex-col p-5 transition-all duration-150 ease hover:shadow-elev-2">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <r.icon size={20} />
            </div>
            <h3 className="text-subtitle font-semibold">{r.title}</h3>
            <p className="mt-1 flex-1 text-body text-text-secondary">{r.desc}</p>
            <div className="mt-4 flex items-center gap-2">
              <Button size="sm" onClick={() => view(r.key)}>View</Button>
              <Button size="sm" variant="secondary" onClick={() => download(r.key, "pdf")}><Download size={14} /> PDF</Button>
              <Button size="sm" variant="ghost" onClick={() => download(r.key, "csv")}>CSV</Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title={report?.title || "Report"} wide
        footer={
          <>
            <Button variant="secondary" onClick={() => download(open, "pdf")}><Download size={16} /> PDF</Button>
            <Button variant="secondary" onClick={() => download(open, "csv")}>CSV</Button>
          </>
        }
      >
        {loading || !report ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <p className="mb-3 text-body text-text-secondary">{report.subtitle}</p>
            <DataTable
              dense
              rows={(report.rows || []).map((row, i) => ({ _i: i, ...row }))}
              rowKey="_i"
              columns={(report.columns || []).map((c) => ({
                key: c,
                header: c,
                render: (row) => String(row[c]),
              }))}
            />
          </>
        )}
      </Modal>
    </>
  );
}
