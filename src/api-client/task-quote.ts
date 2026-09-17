import { apiClient } from './axiosClient';

export const taskQuoteService = {
  // Get all quotes
  getAll: (params?: any) => apiClient.get('/task-quotes', { params }),

  // Get by ID
  getById: (id: string) => apiClient.get(`/task-quotes/${id}`),

  // Get by task ID
  getByTaskId: (taskId: string) => apiClient.get(`/task-quotes/task/${taskId}`),

  // Create
  create: (data: any) => apiClient.post('/task-quotes', data),

  // Update
  update: (id: string, data: any) => apiClient.put(`/task-quotes/${id}`, data),

  // Update only the layout files — layoutFileIds is a safe-after-billing field, so
  // this works on locked quotes too. Toast suppressed so batch callers can emit one
  // summary. Sends the ordered File-id array (replaces the relation; [] clears).
  updateLayoutFile: (id: string, layoutFileIds: string[]) =>
    apiClient.put(
      `/task-quotes/${id}`,
      { layoutFileIds },
      { metadata: { suppressToast: true } } as any,
    ),

  // Update status
  updateStatus: (id: string, status: string, reason?: string) =>
    apiClient.put(`/task-quotes/${id}/status`, { status, reason }),

  // Aprovação COMERCIAL do orçamento (PENDING/SIGNED → APPROVED). É o último
  // estado do orçamento; o que vem depois é cobrança, e cobrança tem rota
  // própria (`billingService.approve`).
  approve: (id: string) => apiClient.put(`/task-quotes/${id}/budget-approve`),

  // Budget Approve (alias)
  budgetApprove: (id: string) => apiClient.put(`/task-quotes/${id}/budget-approve`),

  /**
   * ⚠️ APROVAR FATURAMENTO NÃO MORA MAIS AQUI.
   *
   * Era `updateStatus(id, "BILLING_APPROVED")` para a aprovação conjunta e
   * `PUT /task-quotes/:id/internal-approve/:taskId` para uma fatia. Os dois
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
  revertBilling: (id: string) => apiClient.put(`/task-quotes/${id}/revert-billing`),

  // Reject (sends back to PENDING with a reason)
  reject: (id: string, reason?: string) =>
    apiClient.put(`/task-quotes/${id}/status`, { status: 'PENDING', reason }),

  // Cancel (sends back to PENDING)
  cancel: (id: string) => apiClient.put(`/task-quotes/${id}/status`, { status: 'PENDING' }),

  // Update just the orderNumber on a customerConfig — safe to call on locked quotes
  /**
   * @deprecated O número do pedido é do VEÍCULO (`Task.customerOrderNumber`).
   * Esta rota grava o mesmo número em TODAS as tarefas do orçamento. Para editar
   * o pedido de um caminhão use `PUT /tasks/:id` (ou `PUT /tasks/batch`).
   */
  updateCustomerConfigOrderNumber: (id: string, customerId: string, orderNumber: string | null) =>
    apiClient.patch(`/task-quotes/${id}/customer-config-order-number`, { customerId, orderNumber }),

  // Recibo de quitação (PDF) — só existe depois que a cobrança é liquidada
  // (`BILLING_STATUS.SETTLED`). O recibo é do orçamento porque é o contrato que
  // se quita; o estado que o libera é o da cobrança.
  getReceiptPdf: (id: string) =>
    apiClient.get(`/task-quotes/${id}/receipt`, { responseType: 'blob' }),

  // Delete
  delete: (id: string) => apiClient.delete(`/task-quotes/${id}`),

  // Get expired
  getExpired: () => apiClient.get('/task-quotes/expired/list'),

  // Get suggestion based on matching task fields
  getSuggestion: (params: { name: string; customerId: string; category: string; implementType: string }) =>
    apiClient.get('/task-quotes/suggest', { params }),

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
  getPublic: (id: string) => apiClient.get(`/task-quotes/public/${id}`, {
    params: { _t: Date.now() },
  }),

  // Upload customer signature (public)
  uploadPublicSignature: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('signature', file);
    return apiClient.post(`/task-quotes/public/${id}/signature`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};
