// packages/hooks/src/bonus.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bonusService, type BonusCalculationResult } from "../api-client";
import { bonusKeys, userKeys } from "./queryKeys";
import { createEntityHooks } from "./createEntityHooks";
import { toast } from "sonner";

// Import proper types from packages
import type {
  Bonus,
  BonusIncludes,
  BonusGetManyParams,
  BonusGetManyResponse,
  BonusGetByIdParams,
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

// Export base hooks with standard names
export const useBonusesInfinite = baseHooks.useInfiniteList;
export const useBonuses = baseHooks.useList;
export const useBonusDetail = baseHooks.useDetail;
export const useBonusMutations = baseHooks.useMutations;
export const useBonusBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Live Calculation Hooks
// =====================================================

/**
 * Hook to get live bonus calculations for a specific period
 * Shows real-time calculated bonuses before they are saved to database
 * Refreshes frequently to show current calculations
 *
 * @param year - Year for calculation (e.g., 2024)
 * @param month - Month for calculation (1-12)
 * @param options - Query options
 */
export const useLiveBonusCalculation = (
  year: number,
  month: number,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) => {
  return useQuery({
    queryKey: [...bonusKeys.all, 'live', year, month],
    queryFn: async () => {
      const response = await bonusService.getLiveBonuses(year, month);
      // The API returns PayrollData with bonuses array
      return response.data || { bonuses: [], meta: {}, summary: {} };
    },
    staleTime: 1000 * 30, // 30 seconds - fresh calculation data
    refetchInterval: options?.refetchInterval ?? 1000 * 60, // Refresh every minute by default
    enabled: (options?.enabled ?? true) && !!year && !!month,
  });
};

// Alias for backward compatibility
export const useLiveBonuses = useLiveBonusCalculation;

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
      console.log('Triggering bonus calculation for:', params);
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
// Specialized Query Hooks
// =====================================================

/**
 * Hook to save monthly bonuses (typically used by cron jobs)
 * This is different from calculateBonuses - it's for the automated saving process
 */
export const useSaveMonthlyBonuses = () => {
  const queryClient = useQueryClient();

  // TODO: Uncomment when bonusService.saveMonthlyBonuses is available (after API client rebuild)
  return useMutation({
    mutationFn: (_params: { year: number; month: number }) => {
      console.warn('saveMonthlyBonuses not yet available - API client needs rebuild');
      return Promise.resolve({
        success: true,
        message: 'Funcionalidade em desenvolvimento',
        data: { totalProcessed: 0, totalSuccess: 0, totalFailed: 0, details: [] }
      });
    },
    onSuccess: (result: BonusCalculationResult, variables) => {
      queryClient.invalidateQueries({ queryKey: bonusKeys.all });

      const monthName = new Date(variables.year, variables.month - 1).toLocaleDateString('pt-BR', { month: 'long' });
      const successCount = result.data?.totalSuccess ?? 0;
      const failedCount = result.data?.totalFailed ?? 0;

      toast.success(`Bônus mensais de ${monthName} salvos: ${successCount} sucessos, ${failedCount} falhas`);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'Erro ao salvar bônus mensais';
      toast.error(message);
    }
  });
};

// =====================================================
// Standard Factory Hook Interface
// =====================================================

export const bonusHooks = {
  useInfiniteList: useBonusesInfinite,
  useList: useBonuses,
  useDetail: useBonusDetail,
  useMutations: useBonusMutations,
  useBatchMutations: useBonusBatchMutations,
};

// =====================================================
// Legacy Aliases for Backward Compatibility
// =====================================================

export { useBonuses as useBonusList };
export { useBonusDetail as useBonus };
export { useBonusMutations as useBonusCrud };

// Alias exports for backward compatibility
export type { BonusPayrollParams as BonusPayrollGetParams } from "../api-client";