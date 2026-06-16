import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/30">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Password required
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Change your password
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          You need to set a new password before continuing.
        </p>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-200">
            Current password
            <input
              autoComplete="current-password"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
              name="oldPassword"
              onChange={(event) => setOldPassword(event.target.value)}
              required
              type="password"
              value={oldPassword}
            />
          </label>
          <label className="block text-sm font-medium text-slate-200">
            New password
            <input
              autoComplete="new-password"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
              name="newPassword"
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </label>
          {error ? (
            <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          <div className="flex gap-3">
            <button
              className="flex-1 rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Saving..." : "Change password"}
            </button>
            <button
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:bg-slate-800"
              onClick={() => void handleLogout()}
              type="button"
            >
              Logout
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
