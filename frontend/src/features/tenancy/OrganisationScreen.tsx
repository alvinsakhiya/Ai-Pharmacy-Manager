import { GroupsSection } from "./GroupsSection";
import { PharmaciesSection } from "./PharmaciesSection";

export function OrganisationScreen() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-teal-700">Organisation</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Organisation
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Manage the high-level group structure and pharmacies for pharmacy
          organisations.
        </p>
      </section>

      <GroupsSection />

      <PharmaciesSection />
    </div>
  );
}
