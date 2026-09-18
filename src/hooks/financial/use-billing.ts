import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingService, type BillingListParams, type BillingListResponse } from "@/api-client/billing";
import { receivableKeys, reconciliationKeys } from "@/hooks/common/query-keys";

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
 *
 * ⚠️ AS OPÇÕES DE REACT-QUERY VÃO NO SEGUNDO ARGUMENTO, e é uma separação que
 * este hook precisa ter. `useTasks` aceita `staleTime`/`refetchOnWindowFocus`
 * misturados aos params porque sabe peneirá-los antes de montar a query string;
 * aqui `params` vai INTEIRO para o axios, então um `refetchOnWindowFocus:
 * "always"` deixado ali viraria `?refetchOnWindowFocus=always` na URL da API —
 * parâmetro que o servidor ignora, e que muda a `queryKey` a cada render sem
 * mudar a resposta.
 */
export function useBillings(
  params?: BillingListParams,
  options?: { enabled?: boolean; staleTime?: number; refetchOnWindowFocus?: boolean | "always" },
) {
  return useQuery<BillingListResponse>({
    queryKey: billingKeys.list(params ?? {}),
    queryFn: () => billingService.list(params),
    enabled: options?.enabled !== false,
    // ⚠️ A PÁGINA ANTERIOR FICA NA TELA ENQUANTO A SEGUINTE VIAJA.
    //
    // Paginar troca a `queryKey`, e sem isto o React Query devolve `undefined`
    // até a resposta chegar: a lista pisca vazia e `meta.totalRecords` vira 0 —
    // que a tabela lê como "existe 1 página", colapsando o rodapé e
    // DESABILITANDO o próprio botão de avançar que o usuário acabou de clicar.
    // Era o "clico e às vezes não vai" desta tela.
    //
    // `keepPreviousData` é a resposta idiomática: os dados velhos seguem
    // visíveis, `isPlaceholderData` marca que são velhos, e a contagem nunca
    // passa por zero. Ver também o `effectiveRowCount` do DataTable, que é o
    // cinto de segurança para as listas que ainda não fazem isto.
    placeholderData: keepPreviousData,
    ...(options?.staleTime !== undefined ? { staleTime: options.staleTime } : {}),
    ...(options?.refetchOnWindowFocus !== undefined
      ? { refetchOnWindowFocus: options.refetchOnWindowFocus }
      : {}),
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
 * orçamento, e a aprovação também grava `Budget.billingApprovedAt` quando a
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
      // ⚠️ E O DINHEIRO A RECEBER. Aprovar ou liquidar uma cobrança CRIA ou QUITA
      // fatura, parcelas e boletos — que é exatamente o acervo de onde a
      // Conciliação tira os candidatos a casamento. Sem isto o extrato continuava
      // oferecendo parcelas que já não existem (e escondendo as que acabaram de
      // nascer) até alguém dar F5.
      queryClient.invalidateQueries({ queryKey: receivableKeys.all });
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
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
      // ⚠️ E O DINHEIRO A RECEBER. Aprovar ou liquidar uma cobrança CRIA ou QUITA
      // fatura, parcelas e boletos — que é exatamente o acervo de onde a
      // Conciliação tira os candidatos a casamento. Sem isto o extrato continuava
      // oferecendo parcelas que já não existem (e escondendo as que acabaram de
      // nascer) até alguém dar F5.
      queryClient.invalidateQueries({ queryKey: receivableKeys.all });
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}
