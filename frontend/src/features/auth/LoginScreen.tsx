import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  CalendarClock,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Logo } from "../../components/ui/Logo";
import { labelClass } from "../../components/ui/forms";
import { cn } from "../../lib/cn";

const fieldBase =
  "block w-full rounded-xl border border-line-strong bg-surface py-2.5 pl-10 text-sm text-ink " +
  "shadow-elev-1 transition-[border-color,box-shadow] duration-150 ease-soft placeholder:text-muted-soft " +
  "outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring/60";

const HIGHLIGHTS = [
  {
    icon: Boxes,
    tint: "bg-lilac/20 text-lilac",
    title: "FEFO inventory",
    body: "Stock rotated by expiry — less waste, fewer stockouts.",
  },
  {
    icon: CalendarClock,
    tint: "bg-peach/20 text-peach",
    title: "Dosette & MDS packs",
    body: "Weekly and monthly compliance, prepared ahead of time.",
  },
  {
    icon: ShieldCheck,
    tint: "bg-gold/25 text-gold",
    title: "Audit & access control",
    body: "Every action logged, scoped to each role and pharmacy.",
  },
];

export function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await login(email, password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Unable to sign in.");
      return;
    }

    navigate(result.user?.must_change_password ? "/change-password" : "/", {
      replace: true,
    });
  }

  return (
    <main className="grid min-h-screen bg-canvas text-ink lg:grid-cols-[1.05fr_minmax(440px,0.82fr)]">
      {/* ---------- Brand panel ---------- */}
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        {/* Cohesive lilac aura from the top-left + one warm accent low — calm,
            on-brand depth (matches the operational rail). Pointer-transparent. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_85%_at_18%_-12%,rgba(124,92,214,0.38),transparent_58%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-24 h-[26rem] w-[26rem] rounded-full bg-peach/15 blur-3xl"
        />

        <div className="relative flex animate-fade-in items-center gap-3">
          <Logo size={44} />
          <div>
            <p className="text-[15px] font-bold leading-tight text-white">
              AI Pharmacy Manager
            </p>
            <p className="mt-0.5 text-xs text-sidebar-muted">
              Operational workspace
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex animate-fade-in items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-lilac backdrop-blur-sm">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            Pharmacy command centre
          </span>
          <h2 className="mt-5 animate-slide-up text-[36px] font-extrabold leading-[1.1] tracking-[-0.03em] text-white">
            A calm command centre for pharmacy operations.
          </h2>
          <p className="mt-4 animate-slide-up text-[15px] leading-relaxed text-sidebar-text/75">
            Stock intelligence, dosette compliance packs, and a full audit
            trail — one fast, considered workspace your whole team can live in.
          </p>

          <ul className="stagger mt-9 space-y-3">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <div className="group flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 ring-1 ring-inset ring-white/[0.04] backdrop-blur-sm transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] hover:shadow-elev-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform duration-200 ease-soft group-hover:scale-110 group-hover:-rotate-6",
                        item.tint,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-white">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-snug text-sidebar-text/65">
                        {item.body}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-sidebar-muted">
          <Lock aria-hidden="true" className="h-3.5 w-3.5" />
          No NHS data · encrypted patient records · role-based access
        </p>
      </aside>

      {/* ---------- Form panel ---------- */}
      <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0">
        <div className="w-full max-w-sm animate-fade-in-up">
          {/* Brand mark — shown on small screens where the panel is hidden. */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo size={40} className="shadow-elev-1" />
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              AI Pharmacy Manager
            </p>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-7 shadow-soft sm:p-8">
            {/* Signature accent strip across the top of the card. */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1 bg-gradient-lilac"
            />

            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand">
              Sign in
            </p>
            <h1 className="mt-1.5 text-[26px] font-extrabold tracking-[-0.025em] text-ink">
              Welcome back
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Enter your credentials to access your workspace.
            </p>

            <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="login-email" className={labelClass}>
                  Email
                </label>
                <div className="group relative mt-1.5">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-soft transition-colors duration-150 group-focus-within:text-brand"
                  />
                  <input
                    id="login-email"
                    autoComplete="email"
                    className={cn(fieldBase, "pr-3")}
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@pharmacy.com"
                    required
                    type="email"
                    value={email}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className={labelClass}>
                  Password
                </label>
                <div className="group relative mt-1.5">
                  <Lock
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-soft transition-colors duration-150 group-focus-within:text-brand"
                  />
                  <input
                    id="login-password"
                    autoComplete="current-password"
                    className={cn(fieldBase, "pr-11")}
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Your password"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted transition-all duration-150 ease-soft hover:bg-surface-sunken hover:text-ink focus-ring active:scale-90"
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <p
                  role="alert"
                  className="flex animate-fade-in-up items-start gap-2 rounded-xl border border-danger-border bg-danger-soft px-3 py-2.5 text-sm text-danger-ink"
                >
                  <AlertCircle
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>{error}</span>
                </p>
              ) : null}

              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={submitting}
                type="submit"
                trailingIcon={
                  submitting ? undefined : <ArrowRight className="h-4 w-4" />
                }
              >
                {submitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-muted">
            Trouble signing in? Contact your pharmacy administrator.
          </p>
        </div>
      </div>
    </main>
  );
}
