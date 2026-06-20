import { useQuery } from "@tanstack/react-query";

import {
  getPickingList,
  listDosetteCycles,
  listPatientMedications,
} from "./dosetteApi";

export function usePatientMedicationsQuery(patientId: number) {
  return useQuery({
    queryKey: ["dosette", "medications", patientId],
    queryFn: () => listPatientMedications(patientId),
    enabled: Number.isFinite(patientId),
  });
}

export function useDosetteCyclesQuery(patientId: number) {
  return useQuery({
    queryKey: ["dosette", "cycles", patientId],
    queryFn: () => listDosetteCycles(patientId),
    enabled: Number.isFinite(patientId),
  });
}

export function usePickingListQuery(patientId: number, cycleId: number | null) {
  return useQuery({
    queryKey: ["dosette", "picking-list", patientId, cycleId],
    queryFn: () => getPickingList(patientId, cycleId as number),
    enabled: Number.isFinite(patientId) && Number.isFinite(cycleId),
  });
}
