/**
 * Financial Section Component
 *
 * Financial dashboard section with:
 * - Revenue and cost KPIs
 * - Profitability analysis
 * - Top customers
 * - Budget tracking
 */

import { DashboardGrid, DashboardWidget } from "../components/DashboardGrid";
import { KPICard } from "../components/KPICard";
import { ChartPlaceholder } from "../components/ChartPlaceholder";
import { KPI_WIDGETS, CHART_WIDGETS } from "../utils/dashboard-config";
import { calculateKPIs } from "../utils/dashboard-helpers";
import { useUnifiedDashboard } from "@/hooks/dashboard";

export interface FinancialSectionProps {
  dateRange?: { start: Date; end: Date };
}

/**
 * Financial Section Component
 */
export function FinancialSection({ dateRange }: FinancialSectionProps) {
  const { data, isLoading, error } = useUnifiedDashboard({
    startDate: dateRange?.start?.toISOString(),
    endDate: dateRange?.end?.toISOString(),
  });

  const kpis = data ? calculateKPIs(data) : {};

  if (error) {
    return (
      <ChartPlaceholder
        type="error"
        title="Erro ao carregar dados financeiros"
        message="Não foi possível carregar os dados financeiros."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <DashboardGrid>
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
        <DashboardWidget config={CHART_WIDGETS.revenueCosts}>
          <ChartPlaceholder
            type={isLoading ? "loading" : "noData"}
            title={CHART_WIDGETS.revenueCosts.title}
            message="Gráfico em desenvolvimento"
          />
        </DashboardWidget>

        <DashboardWidget config={CHART_WIDGETS.topCustomers}>
          <ChartPlaceholder
            type={isLoading ? "loading" : "noData"}
            title={CHART_WIDGETS.topCustomers.title}
            message="Gráfico em desenvolvimento"
          />
        </DashboardWidget>
      </DashboardGrid>
    </div>
  );
}
