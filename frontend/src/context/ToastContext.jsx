import { useCallback, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import ToastContext from "./toast-context";

const TOAST_DURATION = 4500;

const toneStyles = {
  success: {
    icon: CheckCircle2,
    iconStyle: "border border-cyan-200 bg-cyan-50 text-cyan-900",
    barStyle: "bg-cyan-800",
    pattern: "signal-pattern-ready",
  },
  error: {
    icon: AlertCircle,
    iconStyle: "border border-rose-200 bg-rose-50 text-rose-900",
    barStyle: "bg-rose-700",
    pattern: "signal-pattern-critical",
  },
  info: {
    icon: Info,
    iconStyle: "border border-blue-200 bg-blue-50 text-blue-900",
    barStyle: "bg-blue-700",
    pattern: "signal-pattern-info",
  },
};

function Toast({ toast, onDismiss }) {
  const tone = toneStyles[toast.tone] || toneStyles.info;
  const Icon = tone.icon;

  return (
    <div
      className={`toast-enter surface-card pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden p-4 pr-12 ${tone.pattern}`}
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${tone.barStyle}`} />
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.iconStyle}`}
      >
        <Icon aria-hidden="true" size={19} />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-bold text-slate-900">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-sm leading-5 text-slate-500">{toast.message}</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/70 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20"
      >
        <X aria-hidden="true" size={15} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));

    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (tone, title, message) => {
      const id = ++idRef.current;

      setToasts((current) => [...current.slice(-3), { id, tone, title, message }]);
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_DURATION)
      );
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      success: (title, message) => push("success", title, message),
      error: (title, message) => push("error", title, message),
      info: (title, message) => push("info", title, message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="print-hidden pointer-events-none fixed inset-x-4 bottom-4 z-[70] flex flex-col items-center gap-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
