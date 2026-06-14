// packages/hooks/src/useLeaves.ts
// Afastamentos (Medicina do Trabalho)

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getLeaves, getLeaveById, createLeave, updateLeave, deleteLeave, finishLeave, getLeavePayrollSplit, uploadLeaveFiles, batchCreateLeaves, batchUpdateLeaves, batchDeleteLeaves } from "../../api-client/leave";
import type { LeaveGetManyFormData, LeaveCreateFormData, LeaveUpdateFormData, LeaveBatchCreateFormData, LeaveBatchUpdateFormData, LeaveBatchDeleteFormData } from "../../schemas/leave";
import type {
  Leave,
  LeaveGetManyResponse,
  LeaveGetUniqueResponse,
  LeaveCreateResponse,
  LeaveUpdateResponse,
  LeaveDeleteResponse,
  LeaveBatchCreateResponse,
  LeaveBatchUpdateResponse,
  LeaveBatchDeleteResponse,
} from "../../types/leave";
import { leaveKeys, changeLogKeys } from "../common/query-keys";
import { createEntityHooks } from "../common/create-entity-hooks";

// =====================================================
// Leave Service Adapter
// =====================================================

const leaveServiceAdapter = {
  getMany: getLeaves,
  getById: getLeaveById,
  create: createLeave,
  update: updateLeave,
  delete: deleteLeave,
  batchCreate: batchCreateLeaves,
  batchUpdate: batchUpdateLeaves,
  batchDelete: batchDeleteLeaves,
};

// =====================================================
// Base Leave Hooks
// =====================================================

const baseHooks = createEntityHooks<
  LeaveGetManyFormData,
  LeaveGetManyResponse,
  LeaveGetUniqueResponse,
  LeaveCreateFormData,
  LeaveCreateResponse,
  LeaveUpdateFormData,
  LeaveUpdateResponse,
  LeaveDeleteResponse,
  LeaveBatchCreateFormData,
  LeaveBatchCreateResponse<Leave>,
  LeaveBatchUpdateFormData,
  LeaveBatchUpdateResponse<Leave>,
  LeaveBatchDeleteFormData,
  LeaveBatchDeleteResponse
>({
  queryKeys: leaveKeys,
  service: leaveServiceAdapter,
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// Export base hooks with standard names
export const useLeavesInfinite = baseHooks.useInfiniteList;
export const useLeaves = baseHooks.useList;
export const useLeave = baseHooks.useDetail;
export const useLeaveMutations = baseHooks.useMutations;
export const useLeaveBatchMutations = baseHooks.useBatchMutations;

// Legacy alias
export { useLeave as useLeaveDetail };

// =====================================================
// Specialized Hooks
// =====================================================

// Finalização do afastamento (→ COMPLETED, data de retorno efetiva)
export function useFinishLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actualEndDate, include }: { id: string; actualEndDate: Date; include?: any }) => finishLeave(id, { actualEndDate }, include ? { include } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

// Upload de arquivos (atestados etc.) — multipart "files", até 10 por requisição
export function useUploadLeaveFiles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, files, include }: { id: string; files: globalThis.File[]; include?: any }) => uploadLeaveFiles(id, files, include ? { include } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

// GET :id/payroll-split — primeiros 15 dias empregador / 16º dia INSS (Part E).
export function useLeavePayrollSplit(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...leaveKeys.detail(id), "payroll-split"] as const,
    queryFn: () => getLeavePayrollSplit(id),
    enabled: (options?.enabled ?? true) && !!id,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });
}
