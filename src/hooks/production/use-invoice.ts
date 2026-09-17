import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceService } from '@/api-client/invoice';
import { nfseService } from '@/api-client/nfse';
import { taskQuoteKeys } from '@/hooks/production/use-task-quote';
import { dashboardQueryKeys } from '@/hooks/common/use-dashboard';
import { taskKeys } from '@/hooks';
import { billingKeys } from '@/hooks/financial/use-billing';

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters?: any) => [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
  byTask: (taskId: string) => [...invoiceKeys.all, 'byTask', taskId] as const,
  byQuote: (quoteId: string) => [...invoiceKeys.all, 'byQuote', quoteId] as const,
  byCustomer: (customerId: string) => [...invoiceKeys.all, 'byCustomer', customerId] as const,
  nfseHistory: (taskId: string) => [...invoiceKeys.all, 'nfseHistory', taskId] as const,
};

/**
 * Invalidate all billing-related caches (invoices, quotes, tasks, dashboard).
 *
 * 🔴 `billingKeys.all` É OBRIGATÓRIA AQUI, e faltava.
 *
 * A lista de Faturamento passou a ser uma lista de COBRANÇAS: ela lê
 * `["billings","list",params]`, e `billingKeys.all = ["billings"]` é o prefixo
 * que a alcança. Enquanto a lista era de tarefas, `taskKeys.all` a cobria por
 * acidente — as treze chamadas desta função (conciliar boleto, marcar parcela
 * paga, cancelar NFS-e, e o botão "Conciliar Boletos" DA PRÓPRIA tela) pareciam
 * atualizar a tela. Sem esta linha, o boleto concilia, o servidor grava, e a
 * lista continua mostrando o estado anterior até alguém recarregar a página.
 */
function invalidateAllBillingCaches(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
  queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
  queryClient.invalidateQueries({ queryKey: taskKeys.all });
  queryClient.invalidateQueries({ queryKey: billingKeys.all });
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

/**
 * AS FATURAS DE UM ORÇAMENTO — a rota que enxerga a fatura conjunta.
 *
 * `useInvoicesByTask` pergunta por `Invoice.taskId`, que é NULO quando a fatura
 * cobre mais de um veículo: num orçamento faturado junto ela devolve vazio. Esta
 * pergunta vai pelo FATURAMENTO, que sempre existe.
 *
 * Continua havendo a por tarefa: numa cobrança veículo a veículo ela é mais
 * específica e é o que a tela de um caminhão quer.
 */
export function useInvoicesByQuote(
  quoteId: string | undefined,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: invoiceKeys.byQuote(quoteId ?? ''),
    queryFn: () => invoiceService.getByQuoteId(quoteId!),
    enabled: !!quoteId && options?.enabled !== false,
    refetchInterval: options?.refetchInterval,
  });
}

/**
 * AS FATURAS QUE COBRAM ESTE VEÍCULO.
 *
 * É a pergunta que toda tela de tarefa faz, e a resposta mudou de rota:
 *
 *   · `Invoice.taskId` só existe quando a fatura é de UM veículo. Numa fatura
 *     conjunta ele é NULO, então `/invoices/task/:id` devolvia VAZIO — o
 *     orçamento de sessenta caminhões faturado junto mostrava "nenhuma fatura"
 *     sobre uma cobrança de R$ 730.224,00 já emitida, em três telas.
 *   · A rota por ORÇAMENTO enxerga todas, e a COBERTURA diz quais cobram este
 *     caminhão. É a única leitura que acerta nos três modos.
 *
 * Sem `quoteId` (tarefa sem orçamento) cai na rota por tarefa, que é o que
 * existia e continua certo ali.
 */
export function useTaskBillingInvoices(
  taskId: string | undefined,
  quoteId: string | undefined,
  options?: { refetchInterval?: number | false },
) {
  const byQuote = useInvoicesByQuote(quoteId, { refetchInterval: options?.refetchInterval });
  const byTask = useInvoicesByTask(quoteId ? '' : (taskId ?? ''), {
    refetchInterval: options?.refetchInterval,
  });

  const source = quoteId ? byQuote : byTask;
  const data = useMemo(() => {
    const all = ((source.data as any)?.data ?? []) as any[];
    if (!quoteId || !taskId) return source.data;
    const covering = all.filter((inv) => {
      const covered = (inv?.customerConfig?.billing?.tasks ?? []) as Array<{ taskId: string }>;
      // Sem cobertura declarada a fatura é do orçamento inteiro — a leitura que
      // a ausência sempre teve, e a que mantém as faturas antigas visíveis.
      if (covered.length === 0) return inv?.taskId == null || inv?.taskId === taskId;
      return covered.some((row) => row.taskId === taskId);
    });
    return { ...(source.data as any), data: covering };
  }, [source.data, quoteId, taskId]);

  return { ...source, data } as typeof source;
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

// Reconcile an NFS-e stuck in PROCESSING/ERROR against the prefeitura's live state.
// Emission is a non-transactional POST, so a crash mid-flight can leave a live note with
// no local link. This asks the prefeitura what actually exists and resolves accordingly —
// it never emits, so it cannot mint a duplicate note.
export function useReconcileNfse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invoiceId: string) => invoiceService.reconcileNfse(invoiceId),
    onSuccess: () => {
      invalidateAllBillingCaches(queryClient);
    },
  });
}

// Register the invoice's still-unregistered bank slips at Sicredi now, instead of waiting
// for the sweep that only runs within 5 days of the due date.
export function useRegisterInvoiceBoletos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invoiceId: string) => invoiceService.registerInvoiceBoletos(invoiceId),
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

// Reenvia a NFS-e ao ADN. Devolve o estado depois do reenvio — `hasError` continua true
// quando o ambiente nacional segue fora, então quem chama precisa olhar o resultado, e não
// só o sucesso da mutation, antes de dizer ao usuário que resolveu.
export function useResendNfseToAdn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (nfseDocumentId: string) =>
      nfseService.resendToAdn(nfseDocumentId).then((r) => r.data),
    onSuccess: () => {
      invalidateAllBillingCaches(queryClient);
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
      paidAt,
      receiptFileIds,
      observations,
    }: {
      installmentId: string;
      paymentMethod: string;
      /** ISO instant of the actual payment date. Omit to let the server stamp now. */
      paidAt?: string;
      receiptFileIds?: string[];
      observations?: string | null;
    }) =>
      invoiceService.markBoletoPaid(installmentId, {
        paymentMethod,
        paidAt,
        receiptFileIds,
        observations,
      }),
    onSuccess: () => {
      invalidateAllBillingCaches(queryClient);
    },
  });
}

// Edit a paid installment's settlement record: receipt files, observations, and the
// payment info (forma de pagamento / data do pagamento).
export function useUpdateInstallmentReceipts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      installmentId,
      receiptFileIds,
      observations,
      paymentMethod,
      paidAt,
    }: {
      installmentId: string;
      receiptFileIds?: string[];
      observations?: string | null;
      paymentMethod?: string;
      /** ISO instant. See invoiceService.markBoletoPaid for the date-only pitfall. */
      paidAt?: string;
    }) =>
      invoiceService.updateInstallmentReceipts(installmentId, {
        receiptFileIds,
        observations,
        paymentMethod,
        paidAt,
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
