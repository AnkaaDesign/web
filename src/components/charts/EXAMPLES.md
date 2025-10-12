# Chart Components - Usage Examples

Quick reference guide with real-world examples.

## Table of Contents
- [Time Series Charts](#time-series-charts)
- [Bar Charts](#bar-charts)
- [Pie Charts](#pie-charts)
- [Area Charts](#area-charts)
- [Business Charts](#business-charts)
- [Dashboard Layouts](#dashboard-layouts)

## Time Series Charts

### Revenue Over Time

```typescript
import { TimeSeriesChart } from '@/components/charts';

function RevenueChart() {
  const data = [
    { date: '2024-01-01', revenue: 45000, costs: 28000 },
    { date: '2024-02-01', revenue: 52000, costs: 30000 },
    { date: '2024-03-01', revenue: 48000, costs: 29000 },
  ];

  const series = [
    { key: 'revenue', name: 'Receita', color: '#10b981' },
    { key: 'costs', name: 'Custos', color: '#ef4444' },
  ];

  return (
    <TimeSeriesChart
      data={data}
      series={series}
      title="Receita e Custos Mensais"
      description="Análise financeira do trimestre"
      height={400}
      valueType="currency"
      showMovingAverage
      movingAverageWindow={3}
      onRefresh={async () => {
        await refetchData();
      }}
    />
  );
}
```

### Stock Price with Trend

```typescript
function StockPriceChart() {
  const data = stockPrices; // from API

  return (
    <TimeSeriesChart
      data={data}
      series={[
        { key: 'price', name: 'Preço', color: '#3b82f6' },
      ]}
      title="Preço das Ações - ACME Corp"
      showTrendLine
      showBrush
      annotations={[
        { date: '2024-06-15', label: 'Dividendos', color: '#10b981' },
        { date: '2024-08-01', label: 'Split 2:1', color: '#f59e0b' },
      ]}
      curved={false}
      height={500}
    />
  );
}
```

## Bar Charts

### Sales by Product

```typescript
import { BarChartComponent } from '@/components/charts';

function ProductSalesChart() {
  const data = [
    { name: 'Produto A', sales: 4000, target: 3500 },
    { name: 'Produto B', sales: 3000, target: 3200 },
    { name: 'Produto C', sales: 2000, target: 2500 },
    { name: 'Produto D', sales: 2780, target: 2800 },
  ];

  const series = [
    { key: 'sales', name: 'Vendas' },
  ];

  return (
    <BarChartComponent
      data={data}
      series={series}
      title="Vendas por Produto"
      orientation="vertical"
      showValueLabels
      targetValue={3000}
      targetLabel="Meta Mínima"
      valueType="currency"
    />
  );
}
```

### Quarterly Comparison

```typescript
function QuarterlyChart() {
  const data = [
    { department: 'Vendas', q1: 40, q2: 45, q3: 50, q4: 55 },
    { department: 'Marketing', q1: 30, q2: 32, q3: 35, q4: 38 },
    { department: 'TI', q1: 25, q2: 28, q3: 30, q4: 32 },
  ];

  const series = [
    { key: 'q1', name: 'Q1', stackId: 'stack' },
    { key: 'q2', name: 'Q2', stackId: 'stack' },
    { key: 'q3', name: 'Q3', stackId: 'stack' },
    { key: 'q4', name: 'Q4', stackId: 'stack' },
  ];

  return (
    <BarChartComponent
      data={data}
      series={series}
      title="Faturamento por Departamento"
      layout="stacked"
      orientation="horizontal"
      valueType="currency"
      showLegend
    />
  );
}
```

## Pie Charts

### Market Share

```typescript
import { PieChartComponent } from '@/components/charts';

function MarketShareChart() {
  const data = [
    { name: 'Nossa Empresa', value: 35 },
    { name: 'Concorrente A', value: 25 },
    { name: 'Concorrente B', value: 20 },
    { name: 'Concorrente C', value: 15 },
    { name: 'Outros', value: 5 },
  ];

  return (
    <PieChartComponent
      data={data}
      title="Participação de Mercado"
      variant="donut"
      showPercentages
      showValues
      centerLabel="Total"
      centerValue="100%"
      colors={[
        '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6b7280'
      ]}
    />
  );
}
```

### Customer Segments

```typescript
function CustomerSegmentChart() {
  const data = [
    { name: 'Empresas', value: 450 },
    { name: 'Governo', value: 200 },
    { name: 'Varejo', value: 350 },
  ];

  return (
    <PieChartComponent
      data={data}
      title="Clientes por Segmento"
      variant="pie"
      showLabels
      showPercentages
      onSegmentClick={(segment) => {
        console.log('Clicked:', segment);
        // Navigate to segment details
      }}
    />
  );
}
```

## Area Charts

### Traffic Sources

```typescript
import { AreaChartComponent } from '@/components/charts';

function TrafficChart() {
  const data = [
    { date: '2024-01-01', organic: 1000, paid: 500, social: 300 },
    { date: '2024-01-02', organic: 1200, paid: 600, social: 350 },
    { date: '2024-01-03', organic: 1100, paid: 550, social: 400 },
  ];

  const series = [
    { key: 'organic', name: 'Orgânico', color: '#10b981' },
    { key: 'paid', name: 'Pago', color: '#3b82f6' },
    { key: 'social', name: 'Social', color: '#8b5cf6' },
  ];

  return (
    <AreaChartComponent
      data={data}
      series={series}
      title="Fontes de Tráfego"
      layout="stacked"
      useGradient
      fillOpacity={0.7}
    />
  );
}
```

### Percentage Breakdown

```typescript
function PercentageAreaChart() {
  const data = monthlyBudget; // from API

  const series = [
    { key: 'salaries', name: 'Salários' },
    { key: 'marketing', name: 'Marketing' },
    { key: 'infrastructure', name: 'Infraestrutura' },
    { key: 'other', name: 'Outros' },
  ];

  return (
    <AreaChartComponent
      data={data}
      series={series}
      title="Distribuição de Orçamento"
      layout="percentage"
      yAxisType="percentage"
      curved
    />
  );
}
```

## Business Charts

### Inventory Management

```typescript
import { InventoryLevelChart } from '@/components/charts/business';

function InventoryDashboard() {
  const inventoryData = [
    {
      id: '1',
      name: 'Parafuso M6',
      currentStock: 500,
      reorderPoint: 300,
      safetyStock: 100,
      maxStock: 1000,
      unit: 'un',
      category: 'A',
    },
    {
      id: '2',
      name: 'Porca M6',
      currentStock: 150,
      reorderPoint: 200,
      safetyStock: 100,
      unit: 'un',
      category: 'B',
    },
    // more items...
  ];

  return (
    <InventoryLevelChart
      data={inventoryData}
      title="Níveis de Estoque Críticos"
      showReorderPoints
      showSafetyStock
      colorByStatus
      onItemClick={(item) => {
        navigate(`/inventory/${item.id}`);
      }}
      onRefresh={refetchInventory}
    />
  );
}
```

### Task Status

```typescript
import { TaskStatusDistribution } from '@/components/charts/business';

function TaskStatusWidget() {
  const taskData = {
    pending: 45,
    in_progress: 23,
    completed: 156,
    cancelled: 8,
  };

  return (
    <TaskStatusDistribution
      data={taskData}
      title="Status das Tarefas"
      description="Situação geral do projeto"
      variant="donut"
      showPercentages
      height={300}
    />
  );
}
```

## Dashboard Layouts

### Full Dashboard

```typescript
import {
  ChartGrid,
  DashboardCard,
  TimeSeriesChart,
  BarChartComponent,
  PieChartComponent,
} from '@/components/charts';

function AnalyticsDashboard() {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <ChartGrid columns={3} gap="md">
        <DashboardCard
          title="Receita Total"
          subtitle="Últimos 30 dias"
          icon={<DollarSign />}
        >
          <div className="text-3xl font-bold">R$ 125.340</div>
          <div className="text-sm text-green-600">+12.5% vs mês anterior</div>
        </DashboardCard>

        <DashboardCard
          title="Novos Clientes"
          subtitle="Últimos 30 dias"
          icon={<Users />}
        >
          <div className="text-3xl font-bold">234</div>
          <div className="text-sm text-green-600">+8.3% vs mês anterior</div>
        </DashboardCard>

        <DashboardCard
          title="Taxa de Conversão"
          subtitle="Últimos 30 dias"
          icon={<TrendingUp />}
        >
          <div className="text-3xl font-bold">3.2%</div>
          <div className="text-sm text-red-600">-0.5% vs mês anterior</div>
        </DashboardCard>
      </ChartGrid>

      {/* Charts */}
      <ChartGrid columns={2} gap="md">
        <DashboardCard
          title="Receita Mensal"
          subtitle="Últimos 12 meses"
          onRefresh={refetchRevenue}
          onExport={exportRevenue}
          draggable
        >
          <TimeSeriesChart
            data={revenueData}
            series={[
              { key: 'revenue', name: 'Receita' },
              { key: 'target', name: 'Meta' },
            ]}
            showMovingAverage
            height={350}
          />
        </DashboardCard>

        <DashboardCard
          title="Vendas por Categoria"
          onExpand={handleExpand}
        >
          <PieChartComponent
            data={categoryData}
            variant="donut"
            showPercentages
            height={350}
          />
        </DashboardCard>

        <DashboardCard
          title="Top 10 Produtos"
          subtitle="Por receita"
        >
          <BarChartComponent
            data={topProducts}
            series={[{ key: 'revenue', name: 'Receita' }]}
            orientation="horizontal"
            showValueLabels
            valueType="currency"
            height={350}
          />
        </DashboardCard>

        <DashboardCard
          title="Crescimento Trimestral"
        >
          <AreaChartComponent
            data={quarterlyGrowth}
            series={[
              { key: 'revenue', name: 'Receita' },
              { key: 'profit', name: 'Lucro' },
            ]}
            layout="default"
            useGradient
            height={350}
          />
        </DashboardCard>
      </ChartGrid>
    </div>
  );
}
```

### Responsive Mobile Layout

```typescript
function MobileDashboard() {
  return (
    <ChartGrid columns={1} gap="sm">
      <DashboardCard title="Visão Geral">
        <TimeSeriesChart
          data={data}
          series={series}
          height={250}
          showLegend={false}
        />
      </DashboardCard>

      <DashboardCard title="Distribuição">
        <PieChartComponent
          data={pieData}
          variant="donut"
          height={250}
        />
      </DashboardCard>
    </ChartGrid>
  );
}
```

## Advanced Patterns

### With React Query

```typescript
import { useQuery } from '@tanstack/react-query';
import { TimeSeriesChart } from '@/components/charts';

function DataDrivenChart() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['revenue-data'],
    queryFn: fetchRevenueData,
  });

  return (
    <TimeSeriesChart
      data={data?.results || []}
      series={[{ key: 'revenue', name: 'Receita' }]}
      isLoading={isLoading}
      error={error}
      onRefresh={refetch}
      title="Receita Diária"
    />
  );
}
```

### Custom Export

```typescript
function ChartWithCustomExport() {
  const handleExport = async (format: 'png' | 'pdf' | 'csv' | 'excel') => {
    if (format === 'csv') {
      // Custom CSV export with additional processing
      const csvData = processDataForExport(data);
      downloadCSV(csvData, 'custom-export.csv');
    }
    // Default export for other formats
  };

  return (
    <TimeSeriesChart
      data={data}
      series={series}
      onExport={handleExport}
    />
  );
}
```

### Interactive Drill-Down

```typescript
function DrillDownChart() {
  const [selectedCategory, setSelectedCategory] = useState(null);

  return (
    <>
      <PieChartComponent
        data={categoryData}
        onSegmentClick={(segment) => {
          setSelectedCategory(segment.name);
        }}
        title="Clique para ver detalhes"
      />

      {selectedCategory && (
        <BarChartComponent
          data={getDetailData(selectedCategory)}
          series={[{ key: 'value', name: 'Valor' }]}
          title={`Detalhes: ${selectedCategory}`}
        />
      )}
    </>
  );
}
```

## Tips and Tricks

### Optimize Large Datasets

```typescript
// Use data aggregation for large datasets
const aggregatedData = useMemo(() => {
  if (data.length > 1000) {
    return aggregateByPeriod(data, 'week');
  }
  return data;
}, [data]);
```

### Sync Multiple Charts

```typescript
function SyncedCharts() {
  const [timeRange, setTimeRange] = useState('30d');

  const filteredData = useMemo(() => {
    return filterByTimeRange(data, timeRange);
  }, [data, timeRange]);

  return (
    <>
      <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

      <ChartGrid columns={2}>
        <TimeSeriesChart data={filteredData} {...} />
        <BarChartComponent data={filteredData} {...} />
      </ChartGrid>
    </>
  );
}
```

### Conditional Rendering

```typescript
function AdaptiveChart({ data, preferredType = 'auto' }) {
  const chartType = preferredType === 'auto'
    ? data.length < 10 ? 'pie' : 'bar'
    : preferredType;

  if (chartType === 'pie') {
    return <PieChartComponent data={data} />;
  }

  return <BarChartComponent data={data} />;
}
```
