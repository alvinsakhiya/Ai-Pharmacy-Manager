/** House component vocabulary — built once, reused everywhere for coherence.
 *  Apple-calm surfaces; Swiggy-alive motion (press-scale, slide/fade, toasts). */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from "lucide-react";

const cx = (...c) => c.filter(Boolean).join(" ");

/* ---------------------------------------------------------------- Button */
export function Button({ variant = "primary", size = "md", className, children, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 ease " +
    "active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-accent text-white hover:bg-accent-hover shadow-elev-1",
    secondary: "bg-surface text-text-primary border border-border-strong hover:bg-subtle",
    ghost: "text-text-secondary hover:bg-subtle",
    danger: "bg-danger text-white hover:brightness-95 shadow-elev-1",
  };
  const sizes = { sm: "h-8 px-3 text-caption", md: "h-9 px-4 text-body", lg: "h-11 px-5 text-subtitle" };
  return (
    <button className={cx(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Card */
export function Card({ className, children, ...props }) {
  return (
    <div className={cx("bg-surface rounded-xl border border-border-subtle shadow-elev-1", className)} {...props}>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------- Status chip */
const TONES = {
  success: { bg: "bg-success-bg", fg: "text-success-fg", Icon: CheckCircle2 },
  danger: { bg: "bg-danger-bg", fg: "text-danger-fg", Icon: XCircle },
  warning: { bg: "bg-warning-bg", fg: "text-warning-fg", Icon: AlertTriangle },
  info: { bg: "bg-info-bg", fg: "text-info-fg", Icon: Info },
  neutral: { bg: "bg-subtle", fg: "text-text-secondary", Icon: null },
};
export function StatusChip({ tone = "neutral", icon = true, children, dot, style }) {
  const t = TONES[tone] || TONES.neutral;
  const Icon = t.Icon;
  return (
    <span
      className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-medium", t.bg, t.fg)}
      style={style}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />}
      {icon && Icon && <Icon size={13} />}
      {children}
    </span>
  );
}

/* ----------------------------------------------------------- Empty/Error */
export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-text-tertiary">
          <Icon size={22} />
        </div>
      )}
      <p className="text-subtitle font-semibold text-text-primary">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-body text-text-secondary">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry, message }) {
  return (
    <EmptyState
      icon={XCircle}
      title="Something went wrong"
      hint={message || "We couldn't load this data."}
      action={onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    />
  );
}

/* -------------------------------------------------------------- Skeleton */
export function Skeleton({ className }) {
  return (
    <div className={cx("relative overflow-hidden rounded-md bg-subtle", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Toast */
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, tone: "info", ...toast }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), toast.duration || 3500);
  }, []);
  const api = {
    show: push,
    success: (msg) => push({ tone: "success", message: msg }),
    error: (msg) => push({ tone: "danger", message: msg }),
    info: (msg) => push({ tone: "info", message: msg }),
  };
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {toasts.map((t) => {
          const tone = TONES[t.tone] || TONES.info;
          const Icon = tone.Icon || Info;
          return (
            <div
              key={t.id}
              className={cx(
                "pointer-events-auto flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface px-4 py-3 shadow-elev-2 animate-slide-in-right"
              )}
            >
              <Icon size={18} className={tone.fg} />
              <span className="text-body text-text-primary">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ----------------------------------------------------------------- Modal */
export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-text-primary/30 animate-fade-in" onClick={onClose} />
      <div
        className={cx(
          "relative z-10 w-full rounded-2xl bg-surface shadow-elev-3 animate-slide-up",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
          <h3 className="text-subtitle font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-text-tertiary hover:bg-subtle">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border-subtle px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Input */
export function Field({ label, hint, children }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-caption font-medium text-text-secondary">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-caption text-text-tertiary">{hint}</span>}
    </label>
  );
}
export function Input({ className, ...props }) {
  return (
    <input
      className={cx(
        "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-body text-text-primary placeholder:text-text-tertiary",
        "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring transition",
        className
      )}
      {...props}
    />
  );
}
export function Select({ className, children, ...props }) {
  return (
    <select
      className={cx(
        "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-body text-text-primary",
        "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring transition",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={cx("animate-spin", className)} />;
}

export { cx };
