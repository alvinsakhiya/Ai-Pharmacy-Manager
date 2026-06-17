import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignMembership,
  createUser,
  deactivateUser,
  listUsers,
  resetPassword,
  type AssignMembershipBody,
  type CreateUserBody,
} from "./usersApi";

const USERS_QUERY_KEY = ["users"] as const;

export function useUsersQuery() {
  return useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: listUsers,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateUserBody) => createUser(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deactivateUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useResetPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      newPassword,
    }: {
      id: number;
      newPassword: string;
    }) => resetPassword(id, newPassword),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useAssignMembership() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: AssignMembershipBody;
    }) => assignMembership(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}
