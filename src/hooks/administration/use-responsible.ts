// packages/hooks/src/useResponsible.ts

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { responsibleService } from "../../services/responsibleService";
import type {
  Responsible,
  ResponsibleCreateFormData,
  ResponsibleUpdateFormData,
  ResponsibleGetManyFormData,
  ResponsibleGetManyResponse,
} from "../../types/responsible";
import { responsibleKeys, customerKeys, taskKeys, changeLogKeys } from "../common/query-keys";

// =====================================================
// Responsible Service Adapter
// =====================================================

const responsibleServiceAdapter = {
  getMany: (params?: ResponsibleGetManyFormData) => responsibleService.getAll(params),
  getById: (id: string, _include?: any) => responsibleService.getById(id),
  create: (data: ResponsibleCreateFormData) => responsibleService.create(data),
  update: (id: string, data: ResponsibleUpdateFormData) => responsibleService.update(id, data),
  delete: (id: string) => responsibleService.delete(id),
  batchCreate: (data: ResponsibleCreateFormData[]) => responsibleService.batchCreate(data),
  batchUpdate: (updates: Array<{ id: string; data: ResponsibleUpdateFormData }>) => responsibleService.batchUpdate(updates),
  batchDelete: (ids: string[]) => responsibleService.batchDelete(ids),
};

// =====================================================
// List Hook
// =====================================================

export function useResponsibles(
  params?: Partial<ResponsibleGetManyFormData>,
  options?: Omit<UseQueryOptions<ResponsibleGetManyResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: responsibleKeys.list(params),
    queryFn: () => responsibleServiceAdapter.getMany(params as ResponsibleGetManyFormData),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  });
}

// =====================================================
// Infinite List Hook
// =====================================================

export function useResponsiblesInfinite(
  params?: Partial<ResponsibleGetManyFormData>,
  options?: any,
) {
  return useInfiniteQuery({
    queryKey: responsibleKeys.list(params),
    queryFn: async ({ pageParam = 1 }) => {
      const queryParams = {
        ...params,
        page: pageParam,
        pageSize: params?.pageSize || 40,
      } as ResponsibleGetManyFormData;
      return responsibleServiceAdapter.getMany(queryParams);
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

export function useResponsible(
  id: string,
  options?: Omit<UseQueryOptions<Responsible>, "queryKey" | "queryFn"> & { include?: any },
) {
  const { include, ...queryOptions } = options || {};

  return useQuery({
    queryKey: responsibleKeys.detail(id, include),
    queryFn: () => responsibleServiceAdapter.getById(id, include),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    ...queryOptions,
  });
}

// =====================================================
// By Company Hook
// =====================================================

export function useResponsiblesByCompany(
  companyId: string,
  options?: Omit<UseQueryOptions<Responsible[]>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: responsibleKeys.byCompany(companyId),
    queryFn: () => responsibleService.getByCompany(companyId),
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

// =====================================================
// Mutations Hook
// =====================================================

export function useResponsibleMutations() {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: responsibleKeys.all });
    queryClient.invalidateQueries({ queryKey: customerKeys.all });
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
    queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
  };

  const createMutation = useMutation({
    mutationFn: (data: ResponsibleCreateFormData) => responsibleServiceAdapter.create(data),
    onSuccess: invalidateQueries,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ResponsibleUpdateFormData }) =>
      responsibleServiceAdapter.update(id, data),
    onSuccess: invalidateQueries,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => responsibleServiceAdapter.delete(id),
    onSuccess: invalidateQueries,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => responsibleService.toggleActive(id),
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
    deleteAsync: deleteMutation.mutateAsync,
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

export function useResponsibleBatchMutations() {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: responsibleKeys.all });
    queryClient.invalidateQueries({ queryKey: customerKeys.all });
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
    queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
  };

  const batchCreateMutation = useMutation({
    mutationFn: (data: ResponsibleCreateFormData[]) => responsibleServiceAdapter.batchCreate(data),
    onSuccess: invalidateQueries,
  });

  const batchUpdateMutation = useMutation({
    mutationFn: (updates: Array<{ id: string; data: ResponsibleUpdateFormData }>) =>
      responsibleServiceAdapter.batchUpdate(updates),
    onSuccess: invalidateQueries,
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => responsibleServiceAdapter.batchDelete(ids),
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

export function useResponsibleOperations() {
  const mutations = useResponsibleMutations();
  const batchMutations = useResponsibleBatchMutations();

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

export function useCreateResponsible() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ResponsibleCreateFormData) => responsibleService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: responsibleKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

export function useUpdateResponsible(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ResponsibleUpdateFormData) => responsibleService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: responsibleKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: responsibleKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

export function useDeleteResponsible() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => responsibleService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: responsibleKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: changeLogKeys.all });
    },
  });
}

export function useToggleResponsibleActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => responsibleService.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: responsibleKeys.all });
    },
  });
}
