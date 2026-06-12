const buttonVariantStyles = {
  primary:
    "border border-blue-500/70 bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500",
  secondary:
    "border border-white/80 bg-white/55 text-slate-700 shadow-sm backdrop-blur-xl hover:border-white hover:bg-white/80",
  teal:
    "border border-blue-500/70 bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500",
  danger:
    "border border-red-200/80 bg-red-50/75 text-red-700 backdrop-blur-xl hover:border-red-300 hover:bg-red-100/90",
  ghost: "text-slate-600 hover:bg-white/60 hover:text-slate-950",
};

export function buttonClassName(variant = "primary", className = "") {
  return `inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${buttonVariantStyles[variant]} ${className}`;
}
