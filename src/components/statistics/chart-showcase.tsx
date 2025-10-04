import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import {
  BarChart,
  LineChart,
  PieChart,
  ChartGrid,
  ChartContainer,
  ChartMetrics,
  ChartTypeSelector,
  ChartExportButton,
  useChartState,
  chartColors,
} from "./index";
import { CHART_TYPE } from "../../constants";

// Sample data generators
const generateSalesData = () => {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return months.map(month => ({
    name: month,
    vendas: Math.floor(Math.random() * 50000) + 20000,
    meta: 35000,
    custos: Math.floor(Math.random() * 25000) + 15000,
  }));
};

const generateCategoryData = () => [
  { name: "Matéria Prima", value: 45000 },
  { name: "Mão de Obra", value: 28000 },
  { name: "Equipamentos", value: 15000 },
  { name: "Transporte", value: 8000 },
  { name: "Marketing", value: 6000 },
  { name: "Administrativo", value: 4000 },
  { name: "Outros", value: 3000 },
];

const generateStatusData = () => [
  { name: "Concluído", value: 156, color: chartColors.success[0] },
  { name: "Em Andamento", value: 89, color: chartColors.warning[0] },
  { name: "Pendente", value: 67, color: chartColors.primary[0] },
  { name: "Cancelado", value: 23, color: chartColors.danger[0] },
];

const generatePerformanceData = () => {
  const weeks = Array.from({ length: 12 }, (_, i) => `Sem ${i + 1}`);
  return weeks.map(week => ({
    name: week,
    eficiencia: Math.floor(Math.random() * 30) + 70,
    qualidade: Math.floor(Math.random() * 25) + 75,
    produtividade: Math.floor(Math.random() * 35) + 65,
  }));
};

export function ChartShowcase() {
  const {
    chartType,
    setChartType,
    isLoading,
    refresh,
    setLoadingState,
    lastUpdated,
  } = useChartState({
    initialType: CHART_TYPE.BAR,
    autoRefresh: false,
  });

  const [salesData, setSalesData] = React.useState(generateSalesData);
  const [categoryData, setCategoryData] = React.useState(generateCategoryData);
  const [statusData, setStatusData] = React.useState(generateStatusData);
  const [performanceData, setPerformanceData] = React.useState(generatePerformanceData);

  const handleRefresh = async () => {
    setLoadingState(true);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update all data
    setSalesData(generateSalesData());
    setCategoryData(generateCategoryData());
    setStatusData(generateStatusData());
    setPerformanceData(generatePerformanceData());

    setLoadingState(false);
    refresh();
  };

  const exportChart = () => {
    console.log("Exporting chart...");
    // In a real implementation, you would use html2canvas or similar
  };

  // Calculate metrics from current data
  const totalSales = salesData.reduce((sum, item) => sum + item.vendas, 0);
  const totalCosts = salesData.reduce((sum, item) => sum + item.custos, 0);
  const profit = totalSales - totalCosts;
  const profitMargin = totalSales > 0 ? ((profit / totalSales) * 100) : 0;

  const metrics = [
    {
      label: "Vendas Totais",
      value: totalSales,
      format: "currency" as const,
      change: 12.5,
    },
    {
      label: "Custos Totais",
      value: totalCosts,
      format: "currency" as const,
      change: -3.2,
    },
    {
      label: "Lucro",
      value: profit,
      format: "currency" as const,
      change: 8.7,
    },
    {
      label: "Margem",
      value: profitMargin,
      format: "percentage" as const,
      change: 2.1,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header with controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Dashboard de Gráficos</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Demonstração completa dos componentes de gráfico
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ChartTypeSelector
                value={chartType}
                onChange={setChartType}
                compact
              />
              <ChartExportButton onExport={exportChart} />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <ChartMetrics metrics={metrics} />
            <div className="text-xs text-muted-foreground text-center">
              Última atualização: {lastUpdated.toLocaleTimeString("pt-BR")}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main charts grid */}
      <ChartGrid columns={2} gap="lg">
        {/* Sales Chart */}
        <BarChart
          title="Vendas vs Custos Mensais"
          description="Comparação entre vendas realizadas e custos mensais"
          data={salesData}
          bars={[
            { dataKey: "vendas", name: "Vendas", color: chartColors.primary[0] },
            { dataKey: "custos", name: "Custos", color: chartColors.danger[0] },
          ]}
          referenceLines={[
            { value: 35000, label: "Meta", color: chartColors.success[0] }
          ]}
          valueType="currency"
          isLoading={isLoading}
          showExport
          onExport={exportChart}
        />

        {/* Performance Trends */}
        <LineChart
          title="Indicadores de Performance"
          description="Evolução dos indicadores ao longo das semanas"
          data={performanceData}
          lines={[
            { dataKey: "eficiencia", name: "Eficiência", color: chartColors.primary[0] },
            { dataKey: "qualidade", name: "Qualidade", color: chartColors.success[0] },
            { dataKey: "produtividade", name: "Produtividade", color: chartColors.warning[0] },
          ]}
          valueType="percentage"
          smooth
          isLoading={isLoading}
          showExport
          onExport={exportChart}
        />
      </ChartGrid>

      {/* Secondary charts */}
      <ChartGrid columns={3} gap="md">
        {/* Category Distribution */}
        <PieChart
          title="Distribuição de Gastos"
          description="Breakdown dos gastos por categoria"
          data={categoryData}
          type="donut"
          valueType="currency"
          showPercentages
          isLoading={isLoading}
          className="col-span-2"
        />

        {/* Status Distribution */}
        <PieChart
          title="Status dos Projetos"
          description="Situação atual dos projetos"
          data={statusData}
          type="pie"
          showPercentages
          showValues={false}
          isLoading={isLoading}
        />
      </ChartGrid>

      {/* Chart variations based on selected type */}
      <Card>
        <CardHeader>
          <CardTitle>Gráfico Dinâmico - {chartType}</CardTitle>
          <p className="text-sm text-muted-foreground">
            O tipo de gráfico muda baseado na seleção acima
          </p>
        </CardHeader>
        <CardContent>
          {chartType === CHART_TYPE.BAR && (
            <BarChart
              data={salesData}
              bars={[{ dataKey: "vendas", name: "Vendas", color: chartColors.primary[0] }]}
              valueType="currency"
              showLabels
              isLoading={isLoading}
              height={300}
            />
          )}

          {chartType === CHART_TYPE.LINE && (
            <LineChart
              data={salesData}
              lines={[
                {
                  dataKey: "vendas",
                  name: "Vendas",
                  color: chartColors.primary[0],
                  area: true,
                  areaOpacity: 0.3,
                }
              ]}
              chartType="composed"
              valueType="currency"
              smooth
              isLoading={isLoading}
              height={300}
            />
          )}

          {(chartType === CHART_TYPE.PIE || chartType === CHART_TYPE.DONUT) && (
            <PieChart
              data={categoryData.slice(0, 6)} // Limit to 6 categories for better visualization
              type={chartType === CHART_TYPE.DONUT ? "donut" : "pie"}
              valueType="currency"
              showPercentages
              isLoading={isLoading}
              height={300}
            />
          )}

          {chartType === CHART_TYPE.AREA && (
            <LineChart
              data={performanceData}
              lines={[
                {
                  dataKey: "eficiencia",
                  name: "Eficiência",
                  color: chartColors.primary[0],
                  area: true,
                  areaOpacity: 0.4,
                }
              ]}
              chartType="composed"
              valueType="percentage"
              smooth
              isLoading={isLoading}
              height={300}
            />
          )}

          {chartType === CHART_TYPE.STACKED && (
            <BarChart
              data={salesData}
              bars={[
                { dataKey: "vendas", name: "Vendas", color: chartColors.success[0] },
                { dataKey: "custos", name: "Custos", color: chartColors.danger[0] },
              ]}
              stacked
              valueType="currency"
              isLoading={isLoading}
              height={300}
            />
          )}
        </CardContent>
      </Card>

      {/* Usage guide */}
      <Card>
        <CardHeader>
          <CardTitle>Como Usar os Componentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-2">
            <p><strong>Características dos componentes:</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>BaseChart:</strong> Componente base com título, loading, error states e export</li>
              <li><strong>BarChart:</strong> Suporte a barras horizontais/verticais, empilhadas, labels</li>
              <li><strong>LineChart:</strong> Linhas, áreas, pontos personalizáveis, linhas de referência</li>
              <li><strong>PieChart:</strong> Pizza e donut, legendas customizáveis, agrupamento automático</li>
              <li><strong>ChartUtils:</strong> Grid responsivo, métricas, loading states, controles</li>
            </ul>
          </div>

          <div className="text-sm space-y-2">
            <p><strong>Recursos inclusos:</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Design responsivo com breakpoints do Tailwind</li>
              <li>Tooltips em português com formatação adequada</li>
              <li>Esquema de cores baseado no tema do projeto</li>
              <li>Estados de loading, erro e vazio</li>
              <li>Funcionalidade de export (PNG, SVG, PDF)</li>
              <li>Presets para casos de uso comuns</li>
              <li>Suporte completo ao modo escuro</li>
              <li>Animações suaves e transições</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}