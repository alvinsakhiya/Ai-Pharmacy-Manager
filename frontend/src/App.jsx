import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import useAuth from "./hooks/useAuth";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import Inventory from "./pages/Inventory";
import StockMovements from "./pages/StockMovements";
import ClinicalReviews from "./pages/ClinicalReviews";
import NotificationCenter from "./pages/NotificationCenter";
import Dosette from "./pages/Dosette";
import PickingLists from "./pages/PickingLists";
import Alerts from "./pages/Alerts";
import Forecasts from "./pages/Forecasts";
import StockIntelligence from "./pages/StockIntelligence";
import Ordering from "./pages/Ordering";
import Operations from "./pages/Operations";
import Deliveries from "./pages/Deliveries";
import FridgeMonitoring from "./pages/FridgeMonitoring";
import Appointments from "./pages/Appointments";
import Reports from "./pages/Reports";
import AuditLog from "./pages/AuditLog";
import { canAccessPath } from "./utils/access";

function ProtectedRoute({ children, path }) {
  const {
    isAuthenticated,
    isProfileLoading,
    profileError,
    user,
  } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isProfileLoading && !user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm font-semibold text-slate-500" role="status">
          Loading authorised workspace...
        </p>
      </main>
    );
  }

  if (profileError && !user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-3xl border border-red-200 bg-white p-6 text-center shadow-xl">
          <h1 className="text-lg font-bold text-slate-950">
            Access profile unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {profileError} Check the API connection and reload the application.
          </p>
          <button
            type="button"
            className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25"
            onClick={() => window.location.reload()}
          >
            Reload application
          </button>
        </div>
      </main>
    );
  }

  if (!canAccessPath(user, path)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute path="/">
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/patients"
        element={
          <ProtectedRoute path="/patients">
            <Patients />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inventory"
        element={
          <ProtectedRoute path="/inventory">
            <Inventory />
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock-movements"
        element={
          <ProtectedRoute path="/stock-movements">
            <StockMovements />
          </ProtectedRoute>
        }
      />

      <Route
        path="/clinical-reviews"
        element={
          <ProtectedRoute path="/clinical-reviews">
            <ClinicalReviews />
          </ProtectedRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute path="/notifications">
            <NotificationCenter />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dosette"
        element={
          <ProtectedRoute path="/dosette">
            <Dosette />
          </ProtectedRoute>
        }
      />

      <Route
        path="/picking-lists"
        element={
          <ProtectedRoute path="/picking-lists">
            <PickingLists />
          </ProtectedRoute>
        }
      />

      <Route
        path="/alerts"
        element={
          <ProtectedRoute path="/alerts">
            <Alerts />
          </ProtectedRoute>
        }
      />

      <Route
        path="/forecasts"
        element={
          <ProtectedRoute path="/forecasts">
            <Forecasts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stock-intelligence"
        element={
          <ProtectedRoute path="/stock-intelligence">
            <StockIntelligence />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ordering"
        element={
          <ProtectedRoute path="/ordering">
            <Ordering />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations"
        element={
          <ProtectedRoute path="/operations">
            <Operations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/deliveries"
        element={
          <ProtectedRoute path="/deliveries">
            <Deliveries />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fridge-monitoring"
        element={
          <ProtectedRoute path="/fridge-monitoring">
            <FridgeMonitoring />
          </ProtectedRoute>
        }
      />
      <Route
        path="/appointments"
        element={
          <ProtectedRoute path="/appointments">
            <Appointments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute path="/reports">
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit-log"
        element={
          <ProtectedRoute path="/audit-log">
            <AuditLog />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
