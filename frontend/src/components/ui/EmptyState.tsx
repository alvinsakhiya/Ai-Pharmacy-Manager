import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

type EmptyTone = "neutral" | "danger";

interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** A single clear next action. */
  action?: ReactNode;
  tone?: EmptyTone;
  className?: string;
}

const tones: Record<EmptyTone, { wrap: string; icon: string }> = {
  neutral: {
    wrap: "border-line bg-surface",
    icon: "border-line bg-surface-subtle text-muted",
  },
  danger: {
    wrap: "border-danger-border bg-danger-soft",
    icon: "border-danger-border bg-surface text-danger",
  },
};

/**
 * Empty / error state — calm centered icon, one line of explanation, and one
 * clear next action. Every data view should render this instead of a blank box.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: EmptyStateProps) {
  const t = tones[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border px-6 py-12 text-center shadow-soft",
        t.wrap,
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            "mb-4 grid h-14 w-14 place-items-center rounded-full border",
            t.icon,
          )}
        >
          {icon}
        </span>
      ) : null}
      <h3
        className={cn(
          "text-base font-bold",
          tone === "danger" ? "text-danger-ink" : "text-ink",
        )}
      >
        {title}
      </h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
