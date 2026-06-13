// packages/hooks/src/useUserPositionHistory.ts
// Histórico de cargos / Promoções (Departamento Pessoal)

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { getUserPositionHistories, getUserPositionHistoryById, promoteUser } from "../../api-client/user-position-history";
import type { UserPositionHistoryGetManyFormData, UserPositionHistoryPromoteFormData } from "../../schemas/user-position-history";
import type { UserPositionHistoryGetManyResponse, UserPositionHistoryGetUniqueResponse } from "../../types/user-position-history";
import { userPositionHistoryKeys, userKeys, changeLogKeys } from "../common/query-keys";

// =====================================================
// Query Hooks
// =====================================================

export function useUserPositionHistories(
  params?: Partial<UserPositionHistoryGetManyFormData>,
  options?: Omit<UseQueryOptions<UserPositionHistoryGetManyResponse>, "queryKey" | "queryFn">,
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: userPositionHistoryKeys.list(params),
    queryFn: () => getUserPositionHistories(params as UserPositionHistoryGetManyFormData),
    staleTime: 1000 * 60 * 5,
    retry: 2,
    ...options,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: userPositionHistoryKeys.list(params) });
  };

  return { ...query, refresh };
}

export function useUserPositionHistory(
  id: string,
  options?: { enabled?: boolean; include?: any } & Omit<UseQueryOptions<UserPositionHistoryGetUniqueResponse>, "queryKey" | "queryFn">,
) {
  const queryClient = useQueryClient();
  const { enabled = true, include, ...queryOptions } = options || {};

  const query = useQuery({
    queryKey: userPositionHistoryKeys.detail(id, include),
    queryFn: () => getUserPositionHistoryById(id, include ? { include } : undefined),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5,
    retry: 2,
    ...queryOptions,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: userPositionHistoryKeys.detail(id, include) });
  };

  return { ...query, refresh };
}

// =====================================================
// Mutation Hooks
// =====================================================

export function useUserPositionHistoryMutations() {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: userPositionHistoryKeys.all });
    // Promoting changes user.positionId
    queryClient.invalidateQueries({ queryKey: userKeys.all });
    queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
  };

  // PROMOTE — POST /user-position-history/promote
  const promoteMutation = useMutation({
    mutationFn: (data: UserPositionHistoryPromoteFormData) => promoteUser(data),
    onSuccess: () => {
      invalidateQueries();
    },
  });

  return {
    promote: promoteMutation.mutate,
    promoteAsync: promoteMutation.mutateAsync,
    isPromoting: promoteMutation.isPending,
    error: promoteMutation.error,
    refresh: invalidateQueries,
    // Individual mutation states
    promoteMutation,
  };
}
