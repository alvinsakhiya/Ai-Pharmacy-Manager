import { useId } from "react";

import { cn } from "../../lib/cn";

type LogoVariant = "icon" | "full" | "compact";
type LogoTone = "onDark" | "onLight";

interface AppLogoProps {
  /** icon = mark only · full = mark + stacked wordmark · compact = mark + inline wordmark */
  variant?: LogoVariant;
  /** Surface the logo sits on, drives text contrast. */
  tone?: LogoTone;
  /** Mark size in px (square). */
  size?: number;
  /** Optional supporting line under the wordmark (full variant only). */
  tagline?: string;
  /** Accessible name when the mark stands alone; otherwise the mark is decorative. */
  label?: string;
  /** Hide the icon from assistive tech when visible text already names the brand. */
  decorative?: boolean;
  className?: string;
}

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
      className={cn("block shrink-0 drop-shadow-sm", className)}
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

      <rect x="0" y="0" width="48" height="48" rx="13" fill={`url(#${tileId})`} />

      <g fill="#2e2348">
        <rect x="19.25" y="7.5" width="9.5" height="33" rx="4.75" />
        <rect x="7.5" y="19.25" width="33" height="9.5" rx="4.75" />
      </g>

      <rect
        x="19.25"
        y="7.5"
        width="9.5"
        height="11.75"
        fill="#f8f3e8"
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

      <g stroke="#f8f3e8" strokeWidth="1.1" strokeLinecap="round">
        <line x1="24" y1="30.4" x2="21" y2="35.6" />
        <line x1="24" y1="30.4" x2="27" y2="35.6" />
      </g>
      <g fill="#f8f3e8">
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
  const metaTone = tone === "onDark" ? "text-sidebar-muted" : "text-muted";

  if (inline) {
    return (
      <span
        className={cn(
          "min-w-0 text-[13px] font-extrabold tracking-[-0.01em]",
          nameTone,
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
          "block truncate text-[15px] font-extrabold tracking-[-0.015em]",
          nameTone,
        )}
      >
        <span className={accentTone}>AI</span> Pharmacy Manager
      </span>
      {tagline ? (
        <span className={cn("mt-1 block truncate text-xs font-medium", metaTone)}>
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
      <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
        <LogoMark size={size ?? 36} />
        <Wordmark tone={tone} inline />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-3", className)}>
      <LogoMark size={size ?? 44} />
      <Wordmark tone={tone} tagline={tagline} />
    </span>
  );
}
