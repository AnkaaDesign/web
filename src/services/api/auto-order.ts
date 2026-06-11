import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api-client/axiosClient';
import { ITEM_CATEGORY_TYPE, STOCK_MODEL } from '@/constants/enums';
import { itemKeys, orderKeys } from '@/hooks/common/query-keys';

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
  /** Category type — DISPLAY ONLY (capability-fields contract). Tool
   *  badges/grouping must key on `stockModel === 'FIXED_TARGET'`.
   *  PPE never appears (excluded from the workflow for now). */
  categoryType: ITEM_CATEGORY_TYPE | null;
  /** Stock math model — behavior gate for fixed-target badges/grouping. */
  stockModel: STOCK_MODEL | null;
  /** Target on hand for FIXED_TARGET items (engine falls back to 1). */
  fixedTargetQuantity: number | null;
  lastOrderDate: Date | null;
  daysSinceLastOrder: number | null;
  hasActivePendingOrder: boolean;
  estimatedLeadTime: number;
  /** Current unit price. Invariant: estimatedCost = unitPrice × recommendedOrderQuantity.
   *  Used to recompute the expected price live as the user edits the quantity. */
  unitPrice: number;
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

export async function getScheduledItems(): Promise<{
  success: boolean;
  data: { totalScheduledItems: number; items: ScheduledItem[] };
}> {
  const response = await apiClient.get('/orders/auto/scheduled-items');
  return response.data;
}

export interface AutoOrderCreatePayload {
  orders: Array<{
    /** null / omitted = the "no supplier" group. */
    supplierId?: string | null;
    items: Array<{ itemId: string; quantity: number }>;
  }>;
}

/** Create real orders from selected recommendations. The caller resolves the
 *  grouping strategy (combined / per-supplier / per-item / per-category) into
 *  `orders`; the API derives unit price + ICMS/IPI and persists each group. */
export async function createOrdersFromAutoOrder(payload: AutoOrderCreatePayload) {
  const response = await apiClient.post('/orders/auto/create', payload);
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

export function useScheduledItems() {
  return useQuery({
    queryKey: ['scheduled-items'],
    queryFn: getScheduledItems,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/** Mutation for creating orders from recommendations. The api-client
 *  interceptor surfaces success/error toasts, so callers must not double-toast. */
export function useCreateOrdersFromAutoOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrdersFromAutoOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-order-analysis'] });
      queryClient.invalidateQueries({ queryKey: orderKeys.all });
      queryClient.invalidateQueries({ queryKey: itemKeys.all });
    },
  });
}
