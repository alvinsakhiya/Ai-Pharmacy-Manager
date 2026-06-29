import { AppLogo } from "../brand/AppLogo";

interface LogoProps {
  /** Square size in px. */
  size?: number;
  className?: string;
  /** Render the mark aria-hidden when a visible wordmark already names the brand nearby. */
  decorative?: boolean;
  /** Accessible name used when the mark stands alone. */
  label?: string;
}

/**
 * Standalone brand mark for AI Pharmacy Manager. Thin wrapper around the
 * canonical {@link AppLogo} icon variant so splash/auth surfaces share one
 * source of truth for the logo. Pass `decorative` when visible brand text
 * sits beside the mark so assistive tech announces the name only once.
 */
export function Logo({
  size = 44,
  className,
  decorative = false,
  label,
}: LogoProps) {
  return (
    <AppLogo
      variant="icon"
      size={size}
      className={className}
      decorative={decorative}
      label={label}
    />
  );
}
