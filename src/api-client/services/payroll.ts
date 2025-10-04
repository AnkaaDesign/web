import { apiClient } from "../axiosClient";
import type {
  Payroll,
  PayrollGetManyParams,
  PayrollGetManyResponse,
  PayrollGetByIdParams,
} from "../../types";
import type {
  PayrollCreateFormData,
  PayrollUpdateFormData,
  PayrollBatchCreateFormData,
  PayrollBatchUpdateFormData,
  PayrollBatchDeleteFormData,
  DiscountCreateFormData,
} from "../../schemas";

export const payrollService = {
  // Standard CRUD operations
  getMany: (params?: PayrollGetManyParams) =>
    apiClient.get<PayrollGetManyResponse>("/payroll", { params }),

  getById: (id: string, params?: PayrollGetByIdParams) =>
    apiClient.get<Payroll>(`/payroll/${id}`, { params }),

  create: (data: PayrollCreateFormData) =>
    apiClient.post<Payroll>("/payroll", data),

  update: (id: string, data: PayrollUpdateFormData) =>
    apiClient.put<Payroll>(`/payroll/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/payroll/${id}`),

  // Batch operations
  batchCreate: (data: PayrollBatchCreateFormData) =>
    apiClient.post<{ created: number; skipped: number }>("/payroll/batch", data),

  batchUpdate: (data: PayrollBatchUpdateFormData) =>
    apiClient.put<{ updated: number; errors: number }>("/payroll/batch", data),

  batchDelete: (data: PayrollBatchDeleteFormData) =>
    apiClient.delete("/payroll/batch", { data }),

  // Payroll generation and management
  generateMonthlyPayrolls: (year: number, month: number) =>
    apiClient.post<{ created: number; updated: number }>("/payroll/generate-month", { year, month }),

  getLiveCalculations: () =>
    apiClient.get<any>("/payroll/live"),

  // User and period specific queries
  getByUser: (userId: string, params?: PayrollGetManyParams) =>
    apiClient.get<PayrollGetManyResponse>(`/payroll/user/${userId}`, { params }),

  getByMonth: (year: number, month: number, params?: PayrollGetManyParams) =>
    apiClient.get<PayrollGetManyResponse>(`/payroll/month/${year}/${month}`, { params }),

  getByUserAndMonth: (userId: string, year: number, month: number, params?: PayrollGetByIdParams) =>
    apiClient.get<Payroll>(`/payroll/user/${userId}/month/${year}/${month}`, { params }),

  getLiveCalculation: (userId: string, year: number, month: number) =>
    apiClient.get<{
      payroll: Payroll;
      totalGross: number;
      totalDiscounts: number;
      netSalary: number;
      bonus?: number;
    }>(`/payroll/live/${userId}/${year}/${month}`),

  getCurrentMonth: (params?: PayrollGetManyParams) =>
    apiClient.get<PayrollGetManyResponse>("/payroll/current", { params }),

  // Enhanced payroll details with live calculation support
  getPayrollDetails: (year: number, month: number, userId: string, params?: PayrollGetManyParams) =>
    apiClient.get<{ data: Payroll }>(`/payroll/month/${year}/${month}`, {
      params: {
        ...params,
        where: {
          userId,
          year,
          month,
          ...params?.where
        },
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
          ...params?.include
        }
      }
    }),

  // Live calculation support
  getLiveBonuses: (year: number, month: number, params?: PayrollGetManyParams) =>
    apiClient.get<PayrollGetManyResponse>("/payroll/bonuses", {
      params: {
        year,
        month,
        ...params
      }
    }),

  simulateBonuses: (params: {
    year: number;
    month: number;
    taskQuantity?: number;
    sectorIds?: string[];
    excludeUserIds?: string[];
  }) =>
    apiClient.post<any>("/payroll/simulate-bonuses", params),

  finalizeMonth: (year: number, month: number) =>
    apiClient.post<any>("/payroll/finalize-month", { year, month }),

  batchCreateForPeriod: (year: number, month: number) =>
    apiClient.post<any>("/payroll/batch-create-period", { year, month }),

  // Discount management
  addDiscount: (payrollId: string, discount: DiscountCreateFormData) =>
    apiClient.post<Payroll>(`/payroll/${payrollId}/discount`, discount),

  updateDiscount: (payrollId: string, discountId: string, discount: any) =>
    apiClient.put<Payroll>(`/payroll/${payrollId}/discount/${discountId}`, discount),

  removeDiscount: (payrollId: string, discountId: string) =>
    apiClient.delete(`/payroll/${payrollId}/discount/${discountId}`),
};