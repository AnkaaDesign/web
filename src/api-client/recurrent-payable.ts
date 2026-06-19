import { apiClient } from "./axiosClient";
import type {
  CreateRecurrentPayablePayload,
  PayRecurrentOccurrencePayload,
  PayRecurrentOccurrenceResponse,
  RecurrentPayableDetailResponse,
  RecurrentPayableListParams,
  RecurrentPayableListResponse,
  RecurrentPayableMutationResponse,
  UpdateRecurrentPayablePayload,
} from "@/types/recurrent-payable";

const basePath = "/financial/recurrent-payables";

export const recurrentPayableService = {
  getRecurrentPayables: (params?: RecurrentPayableListParams) =>
    apiClient.get<RecurrentPayableListResponse>(basePath, { params }),

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
};
