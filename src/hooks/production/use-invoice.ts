import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceService } from '@/api-client/invoice';
import { nfseService } from '@/api-client/nfse';
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
  nfseHistory: (taskId: string) => [...invoiceKeys.all, 'nfseHistory', taskId] as const,
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

// Get full NFS-e history for a task (cancelled/rejected/orphan notes included).
// Supports polling while a cancellation request is awaiting fiscal.
export function useTaskNfseHistory(taskId: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: invoiceKeys.nfseHistory(taskId),
    queryFn: () => invoiceService.taskNfseHistory(taskId),
    enabled: !!taskId,
    refetchInterval: options?.refetchInterval,
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

// Cancel NFS-e — registers an async cancellation request at the prefeitura.
// `substituteNfseNumber` is forwarded through (required when reasonCode=4 / Duplicidade).
// Returns the CancelNfseResult so callers can surface result.message and the pending/rejected flags.
export function useCancelNfse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, nfseDocumentId, data }: { invoiceId: string; nfseDocumentId: string; data: any }) =>
      invoiceService
        .cancelNfse(invoiceId, { ...data, nfseDocumentId })
        .then((r) => r.data),
    onSuccess: () => {
      invalidateAllBillingCaches(queryClient);
      // Refresh NFS-e list/detail/cancellation views as well
      queryClient.invalidateQueries({ queryKey: ['nfse'] });
    },
  });
}

// Cancel NFS-e by its local document id — works for ANY note (incl. invoice-less orphans).
// Uses the document-scoped endpoint PUT /nfse/document/:id/cancel. Returns the CancelNfseResult.
export function useCancelNfseByDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ nfseDocumentId, data }: { nfseDocumentId: string; data: any }) =>
      nfseService.cancelByDocument(nfseDocumentId, data).then((r) => r.data),
    onSuccess: () => {
      invalidateAllBillingCaches(queryClient);
      // Refresh NFS-e list/detail/cancellation/history views as well
      queryClient.invalidateQueries({ queryKey: ['nfse'] });
    },
  });
}

// Mark boleto as paid via PIX/cash (multiple receipts + observations)
export function useMarkBoletoPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      installmentId,
      paymentMethod,
      receiptFileIds,
      observations,
    }: {
      installmentId: string;
      paymentMethod: string;
      receiptFileIds?: string[];
      observations?: string | null;
    }) =>
      invoiceService.markBoletoPaid(installmentId, {
        paymentMethod,
        receiptFileIds,
        observations,
      }),
    onSuccess: () => {
      invalidateAllBillingCaches(queryClient);
    },
  });
}

// Replace the installment's receipt files and/or update observations
export function useUpdateInstallmentReceipts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      installmentId,
      receiptFileIds,
      observations,
    }: {
      installmentId: string;
      receiptFileIds?: string[];
      observations?: string | null;
    }) =>
      invoiceService.updateInstallmentReceipts(installmentId, {
        receiptFileIds,
        observations,
      }),
    onSuccess: () => {
      invalidateAllBillingCaches(queryClient);
    },
  });
}

// Manually trigger boleto reconciliation for a date range (defaults to last 14 days).
// Returns { reconciled, total, datesChecked } from the API.
export function useReconcileBoletos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params?: { fromDate?: string; toDate?: string }) =>
      invoiceService.reconcileBoletos(params).then(r => r.data),
    onSuccess: () => {
      invalidateAllBillingCaches(queryClient);
    },
  });
}
