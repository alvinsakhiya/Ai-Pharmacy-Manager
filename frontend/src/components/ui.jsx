/** House component vocabulary — built once, reused everywhere for coherence.
 *  Apple-calm surfaces; Swiggy-alive motion (press-scale, slide/fade, toasts). */
import { createContext, use, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
export function Card({ as: Component = "div", className, children, ...props }) {
  return (
    <Component className={cx("bg-surface rounded-xl border border-border-subtle shadow-elev-1", className)} {...props}>
      {children}
    </Component>
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
      {dot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />}
      {icon && Icon && <Icon size={13} aria-hidden="true" />}
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
          <Icon size={22} aria-hidden="true" />
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
    <div aria-hidden="true" className={cx("relative overflow-hidden rounded-md bg-subtle", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  const rowKeys = Array.from({ length: rows }, (_, index) => `row-${index + 1}`);
  const columnKeys = Array.from({ length: cols }, (_, index) => `column-${index + 1}`);
  return (
    <div className="space-y-2 p-4">
      {rowKeys.map((rowKey) => (
        <div key={rowKey} className="flex gap-4">
          {columnKeys.map((columnKey) => (
            <Skeleton key={`${rowKey}-${columnKey}`} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Toast */
const ToastContext = createContext(null);
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
    <ToastContext value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const tone = TONES[t.tone] || TONES.info;
          const Icon = tone.Icon || Info;
          return (
            <div
              key={t.id}
              role="status"
              className={cx(
                "pointer-events-auto flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface px-4 py-3 shadow-elev-2 animate-slide-in-right"
              )}
            >
              <Icon size={18} className={tone.fg} aria-hidden="true" />
              <span className="text-body text-text-primary">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}
export const useToast = () => use(ToastContext);

/* ----------------------------------------------------------------- Modal */
export function Modal({ open, onClose, title, children, footer, wide }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.querySelector("[data-modal-close]")?.focus();
    }, 0);

    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = [...dialogRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )];
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  // Portal to <body> so the fixed overlay is positioned relative to the viewport,
  // never trapped inside an ancestor with transform/filter/backdrop-filter
  // (e.g. the blurred header). Without this the modal renders pinned to the header.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-text-primary/40 animate-fade-in" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          "relative z-10 max-h-[90vh] w-full overflow-hidden rounded-2xl bg-surface shadow-elev-3 animate-slide-up",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
          <h3 id={titleId} className="text-subtitle font-semibold">{title}</h3>
          <button data-modal-close onClick={onClose} aria-label="Close dialog" className="rounded-md p-1 text-text-tertiary hover:bg-subtle focus-visible:ring-2 focus-visible:ring-accent-ring">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border-subtle px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
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

export function Spinner({ className, label }) {
  return (
    <Loader2
      className={cx("animate-spin", className)}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
    />
  );
}

export { cx };
