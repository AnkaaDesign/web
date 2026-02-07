// packages/hooks/src/bonus.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bonusService, type BonusCalculationResult } from "../api-client";
import { bonusKeys, userKeys } from "./query-keys";
import { createEntityHooks } from "./create-entity-hooks";
import { toast } from "sonner";

// Import proper types from packages
import type {
  Bonus,
  BonusIncludes,
  BonusGetManyParams,
  BonusGetManyResponse,
  BonusGetByIdParams,
  BonusFiltersData,
  BonusListParams,
} from "../types";

import type {
  BonusCreateFormData,
  BonusUpdateFormData,
  PayrollGetParams,
} from "../schemas";

// Import payroll-specific types from api-client
import type { BonusPayrollParams, PayrollData, BonusDiscountCreateFormData } from "../api-client";

// =====================================================
// Re-export types for convenience
// =====================================================

export type {
  Bonus,
  BonusIncludes as BonusInclude,
  BonusGetManyParams,
  BonusCreateFormData,
  BonusUpdateFormData,
  PayrollGetParams,
  PayrollData,
  BonusDiscountCreateFormData,
  BonusCalculationResult,
  BonusFiltersData,
  BonusListParams,
};

// =====================================================
// Service Adapter for Entity Factory
// =====================================================

const bonusServiceAdapter = {
  getMany: (params?: BonusGetManyParams) =>
    bonusService.getMany(params).then(response => response.data),
  getById: (id: string, params?: BonusGetByIdParams) =>
    bonusService.getById(id, params).then(response => response.data),
  create: (data: BonusCreateFormData) =>
    bonusService.create(data).then(response => response.data),
  update: (id: string, data: BonusUpdateFormData) =>
    bonusService.update(id, data).then(response => response.data),
  delete: (id: string) =>
    bonusService.delete(id).then(() => undefined),
  batchCreate: (data: BonusCreateFormData[]) =>
    bonusService.batchCreate(data).then(response => response.data),
  batchUpdate: (data: { id: string; data: BonusUpdateFormData }[]) =>
    bonusService.batchUpdate(data).then(response => response.data),
  batchDelete: (ids: string[]) =>
    bonusService.batchDelete(ids).then(() => undefined),
};

// =====================================================
// Base Bonus Hooks using Entity Factory
// =====================================================

const baseHooks = createEntityHooks<
  BonusGetManyParams,
  BonusGetManyResponse,
  Bonus,
  BonusCreateFormData,
  Bonus,
  BonusUpdateFormData,
  Bonus,
  void, // Delete response
  BonusCreateFormData[],
  any, // Batch create response
  { id: string; data: BonusUpdateFormData }[],
  any, // Batch update response
  string[],
  void
>({
  queryKeys: bonusKeys,
  service: bonusServiceAdapter,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [userKeys],
});

// Export base hooks with standard names (matching usePayroll pattern)
export const useBonusesInfinite = baseHooks.useInfiniteList;
export const useBonuses = baseHooks.useList;
export const useBonus = baseHooks.useDetail;
export const useBonusMutations = baseHooks.useMutations;
export const useBonusBatchMutations = baseHooks.useBatchMutations;

// Backward compatibility alias
export const useBonusDetail = useBonus;

/**
 * Hook to manually trigger bonus calculation
 * Used by admins to save calculated bonuses to database
 * Includes optimistic updates for better UX
 *
 * @returns Mutation object with loading state and trigger function
 */
export const useCalculateBonuses = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { year: number; month: number }) => {
      return bonusService.calculateBonuses({
        year: params.year.toString(),
        month: params.month.toString()
      }).then(response => response.data);
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: bonusKeys.all });

      // Snapshot the previous value
      const previousBonuses = queryClient.getQueryData(bonusKeys.list());

      // Optimistically update - show loading state
      const monthName = new Date(variables.year, variables.month - 1).toLocaleDateString('pt-BR', { month: 'long' });
      toast.loading(`Calculando bônus de ${monthName}...`, { id: `calc-${variables.year}-${variables.month}` });

      return { previousBonuses };
    },
    onSuccess: (result: BonusCalculationResult, variables) => {
      // Invalidate all bonus-related queries
      queryClient.invalidateQueries({ queryKey: bonusKeys.all });
      queryClient.invalidateQueries({ queryKey: userKeys.all });

      const monthName = new Date(variables.year, variables.month - 1).toLocaleDateString('pt-BR', { month: 'long' });
      const successCount = result.data?.totalSuccess ?? 0;
      const failedCount = result.data?.totalFailed ?? 0;

      // Dismiss loading toast and show success
      toast.dismiss(`calc-${variables.year}-${variables.month}`);

      if (failedCount > 0) {
        toast.warning(`Bônus calculados: ${successCount} sucessos, ${failedCount} falhas`);
      } else {
        toast.success(`Bônus de ${monthName} calculados com sucesso! ${successCount} funcionários processados.`);
      }
    },
    onError: (error: any, variables, context) => {
      // Rollback optimistic update if needed
      if (context?.previousBonuses) {
        queryClient.setQueryData(bonusKeys.list(), context.previousBonuses);
      }

      // Dismiss loading toast and show error
      toast.dismiss(`calc-${variables.year}-${variables.month}`);
      const message = error?.response?.data?.message ?? 'Erro ao calcular bônus';
      toast.error(message);
    }
  });
};

// =====================================================
// Specialized Bonus Hooks
// =====================================================

/**
 * Hook to get bonuses by user
 */
export const useBonusByUser = (
  userId?: string | null,
  additionalParams?: Partial<BonusGetManyParams>,
  options?: { enabled?: boolean }
) => {
  const params: BonusGetManyParams = {
    ...additionalParams,
    where: {
      ...additionalParams?.where,
      userId: userId || undefined,
    },
    include: {
      user: true,
      ...additionalParams?.include,
    },
  };

  return useBonuses(params, {
    enabled: (options?.enabled ?? true) && !!userId,
  });
};

/**
 * Hook to get bonuses by period (year and month)
 */
export const useBonusByPeriod = (
  year: number,
  month?: number,
  additionalParams?: Partial<BonusGetManyParams>,
  options?: { enabled?: boolean }
) => {
  const params: BonusGetManyParams = {
    ...additionalParams,
    where: {
      ...additionalParams?.where,
      year: year,
      month: month,
    },
    include: {
      user: true,
      ...additionalParams?.include,
    },
    orderBy: additionalParams?.orderBy || { createdAt: 'desc' },
  };

  return useBonuses(params, {
    enabled: (options?.enabled ?? true) && !!year,
  });
};

/**
 * Hook to get bonus list with comprehensive filters
 * Similar to payroll list hook, supports all common filter types
 *
 * @param params - Filter parameters including year, months, performance levels, sectors, positions, users
 * @param options - Query options (enabled, refetch interval, etc.)
 *
 * @example
 * ```ts
 * const { data: bonuses, isLoading } = useBonusList({
 *   year: 2024,
 *   months: [1, 2, 3],
 *   performanceLevels: [4, 5],
 *   sectorIds: ['sector-1'],
 *   include: { user: true, tasks: true, bonusDiscounts: true }
 * });
 * ```
 */
export const useBonusList = (
  params: BonusListParams = {},
  options?: { enabled?: boolean }
) => {
  // Build the where clause from filter parameters
  const whereClause: BonusGetManyParams['where'] = {
    ...params.where,
  };

  // Add year filter
  if (params.year !== undefined) {
    whereClause.year = params.year;
  }

  // Add month filters - support both single month and multiple months
  if (params.months && params.months.length > 0) {
    whereClause.month = { in: params.months };
  } else if (params.month !== undefined) {
    whereClause.month = params.month;
  }

  // Add performance level filters
  if (params.performanceLevels && params.performanceLevels.length > 0) {
    whereClause.performanceLevel = { in: params.performanceLevels };
  }

  // Add user filters
  if (params.userIds && params.userIds.length > 0) {
    whereClause.userId = { in: params.userIds };
  }

  // Add exclude user filters
  if (params.excludeUserIds && params.excludeUserIds.length > 0) {
    whereClause.userId = {
      ...whereClause.userId as any,
      notIn: params.excludeUserIds,
    };
  }

  // Add sector and position filters through user relation
  if (params.sectorIds || params.positionIds) {
    whereClause.user = {
      ...whereClause.user,
      ...(params.sectorIds && params.sectorIds.length > 0 && { sectorId: { in: params.sectorIds } }),
      ...(params.positionIds && params.positionIds.length > 0 && { positionId: { in: params.positionIds } }),
    };
  }

  // Build final query params
  const queryParams: BonusGetManyParams = {
    ...params,
    where: whereClause,
    include: params.include || {
      user: {
        include: {
          sector: true,
          position: true,
        },
      },
      tasks: true,
      bonusDiscounts: true,
    },
    orderBy: params.orderBy || [
      { year: 'desc' },
      { month: 'desc' },
    ],
  };

  return useBonuses(queryParams, options);
};

// =====================================================
// Payroll Hooks
// =====================================================

/**
 * Hook to get payroll data for a specific period
 * Shows confirmed bonuses that are ready for payroll processing
 */
export const usePayroll = (
  params: BonusPayrollParams,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: bonusKeys.payroll(params),
    queryFn: () => bonusService.getPayroll(params).then(response => response.data),
    staleTime: 1000 * 60, // 1 minute - refresh frequently for payroll data
    refetchInterval: 1000 * 60, // Refetch every minute
    enabled: (options?.enabled ?? true) && !!params.year && !!params.month,
  });
};

/**
 * Hook to export payroll data as Excel file
 */
export const useExportPayroll = () => {
  return useMutation({
    mutationFn: (params: BonusPayrollParams) => bonusService.exportPayroll(params),
    onSuccess: (response: any, variables: BonusPayrollParams) => {
      // Handle file download
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `folha-pagamento-${variables.year}-${variables.month}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Folha de pagamento exportada com sucesso!');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'Erro ao exportar folha de pagamento';
      toast.error(message);
    }
  });
};

/**
 * Hook to export bonuses as Excel file with comprehensive filters
 * Similar to useExportPayroll but supports all filter options from useBonusList
 *
 * @example
 * ```ts
 * const exportBonuses = useExportBonuses();
 *
 * // Export with filters
 * exportBonuses.mutate({
 *   year: 2024,
 *   months: [1, 2, 3],
 *   performanceLevels: [4, 5],
 *   sectorIds: ['sector-1'],
 *   include: { user: true, tasks: true, bonusDiscounts: true }
 * });
 * ```
 */
export const useExportBonuses = () => {
  return useMutation({
    mutationFn: (params?: BonusListParams) => {
      // Build the same where clause as useBonusList
      const whereClause: BonusGetManyParams['where'] = {
        ...params?.where,
      };

      if (params?.year !== undefined) {
        whereClause.year = params.year;
      }

      if (params?.months && params.months.length > 0) {
        whereClause.month = { in: params.months };
      } else if (params?.month !== undefined) {
        whereClause.month = params.month;
      }

      if (params?.performanceLevels && params.performanceLevels.length > 0) {
        whereClause.performanceLevel = { in: params.performanceLevels };
      }

      if (params?.userIds && params.userIds.length > 0) {
        whereClause.userId = { in: params.userIds };
      }

      if (params?.excludeUserIds && params.excludeUserIds.length > 0) {
        whereClause.userId = {
          ...whereClause.userId as any,
          notIn: params.excludeUserIds,
        };
      }

      if (params?.sectorIds || params?.positionIds) {
        whereClause.user = {
          ...whereClause.user,
          ...(params.sectorIds && params.sectorIds.length > 0 && { sectorId: { in: params.sectorIds } }),
          ...(params.positionIds && params.positionIds.length > 0 && { positionId: { in: params.positionIds } }),
        };
      }

      const queryParams: BonusGetManyParams = {
        ...params,
        where: whereClause,
        include: params?.include || {
          user: {
            include: {
              sector: true,
              position: true,
            },
          },
          tasks: true,
          bonusDiscounts: true,
        },
        orderBy: params?.orderBy || [
          { year: 'desc' },
          { month: 'desc' },
        ],
      };

      return bonusService.exportBonuses(queryParams);
    },
    onSuccess: (response: any, variables: BonusListParams = {}) => {
      // Handle file download
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');

      // Build filename based on filters
      let filename = 'bonus';
      if (variables.year) {
        filename += `-${variables.year}`;
      }
      if (variables.months && variables.months.length === 1) {
        filename += `-${String(variables.months[0]).padStart(2, '0')}`;
      } else if (variables.month) {
        filename += `-${String(variables.month).padStart(2, '0')}`;
      }
      filename += `.xlsx`;

      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Bônus exportados com sucesso!');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'Erro ao exportar bônus';
      toast.error(message);
    }
  });
};


// =====================================================
// Bonus Discount Hooks
// =====================================================

/**
 * Hook to manage bonus discounts (add/remove discounts from bonuses)
 */
export const useBonusDiscountMutations = () => {
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: bonusKeys.all });
  };

  return {
    create: useMutation({
      mutationFn: (data: BonusDiscountCreateFormData) => bonusService.createDiscount(data),
      onSuccess: () => {
        invalidateQueries();
        toast.success('Desconto adicionado com sucesso');
      },
      onError: (error: any) => {
        const message = error?.response?.data?.message ?? 'Erro ao adicionar desconto';
        toast.error(message);
      }
    }),

    delete: useMutation({
      mutationFn: (id: string) => bonusService.deleteDiscount(id),
      onSuccess: () => {
        invalidateQueries();
        toast.success('Desconto removido com sucesso');
      },
      onError: (error: any) => {
        const message = error?.response?.data?.message ?? 'Erro ao remover desconto';
        toast.error(message);
      }
    })
  };
};

// =====================================================
// Standard Factory Hook Interface
// =====================================================

export const bonusHooks = {
  useInfiniteList: useBonusesInfinite,
  useList: useBonuses,
  useDetail: useBonus,
  useMutations: useBonusMutations,
  useBatchMutations: useBonusBatchMutations,
};