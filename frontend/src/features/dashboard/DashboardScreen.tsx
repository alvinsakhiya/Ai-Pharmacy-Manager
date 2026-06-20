import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { FUTURE_ITEMS, NAV_ITEMS, type NavItem } from "../../app/navConfig";
import { scopeLabel } from "../../lib/scope";

const MODULE_DESCRIPTIONS: Record<string, string> = {
  Users: "Manage pharmacy users and role assignments.",
  Organisation: "Manage groups, pharmacies, and organisation structure.",
  Medications: "Manage medication catalogue and reference data.",
  Inventory: "Track stock levels, batches, locations, and movement.",
  "Stock Intelligence":
    "Review explainable analytics for stock attention, expiry, and reorder risk.",
  Reports: "Download read-only stock attention and movement reports.",
  Alerts: "Review live operational stock and Dosette/MDS alerts.",
  Reviews: "Manage the operational pharmacist review queue.",
  Patients: "View and manage patient records and history.",
  "Audit Log": "Review security and operational audit events.",
};

const MODULE_ICONS: Record<string, string> = {
  Users: "U",
  Organisation: "O",
  Medications: "+",
  Inventory: "□",
  "Stock Intelligence": "↗",
  Reports: "R",
  Alerts: "!",
  Reviews: "★",
  Patients: "P",
  "Audit Log": "A",
};

const QUICK_LINK_LABELS = new Set([
  "Stock Intelligence",
  "Reports",
  "Alerts",
  "Reviews",
  "Audit Log",
]);

function formatRole(role: string | null) {
  if (!role) {
    return "No role";
  }

  return role
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

interface StatCardProps {
  label: string;
  value: string | number;
  helper: string;
}

function StatCard({ helper, label, value }: StatCardProps) {
  return (
    <article className="stat-card">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-5 text-slate-500">{helper}</p>
    </article>
  );
}

function ModuleCard({ item }: { item: NavItem }) {
  return (
    <Link
      className="group app-card flex min-h-40 flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-card-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
      to={item.path}
    >
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="icon-tile">
          {MODULE_ICONS[item.label] ?? item.label.charAt(0)}
        </span>
        <div>
          <h3 className="text-base font-bold text-slate-950">{item.label}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {MODULE_DESCRIPTIONS[item.label] ??
              "Open this workspace module for authorised users."}
          </p>
        </div>
      </div>
      <span
        aria-hidden="true"
        className="mt-4 text-right text-lg font-semibold text-teal-700 transition group-hover:translate-x-1"
      >
        →
      </span>
    </Link>
  );
}

export function DashboardScreen() {
  const { user } = useAuth();
  const { can } = usePermissions();

  if (!user) {
    return null;
  }

  const permittedModules = NAV_ITEMS.filter(
    (item) =>
      item.path !== "/" &&
      item.requiredAnyOf?.some((permission) => can(permission)),
  );
  const quickLinks = permittedModules.filter((item) =>
    QUICK_LINK_LABELS.has(item.label),
  );
  const enabledPermissionCount = Object.values(user.permissions).filter(
    Boolean,
  ).length;

  return (
    <div className="space-y-6">
      <section className="dashboard-hero-grid">
        <div className="app-card p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-teal-700">
                Dashboard landing
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Welcome, {user.full_name || user.email}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                A clean overview of the modules available to your account and
                the pharmacies currently in scope.
              </p>
            </div>
            <span className="badge badge--info uppercase tracking-wide">
              {formatRole(user.role)}
            </span>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">
                  Pharmacies in scope
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {scopeLabel(user)}
                </p>
              </div>
              <span className="badge badge--neutral">
                {user.scope.is_global
                  ? "Global access"
                  : `${user.pharmacies.length} assigned`}
              </span>
            </div>

            {user.pharmacies.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {user.pharmacies.map((pharmacy) => (
                  <li className="badge badge--success" key={pharmacy.id}>
                    {pharmacy.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No assigned pharmacy.
              </p>
            )}
          </div>
        </div>

        <div className="dashboard-stat-grid">
          <StatCard
            helper={
              user.scope.is_global
                ? "All pharmacies visible to this account."
                : "Assigned pharmacy records."
            }
            label="Pharmacies"
            value={user.scope.is_global ? "Global" : user.pharmacies.length}
          />
          <StatCard
            helper="Permission-filtered navigation modules."
            label="Available modules"
            value={permittedModules.length}
          />
          <StatCard
            helper="Enabled capability flags on your account."
            label="Permissions"
            value={enabledPermissionCount}
          />
        </div>
      </section>

      <section className="dashboard-main-grid">
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="section-title">Available modules</h2>
              <p className="mt-1 text-sm text-slate-500">
                Shortcuts are generated from the same permission rules as the
                primary navigation.
              </p>
            </div>
          </div>
          <div className="dashboard-module-grid">
            {permittedModules.map((item) => (
              <ModuleCard item={item} key={item.path} />
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="app-card p-5">
            <h2 className="section-title">Operational shortcuts</h2>
            <div className="mt-4 space-y-3">
              {quickLinks.length > 0 ? (
                quickLinks.map((item) => (
                  <Link
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                    key={item.path}
                    to={item.path}
                  >
                    <span>{item.label}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-500">
                  No operational shortcuts are available for this account.
                </p>
              )}
            </div>
          </section>

          <section className="app-card p-5">
            <h2 className="section-title">Coming in later phases</h2>
            <div className="mt-4 space-y-3">
              {FUTURE_ITEMS.map((item) => (
                <article
                  aria-disabled="true"
                  className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4"
                  key={item.label}
                >
                  <h3 className="text-sm font-bold text-slate-700">
                    {item.label}
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    Planned for a later approved phase.
                  </p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
