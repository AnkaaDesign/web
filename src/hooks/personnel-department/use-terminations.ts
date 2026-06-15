// hooks/personnel-department/use-terminations.ts
// Rescisões (Departamento Pessoal)

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTerminations,
  getTerminationById,
  createTermination,
  updateTermination,
  deleteTermination,
  calculateTermination,
  advanceTermination,
  regressTermination,
  computeTerminationTaxes,
  uploadTerminationDocument,
  updateTerminationDocument,
  addTerminationItem,
  updateTerminationItem,
  deleteTerminationItem,
  batchCreateTerminations,
  batchUpdateTerminations,
  batchDeleteTerminations,
} from "../../api-client/termination";
import type {
  TerminationGetManyFormData,
  TerminationCreateFormData,
  TerminationUpdateFormData,
  TerminationBatchCreateFormData,
  TerminationBatchUpdateFormData,
  TerminationBatchDeleteFormData,
  TerminationAdvanceFormData,
  TerminationDocumentUploadFormData,
  TerminationDocumentUpdateFormData,
  TerminationItemCreateFormData,
  TerminationItemUpdateFormData,
} from "../../schemas/termination";
import type {
  TerminationGetManyResponse,
  TerminationGetUniqueResponse,
  TerminationCreateResponse,
  TerminationUpdateResponse,
  TerminationDeleteResponse,
  TerminationBatchCreateResponse,
  TerminationBatchUpdateResponse,
  TerminationBatchDeleteResponse,
} from "../../types/termination";
import { terminationKeys, userKeys, changeLogKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// Termination Service Adapter
// =====================================================

const terminationServiceAdapter = {
  getMany: getTerminations,
  getById: getTerminationById,
  create: createTermination,
  update: updateTermination,
  delete: deleteTermination,
  batchCreate: batchCreateTerminations,
  batchUpdate: batchUpdateTerminations,
  batchDelete: batchDeleteTerminations,
};

// =====================================================
// Base Termination Hooks
// =====================================================

const baseHooks = createEntityHooks<
  TerminationGetManyFormData,
  TerminationGetManyResponse,
  TerminationGetUniqueResponse,
  TerminationCreateFormData,
  TerminationCreateResponse,
  TerminationUpdateFormData,
  TerminationUpdateResponse,
  TerminationDeleteResponse,
  TerminationBatchCreateFormData,
  TerminationBatchCreateResponse<TerminationCreateFormData>,
  TerminationBatchUpdateFormData,
  TerminationBatchUpdateResponse<TerminationUpdateFormData & { id: string }>,
  TerminationBatchDeleteFormData,
  TerminationBatchDeleteResponse
>({
  queryKeys: terminationKeys,
  service: terminationServiceAdapter,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [userKeys, changeLogKeys], // COMPLETED dismisses the collaborator
});

// Export base hooks with standard names
export const useTerminationsInfinite = baseHooks.useInfiniteList;
export const useTerminations = baseHooks.useList;
export const useTermination = baseHooks.useDetail;
export const useTerminationMutations = baseHooks.useMutations;
export const useTerminationBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Specialized Mutations (verbas engine, status machine, documents, items)
// =====================================================

function useInvalidateTerminations() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: terminationKeys.all });
    queryClient.invalidateQueries({ queryKey: userKeys.all });
    queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
  };
}

/** POST /terminations/:id/calculate — recompute verbas (replaces non-custom items). */
export function useTerminationCalculate() {
  const invalidate = useInvalidateTerminations();
  return useMutation({
    mutationFn: (id: string) => calculateTermination(id),
    onSuccess: invalidate,
  });
}

/** PUT /terminations/:id/advance — advances the status machine (or cancels). */
export function useTerminationAdvance() {
  const invalidate = useInvalidateTerminations();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: TerminationAdvanceFormData }) => advanceTermination(id, data ?? {}),
    onSuccess: invalidate,
  });
}

/** PUT /terminations/:id/regress — steps the status machine ONE step backward. */
export function useTerminationRegress() {
  const invalidate = useInvalidateTerminations();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => regressTermination(id),
    onSuccess: invalidate,
  });
}

/** POST /terminations/:id/compute-taxes — auto-compute INSS/IRRF + FGTS-multa base. */
export function useTerminationComputeTaxes() {
  const invalidate = useInvalidateTerminations();
  return useMutation({
    mutationFn: (id: string) => computeTerminationTaxes(id),
    onSuccess: invalidate,
  });
}

/** POST /terminations/:id/documents — multipart upload (field "file" + type/note). */
export function useTerminationDocumentUpload() {
  const invalidate = useInvalidateTerminations();
  return useMutation({
    mutationFn: ({ id, data, file }: { id: string; data: TerminationDocumentUploadFormData; file: File }) => uploadTerminationDocument(id, data, file),
    onSuccess: invalidate,
  });
}

/** PUT /terminations/documents/:documentId — status/note. */
export function useTerminationDocumentUpdate() {
  const invalidate = useInvalidateTerminations();
  return useMutation({
    mutationFn: ({ documentId, data }: { documentId: string; data: TerminationDocumentUpdateFormData }) => updateTerminationDocument(documentId, data),
    onSuccess: invalidate,
  });
}

/** POST /terminations/:id/items — add a custom verba (INSS/IRRF/other). */
export function useTerminationItemCreate() {
  const invalidate = useInvalidateTerminations();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TerminationItemCreateFormData }) => addTerminationItem(id, data),
    onSuccess: invalidate,
  });
}

/** PUT /terminations/items/:itemId — edit a custom verba. */
export function useTerminationItemUpdate() {
  const invalidate = useInvalidateTerminations();
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: TerminationItemUpdateFormData }) => updateTerminationItem(itemId, data),
    onSuccess: invalidate,
  });
}

/** DELETE /terminations/items/:itemId — remove a custom verba. */
export function useTerminationItemDelete() {
  const invalidate = useInvalidateTerminations();
  return useMutation({
    mutationFn: (itemId: string) => deleteTerminationItem(itemId),
    onSuccess: invalidate,
  });
}
