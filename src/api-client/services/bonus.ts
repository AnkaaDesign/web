import { apiClient } from '../axiosClient';
import type { BatchOperationResult } from '../../types';
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
  bonusId?: string;
  reference: string;
  percentage: number;
  value?: number | null;
  calculationOrder?: number;
}

// Interfaces for bonus calculation and batch operations
interface BonusCalculationParams {
  year: string;
  month: string;
}

interface BonusCalculationResult {
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

  // =====================================================
  // Live Bonus Calculation Endpoints (NEW - Clean Implementation)
  // =====================================================

  /**
   * Get live bonus calculations for a specific period
   * Uses new clean endpoint: GET /bonus/live/:year/:month
   */
  getLiveBonuses: (year: number, month: number) =>
    apiClient.get<PayrollData>(`/bonus/live/${year}/${month}`),

  /**
   * Get live bonus calculation for a specific user
   * Uses new clean endpoint: GET /bonus/live/:userId/:year/:month
   */
  getLiveBonusForUser: (userId: string, year: number, month: number) =>
    apiClient.get<any>(`/bonus/live/${userId}/${year}/${month}`),

  /**
   * Calculate and save bonuses for a specific period (Admin only)
   * Uses new clean endpoint: POST /bonus/calculate/:year/:month
   */
  calculateAndSaveBonuses: (params: BonusCalculationParams) =>
    apiClient.post<BonusCalculationResult>(`/bonus/calculate/${params.year}/${params.month}`),

  calculateBonuses: (params: BonusCalculationParams) =>
    apiClient.post<BonusCalculationResult>(`/bonus/calculate/${params.year}/${params.month}`),

  // =====================================================
  // Filtering Endpoints
  // =====================================================

  /**
   * Get bonuses by user
   * Uses new clean endpoint: GET /bonus/user/:userId
   */
  getByUser: (userId: string, params?: BonusGetManyParamsType) =>
    apiClient.get<BonusGetManyResponseType>(`/bonus/user/${userId}`, { params }),

  /**
   * Get bonuses by month
   * Uses new clean endpoint: GET /bonus/month/:year/:month
   */
  getByMonth: (year: number, month: number, params?: BonusGetManyParamsType) =>
    apiClient.get<BonusGetManyResponseType>(`/bonus/month/${year}/${month}`, { params }),

  /**
   * Get bonus by user and month
   * Uses new clean endpoint: GET /bonus/user/:userId/month/:year/:month
   */
  getByUserAndMonth: (userId: string, year: number, month: number) =>
    apiClient.get<any>(`/bonus/user/${userId}/month/${year}/${month}`),

  /**
   * Get bonus calculation details for debugging/transparency
   * Uses new clean endpoint: GET /bonus/calculation-details/:performanceLevel
   */
  getCalculationDetails: (performanceLevel: number, weightedTaskCount?: number) =>
    apiClient.get<any>(`/bonus/calculation-details/${performanceLevel}`, {
      params: weightedTaskCount ? { weightedTaskCount: weightedTaskCount.toString() } : undefined
    }),

  getLivePayrollData: (filters?: BonusPayrollFilters) => {
    const year = filters?.year || new Date().getFullYear().toString();
    const monthVal = Array.isArray(filters?.month) ? filters.month[0] : filters?.month;
    const month = monthVal || (new Date().getMonth() + 1).toString();
    return apiClient.get<PayrollData>(`/bonus/live/${year}/${month}`);
  },

  saveMonthlyBonuses: (params: BonusCalculationParams) =>
    apiClient.post<BonusCalculationResult>(`/bonus/calculate/${params.year}/${params.month}`),

  getPayroll: (params: BonusPayrollParams) => {
    const year = params.year || new Date().getFullYear().toString();
    const month = params.month || (new Date().getMonth() + 1).toString();
    return apiClient.get<PayrollData>(`/bonus/live/${year}/${month}`);
  },

  /**
   * Export payroll data to Excel
   */
  exportPayroll: (params: BonusPayrollParams) =>
    apiClient.get('/bonus/export-payroll', {
      params,
      responseType: 'blob'
    }),

  /**
   * Export bonuses data to Excel with filters
   * Similar to exportPayroll but supports more filter options
   */
  exportBonuses: (params?: BonusGetManyParamsType) =>
    apiClient.get('/bonus/export', {
      params,
      responseType: 'blob'
    }),

  // Bonus discount operations
  /**
   * Create discount for a bonus
   */
  createDiscount: (data: BonusDiscountCreateFormData) => {
    if (!data.bonusId) {
      throw new Error('bonusId is required in discount data');
    }
    return apiClient.post(`/bonus/${data.bonusId}/discounts`, data);
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
  BonusCalculationParams,
  BonusCalculationResult,
};

// Re-export form data types from schemas package
export type { BonusCreateFormData, BonusUpdateFormData } from '../../schemas';