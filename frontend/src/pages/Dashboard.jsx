import { Users, Pill, Package, AlertTriangle } from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import StatCard from "../components/StatCard";

function Dashboard() {
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
          value="205"
          subtitle="Active dosette patients"
          icon={<Users className="text-slate-700" />}
        />

        <StatCard
          title="Medications"
          value="60"
          subtitle="Medication master records"
          icon={<Pill className="text-slate-700" />}
        />

        <StatCard
          title="Stock Batches"
          value="180"
          subtitle="Tracked batch records"
          icon={<Package className="text-slate-700" />}
        />

        <StatCard
          title="Expiry Alerts"
          value="8"
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
              <span className="font-bold text-red-700">0</span>
            </div>

            <div className="flex justify-between p-4 rounded-2xl bg-amber-50">
              <span className="font-medium text-amber-700">Expires within 1 month</span>
              <span className="font-bold text-amber-700">2</span>
            </div>

            <div className="flex justify-between p-4 rounded-2xl bg-blue-50">
              <span className="font-medium text-blue-700">Expires within 3 months</span>
              <span className="font-bold text-blue-700">3</span>
            </div>

            <div className="flex justify-between p-4 rounded-2xl bg-emerald-50">
              <span className="font-medium text-emerald-700">Expires within 6 months</span>
              <span className="font-bold text-emerald-700">3</span>
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