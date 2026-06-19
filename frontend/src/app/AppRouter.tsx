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
import { AuditScreen } from "../features/audit/AuditScreen";
import { MedicationsScreen } from "../features/catalogue/MedicationsScreen";
import { InventoryScreen } from "../features/inventory/InventoryScreen";
import { StockItemDetailScreen } from "../features/inventory/StockItemDetailScreen";
import { UsersScreen } from "../features/users/UsersScreen";
import { OrganisationScreen } from "../features/tenancy/OrganisationScreen";
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
                  <UsersScreen />
                </RequirePermission>
              }
            />
            <Route
              path="/tenancy"
              element={
                <RequirePermission anyOf={["group.manage", "pharmacy.manage"]}>
                  <OrganisationScreen />
                </RequirePermission>
              }
            />
            <Route
              path="/catalogue"
              element={
                <RequirePermission anyOf={["medication.view"]}>
                  <MedicationsScreen />
                </RequirePermission>
              }
            />
            <Route
              path="/inventory"
              element={
                <RequirePermission anyOf={["stock.view"]}>
                  <InventoryScreen />
                </RequirePermission>
              }
            />
            <Route
              path="/inventory/:stockItemId"
              element={
                <RequirePermission anyOf={["stock.view"]}>
                  <StockItemDetailScreen />
                </RequirePermission>
              }
            />
            <Route
              path="/audit"
              element={
                <RequirePermission anyOf={["audit.view"]}>
                  <AuditScreen />
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
