const buttonVariantStyles = {
  primary:
    "bg-slate-950 text-white shadow-lg shadow-slate-950/10 hover:bg-slate-800",
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50",
  teal:
    "bg-teal-600 text-white shadow-lg shadow-teal-900/10 hover:bg-teal-700",
  danger:
    "border border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
};

export function buttonClassName(variant = "primary", className = "") {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${buttonVariantStyles[variant]} ${className}`;
}
