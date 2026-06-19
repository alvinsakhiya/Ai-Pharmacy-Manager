import { useQuery } from "@tanstack/react-query";

import {
  getPatient,
  listPatients,
  type PatientListParams,
} from "./patientApi";

export function usePatientsQuery(params?: PatientListParams) {
  return useQuery({
    queryKey: ["patients", "list", params?.pharmacy ?? null, params?.search ?? ""],
    queryFn: () => listPatients(params),
  });
}

export function usePatientQuery(id: number) {
  return useQuery({
    queryKey: ["patients", "detail", id],
    queryFn: () => getPatient(id),
    enabled: Number.isFinite(id),
  });
}
