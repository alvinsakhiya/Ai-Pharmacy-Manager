import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";
import { Package, Search } from "lucide-react";

function Inventory() {
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    api.get("/stock-batches/")
      .then((response) => {
        setBatches(response.data);
      })
      .catch((error) => {
        console.error("Inventory API error:", error);
      });
  }, []);

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500 mt-2">
            Track medication stock batches, quantities, suppliers and expiry dates.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-slate-950 text-white px-5 py-3 rounded-2xl hover:bg-slate-800 transition">
          <Package size={20} />
          Add Stock Batch
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200 flex items-center gap-3">
          <Search className="text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search inventory..."
            className="w-full outline-none text-slate-700"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-sm">
              <tr>
                <th className="px-6 py-4">Medication</th>
                <th className="px-6 py-4">Batch</th>
                <th className="px-6 py-4">Expiry Date</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Received</th>
                <th className="px-6 py-4">Supplier</th>
              </tr>
            </thead>

            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    {batch.medication_name} {batch.medication_strength} {batch.medication_form}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {batch.batch_number}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {batch.expiry_date}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-sm">
                      {batch.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {batch.received_date}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {batch.supplier || "—"}
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

export default Inventory;