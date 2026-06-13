import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Spinner } from "./components/ui";
import Layout from "./components/Layout";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Patients = lazy(() => import("./pages/Patients"));
const Dosette = lazy(() => import("./pages/Dosette"));
const Picking = lazy(() => import("./pages/Picking"));
const Stock = lazy(() => import("./pages/Stock"));
const Expiry = lazy(() => import("./pages/Expiry"));
const Forecasting = lazy(() => import("./pages/Forecasting"));
const Reports = lazy(() => import("./pages/Reports"));
const Notifications = lazy(() => import("./pages/Notifications"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const AIHub = lazy(() => import("./pages/ai/AIHub"));
const ClinicalSafety = lazy(() => import("./pages/ai/ClinicalSafety"));
const SmartReorder = lazy(() => import("./pages/ai/SmartReorder"));
const Intake = lazy(() => import("./pages/ai/Intake"));
const DailyBrief = lazy(() => import("./pages/ai/DailyBrief"));
const Settings = lazy(() => import("./pages/Settings"));

function PageFallback() {
  return (
    <div className="flex min-h-64 items-center justify-center text-accent">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

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
    <Suspense fallback={<PageFallback />}>
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
          <Route path="ai" element={<AIHub />} />
          <Route path="ai/brief" element={<DailyBrief />} />
          <Route path="ai/safety" element={<ClinicalSafety />} />
          <Route path="ai/reorder" element={<SmartReorder />} />
          <Route path="ai/intake" element={<Intake />} />
          <Route path="reports" element={<Reports />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
