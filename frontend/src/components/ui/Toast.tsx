/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";

import { cn } from "../../lib/cn";

type ToastTone = "success" | "warning" | "danger" | "info";

interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Auto-dismiss after this many ms (default 4000). 0 disables auto-dismiss. */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, "description">> {
  id: number;
  description?: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<
  ToastTone,
  { bar: string; icon: ReactNode }
> = {
  success: {
    bar: "bg-success",
    icon: <CheckCircle2 className="h-5 w-5 text-success" />,
  },
  warning: {
    bar: "bg-warning",
    icon: <AlertTriangle className="h-5 w-5 text-warning" />,
  },
  danger: {
    bar: "bg-danger",
    icon: <XCircle className="h-5 w-5 text-danger" />,
  },
  info: {
    bar: "bg-info",
    icon: <Info className="h-5 w-5 text-info" />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, tone = "info", duration = 4000 }: ToastOptions) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [
        ...current,
        { id, title, description, tone, duration },
      ]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) =>
        toast({ title, description, tone: "success" }),
      error: (title, description) =>
        toast({ title, description, tone: "danger" }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:items-end"
      >
        {toasts.map((item) => {
          const tone = toneStyles[item.tone];
          return (
            <div
              key={item.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 overflow-hidden rounded-2xl border border-line bg-surface pr-3 shadow-elev-3"
            >
              <span className={cn("w-1 self-stretch", tone.bar)} aria-hidden="true" />
              <span className="mt-3 shrink-0" aria-hidden="true">
                {tone.icon}
              </span>
              <div className="min-w-0 py-3">
                <p className="text-sm font-bold text-ink">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-[13px] leading-snug text-muted">
                    {item.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
                className="mt-2.5 ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-ring"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
