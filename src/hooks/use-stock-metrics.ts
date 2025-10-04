import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
// import { format, differenceInDays } from "date-fns"; // Reserved for future use

// Types for stock metrics
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

interface StockMetrics {
  stockLevels: {
    total: number;
    available: number;
    reserved: number;
    damaged: number;
    inTransit: number;
  };
  turnoverMetrics: {
    averageTurnover: number;
    fastMovingItems: number;
    slowMovingItems: number;
    deadStock: number;
  };
  valueMetrics: {
    totalValue: number;
    averageItemValue: number;
    highestValue: number;
    lowestValue: number;
    valueDistribution: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
  };
  stockHealth: {
    stockAccuracy: number;
    fillRate: number;
    serviceLevel: number;
    overstock: number;
    understock: number;
  };
  categoryMetrics: Array<{
    categoryId: string;
    categoryName: string;
    itemCount: number;
    totalValue: number;
    turnoverRate: number;
    stockStatus: 'healthy' | 'warning' | 'critical';
  }>;
}

interface StockForecasting {
  demandForecast: Array<{
    itemId: string;
    itemName: string;
    currentStock: number;
    forecastedDemand: number;
    suggestedOrder: number;
    confidence: number;
  }>;
  reorderAnalysis: Array<{
    itemId: string;
    itemName: string;
    currentStock: number;
    reorderPoint: number;
    maxStock: number;
    daysUntilReorder: number;
    recommendedAction: string;
  }>;
  seasonalPatterns: Array<{
    month: string;
    demandMultiplier: number;
    historicalAverage: number;
    trendDirection: 'up' | 'down' | 'stable';
  }>;
}

interface PerformanceMetrics {
  efficiency: {
    inventoryTurnover: number;
    daysSalesInventory: number;
    stockoutRate: number;
    carryingCost: number;
  };
  accuracy: {
    cycleCounting: number;
    receivingAccuracy: number;
    pickingAccuracy: number;
    overallAccuracy: number;
  };
  cost: {
    totalCarryingCost: number;
    storageCostPerUnit: number;
    obsolescenceCost: number;
    orderingCost: number;
  };
}

// Mock data generators
const generateMockStockMetrics = (): StockMetrics => {
  const totalItems = Math.floor(Math.random() * 500) + 300;

  return {
    stockLevels: {
      total: totalItems,
      available: Math.floor(totalItems * 0.85),
      reserved: Math.floor(totalItems * 0.10),
      damaged: Math.floor(totalItems * 0.03),
      inTransit: Math.floor(totalItems * 0.02),
    },
    turnoverMetrics: {
      averageTurnover: Number((Math.random() * 8 + 4).toFixed(2)),
      fastMovingItems: Math.floor(totalItems * 0.20),
      slowMovingItems: Math.floor(totalItems * 0.15),
      deadStock: Math.floor(totalItems * 0.05),
    },
    valueMetrics: {
      totalValue: Math.floor(Math.random() * 500000) + 200000,
      averageItemValue: Math.floor(Math.random() * 200) + 50,
      highestValue: Math.floor(Math.random() * 5000) + 1000,
      lowestValue: Math.floor(Math.random() * 50) + 5,
      valueDistribution: [
        { range: 'R$ 0-50', count: Math.floor(totalItems * 0.40), percentage: 40 },
        { range: 'R$ 51-200', count: Math.floor(totalItems * 0.35), percentage: 35 },
        { range: 'R$ 201-500', count: Math.floor(totalItems * 0.15), percentage: 15 },
        { range: 'R$ 501-1000', count: Math.floor(totalItems * 0.07), percentage: 7 },
        { range: 'R$ 1000+', count: Math.floor(totalItems * 0.03), percentage: 3 },
      ],
    },
    stockHealth: {
      stockAccuracy: Math.random() * 10 + 90, // 90-100%
      fillRate: Math.random() * 15 + 85, // 85-100%
      serviceLevel: Math.random() * 8 + 92, // 92-100%
      overstock: Math.floor(totalItems * (Math.random() * 0.05 + 0.02)), // 2-7%
      understock: Math.floor(totalItems * (Math.random() * 0.08 + 0.05)), // 5-13%
    },
    categoryMetrics: [
      'Ferramentas', 'Materiais', 'EPI', 'Eletrônicos', 'Consumíveis', 'Peças'
    ].map((name, i) => ({
      categoryId: `cat-${i + 1}`,
      categoryName: name,
      itemCount: Math.floor(totalItems * (Math.random() * 0.3 + 0.1)),
      totalValue: Math.floor(Math.random() * 80000) + 20000,
      turnoverRate: Number((Math.random() * 10 + 2).toFixed(2)),
      stockStatus: (['healthy', 'warning', 'critical'] as const)[Math.floor(Math.random() * 3)],
    })),
  };
};

const generateMockStockForecasting = (): StockForecasting => {
  const itemCount = 15;

  return {
    demandForecast: Array.from({ length: itemCount }, (_, i) => {
      const currentStock = Math.floor(Math.random() * 100) + 10;
      const forecastedDemand = Math.floor(Math.random() * 50) + 5;
      return {
        itemId: `item-${i + 1}`,
        itemName: `Item ${String.fromCharCode(65 + i)}${Math.floor(i / 26) + 1}`,
        currentStock,
        forecastedDemand,
        suggestedOrder: Math.max(0, forecastedDemand - currentStock + Math.floor(Math.random() * 20)),
        confidence: Math.random() * 30 + 70, // 70-100%
      };
    }),
    reorderAnalysis: Array.from({ length: itemCount }, (_, i) => {
      const currentStock = Math.floor(Math.random() * 80) + 5;
      const reorderPoint = Math.floor(Math.random() * 30) + 10;
      const maxStock = Math.floor(Math.random() * 100) + 50;
      const daysUntilReorder = Math.max(0, Math.floor((currentStock - reorderPoint) / (Math.random() * 3 + 1)));

      let recommendedAction = 'Monitorar';
      if (currentStock <= reorderPoint) recommendedAction = 'Reabastecer agora';
      else if (daysUntilReorder <= 7) recommendedAction = 'Programar pedido';

      return {
        itemId: `item-${i + 1}`,
        itemName: `Item ${String.fromCharCode(65 + i)}${Math.floor(i / 26) + 1}`,
        currentStock,
        reorderPoint,
        maxStock,
        daysUntilReorder,
        recommendedAction,
      };
    }),
    seasonalPatterns: [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ].map(month => {
      const multiplier = Number((Math.random() * 0.6 + 0.7).toFixed(2)); // 0.7-1.3
      const average = Math.floor(Math.random() * 1000) + 500;
      return {
        month,
        demandMultiplier: multiplier,
        historicalAverage: average,
        trendDirection: (multiplier > 1.1 ? 'up' : multiplier < 0.9 ? 'down' : 'stable') as 'up' | 'down' | 'stable',
      };
    }),
  };
};

const generateMockPerformanceMetrics = (): PerformanceMetrics => {
  return {
    efficiency: {
      inventoryTurnover: Number((Math.random() * 8 + 4).toFixed(2)),
      daysSalesInventory: Math.floor(Math.random() * 60) + 30,
      stockoutRate: Number((Math.random() * 5 + 1).toFixed(2)),
      carryingCost: Number((Math.random() * 25 + 15).toFixed(2)),
    },
    accuracy: {
      cycleCounting: Number((Math.random() * 10 + 90).toFixed(1)),
      receivingAccuracy: Number((Math.random() * 8 + 92).toFixed(1)),
      pickingAccuracy: Number((Math.random() * 12 + 88).toFixed(1)),
      overallAccuracy: Number((Math.random() * 7 + 93).toFixed(1)),
    },
    cost: {
      totalCarryingCost: Math.floor(Math.random() * 50000) + 25000,
      storageCostPerUnit: Number((Math.random() * 5 + 2).toFixed(2)),
      obsolescenceCost: Math.floor(Math.random() * 15000) + 5000,
      orderingCost: Math.floor(Math.random() * 8000) + 2000,
    },
  };
};

// Query keys for caching
const stockMetricsKeys = {
  all: ['stock-metrics'] as const,
  metrics: (filters: StatisticsFilters) => [...stockMetricsKeys.all, 'metrics', filters] as const,
  forecasting: (filters: StatisticsFilters) => [...stockMetricsKeys.all, 'forecasting', filters] as const,
  performance: () => [...stockMetricsKeys.all, 'performance'] as const,
};

// Hook for getting comprehensive stock metrics
export const useStockMetrics = (filters: StatisticsFilters) => {
  return useQuery({
    queryKey: stockMetricsKeys.metrics(filters),
    queryFn: async () => {
      // In a real implementation, this would call the API
      // await apiClient.get('/inventory/metrics/stock', { params: filters });

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      return generateMockStockMetrics();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
};

// Hook for getting stock forecasting data
export const useStockForecasting = (filters: StatisticsFilters) => {
  return useQuery({
    queryKey: stockMetricsKeys.forecasting(filters),
    queryFn: async () => {
      // In a real implementation, this would call the API
      // await apiClient.get('/inventory/metrics/forecasting', { params: filters });

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 700));

      return generateMockStockForecasting();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - forecasting data changes less frequently
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Hook for getting performance metrics
export const usePerformanceMetrics = () => {
  return useQuery({
    queryKey: stockMetricsKeys.performance(),
    queryFn: async () => {
      // In a real implementation, this would call the API
      // await apiClient.get('/inventory/metrics/performance');

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 400));

      return generateMockPerformanceMetrics();
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Combined stock insights hook
export const useStockInsights = (filters: StatisticsFilters) => {
  const { data: metrics, isLoading: metricsLoading } = useStockMetrics(filters);
  const { data: forecasting, isLoading: forecastingLoading } = useStockForecasting(filters);
  const { data: performance, isLoading: performanceLoading } = usePerformanceMetrics();

  const insights = useMemo(() => {
    if (!metrics || !forecasting || !performance) return null;

    // Calculate key insights
    const stockEfficiency = (metrics.stockLevels.available / metrics.stockLevels.total) * 100;
    const valueConcentration = metrics.categoryMetrics
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 3)
      .reduce((sum, cat) => sum + cat.totalValue, 0) / metrics.valueMetrics.totalValue * 100;

    const urgentReorders = forecasting.reorderAnalysis.filter(item =>
      item.recommendedAction === 'Reabastecer agora'
    ).length;

    const forecastAccuracy = forecasting.demandForecast.reduce((sum, item) =>
      sum + item.confidence, 0) / forecasting.demandForecast.length;

    // Risk assessment
    const riskFactors = [];
    if (metrics.stockHealth.serviceLevel < 95) riskFactors.push('Baixo nível de serviço');
    // if (metrics.stockHealth.stockoutRate > 5) riskFactors.push('Alta taxa de ruptura'); // stockoutRate field check disabled
    if (urgentReorders > 5) riskFactors.push('Muitos itens necessitam reabastecimento urgente');
    if (performance.efficiency.carryingCost > 30) riskFactors.push('Alto custo de carregamento');

    return {
      stockEfficiency: Number(stockEfficiency.toFixed(1)),
      valueConcentration: Number(valueConcentration.toFixed(1)),
      urgentReorders,
      forecastAccuracy: Number(forecastAccuracy.toFixed(1)),
      overallHealth: calculateOverallHealth(metrics, performance),
      riskFactors,
      recommendations: generateStockRecommendations(metrics, forecasting, performance),
    };
  }, [metrics, forecasting, performance]);

  return {
    metrics,
    forecasting,
    performance,
    insights,
    isLoading: metricsLoading || forecastingLoading || performanceLoading,
  };
};

// Helper function to calculate overall stock health score
const calculateOverallHealth = (metrics: StockMetrics, performance: PerformanceMetrics): number => {
  const factors = [
    metrics.stockHealth.stockAccuracy / 100 * 25, // 25% weight
    metrics.stockHealth.serviceLevel / 100 * 25, // 25% weight
    Math.min(1, performance.efficiency.inventoryTurnover / 8) * 20, // 20% weight
    performance.accuracy.overallAccuracy / 100 * 20, // 20% weight
    Math.max(0, 1 - performance.efficiency.stockoutRate / 10) * 10, // 10% weight
  ];

  return Number((factors.reduce((sum, factor) => sum + factor, 0)).toFixed(1));
};

// Helper function to generate stock-based recommendations
const generateStockRecommendations = (
  metrics: StockMetrics,
  forecasting: StockForecasting,
  performance: PerformanceMetrics
): string[] => {
  const recommendations: string[] = [];

  // Service level recommendations
  if (metrics.stockHealth.serviceLevel < 95) {
    recommendations.push('Melhorar nível de serviço aumentando pontos de reposição');
  }

  // Accuracy recommendations
  if (performance.accuracy.overallAccuracy < 95) {
    recommendations.push('Implementar contagem cíclica mais frequente para melhorar precisão');
  }

  // Turnover recommendations
  if (performance.efficiency.inventoryTurnover < 4) {
    recommendations.push('Revisar níveis de estoque para melhorar giro do inventário');
  }

  // Dead stock recommendations
  if (metrics.turnoverMetrics.deadStock > metrics.stockLevels.total * 0.05) {
    recommendations.push('Implementar programa de liquidação para estoque parado');
  }

  // Forecasting recommendations
  const lowConfidenceItems = forecasting.demandForecast.filter(item => item.confidence < 80).length;
  if (lowConfidenceItems > forecasting.demandForecast.length * 0.3) {
    recommendations.push('Melhorar qualidade dos dados para aumentar precisão das previsões');
  }

  // Cost recommendations
  if (performance.efficiency.carryingCost > 25) {
    recommendations.push('Otimizar níveis de estoque para reduzir custo de carregamento');
  }

  // Reorder recommendations
  const urgentReorders = forecasting.reorderAnalysis.filter(item =>
    item.recommendedAction === 'Reabastecer agora'
  ).length;
  if (urgentReorders > 0) {
    recommendations.push(`Processar ${urgentReorders} pedidos de reabastecimento urgentes`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Desempenho do estoque está dentro dos parâmetros ideais');
  }

  return recommendations;
};

// Export query keys for external invalidation
export { stockMetricsKeys };