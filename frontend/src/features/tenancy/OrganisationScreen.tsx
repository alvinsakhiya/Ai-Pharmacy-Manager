import { GroupsSection } from "./GroupsSection";

export function OrganisationScreen() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-teal-700">Organisation</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Organisation
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Manage the high-level group structure for pharmacy organisations.
          Pharmacy management arrives in the next task.
        </p>
      </section>

      <GroupsSection />

      <section className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Pharmacies</h2>
        <p className="mt-2 text-sm text-slate-600">
          Pharmacy management arrives in the next task.
        </p>
      </section>
    </div>
  );
}
