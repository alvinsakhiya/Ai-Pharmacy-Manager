import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { FUTURE_ITEMS, NAV_ITEMS } from "../../app/navConfig";
import { scopeLabel } from "../../lib/scope";

const MODULE_DESCRIPTIONS: Record<string, string> = {
  Users: "Manage pharmacy users and role assignments in a later task.",
  Organisation: "Manage groups and pharmacies in a later task.",
  "Audit Log": "Review security and operational audit events in a later task.",
  "Stock Intelligence":
    "Explainable inventory analytics for stock attention, expiry, and reorder risk.",
  Reports: "Download read-only stock attention and movement reports as CSV.",
};

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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">
              Dashboard landing
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Welcome, {user.full_name || user.email}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {scopeLabel(user)}
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-800">
            {user.role ?? "No role"}
          </span>
        </div>

        {user.pharmacies.length > 0 ? (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-slate-950">
              Pharmacies in scope
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {user.pharmacies.map((pharmacy) => (
                <li
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                  key={pharmacy.id}
                >
                  {pharmacy.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-950">Available modules</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {permittedModules.map((item) => (
            <Link
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              key={item.path}
              to={item.path}
            >
              <h3 className="text-base font-bold text-slate-950">
                {item.label}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {MODULE_DESCRIPTIONS[item.label]}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-950">
          Coming in later phases
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {FUTURE_ITEMS.map((item) => (
            <article
              aria-disabled="true"
              className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-5 text-slate-400"
              key={item.label}
            >
              <h3 className="text-base font-bold">{item.label}</h3>
              <p className="mt-2 text-sm leading-6">
                Planned for a later approved phase.
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
