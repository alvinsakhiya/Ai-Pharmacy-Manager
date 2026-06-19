import { useMemo } from "react";

import { useAuth } from "../../auth/AuthContext";

export function usePharmacyNames() {
  const { user } = useAuth();

  const pharmacyNames = useMemo(() => {
    return new Map(
      (user?.pharmacies ?? []).map((pharmacy) => [pharmacy.id, pharmacy.name]),
    );
  }, [user?.pharmacies]);

  return {
    pharmacyName: (id: number) => pharmacyNames.get(id) ?? `Pharmacy #${id}`,
  };
}
