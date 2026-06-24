import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  /** Optional leading icon (decorative — the text label carries meaning). */
  icon?: ReactNode;
  /** Show a small status dot instead of an icon. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

const variants: Record<BadgeVariant, string> = {
  neutral: "text-ink-soft bg-surface-subtle border-line",
  brand: "text-brand-ink bg-brand-soft border-brand-soft",
  success: "text-success-ink bg-success-soft border-success-border",
  warning: "text-warning-ink bg-warning-soft border-warning-border",
  danger: "text-danger-ink bg-danger-soft border-danger-border",
  info: "text-info-ink bg-info-soft border-info-border",
};

const dotColors: Record<BadgeVariant, string> = {
  neutral: "bg-muted",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

/**
 * Status chip / badge — pill, semantic colour, always paired with a label
 * (and optional icon/dot). Never relies on colour alone.
 */
export function Badge({
  variant = "neutral",
  icon,
  dot,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
        variants[variant],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full", dotColors[variant])}
        />
      ) : null}
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
