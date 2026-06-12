const toneStyles = {
  slate: "border-slate-200 bg-slate-100 text-slate-700",
  teal: "border-teal-200 bg-teal-50 text-teal-800",
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  purple: "border-violet-200 bg-violet-50 text-violet-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
};

const dotStyles = {
  slate: "bg-slate-400",
  teal: "bg-teal-500",
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
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${toneStyles[tone]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[tone]}`} />}
      {Icon && <Icon aria-hidden="true" size={13} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

export default Badge;
