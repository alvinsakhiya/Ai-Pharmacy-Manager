import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import BrandMark from "../components/BrandMark";
import Button from "../components/Button";
import useAuth from "../hooks/useAuth";

const platformHighlights = [
  "FEFO-led stock allocation",
  "Patient-specific dosette workflows",
  "AI-supported demand forecasting",
];

function readSessionExpiredFlag() {
  const wasExpired = sessionStorage.getItem("sessionExpired") === "true";
  sessionStorage.removeItem("sessionExpired");
  return wasExpired;
}

function Login() {
  const { isAuthenticated, login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(readSessionExpiredFlag);
  const usernameRef = useRef(null);

  useEffect(() => {
    if (error) {
      usernameRef.current?.focus();
    }
  }, [error]);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const clearFeedback = () => {
    setError("");
    setSessionExpired(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearFeedback();
    setIsSubmitting(true);

    try {
      await login(username, password);
    } catch (requestError) {
      setError(
        requestError.response?.status === 401
          ? "The username or password was not recognised. Please try again."
          : "The server could not be reached. Check your connection and try again."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden p-3 sm:p-5 lg:p-7">
      <div className="pointer-events-none fixed -left-24 -top-24 h-96 w-96 rounded-full bg-blue-300/35 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-28 right-0 h-[30rem] w-[30rem] rounded-full bg-violet-300/30 blur-3xl" />
      <div className="liquid-hero relative mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1500px] overflow-hidden rounded-[2rem] sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden border-r border-white/25 bg-linear-to-br from-blue-600/88 via-indigo-600/82 to-violet-600/78 p-10 text-white backdrop-blur-2xl lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="pointer-events-none absolute -right-32 -top-28 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl" />

          <div className="relative">
            <BrandMark inverse />
          </div>

          <div className="relative max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3 py-1.5 text-xs font-bold text-blue-50 backdrop-blur-xl">
              <Sparkles aria-hidden="true" size={14} />
              AI-enhanced pharmacy operations
            </div>
            <p className="max-w-xl text-5xl font-bold leading-[1.08] tracking-[-0.05em] xl:text-6xl">
              Safer stock decisions. Clearer patient workflows.
            </p>
            <p className="mt-6 max-w-xl text-base leading-7 text-blue-50/80 xl:text-lg">
              A secure clinical workspace for medication inventory, dosette
              preparation, FEFO allocation and proactive demand planning.
            </p>

            <ul className="mt-9 grid gap-3" aria-label="Platform capabilities">
              {platformHighlights.map((highlight) => (
                <li
                  key={highlight}
                  className="flex items-center gap-3 text-sm font-semibold text-blue-50/90"
                >
                  <CheckCircle2 aria-hidden="true" className="text-cyan-200" size={18} />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative flex items-center justify-between border-t border-white/20 pt-6 text-xs text-blue-50/70">
            <span>Clinical workflow simulation</span>
            <span className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="text-emerald-200" size={16} />
              JWT secured
            </span>
          </div>
        </section>

        <section className="relative flex items-center justify-center bg-white/34 px-5 py-10 backdrop-blur-2xl sm:px-10 lg:px-12 xl:px-20">
          <div className="absolute inset-x-0 top-0 h-48 bg-linear-to-b from-blue-50/80 to-transparent lg:hidden" />

          <div className="relative w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <BrandMark />
            </div>

            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                Secure staff access
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Welcome back
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Sign in to access pharmacy stock and patient dosette operations.
              </p>
            </div>

            {sessionExpired && !error && (
              <div
                className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                role="status"
              >
                <Clock aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
                <span>Your session expired. Please sign in again to continue.</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
              aria-busy={isSubmitting}
              noValidate={false}
            >
              <div>
                <label
                  className="text-sm font-bold text-slate-700"
                  htmlFor="username"
                >
                  Username
                </label>
                <div className="relative mt-2">
                  <User
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    ref={usernameRef}
                    id="username"
                    name="username"
                    autoComplete="username"
                    required
                    value={username}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "username-hint login-error" : "username-hint"}
                    onChange={(event) => {
                      clearFeedback();
                      setUsername(event.target.value);
                    }}
                    className="field-control field-with-leading-icon min-h-12"
                    placeholder="Enter your username"
                  />
                </div>
                <p id="username-hint" className="mt-2 text-xs text-slate-500">
                  Use the username assigned to your authorised pharmacy staff account.
                </p>
              </div>

              <div>
                <label
                  className="text-sm font-bold text-slate-700"
                  htmlFor="password"
                >
                  Password
                </label>
                <div className="relative mt-2">
                  <Lock
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "password-hint login-error" : "password-hint"}
                    onChange={(event) => {
                      clearFeedback();
                      setPassword(event.target.value);
                    }}
                    className="field-control field-with-icons min-h-12"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/70 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p id="password-hint" className="mt-2 text-xs text-slate-500">
                  Passwords are case-sensitive.
                </p>
              </div>

              {error && (
                <div
                  id="login-error"
                  className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                loading={isSubmitting}
                className="min-h-12 w-full"
              >
                {isSubmitting ? "Signing in..." : "Sign in to workspace"}
              </Button>
            </form>

            <div className="mt-8 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
              <ShieldCheck aria-hidden="true" className="text-emerald-600" size={15} />
              Authorised pharmacy staff only
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Login;
