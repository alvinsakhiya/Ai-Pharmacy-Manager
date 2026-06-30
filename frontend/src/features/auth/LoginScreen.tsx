import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { AppLogo } from "../../components/brand/AppLogo";
import { labelClass } from "../../components/ui/forms";
import { cn } from "../../lib/cn";

const fieldBase =
  "block w-full rounded-2xl border border-[#ded6ee] bg-white py-3 pl-11 text-sm font-medium text-ink " +
  "shadow-[0_1px_0_rgba(255,255,255,0.95)] transition-[border-color,box-shadow,background-color] " +
  "duration-150 ease-soft placeholder:text-muted-soft outline-none focus:border-brand focus:bg-white " +
  "focus:ring-4 focus:ring-brand-ring/35";

const DECORATIVE_BADGES = [
  {
    className: "left-[calc(50%-25rem)] top-[22%] rotate-[-8deg]",
    label: "MDS",
  },
  {
    className: "right-[calc(50%-25rem)] top-[25%] rotate-[7deg]",
    label: "Stock",
  },
  {
    className: "left-[calc(50%-23rem)] bottom-[24%] rotate-[6deg]",
    label: "FEFO",
  },
  {
    className: "right-[calc(50%-23rem)] bottom-[21%] rotate-[-7deg]",
    label: "Review",
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

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setSubmitting(false);
      setError("Enter your email and password.");
      return;
    }

    const result = await login(trimmedEmail, password);
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
    <main className="relative flex min-h-screen overflow-hidden bg-[#f8f5ff] px-5 py-8 text-ink sm:px-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,#dbeafe_0,#dbeafe_17%,transparent_34%),radial-gradient(circle_at_82%_14%,#eadcff_0,#eadcff_18%,transparent_35%),radial-gradient(circle_at_50%_86%,#fff1d6_0,#fff1d6_18%,transparent_38%),linear-gradient(135deg,#f7faff_0%,#f6edff_46%,#fff8ec_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute left-10 top-12 h-28 w-28 rounded-full border border-[#c9b6f6] bg-[#efeafc]"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-14 right-10 h-36 w-36 rounded-full border border-[#bfdbfe] bg-[#e0f2fe]"
      />
      <div
        aria-hidden="true"
        className="absolute right-[16%] top-[16%] h-3 w-3 rounded-full bg-brand"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[23%] left-[18%] h-2.5 w-2.5 rounded-full bg-peach"
      />

      <div
        aria-hidden="true"
        data-testid="login-decorative-badges"
        className="pointer-events-none absolute inset-0 hidden md:block"
      >
        {DECORATIVE_BADGES.map((badge) => (
          <span
            key={badge.label}
            className={cn(
              "absolute rounded-full border border-[#d8cfe8] bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-brand shadow-elev-1",
              badge.className,
            )}
          >
            {badge.label}
          </span>
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
        <section
          aria-label="AI Pharmacy Manager login"
          className="w-full animate-fade-in-up rounded-[2rem] border border-white bg-white p-6 shadow-[0_24px_70px_rgba(80,63,126,0.18)] sm:p-8"
        >
          <div className="flex flex-col items-center text-center">
            <AppLogo variant="compact" tone="onLight" size={44} />
            <p className="mt-6 rounded-full border border-[#ded6ee] bg-[#f8f5ff] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand">
              Operational workspace
            </p>
            <h1 className="mt-4 text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">
              Welcome to AI Pharmacy Manager
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              Sign in to manage pharmacy operations.
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
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
                className="flex animate-fade-in-up items-start gap-2 rounded-2xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm text-danger-ink"
              >
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>{error}</span>
              </p>
            ) : null}

            <button
              className="mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-brand bg-brand px-6 text-sm font-semibold text-white shadow-elev-1 transition-[background-color,border-color,box-shadow,transform] duration-200 ease-soft hover:-translate-y-px hover:border-brand-hover hover:bg-brand-hover hover:shadow-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              disabled={submitting}
              type="submit"
            >
              <span>{submitting ? "Logging in..." : "Log in"}</span>
              {submitting ? null : (
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              )}
            </button>
          </form>
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-center text-xs font-semibold text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-elev-1">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-brand" />
            Human review required
          </span>
          <span aria-hidden="true">·</span>
          <span>Role-based access</span>
          <span aria-hidden="true">·</span>
          <span>Audit trail</span>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          Trouble logging in? Contact your pharmacy administrator.
        </p>
      </div>
    </main>
  );
}
