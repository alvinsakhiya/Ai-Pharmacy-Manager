import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Info,
  MinusCircle,
  Sparkles,
} from "lucide-react";

const toneStyles = {
  slate: "border-slate-300/80 bg-slate-100/80 text-slate-800 signal-pattern-neutral",
  teal: "border-cyan-300/80 bg-cyan-50/80 text-cyan-950 signal-pattern-ready",
  blue: "border-blue-300/80 bg-blue-50/80 text-blue-950 signal-pattern-info",
  purple: "border-violet-300/80 bg-violet-50/80 text-violet-950 signal-pattern-purple",
  success: "border-cyan-300/80 bg-cyan-50/80 text-cyan-950 signal-pattern-ready",
  warning: "border-amber-300/80 bg-amber-50/85 text-amber-950 signal-pattern-attention",
  danger: "border-rose-300/80 bg-rose-50/85 text-rose-950 signal-pattern-critical",
};

const toneIcons = {
  slate: MinusCircle,
  teal: CircleDot,
  blue: Info,
  purple: Sparkles,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertOctagon,
};

function Badge({
  children,
  className = "",
  dot = false,
  icon: Icon,
  showIcon = true,
  tone = "slate",
}) {
  const StatusIcon = Icon || toneIcons[tone] || Info;

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-lg ${toneStyles[tone]} ${className}`}
    >
      {showIcon && (
        <StatusIcon aria-hidden="true" className="shrink-0" size={13} strokeWidth={2.5} />
      )}
      {dot && <span className="sr-only">Status: </span>}
      {children}
    </span>
  );
}

export default Badge;
