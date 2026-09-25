import { apiClient } from "./axiosClient";
import type { Billing } from "@/types/budget";

/**
 * OS PARÂMETROS DA LISTA DE COBRANÇAS — todos planos, nenhum `where` de Prisma.
 *
 * ⚠️ A lista de Faturamento mandava um `where` aninhado para `/tasks`, porque a
 * linha era uma TAREFA. `GET /billings` não aceita `where`: cada filtro é um
 * parâmetro nomeado que o serviço traduz. Mandar `where` aqui não dá erro — é
 * ignorado, e a tela mostra tudo como se nada estivesse marcado.
 *
 * ⚠️ `quoteStatuses` NÃO TEM PADRÃO no servidor e esta tela TEM de mandá-lo. O
 * `Billing` nasce na mesma transação que cria o orçamento, não na aprovação:
 * sem o filtro, a lista traz cobrança de orçamento PENDING que ninguém assinou e
 * de EXPIRED que voltou ao comercial para reanálise do preço.
 */
// `type` e não `interface` de propósito: o estado de navegação do pager carrega
// esta consulta como `Record<string, unknown>`, e uma INTERFACE não ganha o índice
// implícito que essa atribuição exige — o alias ganha.
export type BillingListParams = {
  page?: number;
  limit?: number;
  quoteId?: string;
  /** UM pagador. `customerIds` é o plural que a tela usa. */
  customerId?: string;
  /** `true` = já faturados; `false` = a faturar; ausente = ambos. */
  approved?: boolean;
  /** Só as cobranças cujos veículos estão TODOS finalizados. */
  deliveredOnly?: boolean;
  /** `BILLING_STATUS[]` — o estado da COBRANÇA. */
  statuses?: string[];
  /** `TASK_QUOTE_STATUS[]` — o estado do ORÇAMENTO. Ver o aviso acima. */
  quoteStatuses?: string[];
  searchingFor?: string;
  /** O servidor aceita `#984`; aqui já vai como inteiro. */
  budgetNumber?: number;
  /** "Faturar Para" — os pagadores da cobrança. */
  customerIds?: string[];
  /** "Cliente da Tarefa" — o dono do veículo coberto. */
  taskCustomerIds?: string[];
  totalRange?: { min?: number; max?: number };
  /** `true` = todos os veículos têm pedido; `false` = falta em pelo menos um. */
  hasOrderNumber?: boolean;
  dueDateRange?: { from?: Date; to?: Date };
  finishedDateRange?: { from?: Date; to?: Date };
  billingApprovedRange?: { from?: Date; to?: Date };
  createdAtRange?: { from?: Date; to?: Date };
  /**
   * LISTA, e cada entrada pode trazer a direção colada (`budgetNumber:desc`).
   *
   * Chaves aceitas: `statusOrder`, `createdAt`, `approvedAt`, `budgetNumber`.
   * Qualquer outra é **400** — o whitelist existe para que um campo inexistente
   * não vire 500 do driver. Ver `BILLING_SORT_FIELD_MAP`.
   */
  orderBy?: string[];
};

/** O envelope da lista, já desembrulhado da `AxiosResponse`. */
export interface BillingListResponse {
  success: boolean;
  message: string;
  data: Billing[];
  meta: {
    totalRecords: number;
    page: number;
    take: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * O FATURAMENTO TEM ENDEREÇO PRÓPRIO.
 *
 * Antes, cobrança só se abria por VEÍCULO — e num orçamento de quatro implementos
 * cobrados um a um, os quatro abriam a MESMA página, que desenhava
 * "Fatura 1 · 2 · 3 · 4" lado a lado. Não era defeito de tela: não havia quatro
 * endereços porque não havia quatro coisas.
 *
 * `Billing` é a quarta coisa. `byTask` é a ponte que mantém de pé todo link
 * antigo (notificação, app, favorito, e-mail): o servidor garante que um veículo
 * é cobrado por exatamente UM faturamento, então a tradução é sem ambiguidade.
 */
export const billingService = {
  /**
   * Uma cobrança, com as irmãs para o navegador entre elas.
   *
   * ⚠️ Devolve o ENVELOPE (`{ success, message, data }`), não a `AxiosResponse`.
   * Era a resposta inteira, e é por isso que o detalhe precisou do
   * `unwrapBilling` — um `?.data` sozinho parava no envelope, o id vinha
   * `undefined` e o redirecionamento nunca disparava, sem estourar nada.
   */
  getById: async (billingId: string) => (await apiClient.get(`/billings/${billingId}`)).data,

  /**
   * O faturamento que cobra ESTE veículo.
   *
   * É como a URL antiga (`/faturamento/detalhes/:taskId`) se resolve para a
   * nova: a página traduz uma vez e reescreve o endereço, de modo que o link
   * velho leva ao lugar certo e o histórico do navegador guarda o certo.
   */
  getByTask: async (taskId: string) => (await apiClient.get(`/billings/by-task/${taskId}`)).data,

  /** As cobranças de um orçamento, na ordem de criação. */
  getByQuote: async (quoteId: string) => (await apiClient.get(`/billings/quote/${quoteId}`)).data,

  /**
   * A LISTA — uma linha por COBRANÇA, não por veículo.
   *
   * `approved=false` + `deliveredOnly=true` é a fila que o financeiro nunca
   * teve: o que já foi entregue e ainda não foi cobrado.
   *
   * ⚠️ Devolve `response.data` — o ENVELOPE com `data` e `meta` —, como
   * `getTasks` sempre fez. Devolvendo a `AxiosResponse`, a tabela leria
   * `response.meta` como `undefined` e o rodapé anunciaria "0 resultado(s)"
   * sobre uma página cheia de linhas.
   */
  list: async (params?: BillingListParams): Promise<BillingListResponse> =>
    (await apiClient.get<BillingListResponse>("/billings", { params })).data,

  /**
   * APROVA ESTA COBRANÇA — emite a fatura, a NFS-e e os boletos dela, e de mais
   * nenhuma.
   *
   * É o ÚNICO endereço de "aprovar faturamento". Era
   * `PUT /budgets/:id/status` com `status: 'BILLING_APPROVED'`, que aprovava
   * o orçamento inteiro porque o estado era do orçamento — num orçamento cobrado
   * veículo a veículo isso emitia os sessenta de uma vez. O endpoint antigo hoje
   * RECUSA o valor (ele não existe mais no enum).
   */
  approve: (billingId: string) => apiClient.put(`/billings/${billingId}/approve`),

  /**
   * LIQUIDAÇÃO MANUAL desta cobrança — o orçamento direto, pago à vista sem
   * parcela nem boleto para conciliar.
   *
   * Substitui `updateStatus(quoteId, 'SETTLED')`. Pelo mesmo motivo da aprovação:
   * "liquidado" é estado da COBRANÇA, e marcá-lo no orçamento dava por pagas
   * também as cobranças irmãs que ninguém tinha recebido.
   */
  settle: (billingId: string) => apiClient.put(`/billings/${billingId}/settle`),

  /**
   * DESFAZ ESTA COBRANÇA — apaga a fatura, as parcelas e os boletos dela, baixa
   * os títulos no Sicredi e levanta o carimbo de aprovação. Só dela.
   *
   * Substitui `budgetService.revertBilling(quoteId)` nesta tela. Aquela rota
   * desmonta o ciclo do ORÇAMENTO INTEIRO: num orçamento de três lotes, reverter
   * o lote 3 apagava fatura e boleto dos lotes 1 e 2 e dava baixa em boletos que
   * o cliente já tinha na mão. Ela continua de pé no servidor para "reverter
   * tudo", que é outro ato — e que ninguém pede de dentro da tela de UMA cobrança.
   */
  revert: (billingId: string) => apiClient.put(`/billings/${billingId}/revert`),

  /** Esta cobrança pode ser recomposta, ou já está congelada por fatura/aprovação? */
  frozen: (billingId: string) => apiClient.get(`/billings/${billingId}/frozen`),
};
