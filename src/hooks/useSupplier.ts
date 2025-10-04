// packages/hooks/src/useSupplier.ts

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier, batchCreateSuppliers, batchUpdateSuppliers, batchDeleteSuppliers } from "../api-client";
import type {
  SupplierGetManyFormData,
  SupplierGetByIdFormData,
  SupplierCreateFormData,
  SupplierUpdateFormData,
  SupplierQueryFormData,
  SupplierBatchCreateFormData,
  SupplierBatchUpdateFormData,
  SupplierBatchDeleteFormData,
} from "../schemas";
import { supplierKeys, itemKeys, orderKeys, orderScheduleKeys, fileKeys, changeLogKeys } from "./queryKeys";

// ===============================================
// SUPPLIER HOOKS
// ===============================================

// -------------------------------------
// PARAM TYPES
// -------------------------------------
interface UseSuppliersParams extends Partial<SupplierGetManyFormData> {
  enabled?: boolean;
}

interface UseSupplierDetailParams extends Omit<SupplierGetByIdFormData, "id"> {
  enabled?: boolean;
}

// -------------------------------------
// INFINITE LIST HOOK
// -------------------------------------
export const useSuppliersInfinite = (params?: Partial<SupplierGetManyFormData>) => {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: supplierKeys.list(params),
    queryFn: async ({ pageParam = 1 }) => {
      return getSuppliers({
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
      queryKey: supplierKeys.list(params),
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
export function useSuppliers(params?: UseSuppliersParams) {
  const queryClient = useQueryClient();
  const { enabled = true, ...restParams } = params ?? {};

  const query = useQuery({
    queryKey: supplierKeys.list(restParams),
    queryFn: () => getSuppliers(restParams),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: supplierKeys.list(restParams),
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
export function useSupplierDetail(id: string, params?: UseSupplierDetailParams) {
  const queryClient = useQueryClient();
  const { enabled = true, ...restParams } = params ?? {};

  const query = useQuery({
    queryKey: supplierKeys.detail(id, restParams),
    queryFn: () => getSupplierById(id, restParams),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: supplierKeys.detail(id, restParams),
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
export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SupplierCreateFormData) => createSupplier(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: supplierKeys.all,
      });

      // Invalidate statistics
      queryClient.invalidateQueries({
        queryKey: supplierKeys.statistics(),
      });

      // Invalidate change logs
      queryClient.invalidateQueries({
        queryKey: changeLogKeys.all,
      });

      // Invalidate file queries if supplier has logoId
      if (response.data?.logoId) {
        queryClient.invalidateQueries({
          queryKey: fileKeys.detail(response.data.logoId),
        });
      }
    },
  });
}

// -------------------------------------
// UPDATE MUTATION
// -------------------------------------
export function useUpdateSupplier(id: string, queryParams?: SupplierQueryFormData) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SupplierUpdateFormData) => updateSupplier(id, data, queryParams),
    onSuccess: (response) => {
      // Invalidate all supplier detail queries for this ID (with any include params)
      queryClient.invalidateQueries({
        queryKey: supplierKeys.details(),
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "suppliers" && key[1] === "detail" && key[2] === id;
        },
      });

      queryClient.invalidateQueries({
        queryKey: supplierKeys.all,
      });

      // Invalidate statistics
      queryClient.invalidateQueries({
        queryKey: supplierKeys.statistics(),
      });

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: itemKeys.bySupplier(id),
      });
      queryClient.invalidateQueries({
        queryKey: orderKeys.bySupplier(id),
      });
      queryClient.invalidateQueries({
        queryKey: orderScheduleKeys.bySupplier(id),
      });

      // Invalidate change logs
      queryClient.invalidateQueries({
        queryKey: changeLogKeys.all,
      });

      // Invalidate file queries if supplier has logoId
      if (response.data?.logoId) {
        queryClient.invalidateQueries({
          queryKey: fileKeys.detail(response.data.logoId),
        });
      }
    },
  });
}

// -------------------------------------
// DELETE MUTATION
// -------------------------------------
export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: supplierKeys.all,
      });

      // Invalidate statistics
      queryClient.invalidateQueries({
        queryKey: supplierKeys.statistics(),
      });

      // Invalidate related entities
      queryClient.invalidateQueries({
        queryKey: itemKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: orderKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: orderScheduleKeys.all,
      });

      // Invalidate change logs
      queryClient.invalidateQueries({
        queryKey: changeLogKeys.all,
      });

      // Invalidate file queries since supplier might have had a logo
      queryClient.invalidateQueries({
        queryKey: fileKeys.all,
      });
    },
  });
}

// -------------------------------------
// BATCH CREATE MUTATION
// -------------------------------------
export function useBatchCreateSuppliers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SupplierBatchCreateFormData) => batchCreateSuppliers(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: supplierKeys.all,
      });

      // Invalidate statistics
      queryClient.invalidateQueries({
        queryKey: supplierKeys.statistics(),
      });

      // Invalidate change logs
      queryClient.invalidateQueries({
        queryKey: changeLogKeys.all,
      });

      // Invalidate file queries for suppliers with logos
      if (response.data?.success) {
        const logoIds = new Set(response.data.success.map((supplier) => supplier.logoId).filter(Boolean));

        logoIds.forEach((logoId) => {
          if (logoId) {
            queryClient.invalidateQueries({
              queryKey: fileKeys.detail(logoId),
            });
          }
        });
      }
    },
  });
}

// -------------------------------------
// BATCH UPDATE MUTATION
// -------------------------------------
export function useBatchUpdateSuppliers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SupplierBatchUpdateFormData) => batchUpdateSuppliers(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: supplierKeys.all,
      });

      // Invalidate statistics
      queryClient.invalidateQueries({
        queryKey: supplierKeys.statistics(),
      });

      // Invalidate detail queries and related entities for updated suppliers
      if (response.data?.success) {
        const logoIds = new Set<string>();

        response.data.success.forEach((supplier) => {
          queryClient.invalidateQueries({
            queryKey: supplierKeys.detail(supplier.id),
          });

          // Invalidate related queries
          queryClient.invalidateQueries({
            queryKey: itemKeys.bySupplier(supplier.id),
          });
          queryClient.invalidateQueries({
            queryKey: orderKeys.bySupplier(supplier.id),
          });
          queryClient.invalidateQueries({
            queryKey: orderScheduleKeys.bySupplier(supplier.id),
          });

          if (supplier.logoId) {
            logoIds.add(supplier.logoId);
          }
        });

        // Invalidate file queries for logos
        logoIds.forEach((logoId) => {
          queryClient.invalidateQueries({
            queryKey: fileKeys.detail(logoId),
          });
        });
      }

      // Invalidate change logs
      queryClient.invalidateQueries({
        queryKey: changeLogKeys.all,
      });
    },
  });
}

// -------------------------------------
// BATCH DELETE MUTATION
// -------------------------------------
export function useBatchDeleteSuppliers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SupplierBatchDeleteFormData) => batchDeleteSuppliers(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: supplierKeys.all,
      });

      // Invalidate statistics
      queryClient.invalidateQueries({
        queryKey: supplierKeys.statistics(),
      });

      // Invalidate related entities
      queryClient.invalidateQueries({
        queryKey: itemKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: orderKeys.all,
      });
      queryClient.invalidateQueries({
        queryKey: orderScheduleKeys.all,
      });

      // Invalidate change logs
      queryClient.invalidateQueries({
        queryKey: changeLogKeys.all,
      });

      // Invalidate file queries since suppliers might have had logos
      queryClient.invalidateQueries({
        queryKey: fileKeys.all,
      });
    },
  });
}

// -------------------------------------
// CONVENIENCE MUTATION HOOKS
// -------------------------------------
export function useSupplierMutations() {
  return {
    create: useCreateSupplier(),
    update: useUpdateSupplier,
    delete: useDeleteSupplier(),
  };
}

export function useSupplierBatchMutations() {
  return {
    create: useBatchCreateSuppliers(),
    update: useBatchUpdateSuppliers(),
    delete: useBatchDeleteSuppliers(),
  };
}
