import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "../auth/AuthContext";

export function ProtectedRoute({ children }: { children?: ReactNode }) {
  const { loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        Loading...
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (
    user.must_change_password &&
    location.pathname !== "/change-password"
  ) {
    return <Navigate to="/change-password" replace />;
  }

  return children ?? <Outlet />;
}
