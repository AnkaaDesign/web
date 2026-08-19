// hooks/personnel-department/use-admissions.ts
// Admissões (Departamento Pessoal)

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdmissions,
  getAdmissionById,
  getAdmissionByUser,
  createAdmission,
  updateAdmission,
  deleteAdmission,
  advanceAdmission,
  uploadAdmissionDocument,
  uploadAdmissionDocumentByUser,
  updateAdmissionDocument,
  batchCreateAdmissions,
  batchUpdateAdmissions,
  batchDeleteAdmissions,
} from "../../api-client/admission";
import type {
  AdmissionGetManyFormData,
  AdmissionCreateFormData,
  AdmissionUpdateFormData,
  AdmissionBatchCreateFormData,
  AdmissionBatchUpdateFormData,
  AdmissionBatchDeleteFormData,
  AdmissionAdvanceFormData,
  AdmissionDocumentUploadFormData,
  AdmissionDocumentUpdateFormData,
} from "../../schemas/admission";
import type {
  AdmissionGetManyResponse,
  AdmissionGetUniqueResponse,
  AdmissionCreateResponse,
  AdmissionUpdateResponse,
  AdmissionDeleteResponse,
  AdmissionBatchCreateResponse,
  AdmissionBatchUpdateResponse,
  AdmissionBatchDeleteResponse,
  Admission,
} from "../../types/admission";
import { admissionKeys, userKeys, changeLogKeys, medicalExamKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// Admission Service Adapter
// =====================================================

const admissionServiceAdapter = {
  getMany: getAdmissions,
  getById: getAdmissionById,
  create: createAdmission,
  update: updateAdmission,
  delete: deleteAdmission,
  batchCreate: batchCreateAdmissions,
  batchUpdate: batchUpdateAdmissions,
  batchDelete: batchDeleteAdmissions,
};

// =====================================================
// Base Admission Hooks
// =====================================================

const baseHooks = createEntityHooks<
  AdmissionGetManyFormData,
  AdmissionGetManyResponse,
  AdmissionGetUniqueResponse,
  AdmissionCreateFormData,
  AdmissionCreateResponse,
  AdmissionUpdateFormData,
  AdmissionUpdateResponse,
  AdmissionDeleteResponse,
  AdmissionBatchCreateFormData,
  AdmissionBatchCreateResponse<Admission>,
  AdmissionBatchUpdateFormData,
  AdmissionBatchUpdateResponse<Admission>,
  AdmissionBatchDeleteFormData,
  AdmissionBatchDeleteResponse
>({
  queryKeys: admissionKeys,
  service: admissionServiceAdapter,
  staleTime: 1000 * 60 * 5, // 5 minutes
  // Avançar para a etapa "Exame admissional" faz o SERVIDOR criar o ASO
  // (admission.service.ts). Sem medicalExamKeys aqui o cartão do exame segue
  // servindo o cache "nenhum exame agendado" e o operador clica em Agendar de novo.
  relatedQueryKeys: [userKeys, changeLogKeys, medicalExamKeys], // Admission create/advance updates the user (contractKind) + auto-creates the ASO
});

// Export base hooks with standard names
export const useAdmissionsInfinite = baseHooks.useInfiniteList;
export const useAdmissions = baseHooks.useList;
export const useAdmission = baseHooks.useDetail;
export const useAdmissionMutations = baseHooks.useMutations;
export const useAdmissionBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Specialized Mutations (status machine + documents)
// =====================================================

function useInvalidateAdmissions() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: admissionKeys.all });
    queryClient.invalidateQueries({ queryKey: userKeys.all });
    queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    // O avanço de etapa cria o exame admissional no servidor — sem isto o
    // ExamCard continua mostrando "Agendar exame" sobre um ASO que já existe.
    queryClient.invalidateQueries({ queryKey: medicalExamKeys.all });
  };
}

/** PUT /admissions/:id/advance — advances the status machine (or cancels). */
export function useAdmissionAdvance() {
  const invalidate = useInvalidateAdmissions();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: AdmissionAdvanceFormData }) => advanceAdmission(id, data ?? {}),
    onSuccess: invalidate,
  });
}

/** POST /admissions/:id/documents — multipart upload (field "file" + type/note). */
export function useAdmissionDocumentUpload() {
  const invalidate = useInvalidateAdmissions();
  return useMutation({
    mutationFn: ({ id, data, file }: { id: string; data: AdmissionDocumentUploadFormData; file: File | File[] }) => uploadAdmissionDocument(id, data, file),
    onSuccess: invalidate,
  });
}

/** PUT /admissions/documents/:documentId — status/required/note/expiresAt. */
export function useAdmissionDocumentUpdate() {
  const invalidate = useInvalidateAdmissions();
  return useMutation({
    mutationFn: ({ documentId, data }: { documentId: string; data: AdmissionDocumentUpdateFormData }) => updateAdmissionDocument(documentId, data),
    onSuccess: invalidate,
  });
}

// =====================================================
// Documentação do colaborador (by-user)
// =====================================================

/**
 * GET /admissions/by-user/:userId — admissão (1:1) do colaborador com o
 * checklist de documentos. data é null quando ainda não existe admissão.
 */
export function useAdmissionByUser(userId: string | undefined, params?: any, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...admissionKeys.all, "by-user", userId, params] as const,
    queryFn: () => getAdmissionByUser(userId!, params),
    enabled: !!userId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * POST /admissions/by-user/:userId/documents — upload pelo userId; o servidor
 * cria a admissão (DOCS_PENDING + checklist padrão) quando ainda não existe.
 */
export function useAdmissionDocumentUploadByUser() {
  const invalidate = useInvalidateAdmissions();
  return useMutation({
    mutationFn: ({ userId, data, file }: { userId: string; data: AdmissionDocumentUploadFormData; file: File | File[] }) => uploadAdmissionDocumentByUser(userId, data, file),
    onSuccess: invalidate,
  });
}
