import { Building2 } from "lucide-react";

import { PageHeader } from "../../components/ui/PageHeader";
import { GroupsSection } from "./GroupsSection";
import { PharmaciesSection } from "./PharmaciesSection";

export function OrganisationScreen() {
  return (
    <div className="space-y-5">
      <PageHeader
        className="animate-fade-in-up"
        eyebrow="Administration"
        title="Organisation"
        subtitle="Manage the high-level group structure and pharmacies for pharmacy organisations."
        meta={
          <span className="inline-flex items-center gap-1.5">
            <Building2 aria-hidden="true" className="h-3.5 w-3.5" />
            Groups and pharmacies
          </span>
        }
      />

      <div className="stagger space-y-5">
        <GroupsSection />

        <PharmaciesSection />
      </div>
    </div>
  );
}
