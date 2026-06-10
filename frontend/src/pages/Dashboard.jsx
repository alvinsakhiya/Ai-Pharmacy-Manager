import { Users, Pill, Package, AlertTriangle } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import StatCard from "../components/StatCard";
import { useEffect, useState } from "react";
import api from "../services/api";

function Dashboard() {
  const [stats, setStats] = useState(null);

useEffect(() => {
  api.get("/dashboard/")
    .then((response) => {
      setStats(response.data);
    })
    .catch((error) => {
      console.error("Dashboard API error:", error);
    });
}, []);

if (!stats) {
  return (
    <MainLayout>
      <p className="text-slate-500">Loading dashboard...</p>
    </MainLayout>
  );
}
  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-2">
          Pharmacy stock, dosette records, expiry alerts and FEFO overview.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          title="Total Patients"
          value={stats.total_patients}
          subtitle="Active dosette patients"
          icon={<Users className="text-slate-700" />}
        />

        <StatCard
          title="Medications"
          value={stats.total_medications}
          subtitle="Medication master records"
          icon={<Pill className="text-slate-700" />}
        />

        <StatCard
          title="Stock Batches"
          value={stats.total_batches}
          subtitle="Tracked batch records"
          icon={<Package className="text-slate-700" />}
        />

        <StatCard
          title="Expiry Alerts"
          value={
            stats.expiry_alerts.expired +
            stats.expiry_alerts.one_month +
            stats.expiry_alerts.three_months +
            stats.expiry_alerts.six_months
          }
          subtitle="Require pharmacist review"
          icon={<AlertTriangle className="text-slate-700" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-8">
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Expiry Risk Overview</h2>
          <p className="text-slate-500 mt-1">Batches requiring attention.</p>

          <div className="mt-6 space-y-4">
            <div className="flex justify-between p-4 rounded-2xl bg-red-50">
              <span className="font-medium text-red-700">Expired Stock</span>
              <span className="font-bold text-red-700">{stats.expiry_alerts.expired}</span>
            </div>

            <div className="flex justify-between p-4 rounded-2xl bg-amber-50">
              <span className="font-medium text-amber-700">Expires within 1 month</span>
              <span className="font-bold text-amber-700">{stats.expiry_alerts.one_month}</span>
            </div>

            <div className="flex justify-between p-4 rounded-2xl bg-blue-50">
              <span className="font-medium text-blue-700">Expires within 3 months</span>
              <span className="font-bold text-blue-700">{stats.expiry_alerts.three_months}</span>
            </div>

            <div className="flex justify-between p-4 rounded-2xl bg-emerald-50">
              <span className="font-medium text-emerald-700">Expires within 6 months</span>
              <span className="font-bold text-emerald-700">{stats.expiry_alerts.six_months}</span>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">FEFO Recommendations</h2>
          <p className="text-slate-500 mt-1">Suggested stock usage priority.</p>

          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-2xl border border-slate-200">
              <p className="font-semibold text-slate-900">Paracetamol 500mg</p>
              <p className="text-sm text-slate-500 mt-1">Use batch PCM001 first · Expiry 31/12/2027</p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200">
              <p className="font-semibold text-slate-900">Metformin 500mg</p>
              <p className="text-sm text-slate-500 mt-1">Use batch MET001 first · Expiry 30/09/2027</p>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}

export default Dashboard;