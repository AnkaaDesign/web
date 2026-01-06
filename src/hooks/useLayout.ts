// packages/hooks/src/useLayout.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { layoutService } from "../api-client";
import type { LayoutCreateFormData, LayoutUpdateFormData } from "../schemas";

// Query keys
export const layoutQueryKeys = {
  all: ["layouts"] as const,
  detail: (id: string) => ["layouts", "detail", id] as const,
  byTruck: (truckId: string) => ["layouts", "truck", truckId] as const,
};

// Get layout by ID
export const useLayoutDetail = (
  id: string,
  options?: {
    include?: any;
    enabled?: boolean;
  },
) => {
  return useQuery({
    queryKey: layoutQueryKeys.detail(id),
    queryFn: async () => {
      const response = await layoutService.getById(id, {
        include: options?.include,
      });
      return response.data;
    },
    enabled: options?.enabled !== false && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get layouts by truck ID
export const useLayoutsByTruck = (truckId: string, enabled = true) => {
  return useQuery({
    queryKey: layoutQueryKeys.byTruck(truckId),
    queryFn: async () => {
      const response = await layoutService.getByTruckId(truckId);
      const layoutsData = response.data.data;

      // If layouts exist, fetch each one with sections included
      const fetchWithSections = async (layout: any) => {
        if (!layout?.id) return layout;
        try {
          const detailResponse = await layoutService.getById(layout.id, {
            include: { layoutSections: true, photo: true }
          });
          return detailResponse.data.data;
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[useLayoutsByTruck] Error fetching layout details:', error);
          }
          return layout; // Return original if fetch fails
        }
      };

      const [leftSideLayout, rightSideLayout, backSideLayout] = await Promise.all([
        fetchWithSections(layoutsData.leftSideLayout),
        fetchWithSections(layoutsData.rightSideLayout),
        fetchWithSections(layoutsData.backSideLayout),
      ]);

      return {
        leftSideLayout,
        rightSideLayout,
        backSideLayout,
      };
    },
    enabled: enabled && !!truckId,
    staleTime: 5 * 60 * 1000,
  });
};

// Layout mutations
export const useLayoutMutations = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: layoutService.create,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: layoutQueryKeys.all });
      return response;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: LayoutUpdateFormData }) => layoutService.update(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: layoutQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: layoutQueryKeys.detail(variables.id),
      });
      return response;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: layoutService.delete,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: layoutQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: layoutQueryKeys.detail(id),
      });
      toast.success("Layout excluído com sucesso");
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || "Erro ao excluir layout";
      toast.error(message);
    },
  });

  const createOrUpdateTruckLayoutMutation = useMutation({
    mutationFn: ({ truckId, side, data }: { truckId: string; side: "left" | "right" | "back"; data: LayoutCreateFormData }) =>
      layoutService.createOrUpdateTruckLayout(truckId, side, data),
    onSuccess: async (response, variables) => {
      // Use refetchQueries to immediately refetch and get fresh data
      await queryClient.refetchQueries({
        queryKey: layoutQueryKeys.byTruck(variables.truckId),
        exact: true
      });
      queryClient.invalidateQueries({ queryKey: layoutQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: ["trucks", "detail", variables.truckId],
      });
      return response;
    },
  });

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    createOrUpdateTruckLayout: createOrUpdateTruckLayoutMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSavingTruckLayout: createOrUpdateTruckLayoutMutation.isPending,
  };
};

// Download SVG
export const useLayoutSVGDownload = () => {
  const downloadSVG = async (id: string, filename?: string) => {
    try {
      await layoutService.downloadSVG(id, filename);
      toast.success("SVG baixado com sucesso");
    } catch (error: any) {
      const message = error?.response?.data?.message || "Erro ao baixar SVG";
      toast.error(message);
    }
  };

  return { downloadSVG };
};
