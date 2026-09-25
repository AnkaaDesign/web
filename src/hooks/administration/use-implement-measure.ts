// packages/hooks/src/useImplementMeasure.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { implementMeasureService } from "../../api-client";
import type { ImplementMeasureCreateFormData, ImplementMeasureUpdateFormData } from "../../schemas";
import { implementKeys, taskKeys } from "../common/query-keys";
import type { ImplementFace } from "@/constants/implement-faces";

// Query keys
export const implementMeasureQueryKeys = {
  all: ["implementMeasures"] as const,
  detail: (id: string) => ["implementMeasures", "detail", id] as const,
  byImplement: (implementId: string) => ["implementMeasures", "implement", implementId] as const,
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

type MeasuresByImplement = { leftSideMeasure: any; rightSideMeasure: any; backSideMeasure: any };

// Get implement measures by truck ID
export const useImplementMeasuresByImplement = (
  implementId: string,
  options?: {
    enabled?: boolean;
    includePhoto?: boolean;  // Only include photo when needed (e.g., library view)
  }
) => {
  const enabled = options?.enabled ?? true;
  const includePhoto = options?.includePhoto ?? false;

  return useQuery({
    queryKey: [...implementMeasureQueryKeys.byImplement(implementId), { includePhoto }],
    queryFn: async () => {
      // Single API call - backend now returns everything needed for previews
      // Only includes photo if explicitly requested
      const response = await implementMeasureService.getByImplementId(implementId, { includePhoto });
      // A API sempre devolve as seções de cada face (o repositório as inclui) e
      // `null` na face sem medida. Havia aqui um recuo para uma "versão antiga da
      // API" que buscava as seções medida a medida e remontava a resposta só com
      // as 3 faces que conhecia — a face nova sumiria ali em silêncio. Saiu.
      //
      // O tipo continua o que os consumidores sempre enxergaram: o recuo devolvia
      // `any` por face, e a prévia/edição leem `sections` e `photo` sem checar
      // (a API os manda). Retipar com o tipo da resposta é do P20.
      return response.data.data as MeasuresByImplement;
    },
    enabled: enabled && !!implementId,
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

  const createOrUpdateImplementMeasureMutation = useMutation({
    mutationFn: ({ implementId, side, data }: { implementId: string; side: ImplementFace; data: ImplementMeasureCreateFormData }) =>
      implementMeasureService.createOrUpdateImplementMeasure(implementId, side, data),
    onSuccess: async (response, variables) => {
      // Use refetchQueries to immediately refetch and get fresh data
      await queryClient.refetchQueries({
        queryKey: implementMeasureQueryKeys.byImplement(variables.implementId),
        exact: true
      });
      queryClient.invalidateQueries({ queryKey: implementMeasureQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: implementKeys.detail(variables.implementId),
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
    createOrUpdateImplementMeasure: createOrUpdateImplementMeasureMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSavingImplementMeasure: createOrUpdateImplementMeasureMutation.isPending,
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
