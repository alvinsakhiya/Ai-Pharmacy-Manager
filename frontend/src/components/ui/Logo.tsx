import { useId } from "react";

import { cn } from "../../lib/cn";

interface LogoProps {
  /** Square size in px. */
  size?: number;
  className?: string;
}

/**
 * Brand mark for AI Pharmacy Manager. A lilac app tile holding a two-tone
 * capsule (white + peach) — the house lilac/peach accents, unmistakably a
 * pharmacy product. Decorative: the wordmark beside it carries the name.
 */
export function Logo({ size = 44, className }: LogoProps) {
  const clipId = useId();
  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0", className)}
      height={size}
      width={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="10" y="16.5" width="24" height="11" rx="5.5" />
        </clipPath>
      </defs>
      <rect width="44" height="44" rx="13" fill="#c9b6f6" />
      <g transform="rotate(-40 22 22)">
        <rect x="10" y="16.5" width="24" height="11" rx="5.5" fill="#ffffff" />
        <rect
          x="22"
          y="16.5"
          width="12"
          height="11"
          fill="#ec9a82"
          clipPath={`url(#${clipId})`}
        />
        <rect
          x="21.1"
          y="16.5"
          width="1.8"
          height="11"
          fill="#c9b6f6"
          clipPath={`url(#${clipId})`}
        />
      </g>
    </svg>
  );
}
