import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pill, ShieldCheck, Boxes, LineChart } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button, Field, Input, Spinner } from "../components/ui";

const DEMO = [
  { role: "Administrator", username: "admin" },
  { role: "Pharmacist", username: "pharmacist" },
  { role: "Dispenser", username: "dispenser" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("pharmacist");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      navigate("/");
    } catch {
      setError("Invalid username or password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand / value panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-accent p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/10 blur-2xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <Pill size={20} />
          </div>
          <span className="text-subtitle font-semibold">Pharmica</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-[34px] font-semibold leading-tight tracking-tight">
            One platform for dosette care and intelligent stock control.
          </h1>
          <p className="mt-4 text-white/80">
            Unify compliance-pack preparation, FEFO inventory and demand forecasting —
            replacing fragmented, manual workflows with a single proactive system.
          </p>
          <div className="mt-8 space-y-3 text-white/90">
            {[
              [ShieldCheck, "Role-based access with full audit traceability"],
              [Boxes, "FEFO inventory with batch & expiry visibility"],
              [LineChart, "Explainable demand forecasting & reorder advice"],
            ].map(([Icon, t]) => (
              <div key={t} className="flex items-center gap-3 text-body">
                <Icon size={18} className="opacity-90" />
                {t}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-caption text-white/60">
          Academic prototype · Simulated, pseudo-anonymised data · No external system integration.
        </p>
      </div>

      {/* Form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm animate-slide-up">
          <h2 className="text-title font-semibold">Sign in</h2>
          <p className="mt-1 text-body text-text-secondary">
            Use a demo account below, or your own credentials.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label="Username">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && (
              <p className="rounded-md bg-danger-bg px-3 py-2 text-caption text-danger-fg">{error}</p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : "Sign in"}
            </Button>
          </form>

          <div className="mt-8">
            <p className="mb-2 text-micro uppercase text-text-tertiary">Demo accounts (password: Password123!)</p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.username}
                  onClick={() => {
                    setUsername(d.username);
                    setPassword("Password123!");
                  }}
                  className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-caption font-medium text-text-secondary transition hover:border-accent hover:text-accent active:scale-[0.98]"
                >
                  {d.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
