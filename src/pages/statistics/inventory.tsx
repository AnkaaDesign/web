/**
 * Inventory Statistics Page
 *
 * Comprehensive inventory analytics with:
 * - Stock overview and metrics
 * - ABC/XYZ analysis
 * - Consumption analytics
 * - Reorder analysis
 * - Value tracking
 * - Forecasting
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IconBox,
  IconAlertTriangle,
  IconTrendingUp,
  IconCurrencyDollar,
  IconPackage,
  IconShoppingCart,
  IconChartBar,
  IconChartPie,
  IconChartLine,
} from "@tabler/icons-react";
import {
  StatisticsPageLayout,
  KPICard,
  DetailedDataTable,
  DrillDownModal,
  ComparisonView,
  DashboardGrid,
  type TableColumn,
} from "./components";
import {
  useInventoryStatistics,
  useStockTrends,
  useConsumptionStatistics,
  useStatisticsFilters,
  useStockMetrics,
} from "@/hooks/use-inventory-statistics";
import { formatKPIValue } from "./utils/dashboard-helpers";
import { cn } from "@/lib/utils";

/**
 * Inventory Statistics Page Component
 */
export function InventoryStatisticsPage() {
  const navigate = useNavigate();
  const { filters, updateFilter, resetFilters } = useStatisticsFilters({
    period: "month",
  });

  // Fetch data
  const { data: overview, isLoading: overviewLoading } = useInventoryStatistics(filters);
  const { data: trends, isLoading: trendsLoading } = useStockTrends(filters);
  const { data: consumption, isLoading: consumptionLoading } = useConsumptionStatistics(filters);
  const { data: stockMetrics, isLoading: metricsLoading } = useStockMetrics(filters);

  // Drill-down modal state
  const [drillDownData, setDrillDownData] = useState<{
    open: boolean;
    title: string;
    type: "category" | "supplier" | "item" | null;
    data: any;
  }>({
    open: false,
    title: "",
    type: null,
    data: null,
  });

  const isLoading = overviewLoading || trendsLoading || consumptionLoading || metricsLoading;

  // Handle refresh
  const handleRefresh = () => {
    // Invalidate queries - this would be done through react-query
    window.location.reload();
  };

  // Handle export
  const handleExport = () => {
    console.log("Export inventory statistics");
    // Implementation would generate PDF/Excel
  };

  // Handle date range change
  const handleDateRangeChange = (start: Date, end: Date) => {
    updateFilter("dateRange", { from: start, to: end });
  };

  // Open drill-down modal
  const openDrillDown = (type: typeof drillDownData.type, title: string, data: any) => {
    setDrillDownData({ open: true, title, type, data });
  };

  // Close drill-down modal
  const closeDrillDown = () => {
    setDrillDownData({ open: false, title: "", type: null, data: null });
  };

  return (
    <StatisticsPageLayout
      title="Estatísticas de Estoque"
      onRefresh={handleRefresh}
      onExport={handleExport}
      onDateRangeChange={handleDateRangeChange}
      isRefreshing={isLoading}
      lastUpdated={new Date()}
    >
      {/* Overview KPI Cards */}
      <DashboardGrid>
        <KPICard
          title="Total de Itens"
          data={{
            current: overview?.totalItems || 0,
            previous: overview?.previousTotalItems,
            format: "number",
          }}
          icon={IconPackage}
          loading={overviewLoading}
        />
        <KPICard
          title="Valor Total do Estoque"
          data={{
            current: overview?.totalValue || 0,
            previous: overview?.previousTotalValue,
            format: "currency",
          }}
          icon={IconCurrencyDollar}
          loading={overviewLoading}
        />
        <KPICard
          title="Itens Abaixo do Ponto de Reposição"
          data={{
            current: overview?.lowStockItems || 0,
            previous: overview?.previousLowStockItems,
            format: "number",
          }}
          icon={IconAlertTriangle}
          loading={overviewLoading}
          onClick={() => openDrillDown("item", "Itens com Estoque Baixo", overview?.lowStockDetails)}
        />
        <KPICard
          title="Itens em Estoque Crítico"
          data={{
            current: overview?.criticalItems || 0,
            previous: overview?.previousCriticalItems,
            format: "number",
          }}
          icon={IconAlertTriangle}
          loading={overviewLoading}
        />
      </DashboardGrid>

      {/* ABC/XYZ Classification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconChartPie className="h-5 w-5" />
            Análise ABC/XYZ
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-pulse text-muted-foreground">Carregando análise...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* ABC Classification */}
              <div>
                <h4 className="text-sm font-medium mb-3">Classificação ABC (Por Valor)</h4>
                <div className="grid grid-cols-3 gap-4">
                  <ClassificationCard
                    label="Classe A"
                    description="Alto valor (80% do valor)"
                    count={overview?.abcClassification?.A || 0}
                    percentage={overview?.abcClassification?.APercentage || 0}
                    color="bg-green-500"
                    onClick={() => openDrillDown("item", "Itens Classe A", overview?.abcClassification?.AItems)}
                  />
                  <ClassificationCard
                    label="Classe B"
                    description="Valor médio (15% do valor)"
                    count={overview?.abcClassification?.B || 0}
                    percentage={overview?.abcClassification?.BPercentage || 0}
                    color="bg-yellow-500"
                    onClick={() => openDrillDown("item", "Itens Classe B", overview?.abcClassification?.BItems)}
                  />
                  <ClassificationCard
                    label="Classe C"
                    description="Baixo valor (5% do valor)"
                    count={overview?.abcClassification?.C || 0}
                    percentage={overview?.abcClassification?.CPercentage || 0}
                    color="bg-red-500"
                    onClick={() => openDrillDown("item", "Itens Classe C", overview?.abcClassification?.CItems)}
                  />
                </div>
              </div>

              {/* XYZ Classification */}
              <div>
                <h4 className="text-sm font-medium mb-3">Classificação XYZ (Por Demanda)</h4>
                <div className="grid grid-cols-3 gap-4">
                  <ClassificationCard
                    label="Classe X"
                    description="Demanda constante"
                    count={overview?.xyzClassification?.X || 0}
                    percentage={overview?.xyzClassification?.XPercentage || 0}
                    color="bg-blue-500"
                  />
                  <ClassificationCard
                    label="Classe Y"
                    description="Demanda variável"
                    count={overview?.xyzClassification?.Y || 0}
                    percentage={overview?.xyzClassification?.YPercentage || 0}
                    color="bg-purple-500"
                  />
                  <ClassificationCard
                    label="Classe Z"
                    description="Demanda irregular"
                    count={overview?.xyzClassification?.Z || 0}
                    percentage={overview?.xyzClassification?.ZPercentage || 0}
                    color="bg-orange-500"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconChartBar className="h-5 w-5" />
              Estoque por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">Carregando...</div>
              </div>
            ) : (
              <div className="space-y-3">
                {overview?.topCategories?.slice(0, 5).map((category: any, index: number) => (
                  <div
                    key={category.id || index}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => openDrillDown("category", `Categoria: ${category.name}`, category)}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{category.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {category.itemCount} itens
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatKPIValue(category.totalValue, "currency")}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {category.stockPercentage?.toFixed(1)}% do total
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock by Supplier */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconShoppingCart className="h-5 w-5" />
              Estoque por Fornecedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">Carregando...</div>
              </div>
            ) : (
              <div className="space-y-3">
                {overview?.topSuppliers?.slice(0, 5).map((supplier: any, index: number) => (
                  <div
                    key={supplier.id || index}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => openDrillDown("supplier", `Fornecedor: ${supplier.name}`, supplier)}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{supplier.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {supplier.itemCount} itens
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatKPIValue(supplier.totalValue, "currency")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Consumption Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconChartLine className="h-5 w-5" />
            Análise de Consumo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {consumptionLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-pulse text-muted-foreground">Carregando consumo...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Monthly consumption trend would go here with a chart */}
              <div className="text-sm text-muted-foreground">
                Tendência de consumo mensal (gráfico seria renderizado aqui)
              </div>

              {/* Top consumed items */}
              <div>
                <h4 className="text-sm font-medium mb-3">Itens Mais Consumidos</h4>
                <DetailedDataTable
                  columns={[
                    { key: "name", label: "Item", sortable: true },
                    { key: "category", label: "Categoria", sortable: true },
                    {
                      key: "consumed",
                      label: "Consumido",
                      sortable: true,
                      align: "right",
                      render: (value: number) => formatKPIValue(value, "number")
                    },
                    {
                      key: "value",
                      label: "Valor",
                      sortable: true,
                      align: "right",
                      render: (value: number) => formatKPIValue(value, "currency")
                    },
                  ]}
                  data={consumption?.topConsumed || []}
                  paginated={true}
                  pageSize={10}
                  searchable={true}
                  exportable={true}
                  exportFilename="itens-mais-consumidos.csv"
                  loading={consumptionLoading}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reorder Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconBox className="h-5 w-5" />
            Análise de Reposição
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DetailedDataTable
            columns={[
              { key: "name", label: "Item", sortable: true },
              { key: "currentStock", label: "Estoque Atual", sortable: true, align: "right" },
              { key: "reorderPoint", label: "Ponto de Reposição", sortable: true, align: "right" },
              { key: "safetyStock", label: "Estoque de Segurança", sortable: true, align: "right" },
              {
                key: "priority",
                label: "Prioridade",
                sortable: true,
                render: (value: string) => (
                  <Badge
                    variant={value === "Alta" ? "destructive" : value === "Média" ? "default" : "secondary"}
                  >
                    {value}
                  </Badge>
                )
              },
              {
                key: "suggestedOrder",
                label: "Quantidade Sugerida",
                sortable: true,
                align: "right"
              },
            ]}
            data={overview?.itemsToReorder || []}
            paginated={true}
            pageSize={15}
            searchable={true}
            exportable={true}
            exportFilename="itens-para-reposicao.csv"
            loading={overviewLoading}
            emptyMessage="Nenhum item precisa ser reposto no momento"
          />
        </CardContent>
      </Card>

      {/* Value Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCurrencyDollar className="h-5 w-5" />
            Análise de Valor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Value over time chart would go here */}
            <div className="text-sm text-muted-foreground mb-4">
              Valor do estoque ao longo do tempo (gráfico seria renderizado aqui)
            </div>

            {/* Value by category breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Valor Classe A</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatKPIValue(overview?.valueByClass?.A || 0, "currency")}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {overview?.valueByClass?.APercentage?.toFixed(1)}% do total
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Valor Classe B</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatKPIValue(overview?.valueByClass?.B || 0, "currency")}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {overview?.valueByClass?.BPercentage?.toFixed(1)}% do total
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Valor Classe C</div>
                <div className="text-2xl font-bold text-red-600">
                  {formatKPIValue(overview?.valueByClass?.C || 0, "currency")}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {overview?.valueByClass?.CPercentage?.toFixed(1)}% do total
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drill-Down Modal */}
      <DrillDownModal
        open={drillDownData.open}
        onClose={closeDrillDown}
        title={drillDownData.title}
        description="Análise detalhada dos dados selecionados"
        tableContent={
          drillDownData.data && (
            <div className="p-4">
              <pre className="text-sm">
                {JSON.stringify(drillDownData.data, null, 2)}
              </pre>
            </div>
          )
        }
        exportable={true}
        onExport={() => console.log("Export drill-down data")}
      />
    </StatisticsPageLayout>
  );
}

/**
 * Classification Card Component
 */
interface ClassificationCardProps {
  label: string;
  description: string;
  count: number;
  percentage: number;
  color: string;
  onClick?: () => void;
}

function ClassificationCard({
  label,
  description,
  count,
  percentage,
  color,
  onClick,
}: ClassificationCardProps) {
  return (
    <div
      className={cn(
        "p-4 border rounded-lg",
        onClick && "cursor-pointer hover:shadow-md transition-shadow"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("w-3 h-3 rounded-full", color)} />
        <span className="font-semibold">{label}</span>
      </div>
      <div className="text-sm text-muted-foreground mb-3">{description}</div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold">{count}</div>
          <div className="text-xs text-muted-foreground">itens</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold">{percentage.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground">do total</div>
        </div>
      </div>
    </div>
  );
}

export default InventoryStatisticsPage;
