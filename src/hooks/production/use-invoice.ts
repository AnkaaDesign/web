import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceService } from '@/api-client/invoice';
import { toast } from '@/components/ui/sonner';

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters?: any) => [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
  byTask: (taskId: string) => [...invoiceKeys.all, 'byTask', taskId] as const,
  byCustomer: (customerId: string) => [...invoiceKeys.all, 'byCustomer', customerId] as const,
};

// Get all invoices
export function useInvoices(params?: any) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: () => invoiceService.getAll(params),
  });
}

// Get invoice by ID
export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => invoiceService.getById(id),
    enabled: !!id,
  });
}

// Get invoices by task ID
export function useInvoicesByTask(taskId: string) {
  return useQuery({
    queryKey: invoiceKeys.byTask(taskId),
    queryFn: () => invoiceService.getByTaskId(taskId),
    enabled: !!taskId,
  });
}

// Get invoices by customer ID
export function useInvoicesByCustomer(customerId: string) {
  return useQuery({
    queryKey: invoiceKeys.byCustomer(customerId),
    queryFn: () => invoiceService.getByCustomerId(customerId),
    enabled: !!customerId,
  });
}

// Cancel invoice
export function useCancelInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      invoiceService.cancel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      toast.success('Fatura cancelada com sucesso');
    },
    onError: () => {
      toast.error('Erro ao cancelar fatura');
    },
  });
}

// Regenerate boleto
export function useRegenerateBoleto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (installmentId: string) =>
      invoiceService.regenerateBoleto(installmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      toast.success('Boleto regenerado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao regenerar boleto');
    },
  });
}

// Cancel boleto
export function useCancelBoleto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ installmentId, data }: { installmentId: string; data?: any }) =>
      invoiceService.cancelBoleto(installmentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      toast.success('Boleto cancelado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao cancelar boleto');
    },
  });
}

// Emit NFS-e
export function useEmitNfse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invoiceId: string) =>
      invoiceService.emitNfse(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      toast.success('NFS-e será emitida em instantes');
    },
    onError: () => {
      toast.error('Erro ao emitir NFS-e');
    },
  });
}

// Cancel NFS-e
export function useCancelNfse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: string; data: any }) =>
      invoiceService.cancelNfse(invoiceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
      toast.success('NFS-e cancelada com sucesso');
    },
    onError: () => {
      toast.error('Erro ao cancelar NFS-e');
    },
  });
}
