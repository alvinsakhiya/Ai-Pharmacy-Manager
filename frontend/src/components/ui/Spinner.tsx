import { cn } from "../../lib/cn";

interface SpinnerProps {
  className?: string;
  label?: string;
}

/** Small inline spinner for button-busy and inline async states. */
export function Spinner({ className, label = "Loading" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
