import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskQuoteService } from '@/api-client/task-quote';
import { toast } from '@/components/ui/sonner';

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

// Get all quotes
export function useTaskQuotes(params?: any) {
  return useQuery({
    queryKey: taskQuoteKeys.list(params),
    queryFn: () => taskQuoteService.getAll(params),
  });
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
      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      toast.success('Orçamento criado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao criar orçamento');
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
      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      toast.success('Orçamento atualizado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao atualizar orçamento');
    },
  });
}

// Approve quote
export function useApproveQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => taskQuoteService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      toast.success('Orçamento aprovado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao aprovar orçamento');
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
      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      toast.success('Orçamento rejeitado');
    },
    onError: () => {
      toast.error('Erro ao rejeitar orçamento');
    },
  });
}
