import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";
import { ClipboardList, PackageCheck } from "lucide-react";

function PickingLists() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [pickingList, setPickingList] = useState([]);

  useEffect(() => {
    api.get("/patients/")
      .then((response) => setPatients(response.data))
      .catch((error) => console.error("Patients API error:", error));
  }, []);

  const loadPickingList = (patientId) => {
    setSelectedPatient(patientId);

    if (!patientId) {
      setPickingList([]);
      return;
    }

    api.get(`/picking-list/${patientId}/`)
      .then((response) => setPickingList(response.data))
      .catch((error) => console.error("Picking list API error:", error));
  };

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900">Picking Lists</h1>
        <p className="text-slate-500 mt-2">
          Generate patient picking lists with weekly quantities and FEFO batch allocation.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-8">
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Select Patient
        </label>

        <select
          value={selectedPatient}
          onChange={(e) => loadPickingList(e.target.value)}
          className="w-full md:w-96 border border-slate-300 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="">Choose a patient...</option>

          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.first_name} {patient.last_name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-5">
        {pickingList.map((item, index) => (
          <div
            key={index}
            className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-blue-50">
                    <ClipboardList className="text-blue-600" size={22} />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {item.medication}
                    </h2>
                    <p className="text-sm text-slate-500">
                      Weekly quantity required: {item.weekly_quantity}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mt-5 text-center">
                  <div className="bg-slate-50 rounded-2xl p-3">
                    <p className="text-xs text-slate-500">Morning</p>
                    <p className="font-bold text-slate-900">{item.morning_dose || "—"}</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-3">
                    <p className="text-xs text-slate-500">Afternoon</p>
                    <p className="font-bold text-slate-900">{item.afternoon_dose || "—"}</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-3">
                    <p className="text-xs text-slate-500">Evening</p>
                    <p className="font-bold text-slate-900">{item.evening_dose || "—"}</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-3">
                    <p className="text-xs text-slate-500">Bedtime</p>
                    <p className="font-bold text-slate-900">{item.bedtime_dose || "—"}</p>
                  </div>
                </div>
              </div>

              <div className="min-w-72">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <PackageCheck size={18} />
                  FEFO Allocation
                </h3>

                <div className="mt-3 space-y-3">
                  {item.allocations.map((allocation, idx) => (
                    <div key={idx} className="rounded-2xl bg-emerald-50 p-3">
                      <p className="font-semibold text-emerald-800">
                        Batch {allocation.batch_number}
                      </p>
                      <p className="text-sm text-emerald-700">
                        Qty {allocation.quantity} · Exp {allocation.expiry_date}
                      </p>
                    </div>
                  ))}

                  {item.shortfall > 0 && (
                    <div className="rounded-2xl bg-red-50 p-3">
                      <p className="font-semibold text-red-700">
                        Shortfall: {item.shortfall}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </MainLayout>
  );
}

export default PickingLists;