import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";
import { Pill } from "lucide-react";

function Dosette() {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    api.get("/dosette-records/")
      .then((response) => {
        setRecords(response.data);
      })
      .catch((error) => {
        console.error("Dosette API error:", error);
      });
  }, []);

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900">
          Dosette Management
        </h1>

        <p className="text-slate-500 mt-2">
          Manage patient medication schedules and dosette records.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-sm">
            <tr>
              <th className="px-6 py-4">Patient</th>
              <th className="px-6 py-4">Medication</th>
              <th className="px-6 py-4">Morning</th>
              <th className="px-6 py-4">Afternoon</th>
              <th className="px-6 py-4">Evening</th>
              <th className="px-6 py-4">Bedtime</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {records.map((record) => (
              <tr
                key={record.id}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-6 py-4 font-semibold text-slate-900">
                  {record.patient_name}
                </td>

                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-50">
                      <Pill className="text-blue-600" size={18} />
                    </div>

                    <div>
                      <p className="font-medium text-slate-900">
                        {record.medication_name}
                      </p>

                      <p className="text-sm text-slate-500">
                        {record.medication_strength}{" "}
                        {record.medication_form}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4">
                  {record.morning_dose || "—"}
                </td>

                <td className="px-6 py-4">
                  {record.afternoon_dose || "—"}
                </td>

                <td className="px-6 py-4">
                  {record.evening_dose || "—"}
                </td>

                <td className="px-6 py-4">
                  {record.bedtime_dose || "—"}
                </td>

                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      record.is_active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {record.is_active ? "Active" : "Inactive"}
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

export default Dosette;