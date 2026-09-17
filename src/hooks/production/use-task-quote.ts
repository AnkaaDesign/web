import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTaskQuotes, taskQuoteService } from '@/api-client/task-quote';
import { taskKeys } from '../common/query-keys';

export const taskQuoteKeys = {
  all: ['task-quotes'] as const,
  lists: () => [...taskQuoteKeys.all, 'list'] as const,
  list: (filters?: any) => [...taskQuoteKeys.lists(), filters] as const,
  details: () => [...taskQuoteKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskQuoteKeys.details(), id] as const,
  byTask: (taskId: string) => [...taskQuoteKeys.all, 'byTask', taskId] as const,
  suggestion: (params: { name: string; customerId: string; category: string; implementType: string }) =>
    [...taskQuoteKeys.all, 'suggestion', params] as const,
};

export interface UseTaskQuotesParams extends Record<string, unknown> {
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
export function useTaskQuotes(params?: UseTaskQuotesParams) {
  const queryClient = useQueryClient();
  const { enabled = true, refetchOnWindowFocus, staleTime, ...restParams } = params ?? {};

  const queryKey = useMemo(
    () => taskQuoteKeys.list(restParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(restParams)],
  );

  const query = useQuery({
    queryKey,
    queryFn: () => getTaskQuotes(restParams),
    enabled,
    staleTime: staleTime ?? 0,
    retry: 2,
    refetchOnWindowFocus,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
  };

  return { ...query, refresh };
}

// Get quote by ID
export function useTaskQuote(id: string) {
  return useQuery({
    queryKey: taskQuoteKeys.detail(id),
    queryFn: () => taskQuoteService.getById(id),
    enabled: !!id,
  });
}

// Get quote by task ID
export function useTaskQuoteByTask(taskId: string) {
  return useQuery({
    queryKey: taskQuoteKeys.byTask(taskId),
    queryFn: () => taskQuoteService.getByTaskId(taskId),
    enabled: !!taskId,
  });
}

// Get suggestion based on matching task fields
export function useTaskQuoteSuggestion(params: {
  name: string;
  customerId: string;
  category: string;
  implementType: string;
}) {
  const enabled = !!(params.name && params.customerId && params.category && params.implementType);
  return useQuery({
    queryKey: taskQuoteKeys.suggestion(params),
    queryFn: () => taskQuoteService.getSuggestion(params).then((res) => res.data),
    enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false,
  });
}

// Create quote
export function useCreateTaskQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: taskQuoteService.create,
    onSuccess: () => {
      // Success/error toasts are emitted by the axios interceptor (POST /task-quotes).
      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      // Tasks embed quote data (budget, status) — refresh task lists + details too.
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

// Update quote
export function useUpdateTaskQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      taskQuoteService.update(id, data),
    onSuccess: () => {
      // Success/error toasts are emitted by the axios interceptor (PUT /task-quotes/:id).
      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      // Tasks embed quote data (budget, status) — refresh task lists + details too.
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

// Approve quote
export function useApproveQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => taskQuoteService.approve(id),
    onSuccess: () => {
      // Success/error toasts are emitted by the axios interceptor (PUT /task-quotes/:id/budget-approve).
      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
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
      taskQuoteService.reject(id, reason),
    onSuccess: () => {
      // Success/error toasts are emitted by the axios interceptor (PUT /task-quotes/:id/status).
      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      // Rejecting a quote flips task budget status — refresh task lists + details too.
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
