import { useMemo, useState } from "react";
import { CalendarClock, Download, Moon, Sun, Sunrise, Sunset } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import {
  Button,
  Card,
  Modal,
  StatusChip,
  TableSkeleton,
} from "../components/ui";
import { useFetch } from "../hooks/useFetch";
import { tokenStore } from "../api/client";
import { dateFmt } from "../lib/format";

function exportDosettePdf(planId, ref) {
  fetch(`/api/dosette-plans/${planId}/export-pdf/`, {
    headers: { Authorization: `Bearer ${tokenStore.access}` },
  })
    .then((r) => r.blob())
    .then((b) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dosette-${ref || planId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    });
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const SLOTS = [
  { key: "morning", label: "Morning", Icon: Sunrise },
  { key: "afternoon", label: "Afternoon", Icon: Sun },
  { key: "evening", label: "Evening", Icon: Sunset },
  { key: "bedtime", label: "Bedtime", Icon: Moon },
];

const PALETTE = ["#4F46E5", "#15A463", "#E8A100", "#2D74D6", "#B42318", "#7BA05B", "#9333EA"];

function PackGrid({ items }) {
  // Map medicine -> colour for legend + cells
  const colors = {};
  items.forEach((it, i) => (colors[it.id] = PALETTE[i % PALETTE.length]));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-24" />
              {DAYS.map((d) => (
                <th key={d} className="text-micro uppercase text-text-tertiary">{DAY_LABEL[d]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map(({ key, label, Icon }) => (
              <tr key={key}>
                <td className="pr-2 text-right">
                  <span className="inline-flex items-center gap-1.5 text-caption font-medium text-text-secondary">
                    <Icon size={14} /> {label}
                  </span>
                </td>
                {DAYS.map((day) => {
                  const inCell = items.filter((it) => (it.schedule?.[day] || []).includes(key));
                  return (
                    <td key={day} className="align-top">
                      <div className="min-h-[44px] rounded-lg border border-border-subtle bg-subtle/60 p-1 transition-colors hover:bg-accent-soft/60">
                        <div className="flex flex-wrap gap-1">
                          {inCell.map((it) => (
                            <span
                              key={it.id}
                              title={`${it.medicine_label} ×${it.dose_quantity}`}
                              className="h-2.5 w-2.5 rounded-full transition-transform hover:scale-125"
                              style={{ background: colors[it.id] }}
                            />
                          ))}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {items.map((it) => (
          <span key={it.id} className="inline-flex items-center gap-1.5 text-caption text-text-secondary">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[it.id] }} />
            {it.medicine_label}
            {it.dose_quantity > 1 && <span className="text-text-tertiary">×{it.dose_quantity}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Dosette() {
  const [selected, setSelected] = useState(null);
  const { data, loading } = useFetch("/dosette-plans/", { params: { is_active: true, page_size: 500 } });
  const detail = useFetch(`/dosette-plans/${selected?.id}/`, { skip: !selected });
  const cycles = useFetch("/dosette-cycles/", { params: { ordering: "due_date", page_size: 20 } });

  const columns = [
    { key: "patient_name", header: "Patient", render: (r) => (
        <div>
          <div className="font-medium text-text-primary">{r.patient_name}</div>
          <div className="text-caption text-text-tertiary">{r.patient_ref}</div>
        </div>
      ) },
    { key: "frequency", header: "Frequency", render: (r) => (
        <StatusChip tone="info" icon={false}>{r.frequency === "monthly" ? "Monthly" : "Weekly"}</StatusChip>
      ) },
    { key: "item_count", header: "Medicines", align: "right" },
    { key: "review_date", header: "Review due", render: (r) => dateFmt(r.review_date) },
    { key: "review", header: "Status", sortable: false, render: (r) =>
        r.review_overdue ? <StatusChip tone="danger">Review overdue</StatusChip> : <StatusChip tone="success" icon={false} dot>On track</StatusChip> },
  ];

  return (
    <>
      <PageHeader title="Dosette" subtitle="Compliance-pack plans, schedules & preparation cycles" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="border-b border-border-subtle px-5 py-3">
            <h3 className="text-subtitle font-semibold">Active plans</h3>
          </div>
          {loading ? <TableSkeleton /> : (
            <DataTable columns={columns} rows={data?.results || []} onRowClick={setSelected} />
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock size={18} className="text-text-secondary" />
            <h3 className="text-subtitle font-semibold">Upcoming cycles</h3>
          </div>
          <ul className="space-y-2">
            {(cycles.data?.results || []).slice(0, 10).map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2">
                <div>
                  <div className="text-body font-medium">{c.patient_name}</div>
                  <div className="text-caption text-text-tertiary">Due {dateFmt(c.due_date)}</div>
                </div>
                {c.is_overdue ? (
                  <StatusChip tone="danger">Overdue</StatusChip>
                ) : c.days_to_due <= 3 ? (
                  <StatusChip tone="warning">{c.days_to_due}d</StatusChip>
                ) : (
                  <StatusChip tone="neutral" icon={false}>{c.days_to_due}d</StatusChip>
                )}
              </li>
            ))}
            {(cycles.data?.results || []).length === 0 && (
              <li className="py-6 text-center text-body text-text-tertiary">No cycles scheduled.</li>
            )}
          </ul>
        </Card>
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.patient_name} · ${selected.patient_ref}` : ""}
        wide
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => exportDosettePdf(selected.id, selected.patient_ref)}
            >
              <Download size={16} /> Print summary
            </Button>
            <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
          </>
        }
      >
        {detail.loading || !detail.data ? (
          <TableSkeleton rows={4} cols={7} />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusChip tone="info" icon={false}>
                {detail.data.frequency === "monthly" ? "Monthly pack" : "Weekly pack"}
              </StatusChip>
              <StatusChip tone="neutral" icon={false}>Start {dateFmt(detail.data.start_date)}</StatusChip>
              {detail.data.review_overdue ? (
                <StatusChip tone="danger">Review overdue ({dateFmt(detail.data.review_date)})</StatusChip>
              ) : (
                <StatusChip tone="neutral" icon={false}>Review {dateFmt(detail.data.review_date)}</StatusChip>
              )}
            </div>
            <h4 className="mb-2 text-micro uppercase text-text-tertiary">Weekly schedule</h4>
            <PackGrid items={detail.data.items || []} />
          </>
        )}
      </Modal>
    </>
  );
}
