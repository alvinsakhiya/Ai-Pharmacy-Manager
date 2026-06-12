import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

const toneStyles = {
  teal: {
    icon: "border-blue-200/70 bg-blue-50/70 text-blue-600",
    accent: "from-blue-500 to-cyan-400",
    line: "#3b82f6",
  },
  blue: {
    icon: "border-emerald-200/70 bg-emerald-50/70 text-emerald-600",
    accent: "from-blue-500 to-cyan-500",
    line: "#10b981",
  },
  purple: {
    icon: "border-violet-200/70 bg-violet-50/70 text-violet-600",
    accent: "from-violet-500 to-fuchsia-500",
    line: "#8b5cf6",
  },
  amber: {
    icon: "border-orange-200/70 bg-orange-50/70 text-orange-600",
    accent: "from-amber-500 to-orange-500",
    line: "#f97316",
  },
};

function StatCard({ icon: Icon, subtitle, title, to, tone = "teal", value }) {
  const styles = toneStyles[tone];
  const isLink = Boolean(to);

  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-sm transition duration-200 group-hover:-translate-y-0.5 ${styles.icon}`}
        >
          <Icon aria-hidden="true" size={15} strokeWidth={2} />
        </div>
        <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-600">
          <span className="line-clamp-2">{title}</span>
          {isLink && (
            <ArrowUpRight
              aria-hidden="true"
              className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600"
              size={14}
            />
          )}
        </p>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-bold tracking-[-0.04em] text-slate-950">
            {value}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-4 text-slate-500">
            {subtitle}
          </p>
        </div>
        <svg aria-hidden="true" className="mb-1 h-8 w-20 shrink-0 opacity-90" viewBox="0 0 80 30">
          <path
            d="M1 23 C10 21, 13 27, 21 19 S33 8, 40 15 S52 23, 59 12 S70 9, 79 4"
            fill="none"
            stroke={styles.line}
            strokeLinecap="round"
            strokeWidth="1.7"
          />
          <path
            d="M1 23 C10 21, 13 27, 21 19 S33 8, 40 15 S52 23, 59 12 S70 9, 79 4 L79 30 L1 30 Z"
            fill={`url(#spark-${tone})`}
            opacity="0.14"
          />
          <defs>
            <linearGradient id={`spark-${tone}`} x1="0" x2="0" y1="0" y2="1">
              <stop stopColor={styles.line} />
              <stop offset="1" stopColor={styles.line} stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </>
  );

  if (isLink) {
    return (
      <Link
        to={to}
        className="surface-card group relative block overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:border-white hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20"
      >
        {body}
      </Link>
    );
  }

  return (
    <article className="surface-card group relative overflow-hidden p-5">
      {body}
    </article>
  );
}

export default StatCard;
