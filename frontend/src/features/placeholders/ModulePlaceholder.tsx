interface ModulePlaceholderProps {
  title: string;
  description: string;
}

export function ModulePlaceholder({
  title,
  description,
}: ModulePlaceholderProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">
        Placeholder
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
        {description}
      </p>
    </section>
  );
}
