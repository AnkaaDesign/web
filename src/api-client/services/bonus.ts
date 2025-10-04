import { apiClient } from '../axiosClient';
import type { BatchOperationResult } from '../../types';

// Import proper types from packages
import type {
  Bonus,
  BonusIncludes,
  BonusGetManyParams as BonusGetManyParamsType,
  BonusGetManyResponse as BonusGetManyResponseType,
  BonusGetByIdParams
} from '../../types';

import type {
  BonusCreateFormData,
  BonusUpdateFormData
} from '../../schemas';

// Interfaces for live bonus calculation and payroll data
interface BonusPayrollFilters {
  year?: string;
  month?: string | string[];
  includeInactive?: boolean;
}

interface BonusPayrollParams {
  year?: string;
  month?: string;
  userId?: string;
}

interface PayrollData {
  meta: {
    period: string;
    totalUsers: number;
    eligibleUsers: number;
    averageTasksPerUser: number;
    totalTasks: number;
    calculatedAt: string;
  };
  bonuses: {
    userId: string;
    userName: string;
    userCpf: string;
    positionName: string;
    level: number;
    baseBonus: number;
    ponderedTaskCount: number;
    performance: number;
    sector: {
      id: string;
      name: string;
    };
  }[];
  summary: {
    totalBonus: number;
    averageBonus: number;
    minBonus: number;
    maxBonus: number;
  };
}

interface BonusDiscountCreateFormData {
  bonusId?: string; // Optional for backward compatibility
  reason: string;
  percentage: number;
}

// Interfaces for bonus calculation and batch operations
export interface BonusCalculationParams {
  year: string;
  month: string;
}

export interface BonusCalculationResult {
  success: boolean;
  message: string;
  data: {
    totalProcessed: number;
    totalSuccess: number;
    totalFailed: number;
    details: Array<{
      userId: string;
      userName: string;
      status: 'success' | 'failed';
      error?: string;
      calculatedBonus?: number;
    }>;
  };
}

export const bonusService = {
  // Standard CRUD operations using proper types
  getMany: (params?: BonusGetManyParamsType) =>
    apiClient.get<BonusGetManyResponseType>('/bonus', { params }),

  getById: (id: string, params?: BonusGetByIdParams) =>
    apiClient.get<Bonus>(`/bonus/${id}`, { params }),

  create: (data: BonusCreateFormData) =>
    apiClient.post<Bonus>('/bonus', data),

  update: (id: string, data: BonusUpdateFormData) =>
    apiClient.put<Bonus>(`/bonus/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/bonus/${id}`),

  // Batch operations
  batchCreate: (data: BonusCreateFormData[]) =>
    apiClient.post<BatchOperationResult<Bonus>>('/bonus/batch', { bonuses: data }),

  batchUpdate: (data: { id: string; data: BonusUpdateFormData }[]) =>
    apiClient.put<BatchOperationResult<Bonus>>('/bonus/batch', { updates: data }),

  batchDelete: (ids: string[]) =>
    apiClient.delete<BatchOperationResult<Bonus>>('/bonus/batch', { data: { ids } }),

  // Live bonus calculation and payroll data
  /**
   * Get live bonus calculations for a specific period (calculated on-demand)
   * This provides real-time bonus calculations without saving to database
   */
  getLivePayrollData: (filters?: BonusPayrollFilters) =>
    apiClient.get<PayrollData>('/bonus/payroll-data', { params: filters }),

  /**
   * Alias for getLivePayrollData - Get live bonuses by year/month
   * @param year - Year for calculation
   * @param month - Month for calculation
   */
  getLiveBonuses: (year: number, month: number) =>
    apiClient.get<PayrollData>('/bonus/payroll-data', { params: { year: year.toString(), month: month.toString() } }),

  /**
   * Calculate and save bonuses for a specific period
   * This saves the calculated bonuses to the database
   */
  calculateAndSaveBonuses: (params: BonusCalculationParams) =>
    apiClient.post<BonusCalculationResult>('/bonus/calculate-and-save', params),

  /**
   * Alias for calculateAndSaveBonuses - for hooks compatibility
   */
  calculateBonuses: (params: BonusCalculationParams) =>
    apiClient.post<BonusCalculationResult>('/bonus/calculate-and-save', params),

  /**
   * Legacy method - redirects to calculateAndSaveBonuses
   * @deprecated Use calculateAndSaveBonuses instead
   */
  saveMonthlyBonuses: (params: BonusCalculationParams) =>
    apiClient.post<BonusCalculationResult>('/bonus/save-monthly', params),

  /**
   * Get payroll data for a specific period
   * Similar to getLivePayrollData but formatted for payroll display
   */
  getPayroll: (params: BonusPayrollParams) =>
    apiClient.get<PayrollData>('/bonus/payroll-data', { params }),

  /**
   * Export payroll data to Excel
   */
  exportPayroll: (params: BonusPayrollParams) =>
    apiClient.get('/bonus/export-payroll', {
      params,
      responseType: 'blob'
    }),

  // Bonus discount operations
  /**
   * Create discount for a bonus
   * @param bonusIdOrData - Either bonusId string or discount data object (for backward compatibility)
   * @param dataOrUndefined - Discount data if first param is bonusId, undefined otherwise
   */
  createDiscount: (bonusIdOrData: string | BonusDiscountCreateFormData, dataOrUndefined?: BonusDiscountCreateFormData) => {
    // Handle both signatures for backward compatibility
    if (typeof bonusIdOrData === 'string' && dataOrUndefined) {
      // New signature: createDiscount(bonusId, data)
      return apiClient.post(`/bonus/${bonusIdOrData}/discounts`, dataOrUndefined);
    } else if (typeof bonusIdOrData === 'object') {
      // Old signature: createDiscount(data) - extract bonusId from data
      const data = bonusIdOrData;
      if (!data.bonusId) {
        throw new Error('bonusId is required in discount data');
      }
      return apiClient.post(`/bonus/${data.bonusId}/discounts`, data);
    }
    throw new Error('Invalid arguments for createDiscount');
  },

  deleteDiscount: (discountId: string) =>
    apiClient.delete(`/bonus/discounts/${discountId}`),
};

// Export the types for use in hooks
export type {
  // Standard types from packages
  Bonus,
  BonusIncludes,
  BonusGetManyParamsType as BonusGetManyParams,
  BonusGetManyResponseType as BonusGetManyResponse,
  BonusGetByIdParams,

  // Payroll and calculation types
  BonusPayrollParams,
  BonusPayrollFilters,
  PayrollData,
  BonusDiscountCreateFormData,
};

// Re-export form data types from schemas package
export type { BonusCreateFormData, BonusUpdateFormData } from '../../schemas';