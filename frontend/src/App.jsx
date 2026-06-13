import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Spinner } from "./components/ui";
import Layout from "./components/Layout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import Dosette from "./pages/Dosette";
import Picking from "./pages/Picking";
import Stock from "./pages/Stock";
import Expiry from "./pages/Expiry";
import Forecasting from "./pages/Forecasting";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import AuditLog from "./pages/AuditLog";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center text-accent">
        <Spinner className="h-6 w-6" />
      </div>
    );
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="patients" element={<Patients />} />
        <Route path="dosette" element={<Dosette />} />
        <Route path="picking" element={<Picking />} />
        <Route path="stock" element={<Stock />} />
        <Route path="expiry" element={<Expiry />} />
        <Route path="forecasting" element={<Forecasting />} />
        <Route path="reports" element={<Reports />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="audit" element={<AuditLog />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
