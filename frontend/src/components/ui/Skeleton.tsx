import { cn } from "../../lib/cn";

interface SkeletonProps {
  className?: string;
}

/**
 * Loading skeleton — a calm shimmering placeholder. Prefer skeletons over a
 * spinner over a blank page (pro tools live or die on their loading states).
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block overflow-hidden rounded-xl bg-surface-sunken",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer",
        "after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent",
        className,
      )}
    />
  );
}

/** A skeleton block of stacked table-style rows for loading data tables. */
export function SkeletonRows({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2.5", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
