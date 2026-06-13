// packages/hooks/src/useMedicalExams.ts
// ASO / Exames ocupacionais (Medicina do Trabalho)

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMedicalExams,
  getMedicalExamById,
  getExpiringMedicalExams,
  createMedicalExam,
  updateMedicalExam,
  deleteMedicalExam,
  completeMedicalExam,
  uploadMedicalExamDocument,
  batchCreateMedicalExams,
  batchUpdateMedicalExams,
  batchDeleteMedicalExams,
} from "../../api-client/medical-exam";
import type { MedicalExamGetManyFormData, MedicalExamCreateFormData, MedicalExamUpdateFormData, MedicalExamCompleteFormData, MedicalExamBatchCreateFormData, MedicalExamBatchUpdateFormData, MedicalExamBatchDeleteFormData } from "../../schemas/medical-exam";
import type {
  MedicalExam,
  MedicalExamGetManyResponse,
  MedicalExamGetUniqueResponse,
  MedicalExamCreateResponse,
  MedicalExamUpdateResponse,
  MedicalExamDeleteResponse,
  MedicalExamBatchCreateResponse,
  MedicalExamBatchUpdateResponse,
  MedicalExamBatchDeleteResponse,
} from "../../types/medical-exam";
import { medicalExamKeys, changeLogKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// MedicalExam Service Adapter
// =====================================================

const medicalExamServiceAdapter = {
  getMany: getMedicalExams,
  getById: getMedicalExamById,
  create: createMedicalExam,
  update: updateMedicalExam,
  delete: deleteMedicalExam,
  batchCreate: batchCreateMedicalExams,
  batchUpdate: batchUpdateMedicalExams,
  batchDelete: batchDeleteMedicalExams,
};

// =====================================================
// Base MedicalExam Hooks
// =====================================================

const baseHooks = createEntityHooks<
  MedicalExamGetManyFormData,
  MedicalExamGetManyResponse,
  MedicalExamGetUniqueResponse,
  MedicalExamCreateFormData,
  MedicalExamCreateResponse,
  MedicalExamUpdateFormData,
  MedicalExamUpdateResponse,
  MedicalExamDeleteResponse,
  MedicalExamBatchCreateFormData,
  MedicalExamBatchCreateResponse<MedicalExam>,
  MedicalExamBatchUpdateFormData,
  MedicalExamBatchUpdateResponse<MedicalExam>,
  MedicalExamBatchDeleteFormData,
  MedicalExamBatchDeleteResponse
>({
  queryKeys: medicalExamKeys,
  service: medicalExamServiceAdapter,
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// Export base hooks with standard names
export const useMedicalExamsInfinite = baseHooks.useInfiniteList;
export const useMedicalExams = baseHooks.useList;
export const useMedicalExam = baseHooks.useDetail;
export const useMedicalExamMutations = baseHooks.useMutations;
export const useMedicalExamBatchMutations = baseHooks.useBatchMutations;

// Legacy alias
export { useMedicalExam as useMedicalExamDetail };

// =====================================================
// Specialized Hooks
// =====================================================

// Exames Periódicos dashboard: COMPLETED exams expiring within N days (or overdue)
export function useExpiringMedicalExams(days: number = 60, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: medicalExamKeys.expiring(days),
    queryFn: () => getExpiringMedicalExams(days),
    staleTime: 1000 * 60 * 5,
    retry: 2,
    enabled: options?.enabled ?? true,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: medicalExamKeys.expiring(days) });
  };

  return { ...query, refresh };
}

// Conclusão do exame (SCHEDULED → COMPLETED)
export function useCompleteMedicalExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data, include }: { id: string; data: MedicalExamCompleteFormData; include?: any }) => completeMedicalExam(id, data, include ? { include } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalExamKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

// Upload do documento ASO (multipart "document")
export function useUploadMedicalExamDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file, include }: { id: string; file: globalThis.File; include?: any }) => uploadMedicalExamDocument(id, file, include ? { include } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: medicalExamKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}
