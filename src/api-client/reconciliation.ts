import type { AxiosProgressEvent } from "axios";
import { apiClient } from "./axiosClient";
import type {
  BankTransaction,
  FiscalDocument,
  FiscalDocumentFilters,
  ImportSummary,
  MatchCandidate,
  ReconciliationPaginatedResponse,
  ReconciliationStatistics,
  TransactionFilters,
  XmlImportResult,
} from "@/types/reconciliation";
import type {
  IgnoreReasonPayload,
  ManualMatchPayload,
  RerunMatchingPayload,
} from "@/schemas/reconciliation";

export const reconciliationService = {
  importOfx: (
    files: File[],
    onUploadProgress?: (progress: AxiosProgressEvent) => void,
  ) => {
    const formData = new FormData();
    for (const f of files) formData.append("files", f);
    return apiClient.post<ImportSummary>("/financial/reconciliation/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    });
  },

  importFiscalDocuments: (
    files: File[],
    onUploadProgress?: (progress: AxiosProgressEvent) => void,
  ) => {
    const formData = new FormData();
    for (const f of files) formData.append("files", f);
    return apiClient.post<XmlImportResult>(
      "/financial/reconciliation/fiscal-documents/import",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress,
      },
    );
  },

  listTransactions: (params: TransactionFilters) =>
    apiClient.get<ReconciliationPaginatedResponse<BankTransaction>>("/financial/reconciliation/transactions", {
      params,
    }),

  getCandidates: (transactionId: string) =>
    apiClient.get<MatchCandidate[]>(
      `/financial/reconciliation/transactions/${transactionId}/candidates`,
    ),

  getTransaction: (transactionId: string) =>
    apiClient.get<BankTransaction>(
      `/financial/reconciliation/transactions/${transactionId}`,
    ),

  getFiscalDocument: (id: string) =>
    apiClient.get<FiscalDocument>(`/financial/reconciliation/fiscal-documents/${id}`),

  matchTransaction: (transactionId: string, payload: ManualMatchPayload) =>
    apiClient.post<BankTransaction>(
      `/financial/reconciliation/transactions/${transactionId}/match`,
      payload,
    ),

  unmatchTransaction: (transactionId: string) =>
    apiClient.post<BankTransaction>(
      `/financial/reconciliation/transactions/${transactionId}/unmatch`,
    ),

  ignoreTransaction: (transactionId: string, payload: IgnoreReasonPayload) =>
    apiClient.post<BankTransaction>(
      `/financial/reconciliation/transactions/${transactionId}/ignore`,
      payload,
    ),

  runAutoMatch: (payload: RerunMatchingPayload) =>
    apiClient.post<{ matched: number }>("/financial/reconciliation/run", payload),

  getStatistics: (params: { from?: string; to?: string; months?: number }) =>
    apiClient.get<ReconciliationStatistics>("/financial/reconciliation/statistics", { params }),

  listFiscalDocuments: (params: FiscalDocumentFilters) =>
    apiClient.get<ReconciliationPaginatedResponse<FiscalDocument>>("/financial/reconciliation/fiscal-documents", {
      params,
    }),

  getFiscalDocumentXml: (accessKey: string) =>
    apiClient.get<Blob>(`/financial/reconciliation/fiscal-documents/${accessKey}/xml`, {
      responseType: "blob",
    }),
};
