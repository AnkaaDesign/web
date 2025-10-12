/**
 * Inventory Section Component
 *
 * Inventory-specific dashboard section with:
 * - Inventory KPIs
 * - Stock level charts
 * - Consumption trends
 * - Supplier performance
 */

import { DashboardGrid, DashboardWidget } from "../components/DashboardGrid";
import { KPICard } from "../components/KPICard";
import { ChartPlaceholder } from "../components/ChartPlaceholder";
import { KPI_WIDGETS, CHART_WIDGETS } from "../utils/dashboard-config";
import { calculateKPIs } from "../utils/dashboard-helpers";
import { useInventoryDashboard } from "@/hooks/dashboard";

export interface InventorySectionProps {
  dateRange?: { start: Date; end: Date };
}

/**
 * Inventory Section Component
 */
export function InventorySection({ dateRange }: InventorySectionProps) {
  const { data, isLoading, error } = useInventoryDashboard({
    startDate: dateRange?.start?.toISOString(),
    endDate: dateRange?.end?.toISOString(),
  });

  const kpis = data ? calculateKPIs({ inventory: data }) : {};

  if (error) {
    return (
      <ChartPlaceholder
        type="error"
        title="Erro ao carregar dados de estoque"
        message="Não foi possível carregar os dados de estoque."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <DashboardGrid>
        <DashboardWidget config={KPI_WIDGETS.lowStockItems}>
          <KPICard
            title={KPI_WIDGETS.lowStockItems.title}
            data={kpis["inventory.lowStock"] || { current: 0 }}
            icon={KPI_WIDGETS.lowStockItems.icon}
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
      </DashboardGrid>

      {/* Charts */}
      <DashboardGrid>
        <DashboardWidget config={CHART_WIDGETS.inventoryTurnover}>
          <ChartPlaceholder
            type={isLoading ? "loading" : "noData"}
            title={CHART_WIDGETS.inventoryTurnover.title}
            message="Gráfico em desenvolvimento"
          />
        </DashboardWidget>

        <DashboardWidget config={CHART_WIDGETS.stockLevels}>
          <ChartPlaceholder
            type={isLoading ? "loading" : "noData"}
            title={CHART_WIDGETS.stockLevels.title}
            message="Gráfico em desenvolvimento"
          />
        </DashboardWidget>

        <DashboardWidget config={CHART_WIDGETS.consumptionRate}>
          <ChartPlaceholder
            type={isLoading ? "loading" : "noData"}
            title={CHART_WIDGETS.consumptionRate.title}
            message="Gráfico em desenvolvimento"
          />
        </DashboardWidget>
      </DashboardGrid>
    </div>
  );
}
