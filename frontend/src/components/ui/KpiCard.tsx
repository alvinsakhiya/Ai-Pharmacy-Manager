import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

interface KpiCardProps {
  /** Uppercase eyebrow label. */
  label: ReactNode;
  value: ReactNode;
  /** Small unit beside the value (e.g. "items", "open"). */
  unit?: ReactNode;
  /** Supporting note beneath the value. */
  note?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/**
 * Compact metric card for dashboard overviews. Calm surface, big tabular value,
 * one supporting note. Restraint over decoration.
 */
export function KpiCard({
  label,
  value,
  unit,
  note,
  icon,
  className,
}: KpiCardProps) {
  return (
    <article
      className={cn(
        "interactive-card flex min-h-[120px] flex-col justify-between rounded-2xl border border-line bg-surface p-5 shadow-soft",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink-soft">{label}</p>
        {icon ? (
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong text-ink-soft"
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="tnum text-2xl font-extrabold tracking-[-0.02em] text-ink">
            {value}
          </span>
          {unit ? (
            <span className="text-[11px] font-bold text-muted">{unit}</span>
          ) : null}
        </div>
        {note ? (
          <p className="mt-2 text-xs font-medium text-muted">{note}</p>
        ) : null}
      </div>
    </article>
  );
}
