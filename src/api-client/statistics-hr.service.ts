import { apiClient } from './axiosClient';
import type { AxiosRequestConfig } from 'axios';
import type { StatisticsFilters, ApiResponse } from './statistics-inventory.service';

// =====================
// Types
// =====================

export interface HROverview {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  totalDepartments: number;
  averageProductivity: number;
  attendanceRate: number;
  absenceRate: number;
  turnoverRate: number;
}

export interface ProductivityMetrics {
  overall: number;
  byUser: Array<{
    userId: string;
    userName: string;
    sectorName: string;
    positionName: string;
    activitiesCompleted: number;
    hoursWorked: number;
    productivity: number;
    efficiency: number;
    qualityScore: number;
  }>;
  bySector: Array<{
    sectorId: string;
    sectorName: string;
    employeeCount: number;
    totalActivities: number;
    averageProductivity: number;
    efficiency: number;
  }>;
  trends: {
    currentPeriod: number;
    previousPeriod: number;
    change: number;
    improving: boolean;
  };
}

export interface AttendanceMetrics {
  totalExpectedDays: number;
  totalPresentDays: number;
  totalAbsentDays: number;
  attendanceRate: number;
  punctualityRate: number;
  averageHoursPerDay: number;
  byUser: Array<{
    userId: string;
    userName: string;
    sectorName: string;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    attendanceRate: number;
    punctualityRate: number;
  }>;
  absenceReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  trends: Array<{
    date: string;
    attendanceRate: number;
    presentCount: number;
    absentCount: number;
  }>;
}

export interface PerformanceMetrics {
  averageRating: number;
  totalReviews: number;
  byUser: Array<{
    userId: string;
    userName: string;
    sectorName: string;
    positionName: string;
    averageRating: number;
    reviewCount: number;
    strengths: string[];
    improvements: string[];
    lastReviewDate: string;
  }>;
  byCategory: Array<{
    category: string;
    averageRating: number;
    trend: 'improving' | 'stable' | 'declining';
  }>;
  topPerformers: Array<{
    userId: string;
    userName: string;
    sectorName: string;
    rating: number;
    achievements: string[];
  }>;
}

export interface TrainingMetrics {
  totalTrainings: number;
  completedTrainings: number;
  inProgressTrainings: number;
  pendingTrainings: number;
  totalHoursTrained: number;
  averageCompletionRate: number;
  byUser: Array<{
    userId: string;
    userName: string;
    sectorName: string;
    completedTrainings: number;
    inProgressTrainings: number;
    totalHours: number;
    certifications: number;
  }>;
  byCategory: Array<{
    category: string;
    trainingsCount: number;
    completionRate: number;
    averageRating: number;
  }>;
  upcomingTrainings: Array<{
    trainingId: string;
    trainingName: string;
    startDate: string;
    enrolledUsers: number;
    status: string;
  }>;
}

export interface CompensationMetrics {
  totalPayroll: number;
  averageSalary: number;
  medianSalary: number;
  salaryRange: {
    min: number;
    max: number;
  };
  byPosition: Array<{
    positionId: string;
    positionName: string;
    employeeCount: number;
    averageSalary: number;
    medianSalary: number;
    salaryRange: {
      min: number;
      max: number;
    };
  }>;
  bySector: Array<{
    sectorId: string;
    sectorName: string;
    employeeCount: number;
    totalPayroll: number;
    averageSalary: number;
  }>;
  bonusMetrics: {
    totalBonuses: number;
    averageBonus: number;
    employeesWithBonuses: number;
    bonusRate: number;
  };
  trends: Array<{
    date: string;
    totalPayroll: number;
    averageSalary: number;
  }>;
}

export interface TurnoverMetrics {
  totalSeparations: number;
  voluntarySeparations: number;
  involuntarySeparations: number;
  turnoverRate: number;
  retentionRate: number;
  averageTenure: number;
  byReason: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  bySector: Array<{
    sectorId: string;
    sectorName: string;
    separations: number;
    turnoverRate: number;
    averageTenure: number;
  }>;
  trends: Array<{
    date: string;
    separations: number;
    turnoverRate: number;
  }>;
  costAnalysis: {
    averageReplacementCost: number;
    totalReplacementCost: number;
    estimatedProductivityLoss: number;
  };
}

// =====================
// Helper Functions
// =====================

const buildQueryParams = (filters: StatisticsFilters): Record<string, any> => {
  const params: Record<string, any> = {};

  if (filters.dateRange) {
    params.dateFrom = filters.dateRange.from.toISOString();
    params.dateTo = filters.dateRange.to.toISOString();
  }

  if (filters.period && filters.period !== 'custom') {
    params.period = filters.period;
  }

  if (filters.userId) params.userId = filters.userId;
  if (filters.sectorId) params.sectorId = filters.sectorId;

  return params;
};

// =====================
// Statistics HR Service
// =====================

/**
 * Statistics HR Service
 * Handles all HR-related statistics API calls
 */
export const statisticsHRService = {
  /**
   * Get HR overview statistics
   */
  getOverview: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<HROverview>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<HROverview>>(
      '/statistics/hr/overview',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get employee productivity metrics
   */
  getProductivityMetrics: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<ProductivityMetrics>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<ProductivityMetrics>>(
      '/statistics/hr/productivity',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get attendance metrics
   */
  getAttendanceMetrics: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<AttendanceMetrics>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<AttendanceMetrics>>(
      '/statistics/hr/attendance',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get performance review metrics
   */
  getPerformanceMetrics: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<PerformanceMetrics>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<PerformanceMetrics>>(
      '/statistics/hr/performance',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get training metrics
   */
  getTrainingMetrics: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<TrainingMetrics>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<TrainingMetrics>>(
      '/statistics/hr/training',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get compensation metrics
   */
  getCompensationMetrics: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<CompensationMetrics>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<CompensationMetrics>>(
      '/statistics/hr/compensation',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Get turnover metrics
   */
  getTurnoverMetrics: async (
    filters: StatisticsFilters,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<TurnoverMetrics>> => {
    const params = buildQueryParams(filters);
    const response = await apiClient.get<ApiResponse<TurnoverMetrics>>(
      '/statistics/hr/turnover',
      { params, ...config }
    );
    return response.data;
  },

  /**
   * Export HR statistics
   */
  exportStatistics: async (
    filters: StatisticsFilters,
    format: 'csv' | 'xlsx' | 'pdf' = 'xlsx'
  ): Promise<Blob> => {
    const params = { ...buildQueryParams(filters), format };
    const response = await apiClient.get('/statistics/hr/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

// Export types
export type {
  HROverview,
  ProductivityMetrics,
  AttendanceMetrics,
  PerformanceMetrics,
  TrainingMetrics,
  CompensationMetrics,
  TurnoverMetrics,
};
