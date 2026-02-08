// packages/hooks/src/useRepresentative.ts

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { representativeService } from "../../services/representativeService";
import type {
  Representative,
  RepresentativeCreateFormData,
  RepresentativeUpdateFormData,
  RepresentativeGetManyFormData,
  RepresentativeGetManyResponse,
} from "../../types/representative";
import { representativeKeys, customerKeys, taskKeys, changeLogKeys } from "../common/query-keys";

// =====================================================
// Representative Service Adapter
// =====================================================

const representativeServiceAdapter = {
  getMany: (params?: RepresentativeGetManyFormData) => representativeService.getAll(params),
  getById: (id: string, include?: any) => representativeService.getById(id),
  create: (data: RepresentativeCreateFormData) => representativeService.create(data),
  update: (id: string, data: RepresentativeUpdateFormData) => representativeService.update(id, data),
  delete: (id: string) => representativeService.delete(id),
  batchCreate: (data: RepresentativeCreateFormData[]) => representativeService.batchCreate(data),
  batchUpdate: (updates: Array<{ id: string; data: RepresentativeUpdateFormData }>) => representativeService.batchUpdate(updates),
  batchDelete: (ids: string[]) => representativeService.batchDelete(ids),
};

// =====================================================
// List Hook
// =====================================================

export function useRepresentatives(
  params?: Partial<RepresentativeGetManyFormData>,
  options?: Omit<UseQueryOptions<RepresentativeGetManyResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: representativeKeys.list(params),
    queryFn: () => representativeServiceAdapter.getMany(params as RepresentativeGetManyFormData),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  });
}

// =====================================================
// Infinite List Hook
// =====================================================

export function useRepresentativesInfinite(
  params?: Partial<RepresentativeGetManyFormData>,
  options?: any,
) {
  return useInfiniteQuery({
    queryKey: representativeKeys.list(params),
    queryFn: async ({ pageParam = 1 }) => {
      const queryParams = {
        ...params,
        page: pageParam,
        pageSize: params?.pageSize || 40,
      } as RepresentativeGetManyFormData;
      return representativeServiceAdapter.getMany(queryParams);
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.meta) return undefined;
      const { page, pageCount } = lastPage.meta;
      return page < pageCount ? page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

// =====================================================
// Detail Hook
// =====================================================

export function useRepresentative(
  id: string,
  options?: Omit<UseQueryOptions<Representative>, "queryKey" | "queryFn"> & { include?: any },
) {
  const { include, ...queryOptions } = options || {};

  return useQuery({
    queryKey: representativeKeys.detail(id, include),
    queryFn: () => representativeServiceAdapter.getById(id, include),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    ...queryOptions,
  });
}

// =====================================================
// By Customer Hook
// =====================================================

export function useRepresentativesByCustomer(
  customerId: string,
  options?: Omit<UseQueryOptions<Representative[]>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: representativeKeys.byCustomer(customerId),
    queryFn: () => representativeService.getByCustomer(customerId),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

// =====================================================
// Mutations Hook
// =====================================================

export function useRepresentativeMutations() {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: representativeKeys.all });
    queryClient.invalidateQueries({ queryKey: customerKeys.all });
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
    queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
  };

  const createMutation = useMutation({
    mutationFn: (data: RepresentativeCreateFormData) => representativeServiceAdapter.create(data),
    onSuccess: invalidateQueries,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RepresentativeUpdateFormData }) =>
      representativeServiceAdapter.update(id, data),
    onSuccess: invalidateQueries,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => representativeServiceAdapter.delete(id),
    onSuccess: invalidateQueries,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => representativeService.toggleActive(id),
    onSuccess: invalidateQueries,
  });

  return {
    // Create
    create: createMutation.mutate,
    createAsync: createMutation.mutateAsync,
    createMutation,

    // Update
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    updateMutation,

    // Delete
    delete: deleteMutation.mutate,
    deleteAsync: deleteMutation.deleteAsync,
    deleteMutation,

    // Toggle Active
    toggleActive: toggleActiveMutation.mutate,
    toggleActiveAsync: toggleActiveMutation.mutateAsync,
    toggleActiveMutation,

    // Common
    isLoading:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      toggleActiveMutation.isPending,
    error:
      createMutation.error ||
      updateMutation.error ||
      deleteMutation.error ||
      toggleActiveMutation.error,
    refresh: invalidateQueries,
  };
}

// =====================================================
// Batch Mutations Hook
// =====================================================

export function useRepresentativeBatchMutations() {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: representativeKeys.all });
    queryClient.invalidateQueries({ queryKey: customerKeys.all });
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
    queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
  };

  const batchCreateMutation = useMutation({
    mutationFn: (data: RepresentativeCreateFormData[]) => representativeServiceAdapter.batchCreate(data),
    onSuccess: invalidateQueries,
  });

  const batchUpdateMutation = useMutation({
    mutationFn: (updates: Array<{ id: string; data: RepresentativeUpdateFormData }>) =>
      representativeServiceAdapter.batchUpdate(updates),
    onSuccess: invalidateQueries,
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => representativeServiceAdapter.batchDelete(ids),
    onSuccess: invalidateQueries,
  });

  return {
    // Batch Create
    batchCreate: batchCreateMutation.mutate,
    batchCreateAsync: batchCreateMutation.mutateAsync,
    batchCreateMutation,

    // Batch Update
    batchUpdate: batchUpdateMutation.mutate,
    batchUpdateAsync: batchUpdateMutation.mutateAsync,
    batchUpdateMutation,

    // Batch Delete
    batchDelete: batchDeleteMutation.mutate,
    batchDeleteAsync: batchDeleteMutation.mutateAsync,
    batchDeleteMutation,

    // Common
    isLoading:
      batchCreateMutation.isPending ||
      batchUpdateMutation.isPending ||
      batchDeleteMutation.isPending,
    error:
      batchCreateMutation.error ||
      batchUpdateMutation.error ||
      batchDeleteMutation.error,
  };
}

// =====================================================
// Combined Operations Hook
// =====================================================

export function useRepresentativeOperations() {
  const mutations = useRepresentativeMutations();
  const batchMutations = useRepresentativeBatchMutations();

  return {
    // Single operations
    create: mutations.create,
    createAsync: mutations.createAsync,
    update: mutations.update,
    updateAsync: mutations.updateAsync,
    delete: mutations.delete,
    deleteAsync: mutations.deleteAsync,
    toggleActive: mutations.toggleActive,
    toggleActiveAsync: mutations.toggleActiveAsync,

    // Batch operations
    batchCreate: batchMutations.batchCreate,
    batchCreateAsync: batchMutations.batchCreateAsync,
    batchUpdate: batchMutations.batchUpdate,
    batchUpdateAsync: batchMutations.batchUpdateAsync,
    batchDelete: batchMutations.batchDelete,
    batchDeleteAsync: batchMutations.batchDeleteAsync,

    // Common
    isLoading: mutations.isLoading || batchMutations.isLoading,
    error: mutations.error || batchMutations.error,
    refresh: mutations.refresh,
  };
}

// =====================================================
// Legacy Exports (for backwards compatibility)
// =====================================================

export function useCreateRepresentative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RepresentativeCreateFormData) => representativeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: representativeKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

export function useUpdateRepresentative(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RepresentativeUpdateFormData) => representativeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: representativeKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: representativeKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

export function useDeleteRepresentative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => representativeService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: representativeKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

export function useToggleRepresentativeActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => representativeService.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: representativeKeys.all });
    },
  });
}
