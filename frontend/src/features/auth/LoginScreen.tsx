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
    <main className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[1.05fr_minmax(440px,0.85fr)]">
      {/* ---------- Brand panel ---------- */}
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        {/* aurora accents */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-lilac/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -right-16 h-96 w-96 rounded-full bg-peach/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-1/3 top-1/3 h-56 w-56 rounded-full bg-gold/10 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
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
          <h2 className="text-[34px] font-extrabold leading-[1.15] tracking-[-0.03em] text-white">
            A calm command center for pharmacy operations.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-sidebar-text/75">
            Stock intelligence, dosette compliance packs, and a full audit
            trail — one fast, considered workspace your whole team can live in.
          </p>

          <ul className="stagger mt-9 space-y-4">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                      item.tint,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[14px] font-bold text-white">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-sidebar-text/65">
                      {item.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-muted">
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

          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand">
            Sign in
          </p>
          <h1 className="mt-1.5 text-[28px] font-extrabold tracking-[-0.025em] text-ink">
            Welcome back
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Enter your credentials to access your workspace.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="login-email" className={labelClass}>
                Email
              </label>
              <div className="relative mt-1.5">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-soft"
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
              <div className="relative mt-1.5">
                <Lock
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-soft"
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
                  className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-ring"
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
                className="flex items-start gap-2 rounded-xl border border-danger-border bg-danger-soft px-3 py-2.5 text-sm text-danger-ink"
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

          <p className="mt-6 text-center text-xs leading-relaxed text-muted">
            Trouble signing in? Contact your pharmacy administrator.
          </p>
        </div>
      </div>
    </main>
  );
}
