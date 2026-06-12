import dosePeriods from "../utils/dosePeriods";

export function DoseSlot({ label, value, icon: Icon, style, compact = false }) {
  const hasDose = Boolean(value);

  return (
    <div
      className={`flex items-center rounded-xl border ${
        hasDose ? style : "border-dashed border-slate-200 bg-slate-50/60 text-slate-400"
      } ${compact ? "min-w-24 gap-2 px-2.5 py-2" : "gap-3 px-3.5 py-3"}`}
    >
      <Icon
        aria-hidden="true"
        className={`shrink-0 ${hasDose ? "opacity-75" : "opacity-45"}`}
        size={compact ? 15 : 17}
      />
      <div className="min-w-0">
        {!compact && (
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] opacity-70">
            {label}
          </p>
        )}
        <p className={`font-bold ${compact ? "text-xs" : "mt-0.5 text-sm"}`}>
          {hasDose ? (
            value
          ) : (
            <>
              <span aria-hidden="true">—</span>
              <span className="sr-only">No {label.toLowerCase()} dose</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function DoseSchedule({ doses, compact = false }) {
  return (
    <div
      className={`grid ${
        compact
          ? "grid-cols-2 gap-2 xl:grid-cols-4"
          : "grid-cols-2 gap-2.5 sm:grid-cols-4"
      }`}
    >
      {dosePeriods.map((period) => (
        <DoseSlot
          key={period.key}
          compact={compact}
          icon={period.icon}
          label={period.label}
          style={period.style}
          value={doses[period.key]}
        />
      ))}
    </div>
  );
}

export default DoseSchedule;
