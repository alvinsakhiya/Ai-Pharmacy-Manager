import { Database, FlaskConical } from "lucide-react";
import { StatusChip } from "../ui";

export default function AIDataNotice({ live }) {
  if (live == null) return null;

  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2"
    >
      <span className="flex items-center gap-2 text-caption text-text-secondary">
        {live
          ? <Database size={15} className="text-success-fg" aria-hidden="true" />
          : <FlaskConical size={15} className="text-info-fg" aria-hidden="true" />}
        {live
          ? "Results use the connected application API."
          : "Academic simulation using deterministic sample data; no clinical decisions are automated."}
      </span>
      <StatusChip tone={live ? "success" : "info"} icon={false}>
        {live ? "Live API data" : "Simulated data"}
      </StatusChip>
    </div>
  );
}
