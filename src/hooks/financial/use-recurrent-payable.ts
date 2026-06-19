import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recurrentPayableService } from "@/api-client/recurrent-payable";
import { orderKeys, recurrentPayableKeys } from "@/hooks/common/query-keys";
import type {
  CreateRecurrentPayablePayload,
  PayRecurrentOccurrencePayload,
  RecurrentPayableListParams,
  UpdateRecurrentPayablePayload,
} from "@/types/recurrent-payable";

/**
 * List of recurrent payables (rent/internet/energy/water). Cached briefly — the
 * set changes only when a user creates/edits/archives one. `isActive` scopes the
 * list server-side; omit it to fetch the full set.
 */
export function useRecurrentPayables(params?: RecurrentPayableListParams) {
  return useQuery({
    queryKey: recurrentPayableKeys.list(
      params as Record<string, unknown> | undefined,
    ),
    queryFn: () =>
      recurrentPayableService
        .getRecurrentPayables(params)
        .then((r) => r.data.data),
    staleTime: 60_000,
  });
}

/** Single recurrent payable with its last 12 occurrences. */
export function useRecurrentPayable(id: string | undefined) {
  return useQuery({
    queryKey: id ? recurrentPayableKeys.detail(id) : recurrentPayableKeys.all,
    queryFn: () =>
      id
        ? recurrentPayableService
            .getRecurrentPayable(id)
            .then((r) => r.data.data)
        : Promise.reject(),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/**
 * Create/update/delete a recurrent payable + pay one materialized occurrence.
 * CRUD mutations invalidate the recurrent-payable namespace; the pay action also
 * invalidates the unified payables query (keyed under orderKeys.all) so the
 * Contas a Pagar row flips to Pago in place.
 */
export function useRecurrentPayableMutations() {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: recurrentPayableKeys.all });
  };

  const createMutation = useMutation({
    mutationFn: (body: CreateRecurrentPayablePayload) =>
      recurrentPayableService.createRecurrentPayable(body).then((r) => r.data),
    onSuccess: () => invalidate(),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateRecurrentPayablePayload;
    }) =>
      recurrentPayableService.updateRecurrentPayable(id, body).then((r) => r.data),
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      recurrentPayableService.deleteRecurrentPayable(id).then((r) => r.data),
    onSuccess: () => invalidate(),
  });

  const payMutation = useMutation({
    mutationFn: ({
      occurrenceId,
      body,
    }: {
      occurrenceId: string;
      body: PayRecurrentOccurrencePayload;
    }) =>
      recurrentPayableService
        .payRecurrentOccurrence(occurrenceId, body)
        .then((r) => r.data),
    onSuccess: () => {
      invalidate();
      // Flip the Contas a Pagar row to Pago (payables live under orderKeys.all).
      qc.invalidateQueries({ queryKey: orderKeys.all });
    },
  });

  return {
    create: createMutation.mutate,
    createAsync: createMutation.mutateAsync,
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    delete: deleteMutation.mutate,
    deleteAsync: deleteMutation.mutateAsync,
    pay: payMutation.mutate,
    payAsync: payMutation.mutateAsync,
    isLoading:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      payMutation.isPending,
    error:
      createMutation.error ||
      updateMutation.error ||
      deleteMutation.error ||
      payMutation.error,
    // Individual mutation states
    createMutation,
    updateMutation,
    deleteMutation,
    payMutation,
  };
}
