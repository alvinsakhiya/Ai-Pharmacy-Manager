import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { ChangePasswordScreen } from "../features/auth/ChangePasswordScreen";
import { LoginScreen } from "../features/auth/LoginScreen";
import { ProtectedRoute } from "./ProtectedRoute";

function LoginRoute() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        Loading...
      </main>
    );
  }

  if (user?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <LoginScreen />;
}

function SignedInPlaceholder() {
  const { logout, user } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <section className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/30">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
          AI Pharmacy Manager
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Signed in as {user?.email} ({user?.role ?? "no role"})
        </h1>
        <p className="mt-4 text-slate-300">
          Auth routing is ready. The full app shell and role-filtered navigation
          arrive in the next frontend task.
        </p>
        <button
          className="mt-8 rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300"
          onClick={() => void logout()}
          type="button"
        >
          Logout
        </button>
      </section>
    </main>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/change-password" element={<ChangePasswordScreen />} />
          <Route path="*" element={<SignedInPlaceholder />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
