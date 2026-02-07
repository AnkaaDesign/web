import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { dashboardService } from "../api-client";
import type {
  InventoryDashboardResponse,
  HRDashboardResponse,
  AdministrationDashboardResponse,
  PaintDashboardResponse,
  ProductionDashboardResponse,
  UnifiedDashboardResponse,
} from "../types";
import type {
  InventoryDashboardQueryFormData,
  HRDashboardQueryFormData,
  AdministrationDashboardQueryFormData,
  PaintDashboardQueryFormData,
  ProductionDashboardQueryFormData,
  UnifiedDashboardQueryFormData,
} from "../schemas";

// Query keys
export const dashboardQueryKeys = {
  all: ["dashboards"] as const,
  inventory: (params?: InventoryDashboardQueryFormData) => [...dashboardQueryKeys.all, "inventory", params] as const,
  hr: (params?: HRDashboardQueryFormData) => [...dashboardQueryKeys.all, "hr", params] as const,
  administration: (params?: AdministrationDashboardQueryFormData) => [...dashboardQueryKeys.all, "administration", params] as const,
  paint: (params?: PaintDashboardQueryFormData) => [...dashboardQueryKeys.all, "paint", params] as const,
  production: (params?: ProductionDashboardQueryFormData) => [...dashboardQueryKeys.all, "production", params] as const,
  unified: (params?: UnifiedDashboardQueryFormData) => [...dashboardQueryKeys.all, "unified", params] as const,
};

// Inventory Dashboard Hook
export const useInventoryDashboard = (params?: InventoryDashboardQueryFormData, options?: Omit<UseQueryOptions<InventoryDashboardResponse, Error>, "queryKey" | "queryFn">) => {
  return useQuery({
    queryKey: dashboardQueryKeys.inventory(params),
    queryFn: async () => {
      return await dashboardService.getInventoryDashboard(params);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

// HR Dashboard Hook
export const useHRDashboard = (params?: HRDashboardQueryFormData, options?: Omit<UseQueryOptions<HRDashboardResponse, Error>, "queryKey" | "queryFn">) => {
  return useQuery({
    queryKey: dashboardQueryKeys.hr(params),
    queryFn: async () => {
      return await dashboardService.getHRDashboard(params);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

// Administration Dashboard Hook
export const useAdministrationDashboard = (
  params?: AdministrationDashboardQueryFormData,
  options?: Omit<UseQueryOptions<AdministrationDashboardResponse, Error>, "queryKey" | "queryFn">,
) => {
  return useQuery({
    queryKey: dashboardQueryKeys.administration(params),
    queryFn: async () => {
      return await dashboardService.getAdministrationDashboard(params);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

// Paint Dashboard Hook
export const usePaintDashboard = (params?: PaintDashboardQueryFormData, options?: Omit<UseQueryOptions<PaintDashboardResponse, Error>, "queryKey" | "queryFn">) => {
  return useQuery({
    queryKey: dashboardQueryKeys.paint(params),
    queryFn: async () => {
      return await dashboardService.getPaintDashboard(params);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

// Production Dashboard Hook
export const useProductionDashboard = (params?: ProductionDashboardQueryFormData, options?: Omit<UseQueryOptions<ProductionDashboardResponse, Error>, "queryKey" | "queryFn">) => {
  return useQuery({
    queryKey: dashboardQueryKeys.production(params),
    queryFn: async () => {
      return await dashboardService.getProductionDashboard(params);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

// Unified Dashboard Hook
export const useUnifiedDashboard = (params?: UnifiedDashboardQueryFormData, options?: Omit<UseQueryOptions<UnifiedDashboardResponse, Error>, "queryKey" | "queryFn">) => {
  return useQuery({
    queryKey: dashboardQueryKeys.unified(params),
    queryFn: async () => {
      return await dashboardService.getUnifiedDashboard(params);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

// Export all dashboard hooks
export const dashboardHooks = {
  useInventoryDashboard,
  useHRDashboard,
  useAdministrationDashboard,
  usePaintDashboard,
  useProductionDashboard,
  useUnifiedDashboard,
};
