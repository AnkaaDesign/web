// packages/hooks/src/useImplementMeasureSection.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { implementMeasureSectionService } from "../../api-client";
import type { ImplementMeasureSectionCreateInput, ImplementMeasureSectionUpdateInput } from "../../types";

// Query keys
export const implementMeasureSectionQueryKeys = {
  all: ["implementMeasureSections"] as const,
  byImplementMeasure: (implementMeasureId: string) => ["implementMeasureSections", "implementMeasure", implementMeasureId] as const,
  detail: (id: string) => ["implementMeasureSections", "detail", id] as const,
};

// Get sections by implement measure ID
export const useImplementMeasureSections = (
  implementMeasureId: string,
  options?: {
    enabled?: boolean;
  },
) => {
  return useQuery({
    queryKey: implementMeasureSectionQueryKeys.byImplementMeasure(implementMeasureId),
    queryFn: async () => {
      const response = await implementMeasureSectionService.getByImplementMeasureId(implementMeasureId, {
        orderBy: { position: "asc" }, // Always order by position
      });
      return response.data;
    },
    enabled: options?.enabled !== false && !!implementMeasureId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get implement measure section by ID
export const useImplementMeasureSectionDetail = (
  id: string,
  options?: {
    enabled?: boolean;
  },
) => {
  return useQuery({
    queryKey: implementMeasureSectionQueryKeys.detail(id),
    queryFn: async () => {
      const response = await implementMeasureSectionService.getById(id);
      return response.data;
    },
    enabled: options?.enabled !== false && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Implement measure section mutations
export const useImplementMeasureSectionMutations = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: ImplementMeasureSectionCreateInput & { implementMeasureId: string }) => implementMeasureSectionService.create(data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: implementMeasureSectionQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: implementMeasureSectionQueryKeys.byImplementMeasure(variables.implementMeasureId),
      });
      // Also invalidate the implement measure detail query as sections count might have changed
      queryClient.invalidateQueries({
        queryKey: ["implementMeasures", "detail", variables.implementMeasureId],
      });
      return response;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ImplementMeasureSectionUpdateInput }) => implementMeasureSectionService.update(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: implementMeasureSectionQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: implementMeasureSectionQueryKeys.detail(variables.id),
      });
      // Get implement measure ID from cache to invalidate related queries
      const sectionData = queryClient.getQueryData(implementMeasureSectionQueryKeys.detail(variables.id));
      if (sectionData && typeof sectionData === 'object' && 'implementMeasureId' in sectionData) {
        queryClient.invalidateQueries({
          queryKey: implementMeasureSectionQueryKeys.byImplementMeasure(sectionData.implementMeasureId as string),
        });
        queryClient.invalidateQueries({
          queryKey: ["implementMeasures", "detail", sectionData.implementMeasureId],
        });
      }
      return response;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: implementMeasureSectionService.delete,
    onSuccess: (_, sectionId) => {
      queryClient.invalidateQueries({ queryKey: implementMeasureSectionQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: implementMeasureSectionQueryKeys.detail(sectionId),
      });

      // Invalidate all implement measure sections queries since we don't know which measure this section belonged to
      queryClient.invalidateQueries({
        queryKey: ["implementMeasureSections"],
      });
      queryClient.invalidateQueries({
        queryKey: ["implementMeasures"],
      });
    },
  });

  // Batch operations
  const batchCreateMutation = useMutation({
    mutationFn: implementMeasureSectionService.batchCreate,
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: implementMeasureSectionQueryKeys.all });

      // Invalidate implement measure queries for all affected measures
      const implementMeasureIds = new Set(variables.map(item => item.implementMeasureId));
      implementMeasureIds.forEach(implementMeasureId => {
        queryClient.invalidateQueries({
          queryKey: implementMeasureSectionQueryKeys.byImplementMeasure(implementMeasureId),
        });
        queryClient.invalidateQueries({
          queryKey: ["implementMeasures", "detail", implementMeasureId],
        });
      });

      return response;
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: implementMeasureSectionService.batchDelete,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: implementMeasureSectionQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ["implementMeasures"] });
      toast.success(`${response.data.totalSuccess} seções excluídas com sucesso`);
      return response;
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || "Erro ao excluir seções em lote";
      toast.error(message);
    },
  });

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    batchCreate: batchCreateMutation.mutateAsync,
    batchDelete: batchDeleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isBatchCreating: batchCreateMutation.isPending,
    isBatchDeleting: batchDeleteMutation.isPending,
  };
};
