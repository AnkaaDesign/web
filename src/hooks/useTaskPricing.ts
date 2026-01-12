import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskPricingService } from '@/api-client/task-pricing';
import { toast } from 'sonner';

export const taskPricingKeys = {
  all: ['task-pricings'] as const,
  lists: () => [...taskPricingKeys.all, 'list'] as const,
  list: (filters?: any) => [...taskPricingKeys.lists(), filters] as const,
  details: () => [...taskPricingKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskPricingKeys.details(), id] as const,
  byTask: (taskId: string) => [...taskPricingKeys.all, 'byTask', taskId] as const,
};

// Get all pricings
export function useTaskPricings(params?: any) {
  return useQuery({
    queryKey: taskPricingKeys.list(params),
    queryFn: () => taskPricingService.getAll(params),
  });
}

// Get pricing by ID
export function useTaskPricing(id: string) {
  return useQuery({
    queryKey: taskPricingKeys.detail(id),
    queryFn: () => taskPricingService.getById(id),
    enabled: !!id,
  });
}

// Get pricing by task ID
export function useTaskPricingByTask(taskId: string) {
  return useQuery({
    queryKey: taskPricingKeys.byTask(taskId),
    queryFn: () => taskPricingService.getByTaskId(taskId),
    enabled: !!taskId,
  });
}

// Create pricing
export function useCreateTaskPricing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: taskPricingService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskPricingKeys.all });
      toast.success('Orçamento criado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao criar orçamento');
    },
  });
}

// Update pricing
export function useUpdateTaskPricing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      taskPricingService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskPricingKeys.all });
      toast.success('Orçamento atualizado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao atualizar orçamento');
    },
  });
}

// Approve pricing
export function useApprovePricing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => taskPricingService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskPricingKeys.all });
      toast.success('Orçamento aprovado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao aprovar orçamento');
    },
  });
}

// Reject pricing
export function useRejectPricing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      taskPricingService.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskPricingKeys.all });
      toast.success('Orçamento rejeitado');
    },
    onError: () => {
      toast.error('Erro ao rejeitar orçamento');
    },
  });
}
