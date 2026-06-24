import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface TrackStep {
  key: string;
  label: string;
  icon?: ReactNode;
}

interface StatusTrackProps {
  steps: TrackStep[];
  /** Index of the current step (steps before it render as done). */
  currentIndex: number;
  /** Tone for the active node — peach by default, danger when flagged. */
  tone?: "peach" | "danger";
  className?: string;
}

/**
 * ShipMates-style route/progress track: circular nodes joined by a dashed line.
 * Done steps fill solid, the active node gets a soft pulsing ring, pending nodes
 * are calm outlines. Used for the dosette pack lifecycle.
 */
export function StatusTrack({
  steps,
  currentIndex,
  tone = "peach",
  className,
}: StatusTrackProps) {
  const activeFill =
    tone === "danger"
      ? "border-danger bg-danger text-white"
      : "border-peach bg-peach text-white";
  const activeRing =
    tone === "danger" ? "ring-danger/25" : "ring-peach/30";

  return (
    <div className={cn("flex items-start", className)}>
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const isLast = index === steps.length - 1;
        return (
          <div key={step.key} className="flex flex-1 flex-col items-center last:flex-none">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition-all duration-300 ease-soft",
                  done && "border-peach bg-peach-soft text-peach-ink",
                  active && `${activeFill} ring-4 ${activeRing}`,
                  !done && !active && "border-line-strong bg-surface text-muted",
                )}
              >
                {done ? (
                  <Check aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <span aria-hidden="true" className="text-[12px]">
                    {step.icon ?? (
                      <span className="block h-2 w-2 rounded-full bg-current" />
                    )}
                  </span>
                )}
              </span>
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-1 h-0.5 flex-1 rounded-full border-t-2 border-dashed",
                    index < currentIndex ? "border-peach" : "border-line-strong",
                  )}
                />
              ) : null}
            </div>
            <span
              className={cn(
                "mt-2 max-w-[88px] text-center text-[11px] font-semibold leading-tight",
                active ? "text-ink" : "text-muted",
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
