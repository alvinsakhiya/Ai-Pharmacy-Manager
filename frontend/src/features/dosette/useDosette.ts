import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelDosetteCycle,
  createDosetteCycle,
  createPatientMedication,
  discontinuePatientMedication,
  getPickingList,
  getStockPreview,
  listDosetteCycles,
  listPatientMedications,
  prepareDosetteCycle,
  updateDosetteCycle,
  updatePatientMedication,
  type DosetteCycleWriteBody,
  type PatientMedicationWriteBody,
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

export function useStockPreviewQuery(patientId: number, cycleId: number | null) {
  return useQuery({
    queryKey: ["dosette", "stock-preview", patientId, cycleId],
    queryFn: () => getStockPreview(patientId, cycleId as number),
    enabled: Number.isFinite(patientId) && Number.isFinite(cycleId),
  });
}

function useInvalidateDosetteMedicationData(patientId: number) {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({
      queryKey: ["dosette", "medications", patientId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["dosette", "picking-list", patientId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["dosette", "stock-preview", patientId],
    });
  };
}

export function useCreatePatientMedication(patientId: number) {
  const invalidateDosetteMedicationData =
    useInvalidateDosetteMedicationData(patientId);

  return useMutation({
    mutationFn: (body: PatientMedicationWriteBody) =>
      createPatientMedication(patientId, body),
    onSuccess: invalidateDosetteMedicationData,
  });
}

export function useUpdatePatientMedication(patientId: number) {
  const invalidateDosetteMedicationData =
    useInvalidateDosetteMedicationData(patientId);

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: PatientMedicationWriteBody;
    }) => updatePatientMedication(patientId, id, body),
    onSuccess: invalidateDosetteMedicationData,
  });
}

export function useDiscontinuePatientMedication(patientId: number) {
  const invalidateDosetteMedicationData =
    useInvalidateDosetteMedicationData(patientId);

  return useMutation({
    mutationFn: (id: number) => discontinuePatientMedication(patientId, id),
    onSuccess: invalidateDosetteMedicationData,
  });
}

function useInvalidateDosetteCycleData(patientId: number) {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({
      queryKey: ["dosette", "cycles", patientId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["dosette", "picking-list", patientId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["dosette", "stock-preview", patientId],
    });
  };
}

export function useCreateDosetteCycle(patientId: number) {
  const invalidateDosetteCycleData = useInvalidateDosetteCycleData(patientId);

  return useMutation({
    mutationFn: (body: DosetteCycleWriteBody) =>
      createDosetteCycle(patientId, body),
    onSuccess: invalidateDosetteCycleData,
  });
}

export function useUpdateDosetteCycle(patientId: number) {
  const invalidateDosetteCycleData = useInvalidateDosetteCycleData(patientId);

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: DosetteCycleWriteBody;
    }) => updateDosetteCycle(patientId, id, body),
    onSuccess: invalidateDosetteCycleData,
  });
}

export function usePrepareDosetteCycle(patientId: number) {
  const invalidateDosetteCycleData = useInvalidateDosetteCycleData(patientId);

  return useMutation({
    mutationFn: (id: number) => prepareDosetteCycle(patientId, id),
    onSuccess: invalidateDosetteCycleData,
  });
}

export function useCancelDosetteCycle(patientId: number) {
  const invalidateDosetteCycleData = useInvalidateDosetteCycleData(patientId);

  return useMutation({
    mutationFn: (id: number) => cancelDosetteCycle(patientId, id),
    onSuccess: invalidateDosetteCycleData,
  });
}
