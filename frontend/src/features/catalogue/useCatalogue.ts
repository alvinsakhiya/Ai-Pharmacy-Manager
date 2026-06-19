import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createMedication,
  listMedications,
  updateMedication,
  type MedicationWriteBody,
} from "./catalogueApi";

const MEDICATIONS_QUERY_KEY = ["medications", "list"] as const;

export function useMedicationsQuery() {
  return useQuery({
    queryKey: MEDICATIONS_QUERY_KEY,
    queryFn: listMedications,
  });
}

export function useCreateMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: MedicationWriteBody) => createMedication(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["medications"] });
    },
  });
}

export function useUpdateMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: MedicationWriteBody }) =>
      updateMedication(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["medications"] });
    },
  });
}
