import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { AxiosProgressEvent } from "axios";
import { reconciliationService } from "@/api-client/reconciliation";
import { siegService } from "@/api-client/sieg";
import { reconciliationKeys } from "@/hooks/common/query-keys";
import type {
  FiscalDocumentFilters,
  TransactionFilters,
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
        .then(r => r.data),
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
        .then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.fiscalDocs() });
      qc.invalidateQueries({ queryKey: reconciliationKeys.stats() });
    },
  });
}

export function useBankTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: reconciliationKeys.transactions(filters as Record<string, unknown>),
    queryFn: () => reconciliationService.listTransactions(filters).then(r => r.data),
    placeholderData: previous => previous,
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
      id ? reconciliationService.getTransaction(id).then(r => r.data) : Promise.reject(),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/** Single-NF fetch with linked transactions included. See useBankTransaction. */
export function useFiscalDocument(id: string | undefined) {
  return useQuery({
    queryKey: id ? reconciliationKeys.fiscalDoc(id) : reconciliationKeys.all,
    queryFn: () =>
      id ? reconciliationService.getFiscalDocument(id).then(r => r.data) : Promise.reject(),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useMatchCandidates(transactionId: string | undefined, enabled = false) {
  return useQuery({
    queryKey: transactionId
      ? reconciliationKeys.candidates(transactionId)
      : reconciliationKeys.all,
    queryFn: () =>
      transactionId
        ? reconciliationService.getCandidates(transactionId).then(r => r.data)
        : Promise.reject(),
    enabled: !!transactionId && enabled,
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
      reconciliationService.matchTransaction(transactionId, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

export function useUnmatchTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: string) =>
      reconciliationService.unmatchTransaction(transactionId).then(r => r.data),
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
      reconciliationService.ignoreTransaction(transactionId, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

export function useRunAutoMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RerunMatchingPayload) =>
      reconciliationService.runAutoMatch(payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

export function useFiscalDocuments(filters: FiscalDocumentFilters) {
  return useQuery({
    queryKey: reconciliationKeys.fiscalDocs(filters as Record<string, unknown>),
    queryFn: () => reconciliationService.listFiscalDocuments(filters).then(r => r.data),
    placeholderData: previous => previous,
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
      const response = await reconciliationService.getFiscalDocumentXml(accessKey);
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
    queryFn: () => reconciliationService.getStatistics(params).then(r => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useSiegStatus() {
  return useQuery({
    queryKey: reconciliationKeys.siegStatus(),
    queryFn: () => siegService.getStatus().then(r => r.data),
    staleTime: 60_000,
  });
}

export function useSiegFetch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SiegFetchPayload) =>
      siegService.triggerFetch(payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconciliationKeys.fiscalDocs() });
      qc.invalidateQueries({ queryKey: reconciliationKeys.stats() });
    },
  });
}
