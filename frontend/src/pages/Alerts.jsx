import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";
import { AlertTriangle } from "lucide-react";

const groups = [
  { key: "expired", title: "Expired Stock", style: "bg-red-50 text-red-700" },
  { key: "one_month", title: "Expires Within 1 Month", style: "bg-amber-50 text-amber-700" },
  { key: "three_months", title: "Expires Within 3 Months", style: "bg-blue-50 text-blue-700" },
  { key: "six_months", title: "Expires Within 6 Months", style: "bg-emerald-50 text-emerald-700" },
];

function Alerts() {
  const [alerts, setAlerts] = useState(null);

  useEffect(() => {
    api.get("/expiry-alerts/")
      .then((response) => setAlerts(response.data))
      .catch((error) => console.error("Alerts API error:", error));
  }, []);

  if (!alerts) {
    return (
      <MainLayout>
        <p className="text-slate-500">Loading alerts...</p>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900">Expiry Alerts</h1>
        <p className="text-slate-500 mt-2">
          Monitor expired and soon-to-expire stock batches.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {groups.map((group) => (
          <section
            key={group.key}
            className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{group.title}</h2>
                <p className="text-sm text-slate-500">
                  {alerts[group.key].length} batch record(s)
                </p>
              </div>

              <div className={`p-3 rounded-2xl ${group.style}`}>
                <AlertTriangle size={22} />
              </div>
            </div>

            <div className="space-y-3">
              {alerts[group.key].length === 0 ? (
                <p className="text-slate-400 text-sm">No stock in this category.</p>
              ) : (
                alerts[group.key].map((batch) => (
                  <div
                    key={batch.id}
                    className="border border-slate-200 rounded-2xl p-4"
                  >
                    <p className="font-semibold text-slate-900">{batch.medication}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Batch {batch.batch_number} · Exp {batch.expiry_date}
                    </p>
                    <p className="text-sm text-slate-500">
                      Qty {batch.quantity} · Supplier {batch.supplier || "—"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </MainLayout>
  );
}

export default Alerts;