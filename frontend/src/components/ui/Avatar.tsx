import { UserRound } from "lucide-react";

import { cn } from "../../lib/cn";

type AvatarSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

const PALETTES = [
  "from-lilac to-brand text-lilac-ink",
  "from-peach to-gold text-ink",
  "from-success-soft to-lilac-soft text-success-ink",
  "from-info-soft to-lilac-soft text-info-ink",
  "from-warning-soft to-peach-soft text-warning-ink",
  "from-surface-sunken to-lilac-soft text-brand",
];

function hashValue(value: string): number {
  return Array.from(value).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "AP";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({
  className,
  label,
  seed,
  size = "md",
}: {
  seed: string;
  label?: string;
  size?: AvatarSize;
  className?: string;
}) {
  const resolvedSeed = seed.trim() || label || "AI Pharmacy Manager";
  const palette = PALETTES[hashValue(resolvedSeed) % PALETTES.length];
  const display = initials(resolvedSeed);

  return (
    <span
      aria-label={label}
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br font-extrabold shadow-elev-1 ring-1 ring-inset ring-lilac-soft",
        SIZE_CLASSES[size],
        palette,
        className,
      )}
      role={label ? "img" : undefined}
    >
      <span
        aria-hidden="true"
        className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-surface opacity-35"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-current opacity-45"
      />
      <span className="relative z-10">{display}</span>
      <UserRound aria-hidden="true" className="sr-only" />
    </span>
  );
}
