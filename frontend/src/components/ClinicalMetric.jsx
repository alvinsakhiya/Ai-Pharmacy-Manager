const toneStyles = {
  neutral: {
    accent: "bg-slate-700",
    icon: "border-slate-200 bg-slate-100 text-slate-700",
    pattern: "signal-pattern-neutral",
  },
  info: {
    accent: "bg-blue-700",
    icon: "border-blue-200 bg-blue-50 text-blue-800",
    pattern: "signal-pattern-info",
  },
  attention: {
    accent: "bg-amber-600",
    icon: "border-amber-200 bg-amber-50 text-amber-900",
    pattern: "signal-pattern-attention",
  },
  critical: {
    accent: "bg-rose-700",
    icon: "border-rose-200 bg-rose-50 text-rose-900",
    pattern: "signal-pattern-critical",
  },
  ready: {
    accent: "bg-cyan-800",
    icon: "border-cyan-200 bg-cyan-50 text-cyan-900",
    pattern: "signal-pattern-ready",
  },
};

function ClinicalMetric({
  description,
  icon: Icon,
  label,
  symbol,
  tone = "neutral",
  value,
}) {
  const styles = toneStyles[tone] || toneStyles.neutral;

  return (
    <article
      className={`clinical-metric ${styles.pattern}`}
      aria-label={`${label}: ${value}${description ? `. ${description}` : ""}`}
    >
      <span aria-hidden="true" className={`clinical-metric-accent ${styles.accent}`} />
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm ${styles.icon}`}
        >
          {Icon ? <Icon size={17} strokeWidth={2.2} /> : symbol}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">
            {label}
          </p>
          <p className="mt-0.5 text-xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
      </div>
      {description && (
        <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-500">
          {description}
        </p>
      )}
    </article>
  );
}

export default ClinicalMetric;
