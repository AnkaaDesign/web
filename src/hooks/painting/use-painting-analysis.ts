// packages/hooks/src/painting/usePaintingAnalysis.ts

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addPaintingAnalysisFace,
  computePaintingAnalysis,
  createPaintingAnalysis,
  deletePaintingAnalysis,
  deletePaintingAnalysisFace,
  getPaintingAnalyses,
  getPaintingAnalysisById,
  getPaintingConfig,
  processPaintingAnalysis,
  resolvePaintingAlert,
  updatePaintingAnalysis,
  updatePaintingAnalysisFace,
  updatePaintingBoundary,
  updatePaintingConfigIndirect,
  updatePaintingConfigProcessParams,
  updatePaintingConfigRate,
  updatePaintingConfigRule,
  updatePaintingConfigPaintSystem,
  updatePaintingRegion,
  updatePaintingStep,
  updatePaintingStepMaterial,
  updatePaintingStepTask,
} from "../../api-client";
import type {
  PaintingAnalysisComputeFormData,
  PaintingAnalysisCreateFormData,
  PaintingAnalysisFaceCreateFormData,
  PaintingAnalysisFaceUpdateFormData,
  PaintingAnalysisGetManyFormData,
  PaintingAnalysisProcessFormData,
  PaintingAnalysisUpdateFormData,
  PaintingBoundaryUpdateFormData,
  PaintingIndirectUpdateFormData,
  PaintingProcessParamsUpdateFormData,
  PaintingRateUpdateFormData,
  PaintingRegionUpdateFormData,
  PaintingRuleUpdateFormData,
  PaintingStepUpdateFormData,
  PaintingStepTaskUpdateFormData,
  PaintingStepMaterialUpdateFormData,
  PaintingPaintSystemUpdateFormData,
} from "../../types";

// =====================================================
// Query Keys
// =====================================================

export const paintingAnalysisKeys = {
  all: ["paintingAnalyses"] as const,
  lists: () => ["paintingAnalyses", "list"] as const,
  list: (params?: PaintingAnalysisGetManyFormData) => ["paintingAnalyses", "list", params ?? {}] as const,
  details: () => ["paintingAnalyses", "detail"] as const,
  detail: (id?: string) => ["paintingAnalyses", "detail", id ?? null] as const,
  config: () => ["paintingAnalyses", "config"] as const,
};

// =====================================================
// Queries
// =====================================================

export function usePaintingAnalyses(params?: PaintingAnalysisGetManyFormData) {
  return useQuery({
    queryKey: paintingAnalysisKeys.list(params),
    queryFn: () => getPaintingAnalyses(params ?? {}),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
  });
}

/**
 * Full analysis detail. While the engine is running (status === PROCESSING) the query
 * polls every 3s so the page flips to REVIEW/FAILED without a manual refresh.
 */
export function usePaintingAnalysisDetail(id?: string) {
  return useQuery({
    queryKey: paintingAnalysisKeys.detail(id),
    queryFn: () => getPaintingAnalysisById(id as string),
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.data?.status === "PROCESSING" ? 3000 : false),
  });
}

export function usePaintingConfig() {
  return useQuery({
    queryKey: paintingAnalysisKeys.config(),
    queryFn: () => getPaintingConfig(),
    staleTime: 1000 * 60 * 5,
  });
}

// =====================================================
// Analysis Mutations
// =====================================================

export function usePaintingAnalysisMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: paintingAnalysisKeys.all });

  const createMutation = useMutation({
    mutationFn: (data: PaintingAnalysisCreateFormData) => createPaintingAnalysis(data),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PaintingAnalysisUpdateFormData }) => updatePaintingAnalysis(id, data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePaintingAnalysis(id),
    onSuccess: invalidate,
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
  };
}

// =====================================================
// Face Mutations
// =====================================================

export function useAddPaintingAnalysisFace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ analysisId, data }: { analysisId: string; data: PaintingAnalysisFaceCreateFormData }) => addPaintingAnalysisFace(analysisId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paintingAnalysisKeys.all }),
  });
}

export function useUpdatePaintingAnalysisFace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ faceId, data }: { faceId: string; data: PaintingAnalysisFaceUpdateFormData }) => updatePaintingAnalysisFace(faceId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paintingAnalysisKeys.all }),
  });
}

export function useDeletePaintingAnalysisFace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (faceId: string) => deletePaintingAnalysisFace(faceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paintingAnalysisKeys.all }),
  });
}

// =====================================================
// Processing / Compute Mutations
// =====================================================

/** Kicks the async image pipeline (202). The detail query polls while PROCESSING. */
export function useProcessPaintingAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: PaintingAnalysisProcessFormData }) => processPaintingAnalysis(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paintingAnalysisKeys.all }),
  });
}

/** Recomputes independent business stages (MATCH / STRATEGY / PLAN) synchronously. */
export function useComputePaintingAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: PaintingAnalysisComputeFormData }) => computePaintingAnalysis(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paintingAnalysisKeys.all }),
  });
}

// =====================================================
// Region / Boundary / Step / Alert Mutations
// =====================================================

export function useUpdatePaintingRegion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ regionId, data }: { regionId: string; data: PaintingRegionUpdateFormData }) => updatePaintingRegion(regionId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paintingAnalysisKeys.details() }),
  });
}

export function useUpdatePaintingBoundary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ boundaryId, data }: { boundaryId: string; data: PaintingBoundaryUpdateFormData }) => updatePaintingBoundary(boundaryId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paintingAnalysisKeys.details() }),
  });
}

export function useUpdatePaintingStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ stepId, data }: { stepId: string; data: PaintingStepUpdateFormData }) => updatePaintingStep(stepId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paintingAnalysisKeys.details() }),
  });
}

/** Minutos de UMA sub-tarefa; a API recalcula o passo e os totais do plano. */
export function useUpdatePaintingStepTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: PaintingStepTaskUpdateFormData }) => updatePaintingStepTask(taskId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paintingAnalysisKeys.details() }),
  });
}

/** Quantidade/valor de uma linha de material; a API recalcula passo e plano. */
export function useUpdatePaintingStepMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ materialId, data }: { materialId: string; data: PaintingStepMaterialUpdateFormData }) =>
      updatePaintingStepMaterial(materialId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paintingAnalysisKeys.details() }),
  });
}

export function useResolvePaintingAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: string) => resolvePaintingAlert(alertId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paintingAnalysisKeys.details() }),
  });
}

// =====================================================
// Config Mutations
// =====================================================

export function usePaintingConfigMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: paintingAnalysisKeys.config() });

  const updateRateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PaintingRateUpdateFormData }) => updatePaintingConfigRate(id, data),
    onSuccess: invalidate,
  });

  const updateIndirectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PaintingIndirectUpdateFormData }) => updatePaintingConfigIndirect(id, data),
    onSuccess: invalidate,
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PaintingRuleUpdateFormData }) => updatePaintingConfigRule(id, data),
    onSuccess: invalidate,
  });

  const updateProcessParamsMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PaintingProcessParamsUpdateFormData }) => updatePaintingConfigProcessParams(id, data),
    onSuccess: invalidate,
  });

  const updatePaintSystemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PaintingPaintSystemUpdateFormData }) => updatePaintingConfigPaintSystem(id, data),
    onSuccess: invalidate,
  });

  return { updateRateMutation, updateIndirectMutation, updateRuleMutation, updateProcessParamsMutation, updatePaintSystemMutation };
}
