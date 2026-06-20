// packages/hooks/src/useFispq.ts
// FISPQ / FDS — Ficha de Informações de Segurança de Produtos Químicos / Safety Data Sheet

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getFispqs,
  getFispqById,
  createFispq,
  updateFispq,
  deleteFispq,
  uploadFispqDocument,
  batchCreateFispqs,
  batchUpdateFispqs,
  batchDeleteFispqs,
} from "../../api-client/fispq";
import type {
  FispqGetManyFormData,
  FispqCreateFormData,
  FispqUpdateFormData,
  FispqBatchCreateFormData,
  FispqBatchUpdateFormData,
  FispqBatchDeleteFormData,
} from "../../schemas/fispq";
import type {
  Fispq,
  FispqGetManyResponse,
  FispqGetUniqueResponse,
  FispqCreateResponse,
  FispqUpdateResponse,
  FispqDeleteResponse,
  FispqBatchCreateResponse,
  FispqBatchUpdateResponse,
  FispqBatchDeleteResponse,
} from "../../types/fispq";
import { fispqKeys, changeLogKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// Fispq Service Adapter
// =====================================================

const fispqServiceAdapter = {
  getMany: getFispqs,
  getById: getFispqById,
  create: createFispq,
  update: updateFispq,
  delete: deleteFispq,
  batchCreate: batchCreateFispqs,
  batchUpdate: batchUpdateFispqs,
  batchDelete: batchDeleteFispqs,
};

// =====================================================
// Base Fispq Hooks
// =====================================================

const baseHooks = createEntityHooks<
  FispqGetManyFormData,
  FispqGetManyResponse,
  FispqGetUniqueResponse,
  FispqCreateFormData,
  FispqCreateResponse,
  FispqUpdateFormData,
  FispqUpdateResponse,
  FispqDeleteResponse,
  FispqBatchCreateFormData,
  FispqBatchCreateResponse<Fispq>,
  FispqBatchUpdateFormData,
  FispqBatchUpdateResponse<Fispq>,
  FispqBatchDeleteFormData,
  FispqBatchDeleteResponse
>({
  queryKeys: fispqKeys,
  service: fispqServiceAdapter,
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// Export base hooks with standard names
export const useFispqsInfinite = baseHooks.useInfiniteList;
export const useFispqs = baseHooks.useList;
export const useFispq = baseHooks.useDetail;
export const useFispqMutations = baseHooks.useMutations;
export const useFispqBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Specialized Hooks
// =====================================================

// Upload do PDF oficial da FDS (multipart "document")
export function useUploadFispqDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file, include }: { id: string; file: globalThis.File; include?: any }) => uploadFispqDocument(id, file, include ? { include } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fispqKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}
