// packages/hooks/src/payrollDetails.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bonusService, payrollService } from "../api-client";
import { bonusKeys } from "./queryKeys";
import { toast } from "sonner";

// =====================================================
// Query Key Definitions
// =====================================================

export const payrollDetailsKeys = {
  all: ["payrollDetails"] as const,

  // Main payroll details queries
  details: (year: number, month: number) => ["payrollDetails", year, month] as const,
  liveDetails: (year: number, month: number) => ["payrollDetails", "live", year, month] as const,

  // User-specific queries
  userStats: (year: number, month: number) => ["payrollDetails", "userStats", year, month] as const,
  userDetails: (year: number, month: number, userId: string) => ["payrollDetails", "user", userId, year, month] as const,

  // Task summary queries
  taskSummary: (year: number, month: number, userId?: string) =>
    userId ? ["payrollDetails", "tasks", year, month, userId] as const
          : ["payrollDetails", "tasks", year, month] as const,

  // Comparison queries
  comparison: (year: number, month: number) => ["payrollDetails", "comparison", year, month] as const,
};

// =====================================================
// Types
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

// =====================================================
// Main Payroll Details Hooks
// =====================================================

/**
 * Hook to get payroll details for a specific period
 * Returns comprehensive payroll information including bonuses, remuneration, and earnings
 *
 * @param year - Year for payroll (e.g., 2024)
 * @param month - Month for payroll (1-12)
 * @param options - Query configuration options
 */
export const usePayrollDetails = (
  year: number,
  month: number,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
    userId?: string;
    sectorId?: string;
  }
) => {
  return useQuery({
    queryKey: payrollDetailsKeys.details(year, month),
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
    staleTime: options?.staleTime ?? 1000 * 60 * 2, // 2 minutes default
    refetchInterval: options?.refetchInterval ?? 1000 * 60 * 5, // Refresh every 5 minutes
    enabled: (options?.enabled ?? true) && !!year && !!month,
  });
};

/**
 * Hook to get live payroll calculations for a specific period
 * Always calculates bonuses on-the-fly without saving to database
 * Useful for previewing calculations before saving
 *
 * @param year - Year for calculation (e.g., 2024)
 * @param month - Month for calculation (1-12)
 * @param options - Query configuration options
 */
export const usePayrollLiveDetails = (
  year: number,
  month: number,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
    userId?: string;
  }
) => {
  return useQuery({
    queryKey: payrollDetailsKeys.liveDetails(year, month),
    queryFn: async () => {
      // Get live bonus calculations from the bonus service
      const response = await bonusService.getLiveBonuses(year, month);
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds - fresh calculation data
    refetchInterval: options?.refetchInterval ?? 1000 * 60, // Refresh every minute by default
    enabled: (options?.enabled ?? true) && !!year && !!month,
  });
};

/**
 * Hook to get user statistics for payroll period
 * Returns detailed statistics per user including payroll and bonus information
 *
 * @param year - Year for statistics
 * @param month - Month for statistics
 * @param options - Query configuration options
 */
export const usePayrollUserStats = (
  year: number,
  month: number,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    userId?: string;
    sectorId?: string;
  }
) => {
  return useQuery({
    queryKey: payrollDetailsKeys.userStats(year, month),
    queryFn: async () => {
      // Get all payrolls for the period with user details
      const response = await payrollService.getMany({
        where: { year, month, userId: options?.userId },
        include: {
          user: { include: { position: true, sector: true } },
          bonus: { include: { bonusDiscounts: true, tasks: true } },
          discounts: true
        }
      });

      // Transform payroll data into user statistics
      return response.data?.data?.map((payroll: any) => ({
        userId: payroll.user?.id,
        userName: payroll.user?.name,
        userCpf: payroll.user?.cpf,
        userEmail: payroll.user?.email,
        position: payroll.user?.position?.name,
        sector: payroll.user?.sector?.name,
        baseRemuneration: payroll.baseRemuneration,
        bonus: payroll.bonus?.baseBonus || 0,
        totalDiscounts: payroll.discounts?.reduce((sum: number, d: any) =>
          sum + (d.percentage ? payroll.baseRemuneration * d.percentage / 100 : d.fixedValue || 0), 0
        ) || 0,
        netSalary: 0, // Calculate based on base + bonus - discounts
        taskCount: payroll.bonus?.tasks?.length || 0,
      })) || [];
    },
    staleTime: options?.staleTime ?? 1000 * 60 * 5, // 5 minutes default
    enabled: (options?.enabled ?? true) && !!year && !!month,
  });
};

/**
 * Hook to get task summary for a payroll period
 * Returns task completion details for bonus calculation
 *
 * @param year - Year for task summary
 * @param month - Month for task summary
 * @param userId - Optional user ID to filter tasks
 * @param options - Query configuration options
 */
export const usePayrollTaskSummary = (
  year: number,
  month: number,
  userId?: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) => {
  return useQuery({
    queryKey: payrollDetailsKeys.taskSummary(year, month, userId),
    queryFn: async () => {
      // This would need to be implemented in the backend
      // For now, return an empty array
      return [];
    },
    staleTime: options?.staleTime ?? 1000 * 60 * 5, // 5 minutes default
    enabled: (options?.enabled ?? true) && !!year && !!month,
  });
};

// =====================================================
// Mutations
// =====================================================

/**
 * Hook to manually calculate bonuses for a period
 * Triggers bonus calculation and saves to database
 */
export const useCalculatePayrollBonuses = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      bonusService.calculateBonuses({ year: year.toString(), month: month.toString() }),
    onSuccess: (result: any) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: payrollDetailsKeys.all });
      queryClient.invalidateQueries({ queryKey: bonusKeys.all });

      // Access the result from the axios response
      const responseData = result?.data || result;
      const totalSuccess = responseData?.data?.totalSuccess || 0;
      const totalFailed = responseData?.data?.totalFailed || 0;

      if (totalSuccess > 0) {
        toast.success(`Bonificações calculadas: ${totalSuccess} funcionários`);
      }

      if (totalFailed > 0) {
        toast.warning(`${totalFailed} cálculos falharam`);
      }
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Erro ao calcular bonificações';
      toast.error(message);
    },
  });
};

/**
 * Hook to save monthly bonuses
 * Saves calculated bonuses to the database
 */
export const useSaveMonthlyBonuses = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      bonusService.saveMonthlyBonuses({ year: year.toString(), month: month.toString() }),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: payrollDetailsKeys.all });
      queryClient.invalidateQueries({ queryKey: bonusKeys.all });

      // Access the result from the axios response
      const responseData = result?.data || result;
      const totalSuccess = responseData?.data?.totalSuccess || 0;
      toast.success(`${totalSuccess} bonificações salvas com sucesso`);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Erro ao salvar bonificações';
      toast.error(message);
    },
  });
};

// =====================================================
// Utility Functions
// =====================================================

/**
 * Get payroll period comparison data
 * Compares current period with previous period
 */
export const usePayrollComparison = (
  currentYear: number,
  currentMonth: number,
  options?: {
    enabled?: boolean;
    compareWithPrevious?: boolean; // If true, compares with previous month, otherwise previous year
  }
) => {
  const compareWithPrevious = options?.compareWithPrevious ?? true;

  const compareYear = compareWithPrevious
    ? (currentMonth === 1 ? currentYear - 1 : currentYear)
    : currentYear - 1;

  const compareMonth = compareWithPrevious
    ? (currentMonth === 1 ? 12 : currentMonth - 1)
    : currentMonth;

  const currentQuery = usePayrollDetails(currentYear, currentMonth, { enabled: options?.enabled });
  const compareQuery = usePayrollDetails(compareYear, compareMonth, { enabled: options?.enabled });

  return useQuery<PayrollComparison>({
    queryKey: payrollDetailsKeys.comparison(currentYear, currentMonth),
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
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: (options?.enabled ?? true) && !!currentQuery.data && !!compareQuery.data,
  });
};