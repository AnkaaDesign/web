import { apiClient } from "./axiosClient";
import type {
  ReceivableAllocatePayload,
  ReceivableCandidatesResponse,
  ReceivableMatchPayload,
  ReceivableMatchResponse,
  ReceivablesResponse,
  ReceivableUnmatchPayload,
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

  // Undo a previous credit↔installment conciliation.
  unmatchReceivable: (payload: ReceivableUnmatchPayload) =>
    apiClient.post<ReceivableMatchResponse>(`${basePath}/unmatch`, payload),
};
