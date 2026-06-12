const toneStyles = {
  slate: "border-slate-200/70 bg-slate-100/65 text-slate-700",
  teal: "border-blue-200/70 bg-blue-50/70 text-blue-700",
  blue: "border-blue-200/70 bg-blue-50/70 text-blue-700",
  purple: "border-violet-200/70 bg-violet-50/70 text-violet-700",
  success: "border-emerald-200/70 bg-emerald-50/70 text-emerald-700",
  warning: "border-amber-200/70 bg-amber-50/75 text-amber-800",
  danger: "border-red-200/70 bg-red-50/75 text-red-700",
};

const dotStyles = {
  slate: "bg-slate-400",
  teal: "bg-blue-500",
  blue: "bg-blue-500",
  purple: "bg-violet-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

function Badge({
  children,
  className = "",
  dot = false,
  icon: Icon,
  tone = "slate",
}) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-lg ${toneStyles[tone]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[tone]}`} />}
      {Icon && <Icon aria-hidden="true" size={13} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

export default Badge;
