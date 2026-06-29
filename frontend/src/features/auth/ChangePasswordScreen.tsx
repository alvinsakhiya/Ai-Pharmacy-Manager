import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, KeyRound } from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Logo } from "../../components/ui/Logo";
import { inputClass, labelClass } from "../../components/ui/forms";

function errorText(errors: unknown): string {
  if (!errors) {
    return "Unable to change password.";
  }

  if (typeof errors === "object" && "detail" in errors) {
    const detail = (errors as { detail?: unknown }).detail;
    if (typeof detail === "string") {
      return detail;
    }
  }

  return "Please check the password fields and try again.";
}

export function ChangePasswordScreen() {
  const { changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await changePassword(oldPassword, newPassword);
    setSubmitting(false);

    if (!result.ok) {
      setError(errorText(result.errors));
      return;
    }

    navigate("/", { replace: true });
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16 text-ink">
      <section className="w-full max-w-md animate-fade-in-up rounded-2xl border border-line bg-surface p-8 shadow-elev-2">
        <div className="flex items-center gap-3">
          <Logo decorative size={44} className="shadow-elev-1" />
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            AI Pharmacy Manager
          </p>
        </div>
        <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-warning-border bg-warning-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-warning-ink">
          <KeyRound aria-hidden="true" className="h-3.5 w-3.5" />
          Password required
        </span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-[-0.02em] text-ink">
          Change your password
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          You need to set a new password before continuing.
        </p>
        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <label className={labelClass}>
            Current password
            <input
              autoComplete="current-password"
              className={inputClass}
              name="oldPassword"
              onChange={(event) => setOldPassword(event.target.value)}
              required
              type="password"
              value={oldPassword}
            />
          </label>
          <label className={labelClass}>
            New password
            <input
              autoComplete="new-password"
              className={inputClass}
              name="newPassword"
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </label>
          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger-ink"
            >
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Saving..." : "Change password"}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => void handleLogout()}
              type="button"
            >
              Logout
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
