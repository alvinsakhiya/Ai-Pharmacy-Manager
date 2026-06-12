export function Skeleton({ className = "" }) {
  return <span aria-hidden="true" className={`skeleton block ${className}`} />;
}

function SkeletonStatus({ label }) {
  return (
    <span className="sr-only" role="status">
      {label}
    </span>
  );
}

export function TableSkeleton({ columns = 5, rows = 6, label = "Loading records..." }) {
  return (
    <div className="p-5 sm:p-6">
      <SkeletonStatus label={label} />
      <div
        aria-hidden="true"
        className="grid gap-x-6 gap-y-5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }, (_, column) => (
          <Skeleton key={`head-${column}`} className="h-3.5 w-3/5" />
        ))}
        {Array.from({ length: rows * columns }, (_, cell) => (
          <Skeleton
            key={`cell-${cell}`}
            className={cell % columns === 0 ? "h-5 w-4/5" : "h-5 w-2/3"}
          />
        ))}
      </div>
    </div>
  );
}

export function StatTileSkeleton({ tiles = 3 }) {
  return (
    <>
      {Array.from({ length: tiles }, (_, tile) => (
        <div key={tile} aria-hidden="true" className="surface-card px-4 py-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2.5 h-6 w-12" />
        </div>
      ))}
    </>
  );
}

export function CardSkeleton({ label = "Loading records..." }) {
  return (
    <div className="p-5 sm:p-6">
      <SkeletonStatus label={label} />
      <div aria-hidden="true" className="space-y-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-2 h-3.5 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, slot) => (
            <Skeleton key={slot} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      <SkeletonStatus label="Preparing your operations overview..." />
      <div aria-hidden="true">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, card) => (
            <div key={card} className="surface-card p-5 sm:p-6">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-4 h-8 w-16" />
              <Skeleton className="mt-3 h-3 w-3/4" />
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          {Array.from({ length: 2 }, (_, panel) => (
            <div key={panel} className="surface-card p-5 sm:p-6">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="mt-2 h-3.5 w-1/2" />
              <div className="mt-6 space-y-4">
                {Array.from({ length: 4 }, (_, row) => (
                  <Skeleton key={row} className="h-9 w-full rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
