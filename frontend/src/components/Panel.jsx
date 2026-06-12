export function Panel({ children, className = "" }) {
  return (
    <section className={`surface-card ${className}`}>
      {children}
    </section>
  );
}

export function PanelHeader({
  action,
  description,
  eyebrow,
  icon: Icon,
  title,
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200/80 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Icon aria-hidden="true" size={20} />
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
              {eyebrow}
            </p>
          )}
          <h2 className="text-lg font-bold tracking-tight text-slate-950">{title}</h2>
          {description && (
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
