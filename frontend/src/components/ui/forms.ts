/**
 * Shared form-control class strings. Apply these to existing inputs/selects/
 * labels to adopt the house style WITHOUT restructuring label↔control
 * associations (the test suite relies on getByLabel / htmlFor wiring).
 */

export const labelClass = "block text-[13px] font-semibold text-ink-soft";

export const inputClass =
  "mt-1.5 block w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink " +
  "shadow-elev-1 transition-[border-color,box-shadow] duration-150 ease-soft placeholder:text-muted-soft " +
  "outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring/60 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60";

export const selectClass = inputClass;

export const textareaClass =
  inputClass + " min-h-[88px] resize-y leading-relaxed";

export const fieldHintClass = "mt-1.5 text-xs text-muted";

export const fieldErrorClass = "mt-1.5 text-xs font-medium text-danger-ink";
