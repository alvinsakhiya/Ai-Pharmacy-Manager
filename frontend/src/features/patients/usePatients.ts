import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createPatient,
  createPatientNote,
  deactivatePatient,
  getPatient,
  getPatientGp,
  listPatientNotes,
  listPatients,
  updatePatient,
  updatePatientGp,
  type PatientGpWriteBody,
  type PatientListParams,
  type PatientNoteWriteBody,
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

export function useUpdatePatientGp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      patientId,
      body,
    }: {
      patientId: number;
      body: PatientGpWriteBody;
    }) => updatePatientGp(patientId, body),
    onSuccess: (_gp, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["patients", "detail", variables.patientId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["patients", "gp", variables.patientId],
      });
    },
  });
}

export function usePatientGpQuery(patientId: number, enabled = true) {
  return useQuery({
    queryKey: ["patients", "gp", patientId],
    queryFn: () => getPatientGp(patientId),
    enabled: enabled && Number.isFinite(patientId),
  });
}

export function usePatientNotesQuery(patientId: number) {
  return useQuery({
    queryKey: ["patients", "notes", patientId],
    queryFn: () => listPatientNotes(patientId),
    enabled: Number.isFinite(patientId),
  });
}

export function useCreatePatientNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      patientId,
      body,
    }: {
      patientId: number;
      body: PatientNoteWriteBody;
    }) => createPatientNote(patientId, body),
    onSuccess: (_note, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["patients", "notes", variables.patientId],
      });
    },
  });
}
