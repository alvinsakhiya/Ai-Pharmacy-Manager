import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { DashboardScreen } from "../features/dashboard/DashboardScreen";
import { StockAnalyticsScreen } from "../features/analytics/StockAnalyticsScreen";
import { ChangePasswordScreen } from "../features/auth/ChangePasswordScreen";
import { LoginScreen } from "../features/auth/LoginScreen";
import { AuditScreen } from "../features/audit/AuditScreen";
import { MedicationsScreen } from "../features/catalogue/MedicationsScreen";
import { InventoryScreen } from "../features/inventory/InventoryScreen";
import { StockItemDetailScreen } from "../features/inventory/StockItemDetailScreen";
import { DosetteScreen } from "../features/dosette/DosetteScreen";
import { AlertsScreen } from "../features/notifications/AlertsScreen";
import { PatientDetailScreen } from "../features/patients/PatientDetailScreen";
import { PatientsScreen } from "../features/patients/PatientsScreen";
import { ReportsScreen } from "../features/reports/ReportsScreen";
import { ReviewsScreen } from "../features/reviews/ReviewsScreen";
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
              path="/analytics"
              element={
                <RequirePermission anyOf={["stock.view"]}>
                  <StockAnalyticsScreen />
                </RequirePermission>
              }
            />
            <Route
              path="/reports"
              element={
                <RequirePermission anyOf={["stock.view"]}>
                  <ReportsScreen />
                </RequirePermission>
              }
            />
            <Route
              path="/alerts"
              element={
                <RequirePermission anyOf={["stock.view", "blister.view"]}>
                  <AlertsScreen />
                </RequirePermission>
              }
            />
            <Route
              path="/reviews"
              element={
                <RequirePermission anyOf={["review.view"]}>
                  <ReviewsScreen />
                </RequirePermission>
              }
            />
            <Route
              path="/patients"
              element={
                <RequirePermission anyOf={["patient.view"]}>
                  <PatientsScreen />
                </RequirePermission>
              }
            />
            <Route
              path="/patients/:patientId"
              element={
                <RequirePermission anyOf={["patient.view"]}>
                  <PatientDetailScreen />
                </RequirePermission>
              }
            />
            <Route
              path="/patients/:patientId/dosette"
              element={
                <RequirePermission anyOf={["blister.view"]}>
                  <DosetteScreen />
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
