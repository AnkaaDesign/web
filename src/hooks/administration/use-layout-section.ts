// packages/hooks/src/useLayoutSection.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { layoutSectionService } from "../../api-client";
import type { LayoutSectionCreateInput, LayoutSectionUpdateInput } from "../../types";

// Query keys
export const layoutSectionQueryKeys = {
  all: ["layoutSections"] as const,
  byLayout: (layoutId: string) => ["layoutSections", "layout", layoutId] as const,
  detail: (id: string) => ["layoutSections", "detail", id] as const,
};

// Get sections by layout ID
export const useLayoutSections = (
  layoutId: string,
  options?: {
    enabled?: boolean;
  },
) => {
  return useQuery({
    queryKey: layoutSectionQueryKeys.byLayout(layoutId),
    queryFn: async () => {
      const response = await layoutSectionService.getByLayoutId(layoutId, {
        orderBy: { position: "asc" }, // Always order by position
      });
      return response.data;
    },
    enabled: options?.enabled !== false && !!layoutId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get layout section by ID
export const useLayoutSectionDetail = (
  id: string,
  options?: {
    enabled?: boolean;
  },
) => {
  return useQuery({
    queryKey: layoutSectionQueryKeys.detail(id),
    queryFn: async () => {
      const response = await layoutSectionService.getById(id);
      return response.data;
    },
    enabled: options?.enabled !== false && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Layout section mutations
export const useLayoutSectionMutations = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: LayoutSectionCreateInput & { layoutId: string }) => layoutSectionService.create(data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: layoutSectionQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: layoutSectionQueryKeys.byLayout(variables.layoutId),
      });
      // Also invalidate the layout detail query as sections count might have changed
      queryClient.invalidateQueries({
        queryKey: ["layouts", "detail", variables.layoutId],
      });
      return response;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: LayoutSectionUpdateInput }) => layoutSectionService.update(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: layoutSectionQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: layoutSectionQueryKeys.detail(variables.id),
      });
      // Get layout ID from cache to invalidate related queries
      const sectionData = queryClient.getQueryData(layoutSectionQueryKeys.detail(variables.id));
      if (sectionData && typeof sectionData === 'object' && 'layoutId' in sectionData) {
        queryClient.invalidateQueries({
          queryKey: layoutSectionQueryKeys.byLayout(sectionData.layoutId as string),
        });
        queryClient.invalidateQueries({
          queryKey: ["layouts", "detail", sectionData.layoutId],
        });
      }
      return response;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: layoutSectionService.delete,
    onSuccess: (_, sectionId) => {
      queryClient.invalidateQueries({ queryKey: layoutSectionQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: layoutSectionQueryKeys.detail(sectionId),
      });

      // Invalidate all layout sections queries since we don't know which layout this section belonged to
      queryClient.invalidateQueries({
        queryKey: ["layoutSections"],
      });
      queryClient.invalidateQueries({
        queryKey: ["layouts"],
      });

      toast.success("Seção excluída com sucesso");
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || "Erro ao excluir seção";
      toast.error(message);
    },
  });

  // Batch operations
  const batchCreateMutation = useMutation({
    mutationFn: layoutSectionService.batchCreate,
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: layoutSectionQueryKeys.all });

      // Invalidate layout queries for all affected layouts
      const layoutIds = new Set(variables.map(item => item.layoutId));
      layoutIds.forEach(layoutId => {
        queryClient.invalidateQueries({
          queryKey: layoutSectionQueryKeys.byLayout(layoutId),
        });
        queryClient.invalidateQueries({
          queryKey: ["layouts", "detail", layoutId],
        });
      });

      return response;
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: layoutSectionService.batchDelete,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: layoutSectionQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ["layouts"] });
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