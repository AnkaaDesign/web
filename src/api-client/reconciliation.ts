import type { AxiosProgressEvent } from "axios";
import { apiClient } from "./axiosClient";
import type {
  BankTransaction,
  CategorizePayload,
  CategorizeResult,
  ChangeCategoryPayload,
  ClassifyBatchPayload,
  ClassifyBatchResult,
  CreateTransactionCategoryPayload,
  FiscalDocument,
  FiscalDocumentFilters,
  ImportSummary,
  MatchCandidate,
  OutflowForecast,
  ReconciliationPaginatedResponse,
  ReconciliationStatistics,
  ReconciliationSuggestion,
  SetFiscalItemCategoryPayload,
  TransactionCategory,
  TransactionCategoryListParams,
  TransactionFilters,
  UpdateTransactionCategoryPayload,
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
    return apiClient.post<ImportSummary>(
      "/financial/reconciliation/import",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress,
      },
    );
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
    apiClient.get<ReconciliationPaginatedResponse<BankTransaction>>(
      "/financial/reconciliation/transactions",
      {
        params,
      },
    ),

  getCandidates: (transactionId: string, search?: string) =>
    apiClient.get<MatchCandidate[]>(
      `/financial/reconciliation/transactions/${transactionId}/candidates`,
      { params: search ? { search } : undefined },
    ),

  getTransaction: (transactionId: string) =>
    apiClient.get<BankTransaction>(
      `/financial/reconciliation/transactions/${transactionId}`,
    ),

  getFiscalDocument: (id: string) =>
    apiClient.get<FiscalDocument>(
      `/financial/reconciliation/fiscal-documents/${id}`,
    ),

  setFiscalItemCategory: (
    fiscalItemId: string,
    payload: SetFiscalItemCategoryPayload,
  ) =>
    apiClient.post<FiscalDocument>(
      `/financial/reconciliation/fiscal-documents/items/${fiscalItemId}/category`,
      payload,
    ),

  matchTransaction: (transactionId: string, payload: ManualMatchPayload) =>
    apiClient.post<BankTransaction>(
      `/financial/reconciliation/transactions/${transactionId}/match`,
      payload,
    ),

  unmatchTransaction: (transactionId: string) =>
    apiClient.post<BankTransaction>(
      `/financial/reconciliation/transactions/${transactionId}/unmatch`,
    ),

  unmatchFiscalDocument: (fiscalDocumentId: string) =>
    apiClient.post(
      `/financial/reconciliation/fiscal-documents/${fiscalDocumentId}/unmatch`,
    ),

  ignoreTransaction: (transactionId: string, payload: IgnoreReasonPayload) =>
    apiClient.post<BankTransaction>(
      `/financial/reconciliation/transactions/${transactionId}/ignore`,
      payload,
    ),

  changeCategory: (transactionId: string, payload: ChangeCategoryPayload) =>
    apiClient.post<BankTransaction>(
      `/financial/reconciliation/transactions/${transactionId}/category`,
      payload,
    ),

  classifyBatch: (payload: ClassifyBatchPayload) =>
    apiClient.post<ClassifyBatchResult>(
      "/financial/reconciliation/classify",
      payload,
    ),

  runAutoMatch: (payload: RerunMatchingPayload) =>
    apiClient.post<{
      classified: ClassifyBatchResult;
      matched: number;
      categorized: number;
    }>(
      "/financial/reconciliation/run",
      payload,
      // Suppress the generic interceptor toast — the "Verificar" handler shows
      // its own detailed summary (classificadas · conciliadas · categorizadas).
      { metadata: { suppressToast: true } } as never,
    ),

  getStatistics: (params: { from?: string; to?: string; months?: number }) =>
    apiClient.get<ReconciliationStatistics>(
      "/financial/reconciliation/statistics",
      { params },
    ),

  listFiscalDocuments: (params: FiscalDocumentFilters) =>
    apiClient.get<ReconciliationPaginatedResponse<FiscalDocument>>(
      "/financial/reconciliation/fiscal-documents",
      {
        params,
      },
    ),

  getFiscalDocumentXml: (accessKey: string) =>
    apiClient.get<Blob>(
      `/financial/reconciliation/fiscal-documents/${accessKey}/xml`,
      {
        responseType: "blob",
      },
    ),

  listCategories: (params?: TransactionCategoryListParams) =>
    apiClient.get<TransactionCategory[]>(
      "/financial/reconciliation/categories",
      {
        params,
      },
    ),

  createCategory: (body: CreateTransactionCategoryPayload) =>
    apiClient.post<TransactionCategory>(
      "/financial/reconciliation/categories",
      body,
    ),

  // Controller exposes update via POST (not PATCH) — matches the backend.
  updateCategory: (id: string, body: UpdateTransactionCategoryPayload) =>
    apiClient.post<TransactionCategory>(
      `/financial/reconciliation/categories/${id}`,
      body,
    ),

  deleteCategory: (id: string) =>
    apiClient.post<TransactionCategory>(
      `/financial/reconciliation/categories/${id}/delete`,
    ),

  categorize: (body: CategorizePayload) =>
    apiClient.post<CategorizeResult>(
      "/financial/reconciliation/categorize",
      body,
    ),

  // Composite "Previsão de Saídas": pedidos + impostos (aprox.) + folha (com
  // bonificação, agregado) + recorrentes, composed server-side.
  getOutflowForecast: (params?: { reference?: string }) =>
    apiClient.get<OutflowForecast>(
      "/financial/reconciliation/outflow-forecast",
      { params },
    ),

  // Inbox of medium-confidence category suggestions awaiting one-click confirm.
  listSuggestions: () =>
    apiClient.get<ReconciliationSuggestion[]>(
      "/financial/reconciliation/suggestions",
    ),

  confirmSuggestion: (transactionId: string) =>
    apiClient.post<BankTransaction>(
      `/financial/reconciliation/transactions/${transactionId}/suggestion/confirm`,
    ),
};
