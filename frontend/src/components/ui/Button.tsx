import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "../../lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon (e.g. a Lucide icon). Decorative — kept out of the label. */
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-soft " +
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
  "active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 " +
  "disabled:hover:translate-y-0";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-lilac text-lilac-ink border border-lilac shadow-elev-1 hover:bg-lilac-hover hover:border-lilac-hover hover:-translate-y-px hover:shadow-elev-2",
  secondary:
    "bg-surface text-ink-soft border border-line-strong shadow-elev-1 hover:bg-surface-subtle hover:text-ink hover:-translate-y-px",
  subtle:
    "bg-surface-sunken text-ink-soft border border-transparent hover:bg-line-strong/40 hover:text-ink",
  ghost: "bg-transparent text-ink-soft border border-transparent hover:bg-surface-sunken",
  danger:
    "bg-danger text-white border border-danger shadow-elev-1 hover:bg-danger-ink hover:border-danger-ink hover:-translate-y-px",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      leadingIcon,
      trailingIcon,
      fullWidth,
      className,
      type = "button",
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          base,
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className,
        )}
        {...rest}
      >
        {leadingIcon ? (
          <span aria-hidden="true" className="-ml-0.5 inline-flex shrink-0">
            {leadingIcon}
          </span>
        ) : null}
        {children}
        {trailingIcon ? (
          <span aria-hidden="true" className="-mr-0.5 inline-flex shrink-0">
            {trailingIcon}
          </span>
        ) : null}
      </button>
    );
  },
);
