import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import BrandMark from "../components/BrandMark";
import useAuth from "../hooks/useAuth";

const platformHighlights = [
  "FEFO-led stock allocation",
  "Patient-specific dosette workflows",
  "AI-supported demand forecasting",
];

function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch {
      setError("The username or password was not recognised. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07111f] p-3 sm:p-5 lg:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1500px] overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-black/30 sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-linear-to-br from-[#0a1728] via-[#0b2030] to-[#063c3c] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="subtle-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="pointer-events-none absolute -right-32 -top-28 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative">
            <BrandMark inverse />
          </div>

          <div className="relative max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1.5 text-xs font-bold text-teal-200">
              <Sparkles size={14} />
              AI-enhanced pharmacy operations
            </div>
            <h1 className="max-w-xl text-5xl font-bold leading-[1.08] tracking-[-0.05em] xl:text-6xl">
              Safer stock decisions. Clearer patient workflows.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 xl:text-lg">
              A secure clinical workspace for medication inventory, dosette
              preparation, FEFO allocation and proactive demand planning.
            </p>

            <div className="mt-9 grid gap-3">
              {platformHighlights.map((highlight) => (
                <div
                  key={highlight}
                  className="flex items-center gap-3 text-sm font-semibold text-slate-200"
                >
                  <CheckCircle2 className="text-teal-300" size={18} />
                  {highlight}
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-between border-t border-white/10 pt-6 text-xs text-slate-400">
            <span>Clinical workflow simulation</span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="text-emerald-300" size={16} />
              JWT secured
            </span>
          </div>
        </section>

        <section className="relative flex items-center justify-center bg-slate-50/60 px-5 py-10 sm:px-10 lg:px-12 xl:px-20">
          <div className="absolute inset-x-0 top-0 h-48 bg-linear-to-b from-teal-50/80 to-transparent lg:hidden" />

          <div className="relative w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <BrandMark />
            </div>

            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
                Secure staff access
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Welcome back
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Sign in to access pharmacy stock and patient dosette operations.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
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
                    id="username"
                    name="username"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="field-control field-with-leading-icon min-h-12"
                    placeholder="Enter your username"
                  />
                </div>
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
                    onChange={(event) => setPassword(event.target.value)}
                    className="field-control field-with-icons min-h-12"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 shrink-0" size={18} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-xl shadow-slate-950/15 transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/25 disabled:cursor-wait disabled:opacity-70"
              >
                {isSubmitting ? "Signing in..." : "Sign in to workspace"}
                {!isSubmitting && (
                  <ArrowRight
                    className="transition-transform group-hover:translate-x-0.5"
                    size={18}
                  />
                )}
              </button>
            </form>

            <div className="mt-8 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
              <ShieldCheck className="text-emerald-600" size={15} />
              Authorised pharmacy staff only
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Login;
