import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { statisticsDashboardService } from '../statistics-dashboard.service';
import { apiClient } from '../axiosClient';
import type { StatisticsFilters } from '../statistics-inventory.service';
import type {
  UnifiedDashboardData,
  KPIMetrics,
  PerformanceSnapshot,
  ExecutiveSummary,
  ComparisonReport,
  RealTimeMetrics,
  ApiResponse,
} from '../statistics-dashboard.service';

// Mock axios client
vi.mock('../axiosClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('statisticsDashboardService', () => {
  const mockFilters: StatisticsFilters = {
    dateRange: {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    },
    period: 'month',
    categoryId: 'cat-123',
    brandId: 'brand-456',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUnifiedDashboard', () => {
    it('should fetch unified dashboard data successfully', async () => {
      const mockData: ApiResponse<UnifiedDashboardData> = {
        success: true,
        message: 'Data retrieved successfully',
        data: {
          overview: {
            totalRevenue: 100000,
            totalCost: 60000,
            totalProfit: 40000,
            profitMargin: 40,
            inventoryValue: 250000,
            activeOrders: 45,
            activeEmployees: 25,
            productivity: 85,
          },
          inventory: {
            totalItems: 500,
            totalValue: 250000,
            lowStockItems: 10,
            criticalItems: 3,
            stockHealth: 92,
            recentActivities: 150,
          },
          production: {
            ordersInProgress: 20,
            completedToday: 12,
            delayedOrders: 2,
            efficiency: 88,
            onTimeDeliveryRate: 94,
            qualityScore: 96,
          },
          financial: {
            revenue: 100000,
            expenses: 60000,
            profit: 40000,
            cashFlow: 15000,
            profitMargin: 40,
            revenueGrowth: 12,
          },
          hr: {
            activeEmployees: 25,
            attendanceRate: 95,
            productivity: 85,
            pendingLeaves: 3,
            turnoverRate: 5,
          },
          alerts: [],
          trends: {
            revenue: [],
            production: [],
            inventory: [],
            expenses: [],
          },
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockData });

      const result = await statisticsDashboardService.getUnifiedDashboard(mockFilters);

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/dashboard/unified', {
        params: {
          dateFrom: mockFilters.dateRange.from.toISOString(),
          dateTo: mockFilters.dateRange.to.toISOString(),
          period: 'month',
          categoryId: 'cat-123',
          brandId: 'brand-456',
        },
      });
      expect(result).toEqual(mockData);
      expect(result.success).toBe(true);
      expect(result.data.overview.totalRevenue).toBe(100000);
    });

    it('should build query params correctly with all filters', async () => {
      const fullFilters: StatisticsFilters = {
        dateRange: {
          from: new Date('2025-01-01'),
          to: new Date('2025-01-31'),
        },
        period: 'week',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        supplierId: 'supplier-1',
        userId: 'user-1',
        sectorId: 'sector-1',
        itemId: 'item-1',
      };

      const mockData: ApiResponse<UnifiedDashboardData> = {
        success: true,
        message: 'Success',
        data: {} as UnifiedDashboardData,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockData });

      await statisticsDashboardService.getUnifiedDashboard(fullFilters);

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/dashboard/unified', {
        params: {
          dateFrom: fullFilters.dateRange.from.toISOString(),
          dateTo: fullFilters.dateRange.to.toISOString(),
          period: 'week',
          categoryId: 'cat-1',
          brandId: 'brand-1',
          supplierId: 'supplier-1',
          userId: 'user-1',
          sectorId: 'sector-1',
          itemId: 'item-1',
        },
      });
    });

    it('should exclude custom period from query params', async () => {
      const customPeriodFilters: StatisticsFilters = {
        ...mockFilters,
        period: 'custom',
      };

      const mockData: ApiResponse<UnifiedDashboardData> = {
        success: true,
        message: 'Success',
        data: {} as UnifiedDashboardData,
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockData });

      await statisticsDashboardService.getUnifiedDashboard(customPeriodFilters);

      const callParams = vi.mocked(apiClient.get).mock.calls[0][1]?.params;
      expect(callParams).not.toHaveProperty('period');
    });

    it('should handle 400 bad request error', async () => {
      const error = {
        response: {
          status: 400,
          data: { message: 'Invalid date range' },
        },
      };

      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(statisticsDashboardService.getUnifiedDashboard(mockFilters)).rejects.toEqual(
        error
      );
    });

    it('should handle 401 unauthorized error', async () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      };

      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(statisticsDashboardService.getUnifiedDashboard(mockFilters)).rejects.toEqual(
        error
      );
    });

    it('should handle 404 not found error', async () => {
      const error = {
        response: {
          status: 404,
          data: { message: 'Dashboard not found' },
        },
      };

      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(statisticsDashboardService.getUnifiedDashboard(mockFilters)).rejects.toEqual(
        error
      );
    });

    it('should handle 500 internal server error', async () => {
      const error = {
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
      };

      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(statisticsDashboardService.getUnifiedDashboard(mockFilters)).rejects.toEqual(
        error
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');

      vi.mocked(apiClient.get).mockRejectedValueOnce(networkError);

      await expect(statisticsDashboardService.getUnifiedDashboard(mockFilters)).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('getKPIMetrics', () => {
    it('should fetch KPI metrics with filters', async () => {
      const mockData: ApiResponse<KPIMetrics> = {
        success: true,
        message: 'KPI data retrieved',
        data: {
          financial: {
            revenue: { value: 100000, change: 12, trend: 'up' },
            profit: { value: 40000, change: 8, trend: 'up' },
            profitMargin: { value: 40, change: 2, trend: 'up' },
            cashFlow: { value: 15000, change: -5, trend: 'down' },
          },
          operational: {
            inventoryTurnover: { value: 4.5, change: 0.3, trend: 'up' },
            orderFulfillment: { value: 95, change: 2, trend: 'up' },
            onTimeDelivery: { value: 94, change: 1, trend: 'up' },
            qualityRate: { value: 98, change: 0, trend: 'stable' },
          },
          hr: {
            productivity: { value: 85, change: 3, trend: 'up' },
            attendance: { value: 95, change: 1, trend: 'up' },
            satisfaction: { value: 88, change: -2, trend: 'down' },
            turnover: { value: 5, change: 1, trend: 'down' },
          },
          customer: {
            satisfaction: { value: 92, change: 3, trend: 'up' },
            retention: { value: 87, change: 2, trend: 'up' },
            orderValue: { value: 2500, change: 150, trend: 'up' },
            repeatRate: { value: 65, change: 5, trend: 'up' },
          },
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockData });

      const result = await statisticsDashboardService.getKPIMetrics(mockFilters);

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/dashboard/kpi', {
        params: expect.objectContaining({
          dateFrom: mockFilters.dateRange.from.toISOString(),
          dateTo: mockFilters.dateRange.to.toISOString(),
        }),
      });
      expect(result.data.financial.revenue.trend).toBe('up');
      expect(result.data.operational.inventoryTurnover.value).toBe(4.5);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
      };

      vi.mocked(apiClient.get).mockRejectedValueOnce(timeoutError);

      await expect(statisticsDashboardService.getKPIMetrics(mockFilters)).rejects.toEqual(
        timeoutError
      );
    });
  });

  describe('getExecutiveSummary', () => {
    it('should fetch executive summary with aggregated data', async () => {
      const mockData: ApiResponse<ExecutiveSummary> = {
        success: true,
        message: 'Executive summary retrieved',
        data: {
          period: 'Janeiro 2025',
          highlights: {
            revenue: { value: 100000, change: 12, vs: 'previous_month' },
            profit: { value: 40000, change: 8, vs: 'previous_month' },
            orders: { value: 150, change: 5, vs: 'previous_month' },
            efficiency: { value: 88, change: 3, vs: 'previous_month' },
          },
          keyMetrics: [
            {
              name: 'Margem de Lucro',
              value: 40,
              unit: '%',
              change: 2,
              status: 'good',
            },
          ],
          topPerformers: {
            products: [],
            customers: [],
            employees: [],
          },
          criticalIssues: [],
          opportunities: [],
          forecast: {
            revenue: [],
            orders: [],
            trends: [],
          },
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockData });

      const result = await statisticsDashboardService.getExecutiveSummary(mockFilters);

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/dashboard/executive-summary', {
        params: expect.any(Object),
      });
      expect(result.data.highlights.revenue.change).toBe(12);
      expect(result.data.period).toBe('Janeiro 2025');
    });
  });

  describe('exportDashboard', () => {
    it('should export dashboard in CSV format', async () => {
      const mockBlob = new Blob(['test data'], { type: 'text/csv' });

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockBlob });

      const result = await statisticsDashboardService.exportDashboard(mockFilters, 'csv');

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/dashboard/export', {
        params: expect.objectContaining({
          format: 'csv',
        }),
        responseType: 'blob',
      });
      expect(result).toBeInstanceOf(Blob);
    });

    it('should export dashboard in XLSX format', async () => {
      const mockBlob = new Blob(['excel data'], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockBlob });

      const result = await statisticsDashboardService.exportDashboard(mockFilters, 'xlsx');

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/dashboard/export', {
        params: expect.objectContaining({
          format: 'xlsx',
        }),
        responseType: 'blob',
      });
      expect(result).toBeInstanceOf(Blob);
    });

    it('should export dashboard in PDF format by default', async () => {
      const mockBlob = new Blob(['pdf data'], { type: 'application/pdf' });

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockBlob });

      const result = await statisticsDashboardService.exportDashboard(mockFilters);

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/dashboard/export', {
        params: expect.objectContaining({
          format: 'pdf',
        }),
        responseType: 'blob',
      });
      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('getComparisonReport', () => {
    it('should fetch comparison report with previous period', async () => {
      const mockData: ApiResponse<ComparisonReport> = {
        success: true,
        message: 'Comparison data retrieved',
        data: {
          currentPeriod: {
            start: '2025-01-01',
            end: '2025-01-31',
            metrics: { revenue: 100000, orders: 150 },
          },
          previousPeriod: {
            start: '2024-12-01',
            end: '2024-12-31',
            metrics: { revenue: 90000, orders: 140 },
          },
          changes: {
            revenue: { absolute: 10000, percentage: 11.11, trend: 'improving' },
            orders: { absolute: 10, percentage: 7.14, trend: 'improving' },
          },
          insights: ['Revenue improved by 11%', 'Order volume increased'],
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockData });

      const result = await statisticsDashboardService.getComparisonReport(mockFilters, 'previous');

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/dashboard/comparison', {
        params: expect.objectContaining({
          comparePeriod: 'previous',
        }),
      });
      expect(result.data.changes.revenue.trend).toBe('improving');
    });

    it('should fetch comparison report with year ago period', async () => {
      const mockData: ApiResponse<ComparisonReport> = {
        success: true,
        message: 'Comparison data retrieved',
        data: {
          currentPeriod: {
            start: '2025-01-01',
            end: '2025-01-31',
            metrics: {},
          },
          previousPeriod: {
            start: '2024-01-01',
            end: '2024-01-31',
            metrics: {},
          },
          changes: {},
          insights: [],
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockData });

      await statisticsDashboardService.getComparisonReport(mockFilters, 'year_ago');

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/dashboard/comparison', {
        params: expect.objectContaining({
          comparePeriod: 'year_ago',
        }),
      });
    });
  });

  describe('getRealTimeMetrics', () => {
    it('should fetch real-time metrics without filters', async () => {
      const mockData: ApiResponse<RealTimeMetrics> = {
        success: true,
        message: 'Real-time data retrieved',
        data: {
          timestamp: new Date().toISOString(),
          activeUsers: 12,
          activeOrders: 8,
          recentActivities: [],
          systemHealth: {
            overall: 95,
            database: 98,
            api: 97,
            storage: 92,
          },
          performance: {
            avgResponseTime: 120,
            requestsPerMinute: 450,
            errorRate: 0.5,
          },
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockData });

      const result = await statisticsDashboardService.getRealTimeMetrics();

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/dashboard/real-time', undefined);
      expect(result.data.systemHealth.overall).toBe(95);
      expect(result.data.performance.avgResponseTime).toBe(120);
    });
  });

  describe('refreshCache', () => {
    it('should refresh dashboard cache successfully', async () => {
      const mockData: ApiResponse<{ success: boolean; message: string }> = {
        success: true,
        message: 'Cache refreshed successfully',
        data: {
          success: true,
          message: 'Dashboard cache has been refreshed',
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockData });

      const result = await statisticsDashboardService.refreshCache(mockFilters);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/statistics/dashboard/refresh-cache',
        {},
        {
          params: expect.objectContaining({
            dateFrom: mockFilters.dateRange.from.toISOString(),
            dateTo: mockFilters.dateRange.to.toISOString(),
          }),
        }
      );
      expect(result.data.success).toBe(true);
    });
  });

  describe('getPerformanceSnapshot', () => {
    it('should fetch performance snapshot', async () => {
      const mockData: ApiResponse<PerformanceSnapshot> = {
        success: true,
        message: 'Performance snapshot retrieved',
        data: {
          timestamp: new Date().toISOString(),
          score: 85,
          status: 'good',
          categories: {
            inventory: { score: 92, status: 'excellent', issues: [] },
            production: { score: 88, status: 'good', issues: [] },
            financial: { score: 90, status: 'excellent', issues: [] },
            hr: { score: 70, status: 'fair', issues: ['High turnover'] },
          },
          recommendations: [],
          achievements: [],
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockData });

      const result = await statisticsDashboardService.getPerformanceSnapshot(mockFilters);

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/dashboard/performance-snapshot', {
        params: expect.any(Object),
      });
      expect(result.data.score).toBe(85);
      expect(result.data.status).toBe('good');
    });
  });

  describe('Type Safety', () => {
    it('should return correctly typed UnifiedDashboardData', async () => {
      const mockData: ApiResponse<UnifiedDashboardData> = {
        success: true,
        message: 'Success',
        data: {
          overview: {
            totalRevenue: 100000,
            totalCost: 60000,
            totalProfit: 40000,
            profitMargin: 40,
            inventoryValue: 250000,
            activeOrders: 45,
            activeEmployees: 25,
            productivity: 85,
          },
          inventory: {
            totalItems: 500,
            totalValue: 250000,
            lowStockItems: 10,
            criticalItems: 3,
            stockHealth: 92,
            recentActivities: 150,
          },
          production: {
            ordersInProgress: 20,
            completedToday: 12,
            delayedOrders: 2,
            efficiency: 88,
            onTimeDeliveryRate: 94,
            qualityScore: 96,
          },
          financial: {
            revenue: 100000,
            expenses: 60000,
            profit: 40000,
            cashFlow: 15000,
            profitMargin: 40,
            revenueGrowth: 12,
          },
          hr: {
            activeEmployees: 25,
            attendanceRate: 95,
            productivity: 85,
            pendingLeaves: 3,
            turnoverRate: 5,
          },
          alerts: [
            {
              id: 'alert-1',
              type: 'warning',
              category: 'inventory',
              title: 'Low Stock',
              message: 'Some items are low on stock',
              timestamp: new Date().toISOString(),
              actionRequired: true,
            },
          ],
          trends: {
            revenue: [{ date: '2025-01-01', value: 10000 }],
            production: [{ date: '2025-01-01', value: 50 }],
            inventory: [{ date: '2025-01-01', value: 500 }],
            expenses: [{ date: '2025-01-01', value: 5000 }],
          },
        },
        timestamp: new Date().toISOString(),
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockData });

      const result = await statisticsDashboardService.getUnifiedDashboard(mockFilters);

      // Type assertions to verify TypeScript inference
      const _revenue: number = result.data.overview.totalRevenue;
      const _alert = result.data.alerts[0];
      const _alertType: 'critical' | 'warning' | 'info' = _alert.type;
      const _category: 'inventory' | 'production' | 'financial' | 'hr' = _alert.category;

      expect(_revenue).toBe(100000);
      expect(_alertType).toBe('warning');
      expect(_category).toBe('inventory');
    });
  });

  describe('Retry Logic and Rate Limiting', () => {
    it('should handle rate limiting error (429)', async () => {
      const error = {
        response: {
          status: 429,
          data: { message: 'Too many requests' },
        },
      };

      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(statisticsDashboardService.getUnifiedDashboard(mockFilters)).rejects.toEqual(
        error
      );
    });

    it('should handle validation errors from server', async () => {
      const error = {
        response: {
          status: 422,
          data: {
            message: 'Validation failed',
            errors: {
              dateRange: 'Invalid date range',
            },
          },
        },
      };

      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(statisticsDashboardService.getUnifiedDashboard(mockFilters)).rejects.toEqual(
        error
      );
    });
  });

  describe('Custom Axios Config', () => {
    it('should accept and use custom axios config', async () => {
      const mockData: ApiResponse<UnifiedDashboardData> = {
        success: true,
        message: 'Success',
        data: {} as UnifiedDashboardData,
        timestamp: new Date().toISOString(),
      };

      const customConfig = {
        timeout: 10000,
        headers: { 'X-Custom-Header': 'test' },
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockData });

      await statisticsDashboardService.getUnifiedDashboard(mockFilters, customConfig);

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/dashboard/unified', {
        params: expect.any(Object),
        timeout: 10000,
        headers: { 'X-Custom-Header': 'test' },
      });
    });
  });
});
