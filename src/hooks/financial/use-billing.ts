import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingService } from "@/api-client/billing";

export const billingKeys = {
  all: ["billings"] as const,
  detail: (id: string) => ["billings", "detail", id] as const,
  byTask: (taskId: string) => ["billings", "by-task", taskId] as const,
  byQuote: (quoteId: string) => ["billings", "by-quote", quoteId] as const,
  list: (params: unknown) => ["billings", "list", params] as const,
};

/** UMA cobrança, pelo id dela — o endereço próprio do faturamento. */
export function useBilling(billingId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: billingKeys.detail(billingId ?? ""),
    queryFn: () => billingService.getById(billingId!),
    enabled: !!billingId && options?.enabled !== false,
    retry: false,
  });
}

/**
 * O FATURAMENTO QUE COBRA ESTE VEÍCULO — a ponte para os endereços antigos.
 *
 * Todo link que existe hoje (notificação, favorito, app, e-mail, a lista) aponta
 * para `/financeiro/faturamento/detalhes/:taskId`. O servidor garante que um
 * veículo é cobrado por exatamente UM faturamento, então a tradução não tem
 * ambiguidade — e a página reescreve a URL para a canônica assim que ela chega.
 */
export function useBillingByTask(taskId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: billingKeys.byTask(taskId ?? ""),
    queryFn: () => billingService.getByTask(taskId!),
    enabled: !!taskId && options?.enabled !== false,
    retry: false,
  });
}

/** As cobranças de um orçamento — o que o compositor mostra depois de fatiar. */
export function useBillingsByQuote(quoteId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: billingKeys.byQuote(quoteId ?? ""),
    queryFn: () => billingService.getByQuote(quoteId!),
    enabled: !!quoteId && options?.enabled !== false,
  });
}

/**
 * A FILA — "o que entreguei e ainda não cobrei?".
 *
 * Uma pergunta que a lista de faturamento não sabia fazer: as linhas eram
 * TAREFAS, e um orçamento de sessenta caminhões cobrado junto aparecia sessenta
 * vezes, cada linha repetindo o mesmo contrato. Aqui cada linha é uma COBRANÇA.
 */
export function useBillings(params?: {
  page?: number;
  limit?: number;
  quoteId?: string;
  customerId?: string;
  approved?: boolean;
  deliveredOnly?: boolean;
}) {
  return useQuery({
    queryKey: billingKeys.list(params ?? {}),
    queryFn: () => billingService.list(params),
  });
}

/**
 * APROVAR ESTA COBRANÇA — a fatura, a NFS-e e os boletos DELA.
 *
 * O único caminho de "aprovar faturamento" na tela. Era uma transição de status
 * do ORÇAMENTO (`updateStatus(quoteId, "BILLING_APPROVED")`), o que num
 * orçamento cobrado veículo a veículo emitia os sessenta de uma vez — o estado
 * era um só para N cobranças. O endpoint de status hoje recusa aquele valor.
 *
 * Invalida a TAREFA e o ORÇAMENTO junto com a cobrança: a lista de Faturamento é
 * uma lista de tarefas, o estado que ela mostra vem do `billing` pendurado no
 * orçamento, e a aprovação também grava `TaskQuote.billingApprovedAt` quando a
 * última fatia fecha.
 */
export function useApproveBilling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (billingId: string) => billingService.approve(billingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-quotes"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

/**
 * LIQUIDAR ESTA COBRANÇA À MÃO — o orçamento direto, pago à vista.
 *
 * Substitui `updateStatus(quoteId, "SETTLED")`, que dava por pagas também as
 * cobranças irmãs.
 */
export function useSettleBilling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (billingId: string) => billingService.settle(billingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-quotes"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
