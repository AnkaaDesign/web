import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { AxiosProgressEvent } from "axios";
import { reconciliationService } from "@/api-client/reconciliation";
import { siegService } from "@/api-client/sieg";
import { reconciliationKeys } from "@/hooks/common/query-keys";
import type {
  CategorizePayload,
  ChangeCategoryPayload,
  ClassifyBatchPayload,
  CreateTransactionCategoryPayload,
  FiscalDocumentFilters,
  OffBankResolution,
  TransactionCategoryListParams,
  TransactionFilters,
  UpdateTransactionCategoryPayload,
} from "@/types/reconciliation";
import type {
  IgnoreReasonPayload,
  ManualMatchPayload,
  RerunMatchingPayload,
  SiegFetchPayload,
} from "@/schemas/reconciliation";

export function useImportOfx(options?: {
  onUploadProgress?: (progress: AxiosProgressEvent) => void;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) =>
      reconciliationService
        .importOfx(files, options?.onUploadProgress)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

export function useImportFiscalDocuments(options?: {
  onUploadProgress?: (progress: AxiosProgressEvent) => void;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) =>
      reconciliationService
        .importFiscalDocuments(files, options?.onUploadProgress)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.fiscalDocs() });
      qc.invalidateQueries({ queryKey: reconciliationKeys.stats() });
    },
  });
}

export function useBankTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: reconciliationKeys.transactions(
      filters as Record<string, unknown>,
    ),
    queryFn: () =>
      reconciliationService.listTransactions(filters).then((r) => r.data),
    placeholderData: (previous) => previous,
  });
}

/**
 * Fetches a single transaction with matches + statement. Used by detail modals
 * driven by URL params, so a `?txId=xyz` deeplink can hydrate the modal even
 * when the row isn't on the current list page.
 */
export function useBankTransaction(id: string | undefined) {
  return useQuery({
    queryKey: id ? reconciliationKeys.transaction(id) : reconciliationKeys.all,
    queryFn: () =>
      id
        ? reconciliationService.getTransaction(id).then((r) => r.data)
        : Promise.reject(),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/**
 * Sets (or clears) the category of a single NF line item. Broad namespace
 * invalidation refetches both the NF detail and the candidate subtree so the
 * NF detail page and the transaction match section both update in place.
 */
export function useSetFiscalItemCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      fiscalItemId,
      categoryId,
    }: {
      fiscalItemId: string;
      categoryId: string | null;
    }) =>
      reconciliationService
        .setFiscalItemCategory(fiscalItemId, { categoryId })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

/** Single-NF fetch with linked transactions included. See useBankTransaction. */
export function useFiscalDocument(id: string | undefined) {
  return useQuery({
    queryKey: id ? reconciliationKeys.fiscalDoc(id) : reconciliationKeys.all,
    queryFn: () =>
      id
        ? reconciliationService.getFiscalDocument(id).then((r) => r.data)
        : Promise.reject(),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useMatchCandidates(
  transactionId: string | undefined,
  enabled = false,
  search?: string,
) {
  const term = search?.trim() || "";
  return useQuery({
    // Search is folded into the key as an extra segment (not into the factory) so
    // existing prefix-based invalidations by `candidates(txId)` still match.
    queryKey: transactionId
      ? [...reconciliationKeys.candidates(transactionId), term]
      : reconciliationKeys.all,
    queryFn: () =>
      transactionId
        ? reconciliationService
            .getCandidates(transactionId, term || undefined)
            .then((r) => r.data)
        : Promise.reject(),
    enabled: !!transactionId && enabled,
    // Always re-fetch on mount: a candidate note may have been consumed by
    // ANOTHER transaction since this list was last cached (an NF fully allocated
    // elsewhere must never linger here). The server already excludes matched
    // notes; staleTime 0 guarantees the client reflects that on every open.
    staleTime: 0,
  });
}

/**
 * REVERSE candidates: given an NF (fiscal document), the bank transactions that
 * could settle it. Mirror of `useMatchCandidates` from the note's perspective.
 * Keyed inline under the `reconciliation` namespace so prefix-based
 * invalidations by `reconciliationKeys.all` still match.
 */
export function useTransactionCandidates(
  fiscalDocumentId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: fiscalDocumentId
      ? (["reconciliation", "transactionCandidates", fiscalDocumentId] as const)
      : reconciliationKeys.all,
    queryFn: () =>
      fiscalDocumentId
        ? reconciliationService
            .getTransactionCandidates(fiscalDocumentId)
            .then((r) => r.data)
        : Promise.reject(),
    enabled: !!fiscalDocumentId && enabled,
    staleTime: 30_000,
  });
}

export function useMatchTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      transactionId,
      payload,
    }: {
      transactionId: string;
      payload: ManualMatchPayload;
    }) =>
      reconciliationService
        .matchTransaction(transactionId, payload)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

export function useUnmatchTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: string) =>
      reconciliationService
        .unmatchTransaction(transactionId)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

/**
 * Unmatches a fiscal document from ALL its transactions at once ("reset this
 * NF") — the recovery path for installments, where undoing a single transaction
 * would leave the NF partially linked and unable to re-match.
 */
export function useUnmatchFiscalDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fiscalDocumentId: string) =>
      reconciliationService
        .unmatchFiscalDocument(fiscalDocumentId)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

/**
 * Set (or clear, with resolution: null) the off-bank settlement of a received
 * note — a note that will never match a bank line (credit-card / bonificação /
 * no-payment). Invalidates the whole namespace so the NF detail, the documents
 * list buckets, and every candidate pool refresh.
 */
export function useSetOffBankResolution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      fiscalDocumentId,
      resolution,
      notes,
    }: {
      fiscalDocumentId: string;
      resolution: OffBankResolution | null;
      notes?: string;
    }) =>
      reconciliationService
        .setOffBankResolution(fiscalDocumentId, { resolution, notes })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

export function useIgnoreTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      transactionId,
      payload,
    }: {
      transactionId: string;
      payload: IgnoreReasonPayload;
    }) =>
      reconciliationService
        .ignoreTransaction(transactionId, payload)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

export function useRunAutoMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RerunMatchingPayload) =>
      reconciliationService.runAutoMatch(payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

export function useChangeCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      transactionId,
      payload,
    }: {
      transactionId: string;
      payload: ChangeCategoryPayload;
    }) =>
      reconciliationService
        .changeCategory(transactionId, payload)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

export function useClassifyBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ClassifyBatchPayload) =>
      reconciliationService.classifyBatch(payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

export function useFiscalDocuments(filters: FiscalDocumentFilters) {
  return useQuery({
    queryKey: reconciliationKeys.fiscalDocs(filters as Record<string, unknown>),
    queryFn: () =>
      reconciliationService.listFiscalDocuments(filters).then((r) => r.data),
    placeholderData: (previous) => previous,
  });
}

/**
 * Downloads the raw XML for a fiscal document as a blob URL. The URL is
 * revoked on unmount or when the accessKey changes.
 */
export function useFiscalDocumentXml(accessKey: string | undefined) {
  const blobUrlRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: accessKey
      ? reconciliationKeys.fiscalDocXml(accessKey)
      : reconciliationKeys.all,
    queryFn: async () => {
      if (!accessKey) throw new Error("no access key");
      const response =
        await reconciliationService.getFiscalDocumentXml(accessKey);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(response.data);
      blobUrlRef.current = url;
      return url;
    },
    enabled: !!accessKey,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    };
  }, []);

  return query;
}

export function useReconciliationStatistics(params: {
  from?: string;
  to?: string;
  months?: number;
}) {
  return useQuery({
    queryKey: reconciliationKeys.stats(params as Record<string, unknown>),
    queryFn: () =>
      reconciliationService.getStatistics(params).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

/**
 * Dynamic, DB-backed category taxonomy. Cached 5min — it changes rarely (only
 * when a user creates/edits a TRANSACTION_ONLY category or inventory mirrors a
 * new ItemCategory).
 */
export function useReconciliationCategories(
  params?: TransactionCategoryListParams,
) {
  return useQuery({
    queryKey: reconciliationKeys.categories(
      params as Record<string, unknown> | undefined,
    ),
    queryFn: () =>
      reconciliationService.listCategories(params).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useCreateReconciliationCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTransactionCategoryPayload) =>
      reconciliationService.createCategory(body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.categories() });
    },
  });
}

export function useUpdateReconciliationCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateTransactionCategoryPayload;
    }) => reconciliationService.updateCategory(id, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.categories() });
    },
  });
}

export function useDeleteReconciliationCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      reconciliationService.deleteCategory(id).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.categories() });
    },
  });
}

/** Auto-tags transactions in scope. Invalidates the whole namespace since both
 *  the transaction list and the stats shift. */
export function useCategorize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CategorizePayload) =>
      reconciliationService.categorize(payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

/**
 * Composite "Previsão de Saídas" for one competence month (YYYY-MM). Server
 * composes pedidos + impostos (aprox.) + folha (aggregate, com bonificação) +
 * recorrentes; the payroll slice can be slow (live calc), so cache it a bit.
 */
export function useOutflowForecast(reference?: string) {
  return useQuery({
    queryKey: reconciliationKeys.outflowForecast(reference),
    queryFn: () =>
      reconciliationService
        .getOutflowForecast(reference ? { reference } : undefined)
        .then((r) => r.data),
    staleTime: 60_000,
    refetchOnMount: "always",
    placeholderData: (previous) => previous,
  });
}

/** Inbox of medium-confidence category suggestions (PENDING transactions). */
export function useReconciliationSuggestions(enabled = true) {
  return useQuery({
    queryKey: reconciliationKeys.suggestions(),
    queryFn: () =>
      reconciliationService.listSuggestions().then((r) => r.data),
    enabled,
    staleTime: 30_000,
  });
}

/** Promotes a stored suggestion to a MANUAL category (also trains learners). */
export function useConfirmSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: string) =>
      reconciliationService
        .confirmSuggestion(transactionId)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

export function useSiegStatus() {
  return useQuery({
    queryKey: reconciliationKeys.siegStatus(),
    queryFn: () => siegService.getStatus().then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useSiegFetch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SiegFetchPayload) =>
      siegService.triggerFetch(payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.fiscalDocs() });
      qc.invalidateQueries({ queryKey: reconciliationKeys.stats() });
    },
  });
}
