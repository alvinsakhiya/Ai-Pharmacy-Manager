import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  PackageCheck,
  PackageX,
  UserRound,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import PageHeader from "../components/Header";
import Badge from "../components/Badge";
import DoseSchedule from "../components/DoseSchedule";
import { Panel } from "../components/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import ClinicalMetric from "../components/ClinicalMetric";
import api from "../services/api";
import { formatDate } from "../utils/helpers";

function PickingLists() {
  const [patients, setPatients] = useState([]);
  const [patientsStatus, setPatientsStatus] = useState("loading");
  const [selectedPatient, setSelectedPatient] = useState("");
  const [pickingList, setPickingList] = useState([]);
  const [listStatus, setListStatus] = useState("idle");

  const loadPatients = () => {
    setPatientsStatus("loading");

    api
      .get("/patients/")
      .then((response) => {
        setPatients(response.data);
        setPatientsStatus("success");
      })
      .catch(() => setPatientsStatus("error"));
  };

  useEffect(() => {
    let isCurrentRequest = true;

    api
      .get("/patients/")
      .then((response) => {
        if (isCurrentRequest) {
          setPatients(response.data);
          setPatientsStatus("success");
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setPatientsStatus("error");
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  const loadPickingList = async (patientId) => {
    setSelectedPatient(patientId);
    setPickingList([]);

    if (!patientId) {
      setListStatus("idle");
      return;
    }

    setListStatus("loading");

    try {
      const response = await api.get(`/picking-list/${patientId}/`);
      setPickingList(response.data);
      setListStatus("success");
    } catch {
      setListStatus("error");
    }
  };

  const selectedPatientRecord = patients.find(
    (patient) => String(patient.id) === selectedPatient
  );
  const totalRequired = pickingList.reduce(
    (total, item) => total + item.weekly_quantity,
    0
  );
  const totalShortfall = pickingList.reduce(
    (total, item) => total + item.shortfall,
    0
  );

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Dispensing workflow"
        title="Patient picking lists"
        description="Calculate weekly medication requirements and review safe FEFO batch allocation before assembly."
        icon={ClipboardCheck}
        actions={
          selectedPatientRecord && (
            <Badge dot tone={totalShortfall > 0 ? "danger" : "success"}>
              {totalShortfall > 0
                ? "SHORTFALL · Stock action required"
                : "READY · Allocation complete"}
            </Badge>
          )
        }
      />

      <Panel className="mb-6 overflow-hidden">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label
              className="text-sm font-bold text-slate-800"
              htmlFor="patient-selector"
            >
              Select a patient
            </label>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              The list uses active dosette schedules and current FEFO-safe stock.
            </p>
            <div className="relative mt-3 max-w-xl">
              <UserRound
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <select
                id="patient-selector"
                value={selectedPatient}
                disabled={patientsStatus === "loading" || patientsStatus === "error"}
                onChange={(event) => loadPickingList(event.target.value)}
                className="field-control field-with-leading-icon min-h-12 appearance-none font-semibold"
              >
                <option value="">
                  {patientsStatus === "loading"
                    ? "Loading patients..."
                    : "Choose a patient..."}
                </option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.first_name} {patient.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedPatientRecord && listStatus === "success" && (
            <div className="grid grid-cols-2 gap-3">
              <ClinicalMetric
                icon={PackageCheck}
                label="Weekly units"
                tone="info"
                value={totalRequired}
              />
              <ClinicalMetric
                description={totalShortfall > 0 ? "Stock action required" : "Fully covered"}
                icon={totalShortfall > 0 ? AlertTriangle : CheckCircle2}
                label="Shortfall"
                tone={totalShortfall > 0 ? "critical" : "ready"}
                value={totalShortfall}
              />
            </div>
          )}
        </div>

        {patientsStatus === "error" && (
          <div className="border-t border-slate-200">
            <ErrorState
              message="The patient list could not be loaded. Check the API connection and try again."
              onRetry={loadPatients}
            />
          </div>
        )}
      </Panel>

      {patientsStatus !== "error" && listStatus === "idle" && (
        <Panel>
          <EmptyState
            icon={ClipboardCheck}
            title="Choose a patient to begin"
            message="Their active dosette medicines, weekly quantities and recommended FEFO batches will appear here."
          />
        </Panel>
      )}

      {listStatus === "loading" && (
        <Panel>
          <LoadingState
            label="Generating patient picking list..."
            message="Calculating weekly doses and checking eligible stock batches."
          />
        </Panel>
      )}

      {listStatus === "error" && (
        <Panel>
          <ErrorState
            message="The picking list could not be generated. Check the API connection and try again."
            onRetry={() => loadPickingList(selectedPatient)}
          />
        </Panel>
      )}

      {listStatus === "success" && pickingList.length === 0 && (
        <Panel>
          <EmptyState
            icon={PackageX}
            title="No active dosette medicines"
            message="This patient does not currently have an active medication schedule to pick."
          />
        </Panel>
      )}

      {listStatus === "success" && pickingList.length > 0 && (
        <div className="space-y-5">
          {pickingList.map((item, index) => (
            <article
              key={`${item.medication}-${index}`}
              className="surface-card overflow-hidden"
              aria-labelledby={`picking-medication-${index}`}
            >
              <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-700">
                        <ClipboardCheck size={21} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">
                          Weekly medication requirement
                        </p>
                        <h2
                          id={`picking-medication-${index}`}
                          className="mt-1 text-xl font-bold tracking-tight text-slate-950"
                        >
                          {item.medication}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.patient}
                        </p>
                      </div>
                    </div>
                    <Badge tone="blue">{item.weekly_quantity} units required</Badge>
                  </div>

                  <div className="mt-6">
                    <DoseSchedule
                      doses={{
                        morning: item.morning_dose,
                        afternoon: item.afternoon_dose,
                        evening: item.evening_dose,
                        bedtime: item.bedtime_dose,
                      }}
                    />
                  </div>

                  {item.instructions && (
                    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                      <FileText className="mt-0.5 shrink-0 text-slate-400" size={17} />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Instructions
                        </p>
                        <p className="mt-1">{item.instructions}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className={`border-t p-5 sm:p-6 xl:border-l xl:border-t-0 ${
                    item.shortfall > 0
                      ? "signal-pattern-critical border-rose-300 bg-rose-50/65"
                      : "signal-pattern-ready border-cyan-300 bg-cyan-50/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p
                        className={`flex items-center gap-2 text-sm font-black ${
                          item.shortfall > 0 ? "text-red-900" : "text-emerald-900"
                        }`}
                      >
                        <PackageCheck size={19} />
                        FEFO allocation recommendation
                      </p>
                      <p
                        className={`mt-1 text-xs leading-5 ${
                          item.shortfall > 0 ? "text-red-700" : "text-emerald-700"
                        }`}
                      >
                        Ordered by earliest eligible expiry. Expired and zero-stock
                        batches are excluded.
                      </p>
                    </div>
                    {item.shortfall > 0 ? (
                      <Badge icon={AlertTriangle} tone="danger">
                        SHORTFALL · {item.shortfall} units
                      </Badge>
                    ) : (
                      <Badge icon={CheckCircle2} tone="success">
                        READY · Fully allocated
                      </Badge>
                    )}
                  </div>

                  <ol className="mt-5 space-y-3" aria-label="FEFO batch picking order">
                    {item.allocations.map((allocation, allocationIndex) => (
                      <li
                        key={`${allocation.batch_number}-${allocationIndex}`}
                        className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              FEFO {allocationIndex + 1} · Batch
                            </p>
                            <p className="mt-1 font-mono text-sm font-black text-slate-900">
                              {allocation.batch_number}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Pick quantity
                            </p>
                            <p className="mt-1 text-lg font-black text-emerald-800">
                              {allocation.quantity}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-500">
                          Expires {formatDate(allocation.expiry_date)}
                        </p>
                      </li>
                    ))}

                    {item.allocations.length === 0 && (
                      <li
                        className="flex items-start gap-3 rounded-2xl border border-rose-300 bg-white/80 p-4 text-sm font-semibold text-rose-950"
                        role="alert"
                      >
                        <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
                        <span>
                          SHORTFALL: no eligible in-date, positive-quantity stock
                          batch is available.
                        </span>
                      </li>
                    )}
                  </ol>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </MainLayout>
  );
}

export default PickingLists;
