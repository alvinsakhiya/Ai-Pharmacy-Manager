function PageHeader({
  actions,
  description,
  eyebrow,
  icon: Icon,
  title,
}) {
  return (
    <header className="mb-5 flex flex-col gap-4 sm:mb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        {Icon && (
          <div className="mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/52 text-blue-600 shadow-sm backdrop-blur-xl sm:flex">
            <Icon aria-hidden="true" size={21} strokeWidth={2} />
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.17em] text-blue-600">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
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
