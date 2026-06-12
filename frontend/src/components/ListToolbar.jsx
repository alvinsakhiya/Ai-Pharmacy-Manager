function ListToolbar({ children, filters, shown, total, unit = "shown" }) {
  return (
    <div className="flex flex-col gap-4 border-b border-white/75 p-4 sm:p-5 lg:flex-row lg:items-center">
      {children}
      {filters}
      {shown != null && (
        <p
          aria-live="polite"
          aria-atomic="true"
          className="flex shrink-0 items-baseline justify-between gap-2 rounded-xl border border-slate-200/70 bg-white/55 px-3 py-2 text-sm shadow-sm lg:justify-end"
        >
          <span className="font-bold text-slate-800">
            {shown} {unit}
          </span>
          {total != null && (
            <span className="text-xs font-semibold text-slate-500">
              of {total} total
            </span>
          )}
        </p>
      )}
    </div>
  );
}

export default ListToolbar;
