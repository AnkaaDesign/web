// payroll.ts
// Clean API client for payroll endpoints
// Aligned with new clean controller implementation

import { apiClient } from "../axiosClient";
import type {
  Payroll,
  PayrollGetManyParams,
  PayrollGetManyResponse,
  PayrollGetByIdParams,
} from "../../types";
import type {
  PayrollUpdateFormData,
  PayrollBatchUpdateFormData,
  PayrollBatchDeleteFormData,
} from "../../schemas";

export const payrollService = {
  // =====================================================
  // Regular CRUD Operations (like any other entity)
  // The API automatically includes live calculations for current period
  // =====================================================

  /**
   * Get many payrolls - Standard entity list
   * Automatically includes live calculations for current period
   */
  getMany: (params?: PayrollGetManyParams) =>
    apiClient.get<PayrollGetManyResponse>("/payroll", { params }),

  /**
   * Get payroll by ID - Standard entity retrieval
   * Handles both regular UUIDs and live IDs (format: live-{userId}-{year}-{month})
   */
  getById: (id: string, params?: PayrollGetByIdParams) => {
    // Check if this is a live ID (format: live-{userId}-{year}-{month})
    if (id.startsWith('live-')) {
      const parts = id.split('-');
      // live-{uuid part1}-{uuid part2}-{uuid part3}-{uuid part4}-{uuid part5}-{year}-{month}
      if (parts.length === 8) {
        const userId = `${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}-${parts[5]}`;
        const year = parseInt(parts[6], 10);
        const month = parseInt(parts[7], 10);
        // Call the proper live endpoint
        return apiClient.get<Payroll>(`/payroll/live/${userId}/${year}/${month}`);
      }
    }
    // Regular UUID - use normal endpoint
    return apiClient.get<Payroll>(`/payroll/${id}`, { params });
  },

  /**
   * Update payroll - Standard entity update
   * Note: Payrolls are created by cronjob, but can be edited between
   * the period end (25th) and payment date (5th)
   */
  update: (id: string, data: PayrollUpdateFormData) =>
    apiClient.put<Payroll>(`/payroll/${id}`, data),

  /**
   * Delete payroll - Standard entity deletion (Admin only)
   */
  delete: (id: string) =>
    apiClient.delete(`/payroll/${id}`),

  // =====================================================
  // Batch Operations
  // =====================================================

  /**
   * Batch update payrolls
   */
  batchUpdate: (data: PayrollBatchUpdateFormData) =>
    apiClient.put<{ success: Payroll[]; failed: any[] }>("/payroll/batch", data),

  /**
   * Batch delete payrolls (Admin only)
   */
  batchDelete: (data: PayrollBatchDeleteFormData) =>
    apiClient.delete("/payroll/batch", { data }),

  // =====================================================
  // Cronjob/System Endpoints
  // =====================================================

  /**
   * Generate payrolls for all active users for a specific month
   * Called by cronjob on the 26th at 23:59
   */
  generateMonthlyPayrolls: (year: number, month: number) =>
    apiClient.post<{ created: number; skipped: number }>("/payroll/generate-month", { year, month }),

  // =====================================================
  // Live Calculation Endpoints
  // =====================================================

  /**
   * Get live payroll calculation for current user
   */
  getLiveCalculations: () =>
    apiClient.get<any>("/payroll/live"),

  /**
   * Get live payroll calculation for a specific user and period
   */
  getLiveCalculation: (userId: string, year: number, month: number) =>
    apiClient.get<{
      success: boolean;
      message: string;
      data: {
        payroll: Payroll;
        bonus: any;
        calculations: any;
        calculatedAt: string;
      };
    }>(`/payroll/live/${userId}/${year}/${month}`),

  // =====================================================
  // Filtering Endpoints
  // =====================================================

  /**
   * Get payrolls by user
   */
  getByUser: (userId: string, params?: PayrollGetManyParams) =>
    apiClient.get<PayrollGetManyResponse>(`/payroll/user/${userId}`, { params }),

  /**
   * Get payrolls by month
   */
  getByMonth: (year: number, month: number, params?: PayrollGetManyParams) =>
    apiClient.get<PayrollGetManyResponse>(`/payroll/month/${year}/${month}`, { params }),

  /**
   * Get payroll by user and month
   */
  getByUserAndMonth: (userId: string, year: number, month: number, params?: PayrollGetByIdParams) =>
    apiClient.get<{ success: boolean; message: string; data: Payroll | null }>(
      `/payroll/user/${userId}/month/${year}/${month}`,
      { params }
    ),

  // =====================================================
  // Bonus Simulation
  // =====================================================

  /**
   * Simulate bonuses for all users with optional filters (GET)
   */
  simulateBonusesGet: (params: {
    year: number;
    month: number;
    taskQuantity?: number;
    sectorIds?: string;
    excludeUserIds?: string;
  }) =>
    apiClient.get<any>("/payroll/bonuses/simulate", { params }),

  /**
   * Simulate bonuses for all users with optional filters (POST)
   */
  simulateBonuses: (params: {
    year: number;
    month: number;
    taskQuantity?: number;
    sectorIds?: string[];
    excludeUserIds?: string[];
  }) =>
    apiClient.post<any>("/payroll/simulate-bonuses", params),

  // =====================================================
  // Legacy/Compatibility Methods
  // =====================================================

  /**
   * @deprecated Use getMany with period filter instead
   * Get current month payrolls
   */
  getCurrentMonth: (params?: PayrollGetManyParams) => {
    const now = new Date();
    return apiClient.get<PayrollGetManyResponse>(`/payroll/month/${now.getFullYear()}/${now.getMonth() + 1}`, { params });
  },

  /**
   * @deprecated Use getMany with period filter instead
   * Get payrolls with bonus data
   */
  getLiveBonuses: (year: number, month: number, params?: PayrollGetManyParams) =>
    apiClient.get<PayrollGetManyResponse>(`/payroll/month/${year}/${month}`, {
      params: {
        ...params,
        include: {
          user: { include: { position: true, sector: true } },
          bonus: { include: { tasks: true, bonusDiscounts: true } },
          discounts: true,
        },
      },
    }),

  /**
   * @deprecated Use generateMonthlyPayrolls instead
   */
  batchCreateForPeriod: (year: number, month: number) =>
    apiClient.post<any>("/payroll/generate-month", { year, month }),

  /**
   * @deprecated Not available in new controller
   */
  finalizeMonth: (_year: number, _month: number) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('finalizeMonth is deprecated - payrolls are finalized by cronjob');
    }
    return Promise.resolve({ data: { success: false, message: 'Deprecated' } });
  },

  /**
   * Enhanced payroll details with live calculation support
   */
  getPayrollDetails: (year: number, month: number, userId: string, params?: PayrollGetManyParams) =>
    apiClient.get<{ success: boolean; message: string; data: Payroll | null }>(
      `/payroll/user/${userId}/month/${year}/${month}`,
      {
        params: {
          ...params,
          include: {
            user: { include: { position: true, sector: true } },
            bonus: { include: { tasks: true, bonusDiscounts: true } },
            discounts: true,
          },
        },
      }
    ),
};