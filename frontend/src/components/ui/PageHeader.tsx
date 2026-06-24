import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

interface PageHeaderProps {
  /** Small uppercase eyebrow above the title. */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Sub-line beneath the subtitle (e.g. "Demo data · Last updated just now"). */
  meta?: ReactNode;
  /** Right-aligned page actions. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Standard page header — eyebrow, title, subtitle, meta line, and right-aligned
 * actions. Use as the first element of every screen for cross-surface rhythm.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1.5 text-[26px] font-extrabold tracking-[-0.025em] text-ink sm:text-[28px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            {subtitle}
          </p>
        ) : null}
        {meta ? (
          <p className="mt-2 text-xs font-medium text-muted">{meta}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
