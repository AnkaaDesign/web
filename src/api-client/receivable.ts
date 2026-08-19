import { apiClient } from "./axiosClient";
import type {
  ReceivableAllocatePayload,
  ReceivableCandidatesResponse,
  ReceivableMatchPayload,
  ReceivableMatchResponse,
  ReceivablesResponse,
  ReceivableSuggestionResponse,
  ReceivableUnmatchPayload,
  TaskCandidatesResponse,
  TaskMatchPayload,
  TaskMatchResponse,
} from "@/types/receivable";

const basePath = "/financial/receivables";

export const receivableService = {
  // Unified receivables list (task-quotes + external operations + invoices) with
  // the 4-state summary, the ENTRADA analog of the payables endpoint.
  getReceivables: () => apiClient.get<ReceivablesResponse>(basePath),

  // Open installments a bank CREDIT can be conciliated against.
  getReceivableCandidates: (transactionId: string) =>
    apiClient.get<ReceivableCandidatesResponse>(
      `${basePath}/candidates/${transactionId}`,
    ),

  // Conciliate an incoming credit against a single open installment.
  matchReceivable: (payload: ReceivableMatchPayload) =>
    apiClient.post<ReceivableMatchResponse>(`${basePath}/match`, payload),

  // Settle one credit across one or more installments with explicit amounts
  // (partial receipt / lump payment of several parcelas).
  allocateReceivable: (payload: ReceivableAllocatePayload) =>
    apiClient.post<ReceivableMatchResponse>(`${basePath}/allocate`, payload),

  // The server's identity-resolved plan for a credit (who paid + which parcelas).
  // Expresses what the candidate list structurally cannot: lump payments spanning
  // several parcelas, and already-PAID parcelas as link-only clearance.
  getReceivableSuggestion: (transactionId: string) =>
    apiClient.get<ReceivableSuggestionResponse>(
      `${basePath}/suggestion/${transactionId}`,
    ),

  // Apply that plan in one click.
  confirmReceivableSuggestion: (transactionId: string) =>
    apiClient.post<ReceivableMatchResponse>(`${basePath}/confirm-suggestion`, {
      transactionId,
    }),

  // Declare a receipt conciliated with NO bank line behind it (money paid into a
  // partner's personal account). ADMIN/ACCOUNTING only — enforced at the route.
  setExternalClearance: (payload: { installmentId: string; cleared: boolean; note?: string | null }) =>
    apiClient.post<{ success: boolean; message: string }>(`${basePath}/external-clearance`, payload),

  // Undo a previous credit↔installment conciliation.
  unmatchReceivable: (payload: ReceivableUnmatchPayload) =>
    apiClient.post<ReceivableMatchResponse>(`${basePath}/unmatch`, payload),

  // Tarefas a credit can be conciliated against — including tasks with NO
  // orçamento, which the installment candidate list structurally cannot see.
  // Without `search` the server resolves identity from the credit (CNPJ/nome);
  // with it, the operator looks the task up by nome/série/placa/chassi/cliente.
  getTaskCandidates: (transactionId: string, search?: string) =>
    apiClient.get<TaskCandidatesResponse>(
      `${basePath}/task-candidates/${transactionId}`,
      { params: search ? { search } : undefined },
    ),

  // Conciliate a credit against one or more tarefas, creating the missing
  // orçamento / fatura / parcela chain for whichever ones need it.
  matchTasks: (payload: TaskMatchPayload) =>
    apiClient.post<TaskMatchResponse>(`${basePath}/match-task`, payload),
};
