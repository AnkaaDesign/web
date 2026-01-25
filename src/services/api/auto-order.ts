import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api-client/axiosClient';

// =====================
// Types
// =====================

export interface AutoOrderRecommendation {
  itemId: string;
  itemName: string;
  currentStock: number;
  monthlyConsumption: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  trendPercentage: number;
  daysUntilStockout: number;
  recommendedOrderQuantity: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  supplierId: string | null;
  supplierName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  lastOrderDate: Date | null;
  daysSinceLastOrder: number | null;
  hasActivePendingOrder: boolean;
  estimatedLeadTime: number;
  estimatedCost: number;
  reorderPoint: number | null;
  maxQuantity: number | null;
  isInSchedule: boolean;
  scheduleNextRun: Date | null;
  isEmergencyOverride: boolean;
}

export interface AutoOrderSupplierGroup {
  supplierId: string | null;
  supplierName: string | null;
  itemCount: number;
  totalEstimatedCost: number;
  items: AutoOrderRecommendation[];
}

export interface AutoOrderAnalysisResponse {
  success: boolean;
  data: {
    totalRecommendations: number;
    recommendations: AutoOrderRecommendation[];
    supplierGroups: AutoOrderSupplierGroup[];
    summary: {
      totalItems: number;
      totalEstimatedCost: number;
      criticalItems: number;
      emergencyOverrides: number;
      scheduledItems: number;
    };
  };
}

export interface AutoOrderCreateRequest {
  recommendations: Array<{
    itemId: string;
    quantity: number;
    reason?: string;
  }>;
  groupBySupplier?: boolean;
}

export interface ScheduledItem {
  itemId: string;
  itemName: string;
  scheduleId: string;
  scheduleName: string;
  nextRun: Date | null;
}

// =====================
// API Functions
// =====================

export async function analyzeAutoOrders(params?: {
  lookbackMonths?: number;
  minStockCriteria?: 'all' | 'low' | 'critical';
  supplierIds?: string[];
  categoryIds?: string[];
}): Promise<AutoOrderAnalysisResponse> {
  const searchParams = new URLSearchParams();

  if (params?.lookbackMonths) {
    searchParams.append('lookbackMonths', params.lookbackMonths.toString());
  }
  if (params?.minStockCriteria) {
    searchParams.append('minStockCriteria', params.minStockCriteria);
  }
  if (params?.supplierIds) {
    params.supplierIds.forEach(id => searchParams.append('supplierIds', id));
  }
  if (params?.categoryIds) {
    params.categoryIds.forEach(id => searchParams.append('categoryIds', id));
  }

  const response = await apiClient.get(`/orders/auto/analyze?${searchParams.toString()}`);
  return response.data;
}

export async function createAutoOrders(
  data: AutoOrderCreateRequest,
): Promise<{ success: boolean; message: string; data: any }> {
  const response = await apiClient.post('/orders/auto/create', data);
  return response.data;
}

export async function getScheduledItems(): Promise<{
  success: boolean;
  data: { totalScheduledItems: number; items: ScheduledItem[] };
}> {
  const response = await apiClient.get('/orders/auto/scheduled-items');
  return response.data;
}

// =====================
// React Query Hooks
// =====================

export function useAutoOrderAnalysis(params?: {
  lookbackMonths?: number;
  minStockCriteria?: 'all' | 'low' | 'critical';
  supplierIds?: string[];
  categoryIds?: string[];
}) {
  return useQuery({
    queryKey: ['auto-order-analysis', params],
    queryFn: () => analyzeAutoOrders(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateAutoOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAutoOrders,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-order-analysis'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useScheduledItems() {
  return useQuery({
    queryKey: ['scheduled-items'],
    queryFn: getScheduledItems,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
