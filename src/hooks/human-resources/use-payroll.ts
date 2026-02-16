// packages/hooks/src/payroll.ts

import { createEntityHooks } from "../common/create-entity-hooks";
import { payrollService, discountService } from "../../api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { payrollKeys, bonusKeys } from "../common/query-keys";
import type {
  PayrollGetManyParams,
  PayrollGetManyResponse,
  PayrollGetByIdParams,
  Payroll,
  Discount,
} from "../../types";
import type {
  PayrollCreateFormData,
  PayrollUpdateFormData,
  PayrollBatchCreateFormData,
  PayrollBatchUpdateFormData,
  PayrollBatchDeleteFormData,
  DiscountCreateFormData,
  DiscountUpdateFormData,
} from "../../schemas";

// =====================================================
// Payroll Service Adapter
// =====================================================

const payrollServiceAdapter = {
  getMany: (params?: PayrollGetManyParams) =>
    payrollService.getMany(params).then(response => response.data),
  getById: (id: string, params?: PayrollGetByIdParams) =>
    payrollService.getById(id, params).then(response => response.data),
  // Payrolls are created by cronjobs, not manually - provide stub for EntityService compatibility
  create: (_data: PayrollCreateFormData): Promise<Payroll> => {
    throw new Error('Payroll creation is handled by cronjobs. Use generateMonthlyPayrolls instead.');
  },
  update: (id: string, data: PayrollUpdateFormData) =>
    payrollService.update(id, data).then(response => response.data),
  delete: (id: string) =>
    payrollService.delete(id).then(() => undefined),
  // Batch create is not supported - payrolls are created by cronjobs
  batchCreate: (_data: PayrollBatchCreateFormData): Promise<{ created: number; skipped: number }> => {
    throw new Error('Batch payroll creation is handled by cronjobs. Use generateMonthlyPayrolls instead.');
  },
  batchUpdate: (data: PayrollBatchUpdateFormData) =>
    payrollService.batchUpdate(data).then(response => {
      const result = response.data;
      // Transform API response to match EntityService expected format
      return {
        updated: result.success?.length ?? 0,
        errors: result.failed?.length ?? 0,
      };
    }),
  batchDelete: (data: PayrollBatchDeleteFormData) =>
    payrollService.batchDelete(data).then(() => undefined),
};

// =====================================================
// Base Payroll Hooks
// =====================================================

const baseHooks = createEntityHooks<
  PayrollGetManyParams,
  PayrollGetManyResponse,
  Payroll,
  PayrollCreateFormData,
  Payroll,
  PayrollUpdateFormData,
  Payroll,
  void,
  PayrollBatchCreateFormData,
  { created: number; skipped: number },
  PayrollBatchUpdateFormData,
  { updated: number; errors: number },
  PayrollBatchDeleteFormData,
  void
>({
  queryKeys: payrollKeys,
  service: payrollServiceAdapter,
  staleTime: 1000 * 60 * 5, // 5 minutes
  relatedQueryKeys: [bonusKeys],
});

// Export base hooks with standard names (matching useUser.ts pattern)
export const usePayrollsInfinite = baseHooks.useInfiniteList;
export const usePayrolls = baseHooks.useList;
export const usePayroll = baseHooks.useDetail;
export const usePayrollMutations = baseHooks.useMutations;
export const usePayrollBatchMutations = baseHooks.useBatchMutations;

// =====================================================
// Specialized Payroll Hooks
// =====================================================

/**
 * Hook to get payroll for a specific user and period.
 *
 * The API automatically returns:
 * - Saved payroll data if it exists in the database
 * - Live-calculated payroll if it's the current period and no saved data exists
 *
 * @param userId - The user ID
 * @param year - The year (e.g., 2025)
 * @param month - The month (1-12)
 * @param options - Optional configuration
 */
export const usePayrollByUserAndPeriod = (
  userId: string,
  year: number,
  month: number,
  options?: {
    enabled?: boolean;
    include?: PayrollGetByIdParams['include'];
  }
) => {
  const defaultInclude = {
    user: {
      include: {
        position: true,
        sector: true,
      },
    },
    bonus: {
      include: {
        tasks: true,
        bonusDiscounts: true,
      },
    },
    discounts: true,
    position: true,
  };

  return useQuery({
    queryKey: payrollKeys.byUserAndPeriod(userId, year, month, options?.include ?? defaultInclude),
    queryFn: async () => {
      const response = await payrollService.getByUserAndMonth(userId, year, month, {
        include: options?.include ?? defaultInclude,
      });
      // The API returns { success, message, data } - extract the data
      return response.data?.data ?? response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: (options?.enabled ?? true) && !!userId && !!year && !!month,
  });
};

/**
 * Hook to get payrolls for a specific period (all users).
 *
 * @param year - The year (e.g., 2025)
 * @param month - The month (1-12)
 * @param options - Optional configuration
 */
export const usePayrollsByPeriod = (
  year: number,
  month: number,
  options?: {
    enabled?: boolean;
    userId?: string;
    sectorId?: string;
  }
) => {
  return useQuery({
    queryKey: payrollKeys.byPeriod(year, month, { userId: options?.userId }),
    queryFn: async () => {
      const response = await payrollService.getMany({
        where: { year, month, userId: options?.userId },
        include: {
          user: { include: { position: true, sector: true } },
          bonus: true,
          discounts: { orderBy: { calculationOrder: "asc" } }
        }
      });
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: (options?.enabled ?? true) && !!year && !!month,
  });
};

/**
 * Hook to simulate bonus calculations with given parameters.
 * Used for "what-if" scenarios before finalizing bonuses.
 */
export const usePayrollBonusSimulation = (params: {
  year: number;
  month: number;
  taskQuantity?: number;
  sectorIds?: string[];
  excludeUserIds?: string[];
}) => {
  return useQuery({
    queryKey: payrollKeys.simulation(params),
    queryFn: async () => {
      const response = await payrollService.simulateBonuses(params);
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds - simulation data can change
    enabled: !!params.year && !!params.month && params.year > 0 && params.month > 0,
  });
};

/**
 * Hook to get payroll comparison between two periods.
 */
export const usePayrollComparison = (
  currentYear: number,
  currentMonth: number,
  options?: {
    enabled?: boolean;
    compareWithPrevious?: boolean;
  }
) => {
  const compareWithPrevious = options?.compareWithPrevious ?? true;

  const compareYear = compareWithPrevious
    ? (currentMonth === 1 ? currentYear - 1 : currentYear)
    : currentYear - 1;

  const compareMonth = compareWithPrevious
    ? (currentMonth === 1 ? 12 : currentMonth - 1)
    : currentMonth;

  const currentQuery = usePayrollsByPeriod(currentYear, currentMonth, { enabled: options?.enabled });
  const compareQuery = usePayrollsByPeriod(compareYear, compareMonth, { enabled: options?.enabled });

  return useQuery({
    queryKey: payrollKeys.comparison(currentYear, currentMonth),
    queryFn: async () => {
      const currentData = currentQuery.data;
      const compareData = compareQuery.data;

      if (!currentData || !compareData) {
        throw new Error('Dados de comparação não disponíveis');
      }

      const currentTotal = currentData.data?.reduce((sum: number, p: any) =>
        sum + (p.baseRemuneration || 0) + (p.bonus?.baseBonus || 0), 0
      ) || 0;

      const compareTotal = compareData.data?.reduce((sum: number, p: any) =>
        sum + (p.baseRemuneration || 0) + (p.bonus?.baseBonus || 0), 0
      ) || 0;

      const difference = currentTotal - compareTotal;
      const percentageChange = compareTotal > 0
        ? ((difference / compareTotal) * 100)
        : 0;

      return {
        current: {
          period: `${currentMonth}/${currentYear}`,
          total: currentTotal,
          count: currentData.data?.length || 0,
        },
        compare: {
          period: `${compareMonth}/${compareYear}`,
          total: compareTotal,
          count: compareData.data?.length || 0,
        },
        difference,
        percentageChange: Math.round(percentageChange * 100) / 100,
        isIncrease: difference > 0,
      };
    },
    staleTime: 1000 * 60 * 5,
    enabled: (options?.enabled ?? true) && !!currentQuery.data && !!compareQuery.data,
  });
};

// =====================================================
// Payroll Mutations
// =====================================================

/**
 * Hook for finalizing payroll for a month
 * @deprecated This method is deprecated - payrolls are finalized by cronjobs
 */
export const useFinalizePayrollMonth = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      payrollService.finalizeMonth(year, month).then(response => response.data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: payrollKeys.all });
      const previousPayrolls = queryClient.getQueryData(payrollKeys.list());
      const monthName = new Date(variables.year, variables.month - 1).toLocaleDateString('pt-BR', { month: 'long' });
      toast.loading(`Finalizando folha de pagamento de ${monthName}...`, {
        id: `finalize-${variables.year}-${variables.month}`
      });
      return { previousPayrolls };
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
      toast.dismiss(`finalize-${variables.year}-${variables.month}`);
      const monthName = new Date(variables.year, variables.month - 1).toLocaleDateString('pt-BR', { month: 'long' });
      toast.success(`Folha de pagamento de ${monthName} finalizada com sucesso!`);
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }, variables, context) => {
      if (context?.previousPayrolls) {
        queryClient.setQueryData(payrollKeys.list(), context.previousPayrolls);
      }
      toast.dismiss(`finalize-${variables.year}-${variables.month}`);
      const message = error?.response?.data?.message ?? 'Erro ao finalizar folha de pagamento';
      toast.error(message);
    },
  });
};

/**
 * Hook for generating monthly payrolls
 */
export const useGenerateMonthlyPayrolls = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      payrollService.generateMonthlyPayrolls(year, month).then(response => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });
};

/**
 * Hook for payroll discount management
 * Note: Uses discountService since discounts are managed separately
 */
export const usePayrollDiscountMutations = () => {
  const queryClient = useQueryClient();

  const addDiscount = useMutation({
    mutationFn: ({ payrollId, discount }: {
      payrollId: string;
      discount: DiscountCreateFormData
    }): Promise<Discount> => {
      // Create discount with payrollId included
      return discountService.create({ ...discount, payrollId } as any).then(response => response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });

  const removeDiscount = useMutation({
    mutationFn: ({ discountId }: { payrollId: string; discountId: string }): Promise<void> =>
      discountService.delete(discountId).then(() => undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });

  const updateDiscount = useMutation({
    mutationFn: ({ discountId, discount }: {
      payrollId: string;
      discountId: string;
      discount: DiscountUpdateFormData
    }): Promise<Discount> =>
      discountService.update(discountId, discount).then(response => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });

  return {
    addDiscount: addDiscount.mutate,
    addDiscountAsync: addDiscount.mutateAsync,
    removeDiscount: removeDiscount.mutate,
    removeDiscountAsync: removeDiscount.mutateAsync,
    updateDiscount: updateDiscount.mutate,
    updateDiscountAsync: updateDiscount.mutateAsync,
    isLoading: addDiscount.isPending || removeDiscount.isPending || updateDiscount.isPending,
    error: addDiscount.error || removeDiscount.error || updateDiscount.error,
  };
};

// =====================================================
// Export Type for Comparison
// =====================================================

export interface PayrollComparison {
  current: {
    period: string;
    total: number;
    count: number;
  };
  compare: {
    period: string;
    total: number;
    count: number;
  };
  difference: number;
  percentageChange: number;
  isIncrease: boolean;
}
