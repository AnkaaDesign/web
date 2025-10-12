/**
 * Main Statistics Dashboard Page
 *
 * Central dashboard providing an overview of key metrics across all business areas.
 *
 * Features:
 * - Multi-tab interface (Overview, Inventory, Production, HR, Financial)
 * - KPI summary cards
 * - Interactive charts
 * - Date range filtering
 * - Export capabilities
 * - Auto-refresh
 * - Responsive design
 *
 * @route /estatisticas
 */

import { useState, useCallback, useEffect } from "react";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { DashboardHeader } from "./components/DashboardHeader";
import { DashboardTabs } from "./components/DashboardTabs";
import {
  OverviewSection,
  InventorySection,
  ProductionSection,
  HRSection,
  FinancialSection,
} from "./sections";
import { getDateRangePresets } from "./utils/dashboard-helpers";
import { REFRESH_INTERVALS } from "./utils/dashboard-config";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Statistics Dashboard Page Component
 */
export function StatisticsPage() {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    const presets = getDateRangePresets();
    const last30Days = presets.find((p) => p.value === "last30days");
    return last30Days
      ? { start: last30Days.start, end: last30Days.end }
      : { start: new Date(), end: new Date() };
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Page tracking
  usePageTracker({
    title: "Dashboard de Estatísticas",
    icon: "chart-bar",
  });

  /**
   * Handle manual refresh
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Invalidate all dashboard queries to force refetch
      await queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      setLastUpdated(new Date());
      toast.success("Dashboard atualizado com sucesso");
    } catch (error) {
      toast.error("Erro ao atualizar dashboard");
      console.error("Failed to refresh dashboard:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  /**
   * Handle date range change
   */
  const handleDateRangeChange = useCallback((start: Date, end: Date) => {
    setDateRange({ start, end });
  }, []);

  /**
   * Handle export
   */
  const handleExport = useCallback(() => {
    toast.info("Exportação em desenvolvimento");
  }, []);

  /**
   * Handle share
   */
  const handleShare = useCallback(() => {
    toast.info("Compartilhamento em desenvolvimento");
  }, []);

  /**
   * Handle filter click
   */
  const handleFilterClick = useCallback(() => {
    toast.info("Filtros em desenvolvimento");
  }, []);

  /**
   * Handle settings click
   */
  const handleSettingsClick = useCallback(() => {
    toast.info("Configurações em desenvolvimento");
  }, []);

  /**
   * Handle tab change
   */
  const handleTabChange = useCallback((value: string) => {
    // Could track tab change for analytics
    console.log("Tab changed to:", value);
  }, []);

  /**
   * Auto-refresh effect
   */
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      handleRefresh();
    }, REFRESH_INTERVALS.normal);

    return () => clearInterval(interval);
  }, [autoRefresh, handleRefresh]);

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <DashboardHeader
        title="Dashboard de Estatísticas"
        onRefresh={handleRefresh}
        onExport={handleExport}
        onShare={handleShare}
        onDateRangeChange={handleDateRangeChange}
        onFilterClick={handleFilterClick}
        onSettingsClick={handleSettingsClick}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
      />

      {/* Dashboard Content with Tabs */}
      <DashboardTabs
        defaultTab="overview"
        onTabChange={handleTabChange}
        overviewContent={<OverviewSection dateRange={dateRange} />}
        inventoryContent={<InventorySection dateRange={dateRange} />}
        productionContent={<ProductionSection dateRange={dateRange} />}
        hrContent={<HRSection dateRange={dateRange} />}
        financialContent={<FinancialSection dateRange={dateRange} />}
      />
    </div>
  );
}

export default StatisticsPage;
