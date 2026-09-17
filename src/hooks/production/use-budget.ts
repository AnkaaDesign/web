import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBudgets, budgetService } from '@/api-client/budget';
import { taskKeys } from '../common/query-keys';

export const budgetKeys = {
  all: ['task-quotes'] as const,
  lists: () => [...budgetKeys.all, 'list'] as const,
  list: (filters?: any) => [...budgetKeys.lists(), filters] as const,
  details: () => [...budgetKeys.all, 'detail'] as const,
  detail: (id: string) => [...budgetKeys.details(), id] as const,
  byTask: (taskId: string) => [...budgetKeys.all, 'byTask', taskId] as const,
  suggestion: (params: { name: string; customerId: string; category: string; implementType: string }) =>
    [...budgetKeys.all, 'suggestion', params] as const,
};

export interface UseBudgetsParams extends Record<string, unknown> {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean | 'always';
  /**
   * Quanto tempo a lista é considerada fresca. Padrão 0 (sempre obsoleta), que
   * é o comportamento histórico de `useTasks`; telas pesadas (o pager, que pede
   * 1000 linhas) devem passar um valor de verdade.
   */
  staleTime?: number;
}

/**
 * A LISTA DE ORÇAMENTOS, paginada no servidor.
 *
 * ⚠️ `enabled`, `staleTime` e `refetchOnWindowFocus` são EXTRAÍDOS antes de os
 * params irem para a requisição — molde de `useTasks`. A versão anterior
 * repassava `params` inteiro para `queryFn` e para a chave, o mesmo defeito
 * documentado em `useSelectedCustomers`: as três chaves viravam query string
 * (`?enabled=false` não desabilita nada no servidor), toda montagem disparava um
 * GET e o `staleTime` era ignorado. A paginação, ao contrário, ENTRA na chave —
 * cada página é uma entrada de cache própria.
 */
export function useBudgets(params?: UseBudgetsParams) {
  const queryClient = useQueryClient();
  const { enabled = true, refetchOnWindowFocus, staleTime, ...restParams } = params ?? {};

  const queryKey = useMemo(
    () => budgetKeys.list(restParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(restParams)],
  );

  const query = useQuery({
    queryKey,
    queryFn: () => getBudgets(restParams),
    enabled,
    staleTime: staleTime ?? 0,
    retry: 2,
    refetchOnWindowFocus,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: budgetKeys.all });
  };

  return { ...query, refresh };
}

// Get quote by ID
export function useBudget(id: string) {
  return useQuery({
    queryKey: budgetKeys.detail(id),
    queryFn: () => budgetService.getById(id),
    enabled: !!id,
  });
}

// Get quote by task ID
export function useBudgetByTask(taskId: string) {
  return useQuery({
    queryKey: budgetKeys.byTask(taskId),
    queryFn: () => budgetService.getByTaskId(taskId),
    enabled: !!taskId,
  });
}

// Get suggestion based on matching task fields
export function useBudgetSuggestion(params: {
  name: string;
  customerId: string;
  category: string;
  implementType: string;
}) {
  const enabled = !!(params.name && params.customerId && params.category && params.implementType);
  return useQuery({
    queryKey: budgetKeys.suggestion(params),
    queryFn: () => budgetService.getSuggestion(params).then((res) => res.data),
    enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false,
  });
}

// Create quote
export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: budgetService.create,
    onSuccess: () => {
      // Success/error toasts are emitted by the axios interceptor (POST /budgets).
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
      // Tasks embed quote data (budget, status) — refresh task lists + details too.
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

// Update quote
export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      budgetService.update(id, data),
    onSuccess: () => {
      // Success/error toasts are emitted by the axios interceptor (PUT /budgets/:id).
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
      // Tasks embed quote data (budget, status) — refresh task lists + details too.
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

// Approve quote
export function useApproveQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => budgetService.approve(id),
    onSuccess: () => {
      // Success/error toasts are emitted by the axios interceptor (PUT /budgets/:id/budget-approve).
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
      // Approving a quote flips task budget status — refresh task lists + details too.
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

// Reject quote
export function useRejectQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      budgetService.reject(id, reason),
    onSuccess: () => {
      // Success/error toasts are emitted by the axios interceptor (PUT /budgets/:id/status).
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
      // Rejecting a quote flips task budget status — refresh task lists + details too.
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
