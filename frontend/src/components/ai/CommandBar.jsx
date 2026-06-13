/**
 * AI Co-pilot — global ⌘K command bar.
 *
 * Natural-language over the live workspace: ask "what's due Thursday?",
 * "what's running short?", "any safety flags?" and get an interpreted intent,
 * ranked results, and one-tap actions that jump you to the right screen.
 *
 * Apple-calm surface; Swiggy-alive motion (slide-up panel, instant feedback,
 * shimmer "thinking" state). Decision-support only.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  CornerDownLeft,
  ArrowUpRight,
  Search,
  Loader2,
  CalendarClock,
  Boxes,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import { copilot } from "../../services/aiClient";
import { StatusChip, cx } from "../ui";

const STARTERS = [
  { label: "What packs are due this week?", icon: CalendarClock },
  { label: "What stock is running short?", icon: Boxes },
  { label: "Show clinical safety flags", icon: ShieldCheck },
  { label: "What stock might we waste?", icon: TimerReset },
];

const toneToChip = (t) =>
  ({ danger: "danger", warning: "warning", info: "info", pass: "success", success: "success" }[t] || "neutral");

export default function CommandBar({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setQuery("");
      setResult(null);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const ask = async (text) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setQuery(q);
    setLoading(true);
    setResult(null);
    const r = await copilot(q);
    setLive(!!r.live);
    setResult(r);
    setLoading(false);
  };

  const go = (to) => {
    if (!to) return;
    onClose?.();
    navigate(to);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-text-primary/30 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-elev-3 animate-slide-up">
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-border-subtle px-4">
          <div className="relative flex h-7 w-7 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-accent-soft" />
            <Sparkles size={16} className="relative text-accent" />
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask the Co-pilot…  e.g. what's due Thursday and short on stock?"
            className="h-14 flex-1 bg-transparent text-subtitle text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          {loading ? (
            <Loader2 size={18} className="animate-spin text-accent" />
          ) : (
            <kbd className="hidden items-center gap-1 rounded-md border border-border-subtle bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-text-tertiary sm:flex">
              <CornerDownLeft size={12} /> Enter
            </kbd>
          )}
        </div>

        <div className="max-h-[52vh] overflow-y-auto">
          {/* Starters */}
          {!result && !loading && (
            <div className="p-2 animate-fade-in">
              <p className="px-3 pb-1 pt-2 text-micro uppercase text-text-tertiary">Try asking</p>
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => ask(s.label)}
                  className="group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-all duration-150 ease hover:bg-subtle active:scale-[0.99]"
                >
                  <s.icon size={16} className="text-text-tertiary group-hover:text-accent" />
                  <span className="flex-1 text-body text-text-primary">{s.label}</span>
                  <ArrowUpRight size={15} className="text-text-tertiary opacity-0 transition group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}

          {/* Thinking shimmer */}
          {loading && (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="relative overflow-hidden rounded-md bg-subtle" style={{ height: 44 }}>
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                </div>
              ))}
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <div className="animate-slide-up">
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-app/60 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <StatusChip tone="info" icon={false}>
                    {result.intent}
                  </StatusChip>
                  <span className="text-body font-medium text-text-primary">{result.summary}</span>
                </div>
                <span className="text-[11px] text-text-tertiary">{live ? "live" : "on-device"}</span>
              </div>

              <div className="p-2">
                {result.items?.map((it, i) => (
                  <button
                    key={i}
                    onClick={() => (it.prompt ? ask(it.prompt) : go(it.to))}
                    className="group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-all duration-150 ease hover:bg-subtle active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-body font-medium text-text-primary">{it.title}</span>
                        {it.meta && (
                          <StatusChip tone={toneToChip(it.tone)} icon={false}>
                            {it.meta}
                          </StatusChip>
                        )}
                      </div>
                      {it.subtitle && <p className="mt-0.5 truncate text-caption text-text-secondary">{it.subtitle}</p>}
                    </div>
                    {it.prompt ? (
                      <Search size={15} className="text-text-tertiary" />
                    ) : (
                      <ArrowUpRight size={15} className="text-text-tertiary opacity-0 transition group-hover:opacity-100" />
                    )}
                  </button>
                ))}
              </div>

              {result.explanation && (
                <p className="border-t border-border-subtle px-4 py-2 text-caption text-text-tertiary">
                  <span className="font-medium text-text-secondary">Why: </span>
                  {result.explanation}
                </p>
              )}

              {result.actions?.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-border-subtle px-3 py-3">
                  {result.actions.map((a, i) => (
                    <button
                      key={i}
                      onClick={() => go(a.to)}
                      className={cx(
                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-caption font-medium transition-all duration-150 ease active:scale-[0.98]",
                        a.tone === "primary"
                          ? "bg-accent text-white hover:bg-accent-hover shadow-elev-1"
                          : "border border-border-strong bg-surface text-text-primary hover:bg-subtle"
                      )}
                    >
                      {a.label}
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border-subtle bg-app/60 px-4 py-2">
          <span className="text-[11px] text-text-tertiary">AI Co-pilot · decision-support, verify before acting</span>
          <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
            <kbd className="rounded border border-border-subtle bg-surface px-1">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
