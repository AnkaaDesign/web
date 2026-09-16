import { apiClient } from "./axiosClient";

/**
 * O FATURAMENTO TEM ENDEREÇO PRÓPRIO.
 *
 * Antes, cobrança só se abria por VEÍCULO — e num orçamento de quatro caminhões
 * cobrados um a um, os quatro abriam a MESMA página, que desenhava
 * "Fatura 1 · 2 · 3 · 4" lado a lado. Não era defeito de tela: não havia quatro
 * endereços porque não havia quatro coisas.
 *
 * `Billing` é a quarta coisa. `byTask` é a ponte que mantém de pé todo link
 * antigo (notificação, app, favorito, e-mail): o servidor garante que um veículo
 * é cobrado por exatamente UM faturamento, então a tradução é sem ambiguidade.
 */
export const billingService = {
  /** Uma cobrança, com as irmãs para o navegador entre elas. */
  getById: (billingId: string) => apiClient.get(`/billings/${billingId}`),

  /**
   * O faturamento que cobra ESTE veículo.
   *
   * É como a URL antiga (`/faturamento/detalhes/:taskId`) se resolve para a
   * nova: a página traduz uma vez e reescreve o endereço, de modo que o link
   * velho leva ao lugar certo e o histórico do navegador guarda o certo.
   */
  getByTask: (taskId: string) => apiClient.get(`/billings/by-task/${taskId}`),

  /** As cobranças de um orçamento, na ordem de criação. */
  getByQuote: (quoteId: string) => apiClient.get(`/billings/quote/${quoteId}`),

  /**
   * A LISTA — uma linha por COBRANÇA, não por veículo.
   *
   * `approved=false` + `deliveredOnly=true` é a fila que o financeiro nunca
   * teve: o que já foi entregue e ainda não foi cobrado.
   */
  list: (params?: {
    page?: number;
    limit?: number;
    quoteId?: string;
    customerId?: string;
    approved?: boolean;
    deliveredOnly?: boolean;
  }) => apiClient.get("/billings", { params }),

  /** Aprova ESTA cobrança — emite a fatura, a NFS-e e os boletos dela, e de mais nenhuma. */
  approve: (billingId: string) => apiClient.put(`/billings/${billingId}/approve`),

  /** Esta cobrança pode ser recomposta, ou já está congelada por fatura/aprovação? */
  frozen: (billingId: string) => apiClient.get(`/billings/${billingId}/frozen`),
};
