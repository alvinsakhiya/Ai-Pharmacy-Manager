import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";

/**
 * Panel — the house surface. bg-surface, hairline border, soft shadow, 12px
 * radius. Use PanelHeader / PanelBody for the standard head + body rhythm.
 */
export function Panel({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-line bg-surface shadow-soft",
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}

interface PanelHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned actions (buttons, links). */
  actions?: ReactNode;
  /** Optional leading icon glyph. */
  icon?: ReactNode;
}

export function PanelHeader({
  title,
  subtitle,
  actions,
  icon,
  className,
  children,
  ...rest
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-h-[54px] items-center justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-5",
        className,
      )}
      {...rest}
    >
      {children ?? (
        <div className="flex min-w-0 items-center gap-3">
          {icon ? (
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-lilac-soft bg-lilac-soft text-brand"
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            {title ? (
              <h2 className="truncate text-[15px] font-bold tracking-[-0.01em] text-ink">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>
            ) : null}
          </div>
        </div>
      )}
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PanelBody({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-4 sm:p-5", className)} {...rest}>
      {children}
    </div>
  );
}
