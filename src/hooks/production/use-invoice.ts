import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceService } from '@/api-client/invoice';
import { taskQuoteKeys } from '@/hooks/production/use-task-quote';
import { dashboardQueryKeys } from '@/hooks/common/use-dashboard';
import { taskKeys } from '@/hooks';

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters?: any) => [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
  byTask: (taskId: string) => [...invoiceKeys.all, 'byTask', taskId] as const,
  byCustomer: (customerId: string) => [...invoiceKeys.all, 'byCustomer', customerId] as const,
};

/**
 * Invalidate all billing-related caches (invoices, quotes, tasks, dashboard)
 */
function invalidateAllBillingCaches(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
  queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
  queryClient.invalidateQueries({ queryKey: taskKeys.all });
  queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all });
}

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

// Get invoices by task ID — supports refetchInterval for polling after billing approval
export function useInvoicesByTask(taskId: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: invoiceKeys.byTask(taskId),
    queryFn: () => invoiceService.getByTaskId(taskId),
    enabled: !!taskId,
    refetchInterval: options?.refetchInterval,
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
      invalidateAllBillingCaches(queryClient);
    },
  });
}

// Regenerate boleto (optionally with a new due date)
export function useRegenerateBoleto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ installmentId, newDueDate }: { installmentId: string; newDueDate?: string }) =>
      invoiceService.regenerateBoleto(installmentId, newDueDate),
    onSuccess: () => {
      invalidateAllBillingCaches(queryClient);
    },
  });
}

// Change bank slip due date
export function useChangeBankSlipDueDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ installmentId, newDueDate }: { installmentId: string; newDueDate: string }) =>
      invoiceService.changeBankSlipDueDate(installmentId, newDueDate),
    onSuccess: () => {
      invalidateAllBillingCaches(queryClient);
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
      invalidateAllBillingCaches(queryClient);
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
      invalidateAllBillingCaches(queryClient);
    },
  });
}

// Cancel NFS-e
export function useCancelNfse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, nfseDocumentId, data }: { invoiceId: string; nfseDocumentId: string; data: any }) =>
      invoiceService.cancelNfse(invoiceId, { ...data, nfseDocumentId }),
    onSuccess: () => {
      invalidateAllBillingCaches(queryClient);
    },
  });
}

// Mark boleto as paid via PIX/cash
export function useMarkBoletoPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ installmentId, paymentMethod, receiptFileId }: {
      installmentId: string;
      paymentMethod: string;
      receiptFileId?: string;
    }) => invoiceService.markBoletoPaid(installmentId, { paymentMethod, receiptFileId }),
    onSuccess: () => {
      invalidateAllBillingCaches(queryClient);
    },
  });
}

// Update installment receipt
export function useUpdateInstallmentReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ installmentId, receiptFileId }: {
      installmentId: string;
      receiptFileId: string;
    }) => invoiceService.updateInstallmentReceipt(installmentId, receiptFileId),
    onSuccess: () => {
      invalidateAllBillingCaches(queryClient);
    },
  });
}
