import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createPatient,
  deactivatePatient,
  getPatient,
  listPatients,
  updatePatient,
  type PatientListParams,
  type PatientUpdateBody,
  type PatientWriteBody,
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

export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: PatientWriteBody) => createPatient(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: PatientUpdateBody;
    }) => updatePatient(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useDeactivatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deactivatePatient(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}
