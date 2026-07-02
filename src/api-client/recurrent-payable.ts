import { apiClient } from "./axiosClient";
import type {
  CreateRecurrentPayablePayload,
  PayRecurrentOccurrencePayload,
  PayRecurrentOccurrenceResponse,
  RecurrentPayableDetailResponse,
  RecurrentPayableListParams,
  RecurrentPayableListResponse,
  RecurrentPayableMonthlyResponse,
  RecurrentPayableMutationResponse,
  UpdateRecurrentPayablePayload,
} from "@/types/recurrent-payable";

const basePath = "/financial/recurrent-payables";

export const recurrentPayableService = {
  getRecurrentPayables: (params?: RecurrentPayableListParams) =>
    apiClient.get<RecurrentPayableListResponse>(basePath, { params }),

  // Per-bill monthly dashboard. `competence` is YYYY-MM; omit for current month.
  getMonthly: (competence?: string) =>
    apiClient.get<RecurrentPayableMonthlyResponse>(`${basePath}/monthly`, {
      params: competence ? { competence } : undefined,
    }),

  getRecurrentPayable: (id: string) =>
    apiClient.get<RecurrentPayableDetailResponse>(`${basePath}/${id}`),

  createRecurrentPayable: (body: CreateRecurrentPayablePayload) =>
    apiClient.post<RecurrentPayableMutationResponse>(basePath, body),

  updateRecurrentPayable: (id: string, body: UpdateRecurrentPayablePayload) =>
    apiClient.put<RecurrentPayableMutationResponse>(`${basePath}/${id}`, body),

  deleteRecurrentPayable: (id: string) =>
    apiClient.delete<RecurrentPayableMutationResponse>(`${basePath}/${id}`),

  // Mark-paid a single materialized occurrence. paidAmount is required for
  // VARIABLE bills; FIXED bills settle with the known value.
  payRecurrentOccurrence: (
    occurrenceId: string,
    body: PayRecurrentOccurrencePayload,
  ) =>
    apiClient.post<PayRecurrentOccurrenceResponse>(
      `${basePath}/occurrences/${occurrenceId}/pay`,
      body,
    ),

  // Ignore a single occurrence for its month (won't be paid — e.g. diarista
  // faltou). Kept on record so it's out of totals but revertible.
  ignoreRecurrentOccurrence: (occurrenceId: string) =>
    apiClient.post<PayRecurrentOccurrenceResponse>(
      `${basePath}/occurrences/${occurrenceId}/ignore`,
      {},
    ),

  // Revert an ignored occurrence back to an open obligation.
  unignoreRecurrentOccurrence: (occurrenceId: string) =>
    apiClient.post<PayRecurrentOccurrenceResponse>(
      `${basePath}/occurrences/${occurrenceId}/unignore`,
      {},
    ),
};
