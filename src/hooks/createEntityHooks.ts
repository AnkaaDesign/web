// packages/hooks/src/createEntityHooks.ts

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions, UseInfiniteQueryOptions } from "@tanstack/react-query";

// =====================================================
// Types
// =====================================================

export interface EntityService<
  TGetManyParams,
  TGetManyResponse,
  TGetByIdResponse,
  TCreateData,
  TCreateResponse,
  TUpdateData,
  TUpdateResponse,
  TDeleteResponse,
  TBatchCreateData,
  TBatchCreateResponse,
  TBatchUpdateData,
  TBatchUpdateResponse,
  TBatchDeleteData,
  TBatchDeleteResponse,
> {
  // Query methods
  getMany: (params?: TGetManyParams) => Promise<TGetManyResponse>;
  getById: (id: string, include?: any) => Promise<TGetByIdResponse>;

  // CRUD methods
  create: (data: TCreateData, include?: any) => Promise<TCreateResponse>;
  update: (id: string, data: TUpdateData, include?: any) => Promise<TUpdateResponse>;
  delete: (id: string) => Promise<TDeleteResponse>;

  // Batch methods
  batchCreate: (data: TBatchCreateData, include?: any) => Promise<TBatchCreateResponse>;
  batchUpdate: (data: TBatchUpdateData, include?: any) => Promise<TBatchUpdateResponse>;
  batchDelete: (data: TBatchDeleteData) => Promise<TBatchDeleteResponse>;
}

export interface QueryKeys {
  all: readonly string[];
  lists: () => readonly unknown[];
  list: (filters?: any) => readonly unknown[];
  details: () => readonly unknown[];
  detail: (id: string, include?: any) => readonly unknown[];
  byIds: (ids: string[]) => readonly unknown[];
}

export interface EntityHooksConfig<
  TGetManyParams,
  TGetManyResponse,
  TGetByIdResponse,
  TCreateData,
  TCreateResponse,
  TUpdateData,
  TUpdateResponse,
  TDeleteResponse,
  TBatchCreateData,
  TBatchCreateResponse,
  TBatchUpdateData,
  TBatchUpdateResponse,
  TBatchDeleteData,
  TBatchDeleteResponse,
> {
  queryKeys: QueryKeys;
  service: EntityService<
    TGetManyParams,
    TGetManyResponse,
    TGetByIdResponse,
    TCreateData,
    TCreateResponse,
    TUpdateData,
    TUpdateResponse,
    TDeleteResponse,
    TBatchCreateData,
    TBatchCreateResponse,
    TBatchUpdateData,
    TBatchUpdateResponse,
    TBatchDeleteData,
    TBatchDeleteResponse
  >;
  staleTime?: number;
  cacheTime?: number;
  // Additional query keys to invalidate on mutations
  relatedQueryKeys?: QueryKeys[];
}

// =====================================================
// Hook Factory
// =====================================================

export function createEntityHooks<
  TGetManyParams extends Record<string, any>,
  TGetManyResponse extends { meta?: { page: number; hasNextPage: boolean } },
  TGetByIdResponse,
  TCreateData,
  TCreateResponse,
  TUpdateData,
  TUpdateResponse,
  TDeleteResponse,
  TBatchCreateData,
  TBatchCreateResponse,
  TBatchUpdateData,
  TBatchUpdateResponse,
  TBatchDeleteData,
  TBatchDeleteResponse,
>(
  config: EntityHooksConfig<
    TGetManyParams,
    TGetManyResponse,
    TGetByIdResponse,
    TCreateData,
    TCreateResponse,
    TUpdateData,
    TUpdateResponse,
    TDeleteResponse,
    TBatchCreateData,
    TBatchCreateResponse,
    TBatchUpdateData,
    TBatchUpdateResponse,
    TBatchDeleteData,
    TBatchDeleteResponse
  >,
) {
  const { queryKeys, service, staleTime = 1000 * 60 * 5, relatedQueryKeys = [] } = config;

  // -------------------------------------
  // List Hook with Infinite Query
  // -------------------------------------
  function useInfiniteList(
    params?: Partial<TGetManyParams>,
    options?: Omit<UseInfiniteQueryOptions<TGetManyResponse>, "queryKey" | "queryFn" | "getNextPageParam" | "initialPageParam">,
  ) {
    const queryClient = useQueryClient();

    const query = useInfiniteQuery({
      queryKey: queryKeys.list(params),
      queryFn: async ({ pageParam = 1 }) => {
        const queryParams = {
          ...params,
          page: pageParam,
          limit: (params as any)?.limit || 40,
        } as unknown as TGetManyParams;
        return service.getMany(queryParams);
      },
      getNextPageParam: (lastPage) => {
        if (!lastPage.meta) return undefined;
        return lastPage.meta.hasNextPage ? lastPage.meta.page + 1 : undefined;
      },
      initialPageParam: 1,
      staleTime,
      ...options, // Allow overriding default options
    });

    const refresh = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.list(params),
      });
    };

    return {
      ...query,
      refresh,
    };
  }

  // -------------------------------------
  // Standard List Hook
  // -------------------------------------
  function useList(params?: Partial<TGetManyParams>, options?: Omit<UseQueryOptions<TGetManyResponse>, "queryKey" | "queryFn">) {
    const queryClient = useQueryClient();

    const query = useQuery({
      queryKey: queryKeys.list(params),
      queryFn: () => service.getMany(params as TGetManyParams),
      staleTime,
      retry: 2,
      ...options, // Allow overriding default options
    });

    const refresh = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.list(params),
      });
    };

    return {
      ...query,
      refresh,
    };
  }

  // -------------------------------------
  // Detail Hook
  // -------------------------------------
  function useDetail(
    id: string,
    options?: {
      enabled?: boolean;
      include?: any;
    } & Omit<UseQueryOptions<TGetByIdResponse>, "queryKey" | "queryFn">,
  ) {
    const queryClient = useQueryClient();
    const { enabled = true, include, ...queryOptions } = options || {};

    const query = useQuery({
      queryKey: queryKeys.detail(id, include),
      queryFn: () => {
        // Wrap include in an object as the service expects { include: ... }
        const params = include ? { include } : undefined;
        console.log('[createEntityHooks] useDetail - include:', JSON.stringify(include, null, 2));
        console.log('[createEntityHooks] useDetail - params:', JSON.stringify(params, null, 2));
        return service.getById(id, params);
      },
      enabled: enabled && !!id,
      staleTime,
      retry: 2,
      ...queryOptions,
    });

    const refresh = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.detail(id, include),
      });
    };

    return {
      ...query,
      refresh,
    };
  }

  // -------------------------------------
  // CRUD Mutations Hook
  // -------------------------------------
  function useMutations(options?: {
    onCreateSuccess?: (data: TCreateResponse, variables: TCreateData) => void;
    onUpdateSuccess?: (data: TUpdateResponse, variables: { id: string; data: TUpdateData }) => void;
    onDeleteSuccess?: (data: TDeleteResponse, variables: string) => void;
  }) {
    const queryClient = useQueryClient();

    const invalidateQueries = () => {
      // Invalidate main entity queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.all,
      });

      // Invalidate related queries
      relatedQueryKeys.forEach((keys) => {
        queryClient.invalidateQueries({
          queryKey: keys.all,
        });
      });
    };

    // CREATE
    const createMutation = useMutation({
      mutationFn: ({ data, include }: { data: TCreateData; include?: any }) => {
        if (process.env.NODE_ENV === "development") {
          console.log("=== CREATE MUTATION DEBUG ===");
          console.log("Mutation data:", JSON.stringify(data, null, 2));
          console.log("Mutation include:", JSON.stringify(include, null, 2));
        }
        return service.create(data, include);
      },
      onSuccess: (data, variables) => {
        if (process.env.NODE_ENV === "development") {
          console.log("=== CREATE MUTATION SUCCESS ===");
          console.log("Response data:", data);
        }
        invalidateQueries();
        options?.onCreateSuccess?.(data, variables.data);
      },
      onError: (error) => {
        if (process.env.NODE_ENV === "development") {
          console.error("=== CREATE MUTATION ERROR ===");
          console.error("Error in mutation:", error);
        }
      },
    });

    // UPDATE
    const updateMutation = useMutation({
      mutationFn: ({ id, data, include }: { id: string; data: TUpdateData; include?: any }) => service.update(id, data, include),
      onSuccess: (data, variables) => {
        invalidateQueries();
        // Also invalidate the specific detail query
        queryClient.invalidateQueries({
          queryKey: queryKeys.details(),
        });
        options?.onUpdateSuccess?.(data, { id: variables.id, data: variables.data });
      },
    });

    // DELETE
    const deleteMutation = useMutation({
      mutationFn: (id: string) => service.delete(id),
      onSuccess: (data, variables) => {
        invalidateQueries();
        options?.onDeleteSuccess?.(data, variables);
      },
    });

    const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

    const error = createMutation.error || updateMutation.error || deleteMutation.error;

    return {
      create: (data: TCreateData, include?: any) => createMutation.mutate({ data, include }),
      createAsync: (data: TCreateData, include?: any) => createMutation.mutateAsync({ data, include }),
      update: ({ id, data, include }: { id: string; data: TUpdateData; include?: any }) => updateMutation.mutate({ id, data, include }),
      updateAsync: ({ id, data, include }: { id: string; data: TUpdateData; include?: any }) => updateMutation.mutateAsync({ id, data, include }),
      delete: deleteMutation.mutate,
      deleteAsync: deleteMutation.mutateAsync,
      remove: deleteMutation.mutate, // Alias for delete
      isLoading,
      isCreating: createMutation.isPending,
      isUpdating: updateMutation.isPending,
      isDeleting: deleteMutation.isPending,
      error,
      refresh: invalidateQueries,
      // Individual mutation states
      createMutation,
      updateMutation,
      deleteMutation,
    };
  }

  // -------------------------------------
  // Batch Mutations Hook
  // -------------------------------------
  function useBatchMutations(options?: {
    onBatchCreateSuccess?: (data: TBatchCreateResponse, variables: TBatchCreateData) => void;
    onBatchUpdateSuccess?: (data: TBatchUpdateResponse, variables: TBatchUpdateData) => void;
    onBatchDeleteSuccess?: (data: TBatchDeleteResponse, variables: TBatchDeleteData) => void;
  }) {
    const queryClient = useQueryClient();

    const invalidateQueries = () => {
      // Invalidate main entity queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.all,
      });

      // Invalidate related queries
      relatedQueryKeys.forEach((keys) => {
        queryClient.invalidateQueries({
          queryKey: keys.all,
        });
      });
    };

    // BATCH CREATE
    const batchCreateMutation = useMutation({
      mutationFn: ({ data, include }: { data: TBatchCreateData; include?: any }) => service.batchCreate(data, include),
      onSuccess: (data, variables) => {
        invalidateQueries();
        options?.onBatchCreateSuccess?.(data, variables.data);
      },
    });

    // BATCH UPDATE
    const batchUpdateMutation = useMutation({
      mutationFn: ({ data, include }: { data: TBatchUpdateData; include?: any }) => {
        if (process.env.NODE_ENV === "development") {
          console.log("=== HOOKS LAYER DEBUGGING ===");
          console.log("Step 8 - Hook mutationFn received data:", JSON.stringify(data, null, 2));
          console.log("Step 9 - Hook mutationFn received include:", JSON.stringify(include, null, 2));
          console.log("Step 10 - Calling service.batchUpdate...");
        }
        return service.batchUpdate(data, include);
      },
      onSuccess: (data, variables) => {
        if (process.env.NODE_ENV === "development") {
          console.log("Step 11 - Hook onSuccess received data:", JSON.stringify(data, null, 2));
          console.log("Step 12 - Hook onSuccess received variables:", JSON.stringify(variables, null, 2));
        }
        invalidateQueries();
        options?.onBatchUpdateSuccess?.(data, variables.data);
      },
      onError: (error, variables) => {
        if (process.env.NODE_ENV === "development") {
          console.error("Step 13 - Hook onError received error:", error);
          console.error("Step 14 - Hook onError received variables:", JSON.stringify(variables, null, 2));
        }
      },
    });

    // BATCH DELETE
    const batchDeleteMutation = useMutation({
      mutationFn: (data: TBatchDeleteData) => service.batchDelete(data),
      onSuccess: (data, variables) => {
        invalidateQueries();
        options?.onBatchDeleteSuccess?.(data, variables);
      },
    });

    const isLoading = batchCreateMutation.isPending || batchUpdateMutation.isPending || batchDeleteMutation.isPending;

    const error = batchCreateMutation.error || batchUpdateMutation.error || batchDeleteMutation.error;

    return {
      batchCreate: (data: TBatchCreateData, include?: any) => batchCreateMutation.mutate({ data, include }),
      batchCreateAsync: (data: TBatchCreateData, include?: any) => batchCreateMutation.mutateAsync({ data, include }),
      batchUpdate: (data: TBatchUpdateData, include?: any) => batchUpdateMutation.mutate({ data, include }),
      batchUpdateAsync: (data: TBatchUpdateData, include?: any) => batchUpdateMutation.mutateAsync({ data, include }),
      batchDelete: batchDeleteMutation.mutate,
      batchDeleteAsync: batchDeleteMutation.mutateAsync,
      isLoading,
      isBatchCreating: batchCreateMutation.isPending,
      isBatchUpdating: batchUpdateMutation.isPending,
      isBatchDeleting: batchDeleteMutation.isPending,
      error,
      refresh: invalidateQueries,
      // Individual mutation states
      batchCreateMutation,
      batchUpdateMutation,
      batchDeleteMutation,
    };
  }

  return {
    useInfiniteList,
    useList,
    useDetail,
    useMutations,
    useBatchMutations,
  };
}

// =====================================================
// Specialized Hook Factory
// =====================================================

export interface SpecializedQueryConfig<TParams, TResponse> {
  queryKeyFn: (params: TParams) => readonly unknown[];
  queryFn: (params: TParams) => Promise<TResponse>;
  staleTime?: number;
}

export function createSpecializedQueryHook<TParams, TResponse>(config: SpecializedQueryConfig<TParams, TResponse>) {
  const { queryKeyFn, queryFn, staleTime = 1000 * 60 * 5 } = config;

  return function useSpecializedQuery(params: TParams, options?: { enabled?: boolean } & Omit<UseQueryOptions<TResponse>, "queryKey" | "queryFn">) {
    const queryClient = useQueryClient();
    const { enabled = true, ...queryOptions } = options || {};

    const query = useQuery({
      queryKey: queryKeyFn(params),
      queryFn: () => queryFn(params),
      enabled,
      staleTime,
      retry: 2,
      ...queryOptions,
    });

    const refresh = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeyFn(params),
      });
    };

    return {
      ...query,
      refresh,
    };
  };
}
