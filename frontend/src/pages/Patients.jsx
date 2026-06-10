import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";
import { Search, UserPlus } from "lucide-react";

function Patients() {
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    api.get("/patients/")
      .then((response) => {
        setPatients(response.data);
      })
      .catch((error) => {
        console.error("Patients API error:", error);
      });
  }, []);

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Patients</h1>
          <p className="text-slate-500 mt-2">
            Manage patient records and dosette profiles.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-slate-950 text-white px-5 py-3 rounded-2xl hover:bg-slate-800 transition">
          <UserPlus size={20} />
          Add Patient
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200 flex items-center gap-3">
          <Search className="text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search patients..."
            className="w-full outline-none text-slate-700"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-sm">
              <tr>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Date of Birth</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Notes</th>
              </tr>
            </thead>

            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    {patient.first_name} {patient.last_name}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {patient.date_of_birth}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {patient.contact_number || "—"}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {patient.notes || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}

export default Patients;