import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "../../lib/cn";

type IconButtonVariant = "default" | "dark" | "soft" | "peach" | "ghost";
type IconButtonSize = "sm" | "md" | "lg";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon buttons have no visible text, so they need an accessible name. */
  "aria-label": string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  icon: ReactNode;
}

const base =
  "inline-flex shrink-0 items-center justify-center rounded-full " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-soft " +
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
  "active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<IconButtonVariant, string> = {
  default:
    "border border-line-strong bg-surface text-ink-soft shadow-elev-1 hover:bg-surface-subtle hover:text-ink",
  dark: "bg-sidebar text-white hover:bg-sidebar-raised",
  soft: "bg-lilac-soft text-brand hover:bg-lilac hover:text-lilac-ink",
  peach: "bg-peach-soft text-peach-ink hover:bg-peach hover:text-white",
  ghost: "text-ink-soft hover:bg-surface-sunken",
};

const sizes: Record<IconButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-11 w-11",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { variant = "default", size = "md", icon, className, type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(base, variants[variant], sizes[size], className)}
        {...rest}
      >
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      </button>
    );
  },
);
