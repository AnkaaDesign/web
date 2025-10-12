/**
 * Financial Statistics Page
 *
 * Comprehensive financial analytics with real data from API
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IconCurrencyDollar,
  IconTrendingUp,
  IconTrendingDown,
  IconChartBar,
  IconReportMoney,
  IconWallet,
  IconRefresh,
  IconAlertCircle,
} from "@tabler/icons-react";
import {
  StatisticsPageLayout,
  KPICard,
  DashboardGrid,
  TrendIndicator,
} from "./components";
import { formatKPIValue } from "./utils/dashboard-helpers";
import { cn } from "@/lib/utils";
import { useFinancialStatistics } from "@/hooks/statistics/useFinancialStatistics";

/**
 * Financial Statistics Page Component
 */
export function FinancialStatisticsPage() {
  // Setup date filters - default to last 30 days
  const [dateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  const filters = useMemo(
    () => ({
      dateRange,
      period: "month" as const,
    }),
    [dateRange]
  );

  // Fetch real data from API
  const { overview, revenue, costs, profitability, isLoading, isError } =
    useFinancialStatistics(filters);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExport = () => {
    console.log("Export financial statistics");
  };

  const handleDateRangeChange = (start: Date, end: Date) => {
    console.log("Date range changed:", start, end);
  };

  // Show error state
  if (isError) {
    return (
      <StatisticsPageLayout
        title="Estatísticas Financeiras"
        onRefresh={handleRefresh}
        onExport={handleExport}
        onDateRangeChange={handleDateRangeChange}
        lastUpdated={new Date()}
      >
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center">
              <IconAlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Erro ao carregar estatísticas financeiras
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Não foi possível conectar aos endpoints da API.
              </p>
              <p className="text-xs text-muted-foreground">
                Verifique se os endpoints do backend estão disponíveis e tente novamente.
              </p>
            </div>
          </CardContent>
        </Card>
      </StatisticsPageLayout>
    );
  }

  return (
    <StatisticsPageLayout
      title="Estatísticas Financeiras"
      onRefresh={handleRefresh}
      onExport={handleExport}
      onDateRangeChange={handleDateRangeChange}
      lastUpdated={new Date()}
      isRefreshing={isLoading}
    >
      {/* Overview KPI Cards */}
      <DashboardGrid>
        <KPICard
          title="Receita Total"
          data={{
            current: overview.data?.data?.totalRevenue || 0,
            format: "currency",
          }}
          icon={IconCurrencyDollar}
          loading={overview.isLoading}
        />
        <KPICard
          title="Custos Totais"
          data={{
            current: overview.data?.data?.totalCost || 0,
            format: "currency",
          }}
          icon={IconTrendingDown}
          loading={overview.isLoading}
        />
        <KPICard
          title="Lucro Líquido"
          data={{
            current: overview.data?.data?.netProfit || 0,
            format: "currency",
          }}
          icon={IconReportMoney}
          loading={overview.isLoading}
        />
        <KPICard
          title="Margem de Lucro"
          data={{
            current: overview.data?.data?.profitMargin || 0,
            format: "percentage",
          }}
          icon={IconTrendingUp}
          loading={overview.isLoading}
        />
      </DashboardGrid>

      {/* Revenue Metrics */}
      {revenue.data?.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconChartBar className="h-5 w-5" />
              Métricas de Receita
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Receita Total
                </div>
                <div className="text-2xl font-bold">
                  {formatKPIValue(
                    revenue.data.data.totalRevenue || 0,
                    "currency"
                  )}
                </div>
                {revenue.data.data.revenueGrowth !== undefined && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Crescimento: {revenue.data.data.revenueGrowth.toFixed(1)}%
                  </div>
                )}
              </div>

              {revenue.data.data.bySource &&
                revenue.data.data.bySource.length > 0 && (
                  <div className="col-span-full">
                    <h4 className="text-sm font-medium mb-3">
                      Receita por Fonte
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {revenue.data.data.bySource.map((source) => (
                        <div
                          key={source.source}
                          className="p-3 border rounded-lg"
                        >
                          <div className="text-sm font-medium">
                            {source.source}
                          </div>
                          <div className="text-lg font-bold">
                            {formatKPIValue(source.amount, "currency")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {source.percentage.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Analysis */}
      {costs.data?.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconTrendingDown className="h-5 w-5" />
              Análise de Custos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Custos Totais
                </div>
                <div className="text-2xl font-bold">
                  {formatKPIValue(costs.data.data.totalCosts || 0, "currency")}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Custo dos Produtos
                </div>
                <div className="text-2xl font-bold">
                  {formatKPIValue(
                    costs.data.data.costOfGoodsSold || 0,
                    "currency"
                  )}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Custos Operacionais
                </div>
                <div className="text-2xl font-bold">
                  {formatKPIValue(
                    costs.data.data.operatingCosts || 0,
                    "currency"
                  )}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Custos de Mão de Obra
                </div>
                <div className="text-2xl font-bold">
                  {formatKPIValue(
                    costs.data.data.laborCosts || 0,
                    "currency"
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profitability */}
      {profitability.data?.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconWallet className="h-5 w-5" />
              Análise de Lucratividade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Lucro Bruto
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {formatKPIValue(
                    profitability.data.data.grossProfit || 0,
                    "currency"
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Margem: {profitability.data.data.grossMargin?.toFixed(1)}%
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Lucro Líquido
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {formatKPIValue(
                    profitability.data.data.netProfit || 0,
                    "currency"
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Margem: {profitability.data.data.netMargin?.toFixed(1)}%
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Margem Operacional
                </div>
                <div className="text-2xl font-bold">
                  {profitability.data.data.operatingMargin?.toFixed(1)}%
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Retorno sobre Ativos
                </div>
                <div className="text-2xl font-bold">
                  {profitability.data.data.returnOnAssets?.toFixed(1)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && !overview.data && (
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <IconRefresh className="h-6 w-6 animate-spin mr-2" />
              <span>Carregando estatísticas financeiras...</span>
            </div>
          </CardContent>
        </Card>
      )}
    </StatisticsPageLayout>
  );
}

export default FinancialStatisticsPage;
