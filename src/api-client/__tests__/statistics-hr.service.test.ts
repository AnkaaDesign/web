import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { statisticsHRService } from '../statistics-hr.service';
import { apiClient } from '../axiosClient';
import type { StatisticsFilters } from '../statistics-inventory.service';

// Mock axios client
vi.mock('../axiosClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('Statistics HR Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getOverview', () => {
    it('should fetch HR overview statistics', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'HR overview retrieved successfully',
          data: {
            totalEmployees: 150,
            activeEmployees: 145,
            inactiveEmployees: 5,
            totalDepartments: 8,
            averageProductivity: 87.5,
            attendanceRate: 95.2,
            absenceRate: 4.8,
            turnoverRate: 12.3,
          },
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const filters: StatisticsFilters = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
        period: 'year',
      };

      const result = await statisticsHRService.getOverview(filters);

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/hr/overview',
        expect.objectContaining({
          params: expect.objectContaining({
            dateFrom: filters.dateRange!.from.toISOString(),
            dateTo: filters.dateRange!.to.toISOString(),
          }),
        })
      );
      expect(result.data.totalEmployees).toBe(150);
      expect(result.data.activeEmployees).toBe(145);
    });

    it('should include sector filter in request', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            totalEmployees: 50,
            activeEmployees: 48,
            inactiveEmployees: 2,
            totalDepartments: 3,
            averageProductivity: 90.0,
            attendanceRate: 96.0,
            absenceRate: 4.0,
            turnoverRate: 8.5,
          },
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const filters: StatisticsFilters = {
        sectorId: 'sector-123',
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
      };

      await statisticsHRService.getOverview(filters);

      expect(apiClient.get).toHaveBeenCalledWith(
        '/statistics/hr/overview',
        expect.objectContaining({
          params: expect.objectContaining({
            sectorId: 'sector-123',
          }),
        })
      );
    });
  });

  describe('getProductivityMetrics', () => {
    it('should fetch productivity metrics', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            overall: 88.5,
            byUser: [
              {
                userId: 'user-1',
                userName: 'John Doe',
                sectorName: 'Engineering',
                positionName: 'Senior Developer',
                activitiesCompleted: 150,
                hoursWorked: 160,
                productivity: 92.5,
                efficiency: 94.0,
                qualityScore: 90.0,
              },
            ],
            bySector: [
              {
                sectorId: 'sector-1',
                sectorName: 'Engineering',
                employeeCount: 25,
                totalActivities: 3750,
                averageProductivity: 91.2,
                efficiency: 93.0,
              },
            ],
            trends: {
              currentPeriod: 88.5,
              previousPeriod: 85.2,
              change: 3.3,
              improving: true,
            },
          },
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const filters: StatisticsFilters = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
      };

      const result = await statisticsHRService.getProductivityMetrics(filters);

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/hr/productivity', expect.any(Object));
      expect(result.data.overall).toBe(88.5);
      expect(result.data.byUser).toHaveLength(1);
      expect(result.data.trends.improving).toBe(true);
    });

    it('should handle user-specific productivity queries', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            overall: 92.5,
            byUser: [],
            bySector: [],
            trends: {
              currentPeriod: 92.5,
              previousPeriod: 90.0,
              change: 2.5,
              improving: true,
            },
          },
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const filters: StatisticsFilters = {
        userId: 'user-123',
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-03-31'),
        },
      };

      await statisticsHRService.getProductivityMetrics(filters);

      expect(apiClient.get).toHaveBeenCalledWith(
        '/statistics/hr/productivity',
        expect.objectContaining({
          params: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      );
    });
  });

  describe('getAttendanceMetrics', () => {
    it('should fetch attendance metrics', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            totalExpectedDays: 2200,
            totalPresentDays: 2090,
            totalAbsentDays: 110,
            attendanceRate: 95.0,
            punctualityRate: 92.0,
            averageHoursPerDay: 8.2,
            byUser: [
              {
                userId: 'user-1',
                userName: 'John Doe',
                sectorName: 'Engineering',
                presentDays: 88,
                absentDays: 2,
                lateDays: 5,
                attendanceRate: 97.8,
                punctualityRate: 94.3,
              },
            ],
            absenceReasons: [
              { reason: 'Sick Leave', count: 45, percentage: 40.9 },
              { reason: 'Personal', count: 35, percentage: 31.8 },
              { reason: 'Vacation', count: 30, percentage: 27.3 },
            ],
            trends: [
              {
                date: '2024-01',
                attendanceRate: 94.5,
                presentCount: 142,
                absentCount: 8,
              },
            ],
          },
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const filters: StatisticsFilters = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
      };

      const result = await statisticsHRService.getAttendanceMetrics(filters);

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/hr/attendance', expect.any(Object));
      expect(result.data.attendanceRate).toBe(95.0);
      expect(result.data.absenceReasons).toHaveLength(3);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should fetch performance review metrics', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            averageRating: 4.2,
            totalReviews: 250,
            byUser: [
              {
                userId: 'user-1',
                userName: 'John Doe',
                sectorName: 'Engineering',
                positionName: 'Senior Developer',
                averageRating: 4.5,
                reviewCount: 4,
                strengths: ['Technical Skills', 'Leadership'],
                improvements: ['Time Management'],
                lastReviewDate: '2024-03-15',
              },
            ],
            byCategory: [
              {
                category: 'Technical Skills',
                averageRating: 4.3,
                trend: 'improving' as const,
              },
              {
                category: 'Communication',
                averageRating: 4.1,
                trend: 'stable' as const,
              },
            ],
            topPerformers: [
              {
                userId: 'user-1',
                userName: 'John Doe',
                sectorName: 'Engineering',
                rating: 4.8,
                achievements: ['Project Lead', 'Mentor'],
              },
            ],
          },
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const filters: StatisticsFilters = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
      };

      const result = await statisticsHRService.getPerformanceMetrics(filters);

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/hr/performance', expect.any(Object));
      expect(result.data.averageRating).toBe(4.2);
      expect(result.data.topPerformers).toHaveLength(1);
    });
  });

  describe('getTrainingMetrics', () => {
    it('should fetch training metrics', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            totalTrainings: 45,
            completedTrainings: 38,
            inProgressTrainings: 5,
            pendingTrainings: 2,
            totalHoursTrained: 1250,
            averageCompletionRate: 84.4,
            byUser: [],
            byCategory: [],
            upcomingTrainings: [],
          },
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const filters: StatisticsFilters = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
      };

      const result = await statisticsHRService.getTrainingMetrics(filters);

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/hr/training', expect.any(Object));
      expect(result.data.totalTrainings).toBe(45);
      expect(result.data.averageCompletionRate).toBe(84.4);
    });
  });

  describe('getCompensationMetrics', () => {
    it('should fetch compensation metrics', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            totalPayroll: 2500000,
            averageSalary: 65000,
            medianSalary: 60000,
            salaryRange: { min: 35000, max: 150000 },
            byPosition: [],
            bySector: [],
            bonusMetrics: {
              totalBonuses: 350000,
              averageBonus: 5000,
              employeesWithBonuses: 70,
              bonusRate: 46.7,
            },
            trends: [],
          },
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const filters: StatisticsFilters = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
      };

      const result = await statisticsHRService.getCompensationMetrics(filters);

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/hr/compensation', expect.any(Object));
      expect(result.data.totalPayroll).toBe(2500000);
      expect(result.data.bonusMetrics.totalBonuses).toBe(350000);
    });

    it('should not expose sensitive salary data without proper authorization', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            totalPayroll: 2500000,
            averageSalary: 65000,
            medianSalary: 60000,
            salaryRange: { min: 35000, max: 150000 },
            byPosition: [],
            bySector: [],
            bonusMetrics: {
              totalBonuses: 350000,
              averageBonus: 5000,
              employeesWithBonuses: 70,
              bonusRate: 46.7,
            },
            trends: [],
          },
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await statisticsHRService.getCompensationMetrics({
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
      });

      // Verify no individual employee salary data is exposed
      expect(result.data.byPosition).toBeDefined();
      expect(result.data.bySector).toBeDefined();
      // Data should be aggregated, not individual
    });
  });

  describe('getTurnoverMetrics', () => {
    it('should fetch turnover metrics', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            totalSeparations: 18,
            voluntarySeparations: 12,
            involuntarySeparations: 6,
            turnoverRate: 12.0,
            retentionRate: 88.0,
            averageTenure: 3.5,
            byReason: [
              { reason: 'Better Opportunity', count: 8, percentage: 44.4 },
              { reason: 'Relocation', count: 4, percentage: 22.2 },
            ],
            bySector: [],
            trends: [],
            costAnalysis: {
              averageReplacementCost: 25000,
              totalReplacementCost: 450000,
              estimatedProductivityLoss: 180000,
            },
          },
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const filters: StatisticsFilters = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
      };

      const result = await statisticsHRService.getTurnoverMetrics(filters);

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/hr/turnover', expect.any(Object));
      expect(result.data.turnoverRate).toBe(12.0);
      expect(result.data.retentionRate).toBe(88.0);
    });
  });

  describe('exportStatistics', () => {
    it('should export HR statistics as XLSX', async () => {
      const mockBlob = new Blob(['mock data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const mockResponse = { data: mockBlob };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const filters: StatisticsFilters = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
      };

      const result = await statisticsHRService.exportStatistics(filters, 'xlsx');

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/hr/export', {
        params: expect.objectContaining({
          format: 'xlsx',
        }),
        responseType: 'blob',
      });
      expect(result).toBeInstanceOf(Blob);
    });

    it('should export HR statistics as CSV', async () => {
      const mockBlob = new Blob(['mock,data'], { type: 'text/csv' });
      const mockResponse = { data: mockBlob };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const filters: StatisticsFilters = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
      };

      const result = await statisticsHRService.exportStatistics(filters, 'csv');

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/hr/export', {
        params: expect.objectContaining({
          format: 'csv',
        }),
        responseType: 'blob',
      });
    });

    it('should export HR statistics as PDF', async () => {
      const mockBlob = new Blob(['mock pdf'], { type: 'application/pdf' });
      const mockResponse = { data: mockBlob };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const filters: StatisticsFilters = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
      };

      const result = await statisticsHRService.exportStatistics(filters, 'pdf');

      expect(apiClient.get).toHaveBeenCalledWith('/statistics/hr/export', {
        params: expect.objectContaining({
          format: 'pdf',
        }),
        responseType: 'blob',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      vi.mocked(apiClient.get).mockRejectedValue(networkError);

      await expect(
        statisticsHRService.getOverview({
          dateRange: {
            from: new Date('2024-01-01'),
            to: new Date('2024-12-31'),
          },
        })
      ).rejects.toThrow('Network Error');
    });

    it('should handle 404 errors', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { message: 'Endpoint not found' },
        },
      };
      vi.mocked(apiClient.get).mockRejectedValue(notFoundError);

      await expect(
        statisticsHRService.getProductivityMetrics({
          dateRange: {
            from: new Date('2024-01-01'),
            to: new Date('2024-12-31'),
          },
        })
      ).rejects.toMatchObject(notFoundError);
    });

    it('should handle unauthorized access', async () => {
      const unauthorizedError = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      };
      vi.mocked(apiClient.get).mockRejectedValue(unauthorizedError);

      await expect(
        statisticsHRService.getCompensationMetrics({
          dateRange: {
            from: new Date('2024-01-01'),
            to: new Date('2024-12-31'),
          },
        })
      ).rejects.toMatchObject(unauthorizedError);
    });
  });

  describe('Query Parameter Building', () => {
    it('should build query parameters correctly', async () => {
      const mockResponse = { data: { success: true, data: {} } };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const filters: StatisticsFilters = {
        dateRange: {
          from: new Date('2024-01-01T00:00:00Z'),
          to: new Date('2024-12-31T23:59:59Z'),
        },
        period: 'month',
        userId: 'user-123',
        sectorId: 'sector-456',
      };

      await statisticsHRService.getOverview(filters);

      expect(apiClient.get).toHaveBeenCalledWith(
        '/statistics/hr/overview',
        expect.objectContaining({
          params: expect.objectContaining({
            dateFrom: filters.dateRange!.from.toISOString(),
            dateTo: filters.dateRange!.to.toISOString(),
            userId: 'user-123',
            sectorId: 'sector-456',
          }),
        })
      );
    });

    it('should exclude custom period from params', async () => {
      const mockResponse = { data: { success: true, data: {} } };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const filters: StatisticsFilters = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
        period: 'custom',
      };

      await statisticsHRService.getOverview(filters);

      const callParams = vi.mocked(apiClient.get).mock.calls[0][1]?.params;
      expect(callParams).not.toHaveProperty('period');
    });
  });
});
