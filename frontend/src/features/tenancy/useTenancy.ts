import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createGroup,
  createPharmacy,
  listGroups,
  listPharmacies,
  updateGroup,
  updatePharmacy,
  type GroupWriteBody,
  type PharmacyWriteBody,
} from "./tenancyApi";

const GROUPS_QUERY_KEY = ["groups", "list"] as const;
const PHARMACIES_QUERY_KEY = ["pharmacies", "list"] as const;

export function useGroupsQuery() {
  return useQuery({
    queryKey: GROUPS_QUERY_KEY,
    queryFn: listGroups,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: GroupWriteBody) => createGroup(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: GroupWriteBody }) =>
      updateGroup(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function usePharmaciesQuery() {
  return useQuery({
    queryKey: PHARMACIES_QUERY_KEY,
    queryFn: listPharmacies,
  });
}

export function useCreatePharmacy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: PharmacyWriteBody) => createPharmacy(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacies"] });
    },
  });
}

export function useUpdatePharmacy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: PharmacyWriteBody }) =>
      updatePharmacy(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacies"] });
    },
  });
}
