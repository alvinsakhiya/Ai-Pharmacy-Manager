import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createGroup,
  listGroups,
  updateGroup,
  type GroupWriteBody,
} from "./tenancyApi";

const GROUPS_QUERY_KEY = ["groups", "list"] as const;

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
