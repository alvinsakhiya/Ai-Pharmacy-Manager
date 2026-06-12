import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";
import { Brain, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

function getRiskStyle(risk) {
  if (risk === "High") return "bg-red-50 text-red-700";
  if (risk === "Medium") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function getRiskIcon(risk) {
  if (risk === "High") return <AlertTriangle size={18} />;
  if (risk === "Medium") return <TrendingUp size={18} />;
  return <CheckCircle2 size={18} />;
}

function Forecasts() {
  const [forecasts, setForecasts] = useState([]);

  useEffect(() => {
    api.get("/forecasts/")
      .then((response) => setForecasts(response.data))
      .catch((error) => console.error("Forecast API error:", error));
  }, []);

  return (
    <MainLayout>
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-purple-50">
            <Brain className="text-purple-700" size={28} />
          </div>

          <div>
            <h1 className="text-4xl font-bold text-slate-900">
              AI Forecasting
            </h1>
            <p className="text-slate-500 mt-2">
              Predict weekly medication demand and identify stock risk using dosette usage data.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-sm">
            <tr>
              <th className="px-6 py-4">Medication</th>
              <th className="px-6 py-4">Current Stock</th>
              <th className="px-6 py-4">Predicted Weekly Demand</th>
              <th className="px-6 py-4">Weeks of Cover</th>
              <th className="px-6 py-4">Recommendation</th>
              <th className="px-6 py-4">Risk</th>
            </tr>
          </thead>

          <tbody>
            {forecasts.map((item, index) => (
              <tr
                key={index}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-6 py-4 font-semibold text-slate-900">
                  {item.medication}
                </td>

                <td className="px-6 py-4 text-slate-600">
                  {item.current_stock}
                </td>

                <td className="px-6 py-4 text-slate-600">
                  {item.predicted_weekly_demand}
                </td>

                <td className="px-6 py-4 text-slate-600">
                  {item.weeks_of_cover ?? "No active demand"}
                </td>

                <td className="px-6 py-4 text-slate-600">
                  {item.recommendation}
                </td>

                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${getRiskStyle(
                      item.risk_level
                    )}`}
                  >
                    {getRiskIcon(item.risk_level)}
                    {item.risk_level}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MainLayout>
  );
}

export default Forecasts;