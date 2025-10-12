/**
 * Dashboard Helper Functions
 *
 * Utility functions for calculating KPIs, formatting data,
 * and processing dashboard information.
 */

/**
 * KPI data interface
 */
export interface KPIData {
  current: number;
  previous?: number;
  target?: number;
  unit?: string;
  format?: "number" | "currency" | "percentage";
}

/**
 * Change indicator result
 */
export interface ChangeIndicator {
  value: number;
  percentage: number;
  trend: "up" | "down" | "neutral";
  isPositive: boolean;
}

/**
 * Calculate change indicator between current and previous values
 *
 * @param current - Current value
 * @param previous - Previous value
 * @param higherIsBetter - Whether higher values are considered better (default: true)
 * @returns Change indicator with trend and percentage
 */
export function getChangeIndicator(
  current: number,
  previous: number,
  higherIsBetter = true
): ChangeIndicator {
  const value = current - previous;
  const percentage = previous !== 0 ? (value / previous) * 100 : 0;

  let trend: "up" | "down" | "neutral" = "neutral";
  if (Math.abs(percentage) < 0.1) {
    trend = "neutral";
  } else if (value > 0) {
    trend = "up";
  } else if (value < 0) {
    trend = "down";
  }

  const isPositive = higherIsBetter
    ? trend === "up" || trend === "neutral"
    : trend === "down" || trend === "neutral";

  return {
    value,
    percentage,
    trend,
    isPositive,
  };
}

/**
 * Format KPI value based on its format type
 *
 * @param value - Value to format
 * @param format - Format type
 * @param unit - Optional unit string
 * @returns Formatted string
 */
export function formatKPIValue(
  value: number,
  format: "number" | "currency" | "percentage" = "number",
  unit?: string
): string {
  let formatted: string;

  switch (format) {
    case "currency":
      formatted = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
      break;
    case "percentage":
      formatted = `${value.toFixed(2)}%`;
      break;
    case "number":
    default:
      formatted = new Intl.NumberFormat("pt-BR").format(value);
      break;
  }

  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Calculate KPI status based on current, previous, and target values
 *
 * @param data - KPI data
 * @returns Status: "success", "warning", or "danger"
 */
export function getKPIStatus(data: KPIData): "success" | "warning" | "danger" {
  if (!data.target) {
    return "success"; // No target, default to success
  }

  const percentageOfTarget = (data.current / data.target) * 100;

  if (percentageOfTarget >= 100) {
    return "success";
  } else if (percentageOfTarget >= 80) {
    return "warning";
  } else {
    return "danger";
  }
}

/**
 * Format dashboard data for display
 *
 * @param rawData - Raw data from API
 * @returns Formatted data object
 */
export function formatDashboardData(rawData: any): any {
  if (!rawData) {
    return {};
  }

  // Deep clone to avoid mutations
  const formatted = JSON.parse(JSON.stringify(rawData));

  // Format dates
  if (formatted.startDate) {
    formatted.startDate = new Date(formatted.startDate);
  }
  if (formatted.endDate) {
    formatted.endDate = new Date(formatted.endDate);
  }

  return formatted;
}

/**
 * Calculate aggregated KPIs from dashboard data
 *
 * @param data - Dashboard data object
 * @returns Aggregated KPI values
 */
export function calculateKPIs(data: any): Record<string, KPIData> {
  const kpis: Record<string, KPIData> = {};

  // Production KPIs
  if (data.production) {
    kpis["tasks.total"] = {
      current: data.production.activeTasks || 0,
      previous: data.production.previousActiveTasks || 0,
      format: "number",
    };

    kpis["tasks.completed"] = {
      current: data.production.completedTasks || 0,
      previous: data.production.previousCompletedTasks || 0,
      format: "number",
    };
  }

  // Inventory KPIs
  if (data.inventory) {
    kpis["inventory.lowStock"] = {
      current: data.inventory.lowStockCount || 0,
      previous: data.inventory.previousLowStockCount || 0,
      format: "number",
    };

    kpis["orders.pending"] = {
      current: data.inventory.pendingOrders || 0,
      previous: data.inventory.previousPendingOrders || 0,
      format: "number",
    };
  }

  // HR KPIs
  if (data.hr) {
    kpis["hr.employeeCount"] = {
      current: data.hr.totalEmployees || 0,
      previous: data.hr.previousTotalEmployees || 0,
      format: "number",
    };
  }

  // Financial KPIs
  if (data.financial) {
    kpis["financial.revenue"] = {
      current: data.financial.monthlyRevenue || 0,
      previous: data.financial.previousMonthlyRevenue || 0,
      format: "currency",
    };

    kpis["financial.costs"] = {
      current: data.financial.monthlyCosts || 0,
      previous: data.financial.previousMonthlyCosts || 0,
      format: "currency",
    };

    kpis["financial.profitMargin"] = {
      current: data.financial.profitMargin || 0,
      previous: data.financial.previousProfitMargin || 0,
      format: "percentage",
    };
  }

  return kpis;
}

/**
 * Generate date range presets
 *
 * @returns Array of date range presets
 */
export function getDateRangePresets() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const last7Days = new Date(today);
  last7Days.setDate(last7Days.getDate() - 7);

  const last30Days = new Date(today);
  last30Days.setDate(last30Days.getDate() - 30);

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  return [
    { label: "Hoje", value: "today", start: today, end: today },
    { label: "Ontem", value: "yesterday", start: yesterday, end: yesterday },
    { label: "Últimos 7 dias", value: "last7days", start: last7Days, end: today },
    { label: "Últimos 30 dias", value: "last30days", start: last30Days, end: today },
    { label: "Este mês", value: "thisMonth", start: thisMonthStart, end: today },
    { label: "Mês passado", value: "lastMonth", start: lastMonthStart, end: lastMonthEnd },
  ];
}

/**
 * Save dashboard layout to localStorage
 *
 * @param layoutId - Layout identifier
 * @param layout - Layout configuration
 */
export function saveDashboardLayout(layoutId: string, layout: any): void {
  try {
    const key = `dashboard-layout-${layoutId}`;
    localStorage.setItem(key, JSON.stringify(layout));
  } catch (error) {
    console.error("Failed to save dashboard layout:", error);
  }
}

/**
 * Load dashboard layout from localStorage
 *
 * @param layoutId - Layout identifier
 * @returns Saved layout or null
 */
export function loadDashboardLayout(layoutId: string): any | null {
  try {
    const key = `dashboard-layout-${layoutId}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error("Failed to load dashboard layout:", error);
    return null;
  }
}

/**
 * Clear saved dashboard layout
 *
 * @param layoutId - Layout identifier
 */
export function clearDashboardLayout(layoutId: string): void {
  try {
    const key = `dashboard-layout-${layoutId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Failed to clear dashboard layout:", error);
  }
}

/**
 * Format large numbers with appropriate suffixes
 *
 * @param num - Number to format
 * @returns Formatted string with suffix (K, M, B)
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  } else if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}
