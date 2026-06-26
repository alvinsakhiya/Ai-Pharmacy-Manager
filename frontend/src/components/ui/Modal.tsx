import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { X } from "lucide-react";

import { cn } from "../../lib/cn";
import { IconButton } from "./IconButton";

type ModalSize = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional supporting line beneath the title. */
  description?: string;
  size?: ModalSize;
}

const sizes: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

export function Modal({
  title,
  isOpen,
  onClose,
  children,
  description,
  size = "md",
}: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousActiveElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      // Focus trap: keep Tab cycling within the dialog.
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-ink/30 px-4 py-6 backdrop-blur-[1px] sm:py-8"
      onMouseDown={handleBackdropClick}
    >
      <div
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        aria-modal="true"
        className={cn(
          "max-h-full w-full animate-scale-in overflow-y-auto rounded-2xl border border-line bg-surface shadow-elev-2 outline-none",
          sizes[size],
        )}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <h2
              className="text-lg font-bold tracking-[-0.01em] text-ink"
              id={titleId}
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-muted" id={descId}>
                {description}
              </p>
            ) : null}
          </div>
          <IconButton
            aria-label="Close modal"
            variant="ghost"
            className="-mr-1.5"
            onClick={onClose}
            icon={<X className="h-5 w-5" />}
          />
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
