import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { DashboardScreen } from "../features/dashboard/DashboardScreen";
import { ChangePasswordScreen } from "../features/auth/ChangePasswordScreen";
import { LoginScreen } from "../features/auth/LoginScreen";
import { ModulePlaceholder } from "../features/placeholders/ModulePlaceholder";
import { AppShell } from "./AppShell";
import { ProtectedRoute } from "./ProtectedRoute";
import { RequirePermission } from "./RequirePermission";

function LoginRoute() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
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

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/change-password" element={<ChangePasswordScreen />} />
          <Route element={<AppShell />}>
            <Route index element={<DashboardScreen />} />
            <Route
              path="/users"
              element={
                <RequirePermission anyOf={["user.manage"]}>
                  <ModulePlaceholder
                    description="User management screens will be added in Task 7B."
                    title="Users"
                  />
                </RequirePermission>
              }
            />
            <Route
              path="/tenancy"
              element={
                <RequirePermission anyOf={["group.manage", "pharmacy.manage"]}>
                  <ModulePlaceholder
                    description="Organisation management screens will be added in Task 7B."
                    title="Organisation"
                  />
                </RequirePermission>
              }
            />
            <Route
              path="/audit"
              element={
                <RequirePermission anyOf={["audit.view"]}>
                  <ModulePlaceholder
                    description="Audit log screens will be added in Task 7B."
                    title="Audit Log"
                  />
                </RequirePermission>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
