import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  BrainCircuit,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  LockKeyhole,
  PackageSearch,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Badge from "../components/Badge";
import Button from "../components/Button";
import ClinicalMetric from "../components/ClinicalMetric";
import PageHeader from "../components/Header";
import { ErrorState, LoadingState } from "../components/PageState";
import { Panel, PanelHeader } from "../components/Panel";
import useApiResource from "../hooks/useApiResource";
import useAuth from "../hooks/useAuth";
import useToast from "../hooks/useToast";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";
import { PharmacyRole, canAccessPath } from "../utils/access";

const allReportRoles = Object.values(PharmacyRole);

const reportCards = [
  {
    id: "stock",
    title: "Stock report",
    description:
      "Export medication batches, quantities, expiry dates, supplier text and reorder thresholds.",
    endpoint: "/reports/stock.csv",
    filename: "stock-report.csv",
    icon: PackageSearch,
    tone: "blue",
    roles: allReportRoles,
  },
  {
    id: "expiry",
    title: "Expiry safety report",
    description:
      "Export expired and near-expiry stock groups for waste-reduction review.",
    endpoint: "/reports/expiry.csv",
    filename: "expiry-report.csv",
    icon: AlertTriangle,
    tone: "danger",
    roles: [
      PharmacyRole.MANAGER,
      PharmacyRole.PHARMACIST,
      PharmacyRole.STOCK_ASSISTANT,
      PharmacyRole.READ_ONLY,
    ],
  },
  {
    id: "forecast",
    title: "Forecast report",
    description:
      "Export explainable demand, weeks-of-cover, risk and reorder recommendations.",
    endpoint: "/reports/forecast.csv",
    filename: "forecast-report.csv",
    icon: BrainCircuit,
    tone: "success",
    roles: [
      PharmacyRole.MANAGER,
      PharmacyRole.PHARMACIST,
      PharmacyRole.READ_ONLY,
    ],
  },
  {
    id: "notifications",
    title: "Notification report",
    description:
      "Export visible notification titles, priorities, statuses and lifecycle dates.",
    endpoint: "/reports/notifications.csv",
    filename: "notification-report.csv",
    icon: BellRing,
    tone: "warning",
    roles: allReportRoles,
  },
  {
    id: "audit",
    title: "Audit report",
    description:
      "Export the latest append-only governance events for manager review.",
    endpoint: "/reports/audit.csv",
    filename: "audit-report.csv",
    icon: ShieldCheck,
    tone: "neutral",
    roles: [PharmacyRole.MANAGER],
  },
];

function userCanExport(user, roles) {
  return roles.some((role) => user?.roles?.includes(role));
}

function extractDownloadFilename(headers, fallback) {
  const disposition = headers["content-disposition"] || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

function triggerBrowserDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function ReportCard({ report, canExport, isPending, onDownload }) {
  const Icon = report.icon;

  return (
    <article className="surface-card flex h-full flex-col overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/58 text-blue-700 shadow-sm backdrop-blur-xl">
          <Icon aria-hidden="true" size={22} />
        </span>
        <Badge tone={canExport ? report.tone : "slate"} icon={canExport ? Download : LockKeyhole}>
          {canExport ? "CSV ready" : "Role restricted"}
        </Badge>
      </div>

      <div className="mt-5 flex-1">
        <h2 className="text-lg font-black tracking-tight text-slate-950">
          {report.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {report.description}
        </p>
      </div>

      <Button
        className="mt-5 w-full"
        disabled={!canExport}
        icon={canExport ? Download : LockKeyhole}
        loading={isPending}
        variant={canExport ? "primary" : "secondary"}
        onClick={() => onDownload(report)}
      >
        {canExport ? "Download CSV" : "Not available"}
      </Button>
    </article>
  );
}

function Reports() {
  const { user } = useAuth();
  const toast = useToast();
  const canExportPicking = canAccessPath(user, "/picking-lists");
  const [selectedPatient, setSelectedPatient] = useState("");
  const [pendingReport, setPendingReport] = useState("");
  const patientResourcePath = canExportPicking ? "/patients/" : "";
  const {
    data: patientData,
    error: patientError,
    isLoading: isPatientsLoading,
    reload: reloadPatients,
  } = useApiResource(
    patientResourcePath,
    "Patients could not be loaded for picking-list exports.",
    []
  );
  const patients = Array.isArray(patientData)
    ? patientData
    : patientData?.results || [];
  const selectedPatientRecord = patients.find(
    (patient) => String(patient.id) === selectedPatient
  );
  const enabledReportCount = useMemo(
    () =>
      reportCards.filter((report) => userCanExport(user, report.roles)).length
      + (canExportPicking ? 1 : 0),
    [canExportPicking, user]
  );

  const downloadReport = async (report) => {
    if (!userCanExport(user, report.roles)) {
      return;
    }

    setPendingReport(report.id);

    try {
      const response = await api.get(report.endpoint, {
        responseType: "blob",
      });
      const contentType = response.headers["content-type"] || "text/csv";
      const filename = extractDownloadFilename(
        response.headers,
        report.filename
      );
      triggerBrowserDownload(
        new Blob([response.data], { type: contentType }),
        filename
      );
      toast.success(
        "CSV export ready",
        `${report.title} downloaded for authorised local review.`
      );
    } catch {
      toast.error(
        "Export failed",
        "The report could not be generated. Check your role access and API connection."
      );
    } finally {
      setPendingReport("");
    }
  };

  const downloadPickingReport = async () => {
    if (!selectedPatient || !canExportPicking) {
      return;
    }

    await downloadReport({
      id: "picking",
      title: "Patient picking list",
      endpoint: `/reports/picking-list/${selectedPatient}.csv`,
      filename: `picking-list-patient-${selectedPatient}.csv`,
      roles: [
        PharmacyRole.MANAGER,
        PharmacyRole.PHARMACIST,
        PharmacyRole.DISPENSER,
      ],
    });
  };

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Reporting and exports"
        title="Report export centre"
        description="Generate original CSV reports for operational review, AT4 testing evidence and safe portfolio demonstration. No proprietary templates or external NHS services are used."
        icon={FileSpreadsheet}
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ClinicalMetric
          icon={FileSpreadsheet}
          label="CSV exports"
          tone="info"
          value="6"
          description="Operational reports currently available"
        />
        <ClinicalMetric
          icon={ShieldCheck}
          label="Audited"
          tone="ready"
          value="Yes"
          description="Each export writes a safe audit event"
        />
        <ClinicalMetric
          icon={LockKeyhole}
          label="Role-aware"
          tone="attention"
          value={enabledReportCount}
          description="Exports enabled for your current role"
        />
        <ClinicalMetric
          icon={Download}
          label="Format"
          tone="neutral"
          value="CSV"
          description="Spreadsheet-ready and deployment-safe"
        />
      </section>

      <Panel className="mb-6 overflow-hidden">
        <PanelHeader
          eyebrow="Patient-specific workflow"
          icon={ClipboardCheck}
          title="Picking-list export"
          description="Download a patient-specific weekly picking list that uses the current FEFO-safe allocation rules."
          action={
            <Badge tone={canExportPicking ? "success" : "slate"}>
              {canExportPicking ? "Picking role available" : "Role restricted"}
            </Badge>
          }
        />

        {!canExportPicking ? (
          <div className="p-5 sm:p-6">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm leading-6 text-slate-600">
              Your current role can view the report centre, but picking-list
              exports are limited to manager, pharmacist and dispenser roles.
            </div>
          </div>
        ) : patientError ? (
          <ErrorState message={patientError} onRetry={reloadPatients} />
        ) : isPatientsLoading ? (
          <LoadingState label="Loading patients for report export..." />
        ) : (
          <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <label
                className="text-sm font-bold text-slate-800"
                htmlFor="report-patient-selector"
              >
                Select patient
              </label>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Choose an existing patient before exporting their picking list.
              </p>
              <div className="relative mt-3 max-w-xl">
                <UserRound
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <select
                  id="report-patient-selector"
                  className="field-control field-with-leading-icon min-h-12 appearance-none font-semibold"
                  value={selectedPatient}
                  onChange={(event) => setSelectedPatient(event.target.value)}
                >
                  <option value="">Choose a patient...</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.first_name} {patient.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              className="w-full lg:w-auto"
              disabled={!selectedPatient}
              icon={Download}
              loading={pendingReport === "picking"}
              onClick={downloadPickingReport}
            >
              Export picking CSV
            </Button>
          </div>
        )}

        {selectedPatientRecord && (
          <div className="border-t border-white/75 px-5 py-4 text-sm font-semibold text-slate-500 sm:px-6">
            Selected patient:{" "}
            <span className="text-slate-900">
              {selectedPatientRecord.first_name} {selectedPatientRecord.last_name}
            </span>
          </div>
        )}
      </Panel>

      <section
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        aria-label="Operational CSV exports"
      >
        {reportCards.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            canExport={userCanExport(user, report.roles)}
            isPending={pendingReport === report.id}
            onDownload={downloadReport}
          />
        ))}
      </section>

      <Panel className="mt-6 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50/75 text-blue-800">
            <ShieldCheck aria-hidden="true" size={21} />
          </span>
          <div>
            <h2 className="text-base font-black text-slate-950">
              Export safety note
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Reports are generated from the project database and downloaded
              locally by authenticated staff. Notification message bodies are
              intentionally excluded from the CSV report to reduce unnecessary
              free-text exposure; users can review full notification details in
              the notification centre.
            </p>
          </div>
        </div>
      </Panel>
    </MainLayout>
  );
}

export default Reports;
