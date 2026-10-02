import { apiClient } from './axiosClient';
import type { BaseGetManyResponse } from '../types/common';
import type { Budget } from '../types/budget';

export type BudgetGetManyResponse = BaseGetManyResponse<Budget>;

/**
 * A LISTA DE ORÇAMENTOS — uma linha por CONTRATO, não por veículo.
 *
 * Devolve `response.data` (o envelope `{ success, data, meta }`), e não o
 * `AxiosResponse` cru que `getAll` entrega: quem consome é uma tabela em modo
 * servidor, que lê `meta.totalRecords` para o rodapé e para a paginação. Pelo
 * caminho antigo o chamador teria de escrever `res.data.data` e `res.data.meta`,
 * e foi por isso que a lista nasceu consultando `/tasks` — o único cliente que
 * já tinha esta forma. Molde idêntico ao de `taskService.getTasks`.
 */
export async function getBudgets(params: Record<string, unknown> = {}): Promise<BudgetGetManyResponse> {
  const response = await apiClient.get<BudgetGetManyResponse>('/budgets', { params });
  return response.data;
}

export const budgetService = {
  // Get all quotes
  getAll: (params?: any) => apiClient.get('/budgets', { params }),

  /** Ver `getBudgets` — o envelope já desembrulhado, para listas paginadas. */
  getMany: getBudgets,

  // Get by ID
  getById: (id: string) => apiClient.get(`/budgets/${id}`),

  // Get by task ID
  getByTaskId: (taskId: string) => apiClient.get(`/budgets/task/${taskId}`),

  // Create
  create: (data: any) => apiClient.post('/budgets', data),

  // Update
  update: (id: string, data: any) => apiClient.put(`/budgets/${id}`, data),

  /**
   * SIMPLIFICAR ORÇAMENTO — N orçamentos de 1 veículo viram 1 de N.
   *
   * Manda TAREFAS, não orçamentos: é assim que a Agenda e o Cronograma
   * selecionam. Deduplicar por orçamento é do servidor — marcar os quatro
   * veículos de um orçamento de quatro é inofensivo.
   *
   * A PRÉVIA é obrigatória antes do botão e não escreve nada: a linha da Agenda
   * traz o total e o cliente, não a lista de serviços, o desconto nem as
   * condições de pagamento — que é o que decide se dá para unir. Toast suprimido
   * porque quem fala é o diálogo, com a lista de impedimentos inteira.
   */
  mergePreview: (taskIds: string[], validityDays?: number) =>
    apiClient.post(
      '/budgets/merge/preview',
      { taskIds, ...(validityDays ? { validityDays } : {}) },
      { metadata: { suppressToast: true } } as any,
    ),

  /**
   * `validityDays`: a validade do orçamento unido RECOMEÇA hoje e vale por este
   * número de dias (padrão do servidor: 30).
   */
  merge: (taskIds: string[], options?: { billingSplit?: 'JOINT' | 'PER_TASK'; validityDays?: number }) =>
    apiClient.post('/budgets/merge', {
      taskIds,
      ...(options?.billingSplit ? { billingSplit: options.billingSplit } : {}),
      ...(options?.validityDays ? { validityDays: options.validityDays } : {}),
    }),

  /**
   * ESTENDER a validade: "vale até daqui a `days` dias", contado de HOJE. Um
   * orçamento em Aguardando Reanálise volta para Pendente.
   */
  extendValidity: (id: string, days: number) =>
    apiClient.put(`/budgets/${id}/validity`, { days }),

  /**
   * Status pelo caminho genérico. A API DELEGA cada destino ao ato (aprovar o
   * valor exige nota, reprovar exige motivo, enviar ao cliente exige valor);
   * telas novas chamam os atos abaixo, que dizem o que pedem.
   */
  updateStatus: (id: string, status: string, reason?: string) =>
    apiClient.put(`/budgets/${id}/status`, { status, reason }),

  // ─── OS ATOS DO EIXO DO VALOR (Modelo C, P14) ───────────────────────────────

  /** "Enviar para aprovação do cliente" (REQUESTED/PENDING/EXPIRED → IN_NEGOTIATION). Exige valor. */
  sendToCustomer: (id: string) => apiClient.put(`/budgets/${id}/send-to-customer`),

  /** "Retirar do cliente" (IN_NEGOTIATION → PENDING). Motivo opcional. */
  withdrawFromCustomer: (id: string, reason?: string) =>
    apiClient.put(`/budgets/${id}/withdraw-from-customer`, reason?.trim() ? { reason: reason.trim() } : {}),

  /**
   * "Aprovar valor em nome do cliente" (→ APPROVED, origem `ON_BEHALF`). A NOTA é
   * obrigatória: como o cliente aprovou (e-mail, telefone, reunião).
   */
  approveValue: (id: string, note: string) => apiClient.put(`/budgets/${id}/value-approval`, { note }),

  /** "Reprovar valor" (APPROVED → PENDING). Motivo obrigatório. */
  revokeValueApproval: (id: string, reason: string) =>
    apiClient.delete(`/budgets/${id}/value-approval`, { data: { reason } }),

  /**
   * "Assinado fora do sistema" (DD11): a prova (PDF ou imagem), a nota e, se
   * quiser, a data em que foi assinado. O eixo da assinatura vai a
   * `SIGNED_OFFLINE` e a cobrança passa a poder ser aprovada.
   */
  registerOfflineSignature: (id: string, args: { file: File; note: string; signedAt?: string | null }) => {
    const form = new FormData();
    form.append('offlineSignatureFile', args.file);
    form.append('note', args.note);
    if (args.signedAt) form.append('signedAt', args.signedAt);
    return apiClient.post(`/budgets/${id}/offline-signature`, form);
  },

  /**
   * ⚠️ APROVAR FATURAMENTO NÃO MORA MAIS AQUI.
   *
   * Era `updateStatus(id, "BILLING_APPROVED")` para a aprovação conjunta e
   * `PUT /budgets/:id/internal-approve/:taskId` para uma fatia. Os dois
   * endereçavam a cobrança pelo ORÇAMENTO (ou por um dos veículos dela), porque
   * a cobrança não tinha id. Agora tem: use `billingService.approve(billingId)`
   * — `PUT /billings/:id/approve` —, que emite a fatura, a NFS-e e os boletos
   * DAQUELA cobrança e de mais nenhuma. O endpoint de status RECUSA
   * `BILLING_APPROVED`: o valor não existe mais no enum.
   *
   * Liquidação manual, pelo mesmo motivo, é `billingService.settle(billingId)`.
   *
   * A rota da fatia continua de pé no servidor para o app instalado; o web não a
   * chama mais.
   */

  /**
   * REVERTER O CICLO DE COBRANÇA DO ORÇAMENTO INTEIRO.
   *
   * ⚠️ Não é "reverter o faturamento desta tela". Endereçada pelo ORÇAMENTO, ela
   * desmonta TODAS as cobranças dele: num orçamento de três lotes, apaga fatura,
   * parcela e boleto dos três e dá baixa no Sicredi de títulos que o cliente já
   * tem na mão. Para desfazer UMA cobrança use `billingService.revert(billingId)`
   * — `PUT /billings/:id/revert`.
   *
   * Nenhuma tela chama esta rota hoje; ela fica para o dia em que existir o ato
   * "reverter tudo", que ainda não tem tela.
   */
  revertBilling: (id: string) => apiClient.put(`/budgets/${id}/revert-billing`),


  // Recibo de quitação (PDF) — só existe depois que a cobrança é liquidada
  // (`BILLING_STATUS.SETTLED`). O recibo é do orçamento porque é o contrato que
  // se quita; o estado que o libera é o da cobrança.
  getReceiptPdf: (id: string) =>
    apiClient.get(`/budgets/${id}/receipt`, { responseType: 'blob' }),

  // Delete
  delete: (id: string) => apiClient.delete(`/budgets/${id}`),

  // Get expired
  getExpired: () => apiClient.get('/budgets/expired/list'),

  // Get suggestion based on matching task fields
  getSuggestion: (params: { name: string; customerId: string; category: string; implementType: string }) =>
    apiClient.get('/budgets/suggest', { params }),

  // =====================
  // PUBLIC ENDPOINTS (No Authentication Required)
  // =====================

  // Get quote for public view (customer budget page).
  // We need this to ALWAYS be 100% fresh — customers reach it through long-lived
  // shareable links and any stale data (missing responsible, etc.) is a real
  // problem. Cache busting:
  //   1. `_t` query param → unique cache key per call (defeats the in-memory axios cache)
  //   2. Server returns Cache-Control: no-store + Pragma + Expires + Surrogate-Control
  //      so the browser HTTP cache and any CDN/proxy in front cannot keep the body.
  // (Request headers like Cache-Control trigger CORS preflight failures, so we
  //  rely on response-side directives instead.)
  getPublic: (id: string) => apiClient.get(`/budgets/public/${id}`, {
    params: { _t: Date.now() },
  }),

  // Upload customer signature (public)
  uploadPublicSignature: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('signature', file);
    return apiClient.post(`/budgets/public/${id}/signature`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};
