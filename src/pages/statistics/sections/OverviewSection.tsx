/**
 * Overview Section Component
 *
 * Main overview dashboard section with:
 * - Key Performance Indicators
 * - Quick charts
 * - Overall system health
 */

import { DashboardGrid, DashboardWidget } from "../components/DashboardGrid";
import { KPICard } from "../components/KPICard";
import { ChartPlaceholder } from "../components/ChartPlaceholder";
import { KPI_WIDGETS, CHART_WIDGETS } from "../utils/dashboard-config";
import { calculateKPIs } from "../utils/dashboard-helpers";
import { useUnifiedDashboard } from "@/hooks/dashboard";

export interface OverviewSectionProps {
  dateRange?: { start: Date; end: Date };
}

/**
 * Overview Section Component
 */
export function OverviewSection({ dateRange }: OverviewSectionProps) {
  // Fetch unified dashboard data
  const { data, isLoading, error } = useUnifiedDashboard({
    startDate: dateRange?.start?.toISOString(),
    endDate: dateRange?.end?.toISOString(),
  });

  // Calculate KPIs from data
  const kpis = data ? calculateKPIs(data) : {};

  if (error) {
    return (
      <ChartPlaceholder
        type="error"
        title="Erro ao carregar dashboard"
        message="Não foi possível carregar os dados do dashboard."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <DashboardGrid>
        <DashboardWidget config={KPI_WIDGETS.totalTasks}>
          <KPICard
            title={KPI_WIDGETS.totalTasks.title}
            data={kpis["tasks.total"] || { current: 0 }}
            icon={KPI_WIDGETS.totalTasks.icon}
            loading={isLoading}
          />
        </DashboardWidget>

        <DashboardWidget config={KPI_WIDGETS.completedTasks}>
          <KPICard
            title={KPI_WIDGETS.completedTasks.title}
            data={kpis["tasks.completed"] || { current: 0 }}
            icon={KPI_WIDGETS.completedTasks.icon}
            loading={isLoading}
          />
        </DashboardWidget>

        <DashboardWidget config={KPI_WIDGETS.pendingOrders}>
          <KPICard
            title={KPI_WIDGETS.pendingOrders.title}
            data={kpis["orders.pending"] || { current: 0 }}
            icon={KPI_WIDGETS.pendingOrders.icon}
            loading={isLoading}
          />
        </DashboardWidget>

        <DashboardWidget config={KPI_WIDGETS.lowStockItems}>
          <KPICard
            title={KPI_WIDGETS.lowStockItems.title}
            data={kpis["inventory.lowStock"] || { current: 0 }}
            icon={KPI_WIDGETS.lowStockItems.icon}
            loading={isLoading}
          />
        </DashboardWidget>

        <DashboardWidget config={KPI_WIDGETS.employeeCount}>
          <KPICard
            title={KPI_WIDGETS.employeeCount.title}
            data={kpis["hr.employeeCount"] || { current: 0 }}
            icon={KPI_WIDGETS.employeeCount.icon}
            loading={isLoading}
          />
        </DashboardWidget>

        <DashboardWidget config={KPI_WIDGETS.monthlyRevenue}>
          <KPICard
            title={KPI_WIDGETS.monthlyRevenue.title}
            data={kpis["financial.revenue"] || { current: 0, format: "currency" }}
            icon={KPI_WIDGETS.monthlyRevenue.icon}
            loading={isLoading}
          />
        </DashboardWidget>

        <DashboardWidget config={KPI_WIDGETS.monthlyCosts}>
          <KPICard
            title={KPI_WIDGETS.monthlyCosts.title}
            data={kpis["financial.costs"] || { current: 0, format: "currency" }}
            icon={KPI_WIDGETS.monthlyCosts.icon}
            loading={isLoading}
          />
        </DashboardWidget>

        <DashboardWidget config={KPI_WIDGETS.profitMargin}>
          <KPICard
            title={KPI_WIDGETS.profitMargin.title}
            data={kpis["financial.profitMargin"] || { current: 0, format: "percentage" }}
            icon={KPI_WIDGETS.profitMargin.icon}
            loading={isLoading}
          />
        </DashboardWidget>
      </DashboardGrid>

      {/* Charts */}
      <DashboardGrid>
        <DashboardWidget config={CHART_WIDGETS.taskCompletionTrend}>
          <ChartPlaceholder
            type={isLoading ? "loading" : "noData"}
            title={CHART_WIDGETS.taskCompletionTrend.title}
            message="Gráfico em desenvolvimento"
          />
        </DashboardWidget>

        <DashboardWidget config={CHART_WIDGETS.orderFulfillment}>
          <ChartPlaceholder
            type={isLoading ? "loading" : "noData"}
            title={CHART_WIDGETS.orderFulfillment.title}
            message="Gráfico em desenvolvimento"
          />
        </DashboardWidget>

        <DashboardWidget config={CHART_WIDGETS.inventoryTurnover}>
          <ChartPlaceholder
            type={isLoading ? "loading" : "noData"}
            title={CHART_WIDGETS.inventoryTurnover.title}
            message="Gráfico em desenvolvimento"
          />
        </DashboardWidget>

        <DashboardWidget config={CHART_WIDGETS.revenueCosts}>
          <ChartPlaceholder
            type={isLoading ? "loading" : "noData"}
            title={CHART_WIDGETS.revenueCosts.title}
            message="Gráfico em desenvolvimento"
          />
        </DashboardWidget>
      </DashboardGrid>
    </div>
  );
}
