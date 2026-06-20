// packages/hooks/src/useWarehouseLocation.ts

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWarehouseLocations,
  getWarehouseLocationById,
  createWarehouseLocation,
  updateWarehouseLocation,
  deleteWarehouseLocation,
  batchCreateWarehouseLocations,
  batchUpdateWarehouseLocations,
  batchDeleteWarehouseLocations,
} from "../../api-client";
import type {
  WarehouseLocationGetManyFormData,
  WarehouseLocationGetByIdFormData,
  WarehouseLocationCreateFormData,
  WarehouseLocationUpdateFormData,
  WarehouseLocationQueryFormData,
  WarehouseLocationBatchCreateFormData,
  WarehouseLocationBatchUpdateFormData,
  WarehouseLocationBatchDeleteFormData,
} from "../../schemas";
import { warehouseLocationKeys, itemKeys, changeLogKeys } from "../common/query-keys";

// ===============================================
// WAREHOUSE LOCATION HOOKS
// ===============================================

// -------------------------------------
// PARAM TYPES
// -------------------------------------
interface UseWarehouseLocationsParams extends Partial<WarehouseLocationGetManyFormData> {
  enabled?: boolean;
}

interface UseWarehouseLocationDetailParams extends Omit<WarehouseLocationGetByIdFormData, "id"> {
  enabled?: boolean;
}

// -------------------------------------
// INFINITE LIST HOOK
// -------------------------------------
export const useWarehouseLocationsInfinite = (params?: Partial<WarehouseLocationGetManyFormData>) => {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: warehouseLocationKeys.list(params),
    queryFn: async ({ pageParam = 1 }) => {
      return getWarehouseLocations({
        ...params,
        page: pageParam,
        limit: params?.limit || 40,
      });
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.meta) return undefined;
      return lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: warehouseLocationKeys.list(params),
    });
  };

  return {
    ...query,
    refresh,
  };
};

// -------------------------------------
// STANDARD LIST HOOK
// -------------------------------------
export function useWarehouseLocations(params?: UseWarehouseLocationsParams) {
  const queryClient = useQueryClient();
  const { enabled = true, ...restParams } = params ?? {};

  const query = useQuery({
    queryKey: warehouseLocationKeys.list(restParams),
    queryFn: () => getWarehouseLocations(restParams),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: warehouseLocationKeys.list(restParams),
    });
  };

  return {
    ...query,
    refresh,
  };
}

// -------------------------------------
// DETAIL HOOK
// -------------------------------------
export function useWarehouseLocationDetail(id: string, params?: UseWarehouseLocationDetailParams) {
  const queryClient = useQueryClient();
  const { enabled = true, ...restParams } = params ?? {};

  const query = useQuery({
    queryKey: warehouseLocationKeys.detail(id, restParams),
    queryFn: () => getWarehouseLocationById(id, restParams),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: warehouseLocationKeys.detail(id, restParams),
    });
  };

  return {
    ...query,
    refresh,
  };
}

// -------------------------------------
// CREATE MUTATION
// -------------------------------------
export function useCreateWarehouseLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WarehouseLocationCreateFormData) => createWarehouseLocation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

// -------------------------------------
// UPDATE MUTATION
// -------------------------------------
export function useUpdateWarehouseLocation(id: string, queryParams?: WarehouseLocationQueryFormData) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WarehouseLocationUpdateFormData) => updateWarehouseLocation(id, data, queryParams),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: warehouseLocationKeys.details(),
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "warehouseLocations" && key[1] === "detail" && key[2] === id;
        },
      });
      queryClient.invalidateQueries({ queryKey: warehouseLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

// -------------------------------------
// DELETE MUTATION
// -------------------------------------
export function useDeleteWarehouseLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteWarehouseLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

// -------------------------------------
// BATCH CREATE MUTATION
// -------------------------------------
export function useBatchCreateWarehouseLocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WarehouseLocationBatchCreateFormData) => batchCreateWarehouseLocations(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

// -------------------------------------
// BATCH UPDATE MUTATION
// -------------------------------------
export function useBatchUpdateWarehouseLocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WarehouseLocationBatchUpdateFormData) => batchUpdateWarehouseLocations(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: warehouseLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });

      if (response.data?.success) {
        response.data.success.forEach((location) => {
          queryClient.invalidateQueries({ queryKey: warehouseLocationKeys.detail(location.id) });
        });
      }

      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

// -------------------------------------
// BATCH DELETE MUTATION
// -------------------------------------
export function useBatchDeleteWarehouseLocations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WarehouseLocationBatchDeleteFormData) => batchDeleteWarehouseLocations(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warehouseLocationKeys.all });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

// -------------------------------------
// CONVENIENCE MUTATION HOOKS
// -------------------------------------
export function useWarehouseLocationMutations() {
  return {
    create: useCreateWarehouseLocation(),
    update: useUpdateWarehouseLocation,
    delete: useDeleteWarehouseLocation(),
  };
}

export function useWarehouseLocationBatchMutations() {
  return {
    create: useBatchCreateWarehouseLocations(),
    update: useBatchUpdateWarehouseLocations(),
    delete: useBatchDeleteWarehouseLocations(),
  };
}
