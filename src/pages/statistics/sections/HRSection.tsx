/**
 * HR Section Component
 *
 * Human Resources dashboard section with:
 * - Employee KPIs
 * - Performance distribution
 * - Vacation calendar
 * - Attendance trends
 */

import { DashboardGrid, DashboardWidget } from "../components/DashboardGrid";
import { KPICard } from "../components/KPICard";
import { ChartPlaceholder } from "../components/ChartPlaceholder";
import { KPI_WIDGETS, CHART_WIDGETS } from "../utils/dashboard-config";
import { calculateKPIs } from "../utils/dashboard-helpers";
import { useHRDashboard } from "@/hooks/dashboard";

export interface HRSectionProps {
  dateRange?: { start: Date; end: Date };
}

/**
 * HR Section Component
 */
export function HRSection({ dateRange }: HRSectionProps) {
  const { data, isLoading, error } = useHRDashboard({
    startDate: dateRange?.start?.toISOString(),
    endDate: dateRange?.end?.toISOString(),
  });

  const kpis = data ? calculateKPIs({ hr: data }) : {};

  if (error) {
    return (
      <ChartPlaceholder
        type="error"
        title="Erro ao carregar dados de RH"
        message="Não foi possível carregar os dados de recursos humanos."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <DashboardGrid>
        <DashboardWidget config={KPI_WIDGETS.employeeCount}>
          <KPICard
            title={KPI_WIDGETS.employeeCount.title}
            data={kpis["hr.employeeCount"] || { current: 0 }}
            icon={KPI_WIDGETS.employeeCount.icon}
            loading={isLoading}
          />
        </DashboardWidget>
      </DashboardGrid>

      {/* Charts */}
      <DashboardGrid>
        <DashboardWidget config={CHART_WIDGETS.employeePerformance}>
          <ChartPlaceholder
            type={isLoading ? "loading" : "noData"}
            title={CHART_WIDGETS.employeePerformance.title}
            message="Gráfico em desenvolvimento"
          />
        </DashboardWidget>
      </DashboardGrid>
    </div>
  );
}
