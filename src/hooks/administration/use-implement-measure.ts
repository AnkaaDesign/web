// packages/hooks/src/useImplementMeasure.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { implementMeasureService } from "../../api-client";
import type { ImplementMeasureCreateFormData, ImplementMeasureUpdateFormData } from "../../schemas";
import { taskKeys } from "../common/query-keys";

// Query keys
export const implementMeasureQueryKeys = {
  all: ["implementMeasures"] as const,
  detail: (id: string) => ["implementMeasures", "detail", id] as const,
  byTruck: (truckId: string) => ["implementMeasures", "truck", truckId] as const,
};

// Get implement measure by ID
export const useImplementMeasureDetail = (
  id: string,
  options?: {
    include?: any;
    enabled?: boolean;
  },
) => {
  return useQuery({
    queryKey: implementMeasureQueryKeys.detail(id),
    queryFn: async () => {
      const response = await implementMeasureService.getById(id, {
        include: options?.include,
      });
      return response.data;
    },
    enabled: options?.enabled !== false && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get implement measures by truck ID
export const useImplementMeasuresByTruck = (
  truckId: string,
  options?: {
    enabled?: boolean;
    includePhoto?: boolean;  // Only include photo when needed (e.g., library view)
  }
) => {
  const enabled = options?.enabled ?? true;
  const includePhoto = options?.includePhoto ?? false;

  return useQuery({
    queryKey: [...implementMeasureQueryKeys.byTruck(truckId), { includePhoto }],
    queryFn: async () => {
      // Single API call - backend now returns everything needed for previews
      // Only includes photo if explicitly requested
      const response = await implementMeasureService.getByTruckId(truckId, { includePhoto });
      const measuresData = response.data.data;

      // If backend already includes sections (which it should after our fix),
      // we don't need additional fetches
      if (measuresData.leftSideMeasure?.sections ||
          measuresData.rightSideMeasure?.sections ||
          measuresData.backSideMeasure?.sections) {
        return measuresData;
      }

      // Fallback: If sections aren't included (old API version),
      // fetch them separately but without photos for preview
      const fetchWithSections = async (measure: any) => {
        if (!measure?.id) return measure;
        try {
          const detailResponse = await implementMeasureService.getById(measure.id, {
            include: {
              sections: true,
              ...(includePhoto && { photo: true })
            }
          });
          return detailResponse.data.data;
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[useImplementMeasuresByTruck] Error fetching implement measure details:', error);
          }
          return measure;
        }
      };

      const [leftSideMeasure, rightSideMeasure, backSideMeasure] = await Promise.all([
        fetchWithSections(measuresData.leftSideMeasure),
        fetchWithSections(measuresData.rightSideMeasure),
        fetchWithSections(measuresData.backSideMeasure),
      ]);

      return {
        leftSideMeasure,
        rightSideMeasure,
        backSideMeasure,
      };
    },
    enabled: enabled && !!truckId,
    staleTime: 5 * 60 * 1000,
  });
};

// Implement measure mutations
export const useImplementMeasureMutations = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: implementMeasureService.create,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: implementMeasureQueryKeys.all });
      // Implement measures are embedded in the task detail (truck measures) — refresh tasks too.
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      return response;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ImplementMeasureUpdateFormData }) => implementMeasureService.update(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: implementMeasureQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: implementMeasureQueryKeys.detail(variables.id),
      });
      // Implement measures are embedded in the task detail (truck measures) — refresh tasks too.
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      return response;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: implementMeasureService.delete,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: implementMeasureQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: implementMeasureQueryKeys.detail(id),
      });
      // Implement measures are embedded in the task detail (truck measures) — refresh tasks too.
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });

  const createOrUpdateTruckMeasureMutation = useMutation({
    mutationFn: ({ truckId, side, data }: { truckId: string; side: "left" | "right" | "back"; data: ImplementMeasureCreateFormData }) =>
      implementMeasureService.createOrUpdateTruckMeasure(truckId, side, data),
    onSuccess: async (response, variables) => {
      // Use refetchQueries to immediately refetch and get fresh data
      await queryClient.refetchQueries({
        queryKey: implementMeasureQueryKeys.byTruck(variables.truckId),
        exact: true
      });
      queryClient.invalidateQueries({ queryKey: implementMeasureQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: ["trucks", "detail", variables.truckId],
      });
      // Implement measures are embedded in the task detail (truck measures) — refresh tasks too.
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      return response;
    },
  });

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    createOrUpdateTruckMeasure: createOrUpdateTruckMeasureMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSavingTruckMeasure: createOrUpdateTruckMeasureMutation.isPending,
  };
};

// Download SVG
export const useImplementMeasureSVGDownload = () => {
  const downloadSVG = async (id: string, filename?: string) => {
    try {
      await implementMeasureService.downloadSVG(id, filename);
      // Success feedback for the local file download (GET is not toasted by the interceptor).
      toast.success("SVG baixado com sucesso");
    } catch {
      // Error toast handled by the axios interceptor.
    }
  };

  return { downloadSVG };
};
