import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { format, isWeekend } from "date-fns";

// Types for activity analytics
interface StatisticsFilters {
  dateRange: {
    from: Date;
    to: Date;
  };
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
  userId?: string;
  sectorId?: string;
}

interface ActivityAnalytics {
  totalActivities: number;
  activityTypes: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  hourlyDistribution: Array<{
    hour: number;
    count: number;
  }>;
  userRanking: Array<{
    userId: string;
    userName: string;
    activityCount: number;
    efficiency: number;
    sectorName: string;
  }>;
  sectorComparison: Array<{
    sectorId: string;
    sectorName: string;
    activityCount: number;
    avgEfficiency: number;
    userCount: number;
  }>;
  peakTimes: Array<{
    timeSlot: string;
    averageActivities: number;
    description: string;
  }>;
}

interface ActivityTrends {
  dailyVolume: Array<{
    date: string;
    total: number;
    incoming: number;
    outgoing: number;
    adjustments: number;
  }>;
  weeklyPattern: Array<{
    dayOfWeek: string;
    averageActivities: number;
    peakHour: string;
  }>;
  monthlyGrowth: {
    currentMonth: number;
    previousMonth: number;
    growthRate: number;
  };
}

interface ActivityHeatmap {
  userActivityMatrix: Array<{
    userId: string;
    userName: string;
    hourlyActivity: number[]; // 24 hours
    dailyTotal: number;
    efficiency: number;
  }>;
  sectorHeatmap: Array<{
    sectorId: string;
    sectorName: string;
    dailyActivity: number[]; // 7 days
    weeklyTotal: number;
  }>;
}

// Mock data generators
const generateMockActivityAnalytics = (): ActivityAnalytics => {
  const totalActivities = Math.floor(Math.random() * 500) + 200;

  // Activity types with realistic distribution
  const activityTypes = [
    { type: 'Recebimento', count: Math.floor(totalActivities * 0.35), percentage: 35 },
    { type: 'Saída', count: Math.floor(totalActivities * 0.30), percentage: 30 },
    { type: 'Transferência', count: Math.floor(totalActivities * 0.15), percentage: 15 },
    { type: 'Ajuste', count: Math.floor(totalActivities * 0.10), percentage: 10 },
    { type: 'Devolução', count: Math.floor(totalActivities * 0.07), percentage: 7 },
    { type: 'Outros', count: Math.floor(totalActivities * 0.03), percentage: 3 },
  ];

  // Hourly distribution (9-17h working hours)
  const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => {
    let baseCount = 0;
    if (hour >= 8 && hour <= 17) {
      // Working hours - higher activity
      baseCount = Math.floor(Math.random() * 30) + 10;
      // Peak around 10-11am and 2-3pm
      if (hour === 10 || hour === 14) {
        baseCount *= 1.5;
      }
    } else {
      // Outside working hours - minimal activity
      baseCount = Math.floor(Math.random() * 5);
    }
    return { hour, count: Math.floor(baseCount) };
  });

  // User ranking
  const userRanking = Array.from({ length: 12 }, (_, i) => ({
    userId: `user-${i + 1}`,
    userName: `Usuário ${i + 1}`,
    activityCount: Math.floor(Math.random() * 50) + 10,
    efficiency: Math.random() * 40 + 60, // 60-100%
    sectorName: ['Estoque', 'Produção', 'Manutenção', 'Administrativo'][Math.floor(Math.random() * 4)],
  })).sort((a, b) => b.activityCount - a.activityCount);

  // Sector comparison
  const sectorComparison = [
    { sectorId: 'warehouse', sectorName: 'Estoque', activityCount: Math.floor(totalActivities * 0.40), avgEfficiency: 85, userCount: 8 },
    { sectorId: 'production', sectorName: 'Produção', activityCount: Math.floor(totalActivities * 0.35), avgEfficiency: 78, userCount: 12 },
    { sectorId: 'maintenance', sectorName: 'Manutenção', activityCount: Math.floor(totalActivities * 0.15), avgEfficiency: 82, userCount: 5 },
    { sectorId: 'admin', sectorName: 'Administrativo', activityCount: Math.floor(totalActivities * 0.10), avgEfficiency: 75, userCount: 6 },
  ];

  return {
    totalActivities,
    activityTypes,
    hourlyDistribution,
    userRanking,
    sectorComparison,
    peakTimes: [
      { timeSlot: '10:00-11:00', averageActivities: 45, description: 'Pico matinal' },
      { timeSlot: '14:00-15:00', averageActivities: 38, description: 'Pico vespertino' },
      { timeSlot: '08:00-09:00', averageActivities: 25, description: 'Início do expediente' },
    ],
  };
};

const generateMockActivityTrends = (filters: StatisticsFilters): ActivityTrends => {
  const days = Math.ceil((filters.dateRange.to.getTime() - filters.dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
  const dailyVolume = [];

  for (let i = 0; i <= days; i++) {
    const date = new Date(filters.dateRange.from);
    date.setDate(date.getDate() + i);

    // Reduce activity on weekends
    const isWeekendDay = isWeekend(date);
    const baseFactor = isWeekendDay ? 0.3 : 1.0;

    const total = Math.floor((Math.random() * 40 + 20) * baseFactor);
    const incoming = Math.floor(total * (0.35 + Math.random() * 0.15));
    const outgoing = Math.floor(total * (0.30 + Math.random() * 0.15));
    const adjustments = total - incoming - outgoing;

    dailyVolume.push({
      date: format(date, 'yyyy-MM-dd'),
      total,
      incoming,
      outgoing,
      adjustments: Math.max(0, adjustments),
    });
  }

  const weeklyPattern = [
    { dayOfWeek: 'Segunda', averageActivities: 45, peakHour: '10:00' },
    { dayOfWeek: 'Terça', averageActivities: 52, peakHour: '14:00' },
    { dayOfWeek: 'Quarta', averageActivities: 48, peakHour: '10:00' },
    { dayOfWeek: 'Quinta', averageActivities: 55, peakHour: '11:00' },
    { dayOfWeek: 'Sexta', averageActivities: 42, peakHour: '15:00' },
    { dayOfWeek: 'Sábado', averageActivities: 15, peakHour: '09:00' },
    { dayOfWeek: 'Domingo', averageActivities: 8, peakHour: '10:00' },
  ];

  const currentMonth = Math.floor(Math.random() * 1000) + 500;
  const previousMonth = Math.floor(Math.random() * 1000) + 500;

  return {
    dailyVolume,
    weeklyPattern,
    monthlyGrowth: {
      currentMonth,
      previousMonth,
      growthRate: ((currentMonth - previousMonth) / previousMonth) * 100,
    },
  };
};

const generateMockActivityHeatmap = (): ActivityHeatmap => {
  // User activity matrix (24 hours)
  const userActivityMatrix = Array.from({ length: 8 }, (_, i) => {
    const hourlyActivity = Array.from({ length: 24 }, (_, hour) => {
      if (hour >= 8 && hour <= 17) {
        return Math.floor(Math.random() * 10) + 2;
      }
      return Math.floor(Math.random() * 2);
    });

    return {
      userId: `user-${i + 1}`,
      userName: `Usuário ${i + 1}`,
      hourlyActivity,
      dailyTotal: hourlyActivity.reduce((sum, count) => sum + count, 0),
      efficiency: Math.random() * 40 + 60,
    };
  });

  // Sector heatmap (7 days)
  const sectorHeatmap = [
    'Estoque', 'Produção', 'Manutenção', 'Administrativo'
  ].map((sectorName, i) => {
    const dailyActivity = Array.from({ length: 7 }, (_, day) => {
      // Reduce activity on weekends (5, 6)
      const isWeekendDay = day === 5 || day === 6;
      const baseFactor = isWeekendDay ? 0.2 : 1.0;
      return Math.floor((Math.random() * 50 + 20) * baseFactor);
    });

    return {
      sectorId: `sector-${i + 1}`,
      sectorName,
      dailyActivity,
      weeklyTotal: dailyActivity.reduce((sum, count) => sum + count, 0),
    };
  });

  return {
    userActivityMatrix,
    sectorHeatmap,
  };
};

// Query keys for caching
const activityAnalyticsKeys = {
  all: ['activity-analytics'] as const,
  analytics: (filters: StatisticsFilters) => [...activityAnalyticsKeys.all, 'analytics', filters] as const,
  trends: (filters: StatisticsFilters) => [...activityAnalyticsKeys.all, 'trends', filters] as const,
  heatmap: (filters: StatisticsFilters) => [...activityAnalyticsKeys.all, 'heatmap', filters] as const,
};

// Hook for getting activity analytics
export const useActivityAnalytics = (filters: StatisticsFilters) => {
  return useQuery({
    queryKey: activityAnalyticsKeys.analytics(filters),
    queryFn: async () => {
      // In a real implementation, this would call the API
      // await apiClient.get('/inventory/analytics/activities', { params: filters });

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 400));

      return generateMockActivityAnalytics();
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook for getting activity trends
export const useActivityTrends = (filters: StatisticsFilters) => {
  return useQuery({
    queryKey: activityAnalyticsKeys.trends(filters),
    queryFn: async () => {
      // In a real implementation, this would call the API
      // await apiClient.get('/inventory/analytics/activity-trends', { params: filters });

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));

      return generateMockActivityTrends(filters);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook for getting activity heatmap data
export const useActivityHeatmap = (filters: StatisticsFilters) => {
  return useQuery({
    queryKey: activityAnalyticsKeys.heatmap(filters),
    queryFn: async () => {
      // In a real implementation, this would call the API
      // await apiClient.get('/inventory/analytics/activity-heatmap', { params: filters });

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 600));

      return generateMockActivityHeatmap();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Combined analytics hook with computed insights
export const useActivityInsights = (filters: StatisticsFilters) => {
  const { data: analytics, isLoading: analyticsLoading } = useActivityAnalytics(filters);
  const { data: trends, isLoading: trendsLoading } = useActivityTrends(filters);
  const { data: heatmap, isLoading: heatmapLoading } = useActivityHeatmap(filters);

  const insights = useMemo(() => {
    if (!analytics || !trends || !heatmap) return null;

    // Calculate insights
    const peakEfficiencyUser = analytics.userRanking[0];
    const mostActiveSector = analytics.sectorComparison.reduce((max, sector) =>
      sector.activityCount > max.activityCount ? sector : max
    );

    const weekdayAvg = trends.weeklyPattern.slice(0, 5).reduce((sum, day) => sum + day.averageActivities, 0) / 5;
    const weekendAvg = trends.weeklyPattern.slice(5).reduce((sum, day) => sum + day.averageActivities, 0) / 2;

    const workLifeBalance = weekendAvg / weekdayAvg;

    // Activity intensity score (0-100)
    const intensityScore = Math.min(100, (analytics.totalActivities / filters.dateRange.from.getTime() * 86400000) * 10);

    return {
      peakEfficiencyUser,
      mostActiveSector,
      workLifeBalance: Number(workLifeBalance.toFixed(2)),
      intensityScore: Number(intensityScore.toFixed(1)),
      trends: {
        isGrowing: trends.monthlyGrowth.growthRate > 0,
        growthRate: trends.monthlyGrowth.growthRate,
      },
      recommendations: generateActivityRecommendations(analytics, trends),
    };
  }, [analytics, trends, heatmap, filters]);

  return {
    analytics,
    trends,
    heatmap,
    insights,
    isLoading: analyticsLoading || trendsLoading || heatmapLoading,
  };
};

// Helper function to generate activity-based recommendations
const generateActivityRecommendations = (analytics: ActivityAnalytics, trends: ActivityTrends): string[] => {
  const recommendations: string[] = [];

  // Check for low activity periods
  const lowActivityHours = analytics.hourlyDistribution.filter(h => h.hour >= 8 && h.hour <= 17 && h.count < 5);
  if (lowActivityHours.length > 2) {
    recommendations.push('Identificar causas de baixa atividade em horários de trabalho');
  }

  // Check for user efficiency disparities
  const efficiencyRange = analytics.userRanking[0].efficiency - analytics.userRanking[analytics.userRanking.length - 1].efficiency;
  if (efficiencyRange > 30) {
    recommendations.push('Implementar treinamento para equalizar eficiência entre usuários');
  }

  // Check for sector imbalances
  const sectorActivityVariance = analytics.sectorComparison.reduce((max, sector) => {
    const avg = analytics.sectorComparison.reduce((sum: number, s: any) => sum + s.activityCount, 0) / analytics.sectorComparison.length;
    const variance = Math.abs(sector.activityCount - avg);
    return variance > max ? variance : max;
  }, 0);

  if (sectorActivityVariance > analytics.totalActivities * 0.2) {
    recommendations.push('Revisar distribuição de carga de trabalho entre setores');
  }

  // Check growth trends
  if (trends.monthlyGrowth.growthRate < -10) {
    recommendations.push('Investigar queda na atividade operacional');
  } else if (trends.monthlyGrowth.growthRate > 25) {
    recommendations.push('Avaliar capacidade para sustentar crescimento de atividade');
  }

  if (recommendations.length === 0) {
    recommendations.push('Padrões de atividade estão dentro da normalidade');
  }

  return recommendations;
};

// Export query keys for external invalidation
export { activityAnalyticsKeys };