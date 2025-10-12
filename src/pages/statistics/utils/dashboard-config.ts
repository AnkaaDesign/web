/**
 * Dashboard Configuration
 *
 * Default layouts and available widgets for the statistics dashboard.
 * Supports customizable dashboard layouts with drag-and-drop functionality.
 */

import type { IconProps } from "@tabler/icons-react";
import {
  IconChartBar,
  IconChartLine,
  IconChartPie,
  IconChartArea,
  IconChartDonut,
  IconTrendingUp,
  IconTrendingDown,
  IconAlertTriangle,
  IconUsers,
  IconBox,
  IconCurrencyDollar,
  IconClipboardList,
  IconCalendar,
} from "@tabler/icons-react";

/**
 * Widget types available in the dashboard
 */
export type WidgetType = "kpi" | "chart" | "table" | "list";

/**
 * Chart types supported
 */
export type ChartType = "line" | "bar" | "area" | "pie" | "donut" | "composed";

/**
 * Widget size options
 */
export type WidgetSize = "small" | "medium" | "large" | "full";

/**
 * Widget configuration interface
 */
export interface WidgetConfig {
  id: string;
  type: WidgetType;
  chartType?: ChartType;
  title: string;
  description?: string;
  size: WidgetSize;
  icon: React.ComponentType<IconProps>;
  dataKey: string; // Key to fetch data from dashboard hooks
  refreshInterval?: number; // Optional auto-refresh interval in ms
}

/**
 * Dashboard layout configuration
 */
export interface DashboardLayout {
  id: string;
  name: string;
  widgets: WidgetConfig[];
}

/**
 * Available KPI Widgets
 */
export const KPI_WIDGETS: Record<string, WidgetConfig> = {
  totalTasks: {
    id: "kpi-total-tasks",
    type: "kpi",
    title: "Total de Tarefas",
    description: "Total de tarefas ativas no sistema",
    size: "small",
    icon: IconClipboardList,
    dataKey: "tasks.total",
  },
  completedTasks: {
    id: "kpi-completed-tasks",
    type: "kpi",
    title: "Tarefas Concluídas",
    description: "Tarefas concluídas este mês",
    size: "small",
    icon: IconTrendingUp,
    dataKey: "tasks.completed",
  },
  pendingOrders: {
    id: "kpi-pending-orders",
    type: "kpi",
    title: "Pedidos Pendentes",
    description: "Pedidos aguardando processamento",
    size: "small",
    icon: IconAlertTriangle,
    dataKey: "orders.pending",
  },
  lowStockItems: {
    id: "kpi-low-stock",
    type: "kpi",
    title: "Itens com Estoque Baixo",
    description: "Itens abaixo do ponto de reposição",
    size: "small",
    icon: IconBox,
    dataKey: "inventory.lowStock",
  },
  employeeCount: {
    id: "kpi-employees",
    type: "kpi",
    title: "Colaboradores",
    description: "Total de colaboradores ativos",
    size: "small",
    icon: IconUsers,
    dataKey: "hr.employeeCount",
  },
  monthlyRevenue: {
    id: "kpi-revenue",
    type: "kpi",
    title: "Receita Mensal",
    description: "Receita total do mês",
    size: "small",
    icon: IconCurrencyDollar,
    dataKey: "financial.revenue",
  },
  monthlyCosts: {
    id: "kpi-costs",
    type: "kpi",
    title: "Custos do Mês",
    description: "Total de custos mensais",
    size: "small",
    icon: IconTrendingDown,
    dataKey: "financial.costs",
  },
  profitMargin: {
    id: "kpi-profit",
    type: "kpi",
    title: "Margem de Lucro",
    description: "Margem de lucro atual",
    size: "small",
    icon: IconChartLine,
    dataKey: "financial.profitMargin",
  },
};

/**
 * Available Chart Widgets
 */
export const CHART_WIDGETS: Record<string, WidgetConfig> = {
  taskCompletionTrend: {
    id: "chart-task-trend",
    type: "chart",
    chartType: "line",
    title: "Tendência de Conclusão de Tarefas",
    description: "Últimos 30 dias",
    size: "medium",
    icon: IconChartLine,
    dataKey: "production.taskTrend",
  },
  orderFulfillment: {
    id: "chart-order-fulfillment",
    type: "chart",
    chartType: "bar",
    title: "Taxa de Atendimento de Pedidos",
    description: "Comparativo mensal",
    size: "medium",
    icon: IconChartBar,
    dataKey: "orders.fulfillmentRate",
  },
  inventoryTurnover: {
    id: "chart-inventory-turnover",
    type: "chart",
    chartType: "area",
    title: "Giro de Estoque",
    description: "Movimentação de inventário",
    size: "medium",
    icon: IconChartArea,
    dataKey: "inventory.turnover",
  },
  employeePerformance: {
    id: "chart-employee-performance",
    type: "chart",
    chartType: "pie",
    title: "Distribuição de Desempenho",
    description: "Níveis de performance dos colaboradores",
    size: "medium",
    icon: IconChartPie,
    dataKey: "hr.performanceDistribution",
  },
  revenueCosts: {
    id: "chart-revenue-costs",
    type: "chart",
    chartType: "composed",
    title: "Receita vs Custos",
    description: "Comparativo financeiro",
    size: "large",
    icon: IconChartBar,
    dataKey: "financial.revenueVsCosts",
  },
  topCustomers: {
    id: "chart-top-customers",
    type: "chart",
    chartType: "bar",
    title: "Top Clientes por Receita",
    description: "Principais clientes do período",
    size: "medium",
    icon: IconChartBar,
    dataKey: "customers.topByRevenue",
  },
  tasksByStatus: {
    id: "chart-tasks-status",
    type: "chart",
    chartType: "donut",
    title: "Tarefas por Status",
    description: "Distribuição de status",
    size: "small",
    icon: IconChartDonut,
    dataKey: "production.tasksByStatus",
  },
  tasksBySector: {
    id: "chart-tasks-sector",
    type: "chart",
    chartType: "pie",
    title: "Tarefas por Setor",
    description: "Distribuição por setor",
    size: "small",
    icon: IconChartPie,
    dataKey: "production.tasksBySector",
  },
  stockLevels: {
    id: "chart-stock-levels",
    type: "chart",
    chartType: "bar",
    title: "Níveis de Estoque",
    description: "Produtos com maior estoque",
    size: "medium",
    icon: IconChartBar,
    dataKey: "inventory.stockLevels",
  },
  consumptionRate: {
    id: "chart-consumption",
    type: "chart",
    chartType: "line",
    title: "Taxa de Consumo",
    description: "Tendência de consumo",
    size: "medium",
    icon: IconChartLine,
    dataKey: "inventory.consumptionRate",
  },
};

/**
 * Default Dashboard Layouts
 */
export const DEFAULT_LAYOUTS: Record<string, DashboardLayout> = {
  overview: {
    id: "overview",
    name: "Visão Geral",
    widgets: [
      KPI_WIDGETS.totalTasks,
      KPI_WIDGETS.completedTasks,
      KPI_WIDGETS.pendingOrders,
      KPI_WIDGETS.lowStockItems,
      KPI_WIDGETS.employeeCount,
      KPI_WIDGETS.monthlyRevenue,
      KPI_WIDGETS.monthlyCosts,
      KPI_WIDGETS.profitMargin,
      CHART_WIDGETS.taskCompletionTrend,
      CHART_WIDGETS.orderFulfillment,
      CHART_WIDGETS.inventoryTurnover,
      CHART_WIDGETS.revenueCosts,
    ],
  },
  inventory: {
    id: "inventory",
    name: "Estoque",
    widgets: [
      KPI_WIDGETS.lowStockItems,
      KPI_WIDGETS.pendingOrders,
      CHART_WIDGETS.inventoryTurnover,
      CHART_WIDGETS.stockLevels,
      CHART_WIDGETS.consumptionRate,
      CHART_WIDGETS.topCustomers,
    ],
  },
  production: {
    id: "production",
    name: "Produção",
    widgets: [
      KPI_WIDGETS.totalTasks,
      KPI_WIDGETS.completedTasks,
      CHART_WIDGETS.taskCompletionTrend,
      CHART_WIDGETS.tasksByStatus,
      CHART_WIDGETS.tasksBySector,
      CHART_WIDGETS.orderFulfillment,
    ],
  },
  hr: {
    id: "hr",
    name: "Recursos Humanos",
    widgets: [
      KPI_WIDGETS.employeeCount,
      CHART_WIDGETS.employeePerformance,
    ],
  },
  financial: {
    id: "financial",
    name: "Financeiro",
    widgets: [
      KPI_WIDGETS.monthlyRevenue,
      KPI_WIDGETS.monthlyCosts,
      KPI_WIDGETS.profitMargin,
      CHART_WIDGETS.revenueCosts,
      CHART_WIDGETS.topCustomers,
    ],
  },
};

/**
 * All available widgets
 */
export const AVAILABLE_WIDGETS = {
  kpi: KPI_WIDGETS,
  charts: CHART_WIDGETS,
};

/**
 * Widget size to grid columns mapping
 */
export const SIZE_TO_COLS: Record<WidgetSize, number> = {
  small: 1,
  medium: 2,
  large: 3,
  full: 4,
};

/**
 * Default refresh intervals (in milliseconds)
 */
export const REFRESH_INTERVALS = {
  fast: 1 * 60 * 1000, // 1 minute
  normal: 5 * 60 * 1000, // 5 minutes
  slow: 15 * 60 * 1000, // 15 minutes
} as const;
