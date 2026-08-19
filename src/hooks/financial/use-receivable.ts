import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { receivableService } from "@/api-client/receivable";
import { receivableKeys, reconciliationKeys, taskKeys } from "@/hooks/common/query-keys";
// taskQuoteKeys lives with its hooks, not in the shared factory file.
import { taskQuoteKeys } from "@/hooks/production/use-task-quote";
import type {
  ReceivableAllocatePayload,
  ReceivableMatchPayload,
  ReceivableUnmatchPayload,
  TaskMatchPayload,
} from "@/types/receivable";

/**
 * Unified receivables list (task-quotes + external operations + invoices) with
 * the 4-state summary — the ENTRADA analog of the payables query. Cached briefly
 * since receipts trickle in via boleto/conciliation.
 */
export function useReceivables(period?: { year: number; months: string[] } | null) {
  // The period is part of the key: receipts are fetched for the months on screen,
  // so changing the selector must refetch instead of re-filtering a payload that
  // only ever held the last 60 days.
  const scope = period?.months?.length
    ? { year: period.year, months: [...period.months].sort().join(",") }
    : null;
  return useQuery({
    queryKey: [...receivableKeys.list(), scope],
    queryFn: () =>
      receivableService.getReceivables(period ?? null).then((r) => r.data.data),
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
 * The server's identity-resolved allocation plan for a credit. Separate from the
 * candidate list because it answers a different question: the candidate list asks
 * "which parcelas look like this value?", the suggestion asks "who paid, and what
 * does this value settle for them?" — which is what resolves a lump payment
 * covering many parcelas, or one landing on parcelas already marked paid.
 */
export function useReceivableSuggestion(
  transactionId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: transactionId
      ? [...receivableKeys.candidates(transactionId), "suggestion"]
      : receivableKeys.all,
    queryFn: () =>
      transactionId
        ? receivableService
            .getReceivableSuggestion(transactionId)
            .then((r) => r.data.data.suggestion)
        : Promise.reject(),
    enabled: !!transactionId && enabled,
    staleTime: 30_000,
  });
}

/**
 * Tarefas a bank CREDIT can be conciliated against, including tasks with no
 * orçamento at all.
 *
 * `staleTime: 0` for the same reason the NF candidate list uses it — another
 * transaction may have consumed a task's open parcela since this list was
 * cached, and here the list also drives what gets CREATED, so a stale read
 * would propose minting a quote that already exists.
 */
export function useTaskMatchCandidates(
  transactionId: string | undefined,
  search: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: transactionId
      ? receivableKeys.taskCandidates(transactionId, search)
      : receivableKeys.all,
    queryFn: () =>
      transactionId
        ? receivableService
            .getTaskCandidates(transactionId, search)
            .then((r) => r.data.data)
        : Promise.reject(),
    enabled: !!transactionId && enabled,
    staleTime: 0,
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
    // A task match can mint an orçamento and a fatura, so the task and
    // task-quote namespaces are no longer accurate either.
    qc.invalidateQueries({ queryKey: taskKeys.all });
    qc.invalidateQueries({ queryKey: taskQuoteKeys.all });
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

  // One-click apply of the identity-resolved plan. Routed through the server's
  // own confirm path (not allocate) because that is the only one that accepts a
  // multi-parcela batch containing already-PAID link-only clearance.
  const confirmSuggestionMutation = useMutation({
    mutationFn: (transactionId: string) =>
      receivableService.confirmReceivableSuggestion(transactionId).then((r) => r.data),
    onSuccess: () => invalidate(),
  });

  // Declare / undo a conciliação sem extrato.
  const externalClearanceMutation = useMutation({
    mutationFn: (payload: { installmentId: string; cleared: boolean; note?: string | null }) =>
      receivableService.setExternalClearance(payload).then((r) => r.data),
    onSuccess: () => invalidate(),
  });

  // Conciliate against tarefas, minting the missing orçamento/fatura/parcela.
  const matchTasksMutation = useMutation({
    mutationFn: (payload: TaskMatchPayload) =>
      receivableService.matchTasks(payload).then((r) => r.data),
    onSuccess: () => invalidate(),
  });

  return {
    matchMutation,
    unmatchMutation,
    allocateMutation,
    confirmSuggestionMutation,
    externalClearanceMutation,
    matchTasksMutation,
    matchAsync: matchMutation.mutateAsync,
    unmatchAsync: unmatchMutation.mutateAsync,
    allocateAsync: allocateMutation.mutateAsync,
    matchTasksAsync: matchTasksMutation.mutateAsync,
    confirmSuggestionAsync: confirmSuggestionMutation.mutateAsync,
    externalClearanceAsync: externalClearanceMutation.mutateAsync,
  };
}
