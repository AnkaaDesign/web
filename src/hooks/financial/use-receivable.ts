import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { receivableService } from "@/api-client/receivable";
import { receivableKeys, reconciliationKeys } from "@/hooks/common/query-keys";
import type {
  ReceivableAllocatePayload,
  ReceivableMatchPayload,
  ReceivableUnmatchPayload,
} from "@/types/receivable";

/**
 * Unified receivables list (task-quotes + external operations + invoices) with
 * the 4-state summary — the ENTRADA analog of the payables query. Cached briefly
 * since receipts trickle in via boleto/conciliation.
 */
export function useReceivables() {
  return useQuery({
    queryKey: receivableKeys.list(),
    queryFn: () => receivableService.getReceivables().then((r) => r.data.data),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

/**
 * Open installments a bank CREDIT can be conciliated against. Lazily enabled
 * (the credit match section drives `enabled`) so it only fires when shown.
 */
export function useReceivableCandidates(
  transactionId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: transactionId
      ? receivableKeys.candidates(transactionId)
      : receivableKeys.all,
    queryFn: () =>
      transactionId
        ? receivableService
            .getReceivableCandidates(transactionId)
            .then((r) => r.data.data)
        : Promise.reject(),
    enabled: !!transactionId && enabled,
    staleTime: 30_000,
  });
}

/**
 * Conciliate / unconciliate a bank credit against a single receivable
 * installment. Both invalidate the receivables list (a matched installment
 * flips to Recebido/Conciliado) and the reconciliation namespace (the bank
 * transaction's match state changes), so both pages refetch in place.
 */
export function useReceivableMutations() {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: receivableKeys.all });
    qc.invalidateQueries({ queryKey: reconciliationKeys.all });
  };

  const matchMutation = useMutation({
    mutationFn: (payload: ReceivableMatchPayload) =>
      receivableService.matchReceivable(payload).then((r) => r.data),
    onSuccess: () => invalidate(),
  });

  const unmatchMutation = useMutation({
    mutationFn: (payload: ReceivableUnmatchPayload) =>
      receivableService.unmatchReceivable(payload).then((r) => r.data),
    onSuccess: () => invalidate(),
  });

  const allocateMutation = useMutation({
    mutationFn: (payload: ReceivableAllocatePayload) =>
      receivableService.allocateReceivable(payload).then((r) => r.data),
    onSuccess: () => invalidate(),
  });

  return {
    matchMutation,
    unmatchMutation,
    allocateMutation,
    matchAsync: matchMutation.mutateAsync,
    unmatchAsync: unmatchMutation.mutateAsync,
    allocateAsync: allocateMutation.mutateAsync,
  };
}
