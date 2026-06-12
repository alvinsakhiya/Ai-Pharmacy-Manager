function PageHeader({
  actions,
  description,
  eyebrow,
  icon: Icon,
  title,
}) {
  return (
    <header className="mb-6 flex flex-col gap-5 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        {Icon && (
          <div className="mt-0.5 hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-teal-200 bg-teal-50 text-teal-700 shadow-sm sm:flex">
            <Icon aria-hidden="true" size={24} strokeWidth={2} />
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700">
              {eyebrow}
            </p>
          )}
          <h1 className="text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
              {description}
            </p>
          )}
        </div>
      </div>

      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </header>
  );
}

export default PageHeader;
