import { useId } from "react";

import { cn } from "../../lib/cn";

type LogoVariant = "icon" | "full" | "compact";
type LogoTone = "onDark" | "onLight";

interface AppLogoProps {
  /** icon = mark only · full = mark + stacked wordmark · compact = mark + inline wordmark */
  variant?: LogoVariant;
  /** Surface the logo sits on, drives wordmark + accent contrast. */
  tone?: LogoTone;
  /** Mark size in px (square). */
  size?: number;
  /** Optional supporting line under the wordmark (full variant only). */
  tagline?: string;
  /** Accessible name when the mark stands alone; otherwise the mark is decorative. */
  label?: string;
  /** Force the icon variant to be decorative (aria-hidden) when a wordmark is already shown nearby. */
  decorative?: boolean;
  className?: string;
}

/**
 * AI Pharmacy Manager brand mark.
 *
 * A lilac squircle holding a deep-plum medical cross whose top arm is a
 * cream pharmacy-capsule cap (the seam reads as a split pill), with a small
 * cream node graph on the lower arm hinting at intelligent software. Built
 * from solid hex fills only (no translucent/glass utilities) so it stays
 * crisp from 32px up and reads cleanly on both the dark rail and light cards.
 */
function LogoMark({
  size = 44,
  decorative = true,
  label,
  className,
}: {
  size?: number;
  decorative?: boolean;
  label?: string;
  className?: string;
}) {
  const tileId = useId();
  const capClipId = useId();

  return (
    <svg
      className={cn("shrink-0", className)}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : label}
    >
      <defs>
        <linearGradient
          id={tileId}
          x1="0"
          y1="0"
          x2="48"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#d8c7fb" />
          <stop offset="1" stopColor="#b497f1" />
        </linearGradient>
        <clipPath id={capClipId}>
          <rect x="19.25" y="7.5" width="9.5" height="33" rx="4.75" />
        </clipPath>
      </defs>

      {/* Squircle tile — solid lilac gradient (no translucency). */}
      <rect x="0" y="0" width="48" height="48" rx="13" fill={`url(#${tileId})`} />

      {/* Medical cross — vertical arm doubles as the capsule body. */}
      <g fill="#2e2348">
        <rect x="19.25" y="7.5" width="9.5" height="33" rx="4.75" />
        <rect x="7.5" y="19.25" width="33" height="9.5" rx="4.75" />
      </g>

      {/* Cream capsule cap on the top arm + lilac seam = the pharmacy pill. */}
      <rect
        x="19.25"
        y="7.5"
        width="9.5"
        height="11.75"
        fill="#f6f2ff"
        clipPath={`url(#${capClipId})`}
      />
      <rect
        x="19.25"
        y="17.6"
        width="9.5"
        height="1.3"
        fill="#c9b6f6"
        clipPath={`url(#${capClipId})`}
      />

      {/* Node graph on the lower arm = intelligent software. */}
      <g stroke="#f6f2ff" strokeWidth="1.1" strokeLinecap="round">
        <line x1="24" y1="30.4" x2="21" y2="35.6" />
        <line x1="24" y1="30.4" x2="27" y2="35.6" />
      </g>
      <g fill="#f6f2ff">
        <circle cx="24" cy="30.1" r="1.7" />
        <circle cx="21" cy="35.8" r="1.4" />
        <circle cx="27" cy="35.8" r="1.4" />
      </g>
    </svg>
  );
}

function Wordmark({
  tone,
  inline = false,
  tagline,
}: {
  tone: LogoTone;
  inline?: boolean;
  tagline?: string;
}) {
  const nameTone = tone === "onDark" ? "text-white" : "text-ink";
  const accentTone = tone === "onDark" ? "text-lilac" : "text-brand";

  if (inline) {
    return (
      <span
        className={cn(
          "text-[11px] font-bold uppercase tracking-[0.12em]",
          tone === "onDark" ? "text-sidebar-text" : "text-muted",
        )}
      >
        <span className={accentTone}>AI</span> Pharmacy Manager
      </span>
    );
  }

  return (
    <span className="min-w-0 leading-tight">
      <span
        className={cn(
          "block truncate text-[15px] font-bold tracking-tight",
          nameTone,
        )}
      >
        <span className={accentTone}>AI</span> Pharmacy Manager
      </span>
      {tagline ? (
        <span
          className={cn(
            "mt-0.5 block text-xs",
            tone === "onDark" ? "text-sidebar-muted" : "text-muted",
          )}
        >
          {tagline}
        </span>
      ) : null}
    </span>
  );
}

export function AppLogo({
  variant = "full",
  tone = "onDark",
  size,
  tagline,
  label = "AI Pharmacy Manager",
  decorative = false,
  className,
}: AppLogoProps) {
  if (variant === "icon") {
    return (
      <LogoMark
        size={size ?? 44}
        decorative={decorative}
        label={label}
        className={className}
      />
    );
  }

  if (variant === "compact") {
    return (
      <span className={cn("inline-flex items-center gap-2.5", className)}>
        <LogoMark size={size ?? 36} />
        <Wordmark tone={tone} inline />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <LogoMark size={size ?? 44} />
      <Wordmark tone={tone} tagline={tagline} />
    </span>
  );
}
