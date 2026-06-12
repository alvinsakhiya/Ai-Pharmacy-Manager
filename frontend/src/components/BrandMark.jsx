import { HeartPulse } from "lucide-react";

function BrandMark({ compact = false, inverse = false }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`brand-orb flex shrink-0 items-center justify-center rounded-2xl ${
          compact ? "h-10 w-10" : "h-12 w-12"
        } ${
          inverse
            ? "bg-white/90 text-blue-600 shadow-lg shadow-blue-950/20"
            : "bg-linear-to-br from-blue-500 via-blue-600 to-violet-600 text-white shadow-lg shadow-blue-900/15"
        }`}
      >
        <HeartPulse size={compact ? 20 : 24} strokeWidth={2.2} />
      </div>

      <div className="min-w-0">
        <p
          className={`truncate font-bold tracking-[-0.03em] ${
            compact ? "text-base" : "text-lg"
          } ${inverse ? "text-white" : "text-slate-900"}`}
        >
          PharmaCare
        </p>
        <p
          className={`truncate text-[11px] font-semibold uppercase tracking-[0.14em] ${
            inverse ? "text-slate-400" : "text-slate-500"
          }`}
        >
          Pharmacy Operations
        </p>
      </div>
    </div>
  );
}

export default BrandMark;
