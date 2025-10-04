import { apiClient } from "./axiosClient";
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

export const dashboardService = {
  // Inventory Dashboard
  getInventoryDashboard: (params?: InventoryDashboardQueryFormData) => {
    return apiClient
      .get<InventoryDashboardResponse>("/dashboards/inventory", {
        params,
      })
      .then((res) => res.data);
  },

  // HR Dashboard
  getHRDashboard: (params?: HRDashboardQueryFormData) =>
    apiClient
      .get<HRDashboardResponse>("/dashboards/hr", {
        params,
      })
      .then((res) => res.data),

  // Administration Dashboard
  getAdministrationDashboard: (params?: AdministrationDashboardQueryFormData) => {
    return apiClient
      .get<AdministrationDashboardResponse>("/dashboards/administration", {
        params,
      })
      .then((res) => res.data);
  },

  // Paint Dashboard
  getPaintDashboard: (params?: PaintDashboardQueryFormData) =>
    apiClient
      .get<PaintDashboardResponse>("/dashboards/paint", {
        params,
      })
      .then((res) => res.data),

  // Production Dashboard
  getProductionDashboard: (params?: ProductionDashboardQueryFormData) =>
    apiClient
      .get<ProductionDashboardResponse>("/dashboards/production", {
        params,
      })
      .then((res) => res.data),

  // Unified Dashboard
  getUnifiedDashboard: (params?: UnifiedDashboardQueryFormData) =>
    apiClient
      .get<UnifiedDashboardResponse>("/dashboards/unified", {
        params,
      })
      .then((res) => res.data),
};
