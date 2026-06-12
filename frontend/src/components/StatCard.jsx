const toneStyles = {
  teal: {
    icon: "border-teal-200 bg-teal-50 text-teal-700",
    accent: "from-teal-500 to-cyan-500",
  },
  blue: {
    icon: "border-blue-200 bg-blue-50 text-blue-700",
    accent: "from-blue-500 to-cyan-500",
  },
  purple: {
    icon: "border-violet-200 bg-violet-50 text-violet-700",
    accent: "from-violet-500 to-fuchsia-500",
  },
  amber: {
    icon: "border-amber-200 bg-amber-50 text-amber-700",
    accent: "from-amber-500 to-orange-500",
  },
};

function StatCard({ icon: Icon, subtitle, title, tone = "teal", value }) {
  const styles = toneStyles[tone];

  return (
    <article className="surface-card group relative overflow-hidden p-5 sm:p-6">
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${styles.accent}`}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950">
            {value}
          </p>
          <p className="mt-2 text-xs font-medium leading-5 text-slate-400">{subtitle}</p>
        </div>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition duration-200 group-hover:-translate-y-0.5 ${styles.icon}`}
        >
          <Icon aria-hidden="true" size={22} strokeWidth={2} />
        </div>
      </div>
    </article>
  );
}

export default StatCard;
