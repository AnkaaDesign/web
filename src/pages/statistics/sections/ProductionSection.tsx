/**
 * Production Section Component
 *
 * Production-specific dashboard section with:
 * - Production KPIs
 * - Task completion trends
 * - Bottleneck analysis
 * - Customer breakdown
 */

import { DashboardGrid, DashboardWidget } from "../components/DashboardGrid";
import { KPICard } from "../components/KPICard";
import { ChartPlaceholder } from "../components/ChartPlaceholder";
import { KPI_WIDGETS, CHART_WIDGETS } from "../utils/dashboard-config";
import { calculateKPIs } from "../utils/dashboard-helpers";
import { useProductionDashboard } from "@/hooks/dashboard";

export interface ProductionSectionProps {
  dateRange?: { start: Date; end: Date };
}

/**
 * Production Section Component
 */
export function ProductionSection({ dateRange }: ProductionSectionProps) {
  const { data, isLoading, error } = useProductionDashboard({
    startDate: dateRange?.start?.toISOString(),
    endDate: dateRange?.end?.toISOString(),
  });

  const kpis = data ? calculateKPIs({ production: data }) : {};

  if (error) {
    return (
      <ChartPlaceholder
        type="error"
        title="Erro ao carregar dados de produção"
        message="Não foi possível carregar os dados de produção."
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

        <DashboardWidget config={CHART_WIDGETS.tasksByStatus}>
          <ChartPlaceholder
            type={isLoading ? "loading" : "noData"}
            title={CHART_WIDGETS.tasksByStatus.title}
            message="Gráfico em desenvolvimento"
          />
        </DashboardWidget>

        <DashboardWidget config={CHART_WIDGETS.tasksBySector}>
          <ChartPlaceholder
            type={isLoading ? "loading" : "noData"}
            title={CHART_WIDGETS.tasksBySector.title}
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
      </DashboardGrid>
    </div>
  );
}
