import { createEntityHooks } from "./createEntityHooks";
import { payrollService } from "../api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  PayrollGetManyParams,
  PayrollGetManyResponse,
  PayrollGetByIdParams,
  Payroll,
} from "../types";
import type {
  PayrollCreateFormData,
  PayrollUpdateFormData,
  PayrollBatchCreateFormData,
  PayrollBatchUpdateFormData,
  PayrollBatchDeleteFormData,
  DiscountCreateFormData,
  DiscountUpdateFormData,
} from "../schemas";

// Query Keys
export const payrollQueryKeys = {
  all: ["payroll"] as const,
  lists: () => [...payrollQueryKeys.all, "list"] as const,
  list: (filters?: PayrollGetManyParams) => [...payrollQueryKeys.lists(), filters] as const,
  details: () => [...payrollQueryKeys.all, "details"] as const,
  detail: (id: string, include?: any) => [...payrollQueryKeys.all, "detail", id, include] as const,
  byIds: (ids: string[]) => [...payrollQueryKeys.all, "byIds", ids] as const,
  userPeriod: (userId: string, year: number, month: number) =>
    [...payrollQueryKeys.all, "userPeriod", userId, year, month] as const,
  current: () => [...payrollQueryKeys.all, "current"] as const,
  live: (userId: string, year: number, month: number) =>
    [...payrollQueryKeys.all, "live", userId, year, month] as const,
} as const;

// Service Adapter for Entity Factory
const payrollServiceAdapter = {
  getMany: (params?: PayrollGetManyParams) =>
    payrollService.getMany(params).then(response => response.data),
  getById: (id: string, params?: PayrollGetByIdParams) =>
    payrollService.getById(id, params).then(response => response.data),
  create: (data: PayrollCreateFormData) =>
    payrollService.create(data).then(response => response.data),
  update: (id: string, data: PayrollUpdateFormData) =>
    payrollService.update(id, data).then(response => response.data),
  delete: (id: string) =>
    payrollService.delete(id).then(() => undefined),
  batchCreate: (data: PayrollBatchCreateFormData) =>
    payrollService.batchCreate(data).then(response => response.data),
  batchUpdate: (data: PayrollBatchUpdateFormData) =>
    payrollService.batchUpdate(data).then(response => response.data),
  batchDelete: (data: PayrollBatchDeleteFormData) =>
    payrollService.batchDelete(data).then(() => undefined),
};

// Base Payroll Hooks using Entity Factory
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
  queryKeys: payrollQueryKeys,
  service: payrollServiceAdapter,
  staleTime: 1000 * 60 * 5,
  relatedQueryKeys: [],
});

// Export base hooks
export const usePayrollsInfinite = baseHooks.useInfiniteList;
export const usePayrolls = baseHooks.useList;
export const usePayrollEntity = baseHooks.useDetail;
export const usePayrollMutations = baseHooks.useMutations;
export const usePayrollBatchMutations = baseHooks.useBatchMutations;

/**
 * Hook to get payroll by user and period
 */
export const usePayrollByUserPeriod = (userId: string, year: number, month: number, params?: PayrollGetByIdParams) => {
  return useQuery({
    queryKey: payrollQueryKeys.userPeriod(userId, year, month),
    queryFn: () => payrollService.getByUserAndMonth(userId, year, month, params).then(response => response.data),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId && !!year && !!month,
  });
};

/**
 * Hook to get current month payroll data
 */
export const useCurrentMonthPayroll = (params?: PayrollGetManyParams) => {
  return useQuery({
    queryKey: payrollQueryKeys.current(),
    queryFn: () => payrollService.getCurrentMonth(params).then(response => response.data),
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook to get live payroll calculation for a user
 */
export const usePayrollLiveCalculation = (
  userId: string,
  year: number,
  month: number,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) => {
  return useQuery({
    queryKey: payrollQueryKeys.live(userId, year, month),
    queryFn: () => payrollService.getLiveCalculation(userId, year, month).then(response => response.data),
    staleTime: 30 * 1000,
    refetchInterval: options?.refetchInterval ?? 60 * 1000,
    enabled: (options?.enabled ?? true) && !!userId && !!year && !!month,
  });
};

/**
 * Hook to get payroll details with bonuses for a specific user
 */
export const usePayrollDetailsWithBonus = (userId: string, year: number, month: number) => {
  return useQuery({
    queryKey: payrollQueryKeys.userPeriod(userId, year, month),
    queryFn: async () => {
      try {
        const response = await payrollService.getByUserAndMonth(userId, year, month, {
          include: {
            user: {
              include: {
                position: true,
                sector: true,
              },
            },
            bonus: {
              include: {
                tasks: true,
                users: true,
              },
            },
            discounts: true,
          },
        });

        if (response.data) {
          return response.data;
        }
      } catch (error: any) {
        if (error?.response?.status === 404) {
          try {
            const liveResponse = await payrollService.getLiveCalculation(userId, year, month);
            if (liveResponse.data) {
              return liveResponse.data.payroll || liveResponse.data;
            }
          } catch (liveError) {
            throw liveError;
          }
        } else {
          throw error;
        }
      }

      throw new Error('No payroll data found for the specified period');
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!userId && !!year && !!month,
  });
};

/**
 * Hook to simulate bonus calculations with given parameters
 */
export const useBonusSimulation = (params: {
  year: number;
  month: number;
  taskQuantity?: number;
  sectorIds?: string[];
  excludeUserIds?: string[];
}) => {
  return useQuery({
    queryKey: ['payroll', 'bonuses', 'simulate', params],
    queryFn: async () => {
      const response = await payrollService.simulateBonuses(params);
      return response.data;
    },
    staleTime: 30 * 1000,
    enabled: !!params.year && !!params.month && params.year > 0 && params.month > 0,
  });
};

/**
 * Hook for finalizing payroll for a month
 */
export const useFinalizePayrollMonth = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      payrollService.finalizeMonth(year, month).then(response => response.data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: payrollQueryKeys.all });
      const previousPayrolls = queryClient.getQueryData(payrollQueryKeys.list());
      const monthName = new Date(variables.year, variables.month - 1).toLocaleDateString('pt-BR', { month: 'long' });
      toast.loading(`Finalizando folha de pagamento de ${monthName}...`, {
        id: `finalize-${variables.year}-${variables.month}`
      });
      return { previousPayrolls };
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all });
      toast.dismiss(`finalize-${variables.year}-${variables.month}`);
      const monthName = new Date(variables.year, variables.month - 1).toLocaleDateString('pt-BR', { month: 'long' });
      toast.success(`Folha de pagamento de ${monthName} finalizada com sucesso!`);
    },
    onError: (error: any, variables, context) => {
      if (context?.previousPayrolls) {
        queryClient.setQueryData(payrollQueryKeys.list(), context.previousPayrolls);
      }
      toast.dismiss(`finalize-${variables.year}-${variables.month}`);
      const message = error?.response?.data?.message ?? 'Erro ao finalizar folha de pagamento';
      toast.error(message);
    },
  });
};

/**
 * Hook for batch creating payrolls for a period
 */
export const useBatchCreatePayroll = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      payrollService.batchCreateForPeriod(year, month).then(response => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all });
    },
  });
};

/**
 * Hook for payroll discount management
 */
export const usePayrollDiscountMutations = () => {
  const queryClient = useQueryClient();

  const addDiscount = useMutation({
    mutationFn: ({ payrollId, discount }: {
      payrollId: string;
      discount: DiscountCreateFormData
    }) => payrollService.addDiscount(payrollId, discount).then(response => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all });
    },
  });

  const removeDiscount = useMutation({
    mutationFn: ({ payrollId, discountId }: { payrollId: string; discountId: string }) =>
      payrollService.removeDiscount(payrollId, discountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all });
    },
  });

  const updateDiscount = useMutation({
    mutationFn: ({ payrollId, discountId, discount }: {
      payrollId: string;
      discountId: string;
      discount: DiscountUpdateFormData
    }) => payrollService.updateDiscount(payrollId, discountId, discount).then(response => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.all });
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

export const payrollHooks = {
  useInfiniteList: usePayrollsInfinite,
  useList: usePayrolls,
  useDetail: usePayrollEntity,
  useMutations: usePayrollMutations,
  useBatchMutations: usePayrollBatchMutations,
};
