import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "../auth/AuthContext";
import { Spinner } from "../components/ui/Spinner";

export function ProtectedRoute({ children }: { children?: ReactNode }) {
  const { loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas text-muted">
        <Spinner className="h-6 w-6 text-brand" label="Loading" />
        <p className="text-sm font-medium text-muted">Loading...</p>
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
