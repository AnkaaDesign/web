import { useState } from "react";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconTrendingUp, IconDownload, IconFilter, IconReload, IconCalendarTime, IconArrowUp, IconArrowDown, IconEqual } from "@tabler/icons-react";
import { addDays, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Chart components
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Scatter,
  Cell
} from "recharts";

// Types for filters and data
interface DateRange {
  from: Date;
  to: Date;
}

interface TrendsFilters {
  dateRange: DateRange;
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  categoryId?: string;
  brandId?: string;
  supplierId?: string;
  analysisType: 'consumption' | 'seasonal' | 'predictive';
  granularity: 'daily' | 'weekly' | 'monthly';
}

// Mock data for trend analysis
const mockConsumptionTrend = [
  { period: '2024-01', consumed: 125, average: 120, trend: 4.2 },
  { period: '2024-02', consumed: 142, average: 125, trend: 13.6 },
  { period: '2024-03', consumed: 138, average: 130, trend: 6.2 },
  { period: '2024-04', consumed: 156, average: 135, trend: 15.6 },
  { period: '2024-05', consumed: 149, average: 140, trend: 6.4 },
  { period: '2024-06', consumed: 167, average: 145, trend: 15.2 },
  { period: '2024-07', consumed: 174, average: 150, trend: 16.0 },
  { period: '2024-08', consumed: 168, average: 155, trend: 8.4 },
  { period: '2024-09', consumed: 189, average: 160, trend: 18.1 },
];

const mockSeasonalData = [
  { month: 'Jan', year2022: 120, year2023: 125, year2024: 135, average: 127 },
  { month: 'Fev', year2022: 135, year2023: 142, year2024: 151, average: 143 },
  { month: 'Mar', year2022: 145, year2023: 138, year2024: 158, average: 147 },
  { month: 'Abr', year2022: 168, year2023: 156, year2024: 172, average: 165 },
  { month: 'Mai', year2022: 156, year2023: 149, year2024: 164, average: 156 },
  { month: 'Jun', year2022: 178, year2023: 167, year2024: 185, average: 177 },
  { month: 'Jul', year2022: 189, year2023: 174, year2024: 192, average: 185 },
  { month: 'Ago', year2022: 172, year2023: 168, year2024: 175, average: 172 },
  { month: 'Set', year2022: 165, year2023: 189, year2024: 195, average: 183 },
  { month: 'Out', year2022: 158, year2023: 165, year2024: null, average: 162 },
  { month: 'Nov', year2022: 142, year2023: 148, year2024: null, average: 145 },
  { month: 'Dez', year2022: 125, year2023: 132, year2024: null, average: 129 },
];

const mockPredictiveData = [
  { period: '2024-09', actual: 189, predicted: 185, confidence: 95 },
  { period: '2024-10', actual: null, predicted: 195, confidence: 92 },
  { period: '2024-11', actual: null, predicted: 178, confidence: 88 },
  { period: '2024-12', actual: null, predicted: 165, confidence: 85 },
  { period: '2025-01', actual: null, predicted: 158, confidence: 80 },
  { period: '2025-02', actual: null, predicted: 172, confidence: 75 },
  { period: '2025-03', actual: null, predicted: 185, confidence: 70 },
];

const mockCategoryTrends = [
  { name: 'Ferramentas', currentMonth: 45, lastMonth: 42, growth: 7.1, trend: 'up' },
  { name: 'Materiais Elétricos', currentMonth: 38, lastMonth: 39, growth: -2.6, trend: 'down' },
  { name: 'Tintas', currentMonth: 52, lastMonth: 48, growth: 8.3, trend: 'up' },
  { name: 'Parafusos e Fixadores', currentMonth: 67, lastMonth: 65, growth: 3.1, trend: 'up' },
  { name: 'EPIs', currentMonth: 23, lastMonth: 23, growth: 0, trend: 'stable' },
];

const mockAnomalies = [
  { date: '2024-09-15', item: 'Tinta Branca 20L', consumption: 15, expected: 8, deviation: 87.5 },
  { date: '2024-09-12', item: 'Cabo Flex 2.5mm', consumption: 25, expected: 12, deviation: 108.3 },
  { date: '2024-09-08', item: 'Parafuso M8', consumption: 200, expected: 95, deviation: 110.5 },
];

export const TrendsStatisticsPage = () => {
  // Page tracking
  usePageTracker({
    title: "Análise de Tendências",
    icon: "calendar-time",
  });

  // State for filters and data refreshing
  const [filters, setFilters] = useState<TrendsFilters>({
    dateRange: {
      from: startOfYear(new Date()),
      to: endOfMonth(new Date()),
    },
    period: 'year',
    analysisType: 'consumption',
    granularity: 'monthly',
  });

  const [activeTab, setActiveTab] = useState("consumption-trends");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Quick date range presets
  const datePresets = [
    {
      label: "Últimos 6 Meses",
      value: "last-6-months",
      getRange: () => ({ from: subDays(new Date(), 180), to: new Date() }),
    },
    {
      label: "Este Ano",
      value: "this-year",
      getRange: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }),
    },
    {
      label: "Último Ano",
      value: "last-year",
      getRange: () => ({ from: subDays(new Date(), 365), to: new Date() }),
    },
    {
      label: "Últimos 2 Anos",
      value: "last-2-years",
      getRange: () => ({ from: subDays(new Date(), 730), to: new Date() }),
    },
  ];

  const handlePeriodChange = (period: string) => {
    const preset = datePresets.find(p => p.value === period);
    if (preset) {
      setFilters(prev => ({
        ...prev,
        period: period as TrendsFilters['period'],
        dateRange: preset.getRange(),
      }));
    }
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range) {
      setFilters(prev => ({
        ...prev,
        dateRange: range,
        period: 'custom',
      }));
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleExport = () => {
    // Export functionality to be implemented
    console.log("Exporting trends analysis...");
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.categoryId) count++;
    if (filters.brandId) count++;
    if (filters.supplierId) count++;
    if (filters.analysisType !== 'consumption') count++;
    if (filters.granularity !== 'monthly') count++;
    return count;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <IconArrowUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <IconArrowDown className="h-4 w-4 text-red-600" />;
      case 'stable':
        return <IconEqual className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full space-y-6">
        {/* Page Header */}
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Análise de Tendências"
            icon={IconCalendarTime}
            favoritePage={FAVORITE_PAGES.ESTOQUE_ESTATISTICAS_TENDENCIAS}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Estatísticas", href: routes.inventory.statistics.root },
              { label: "Tendências" }
            ]}
            actions={[
              {
                key: "refresh",
                label: "Atualizar",
                icon: IconReload,
                onClick: handleRefresh,
                variant: "outline",
                loading: isRefreshing,
              },
              {
                key: "export",
                label: "Exportar",
                icon: IconDownload,
                onClick: handleExport,
                variant: "default",
              },
            ]}
          />
        </div>

        {/* Filters Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <IconFilter className="h-5 w-5" />
                  Filtros de Análise
                </CardTitle>
                <CardDescription>
                  Configure os parâmetros para análise de tendências de consumo
                </CardDescription>
              </div>
              {getActiveFiltersCount() > 0 && (
                <Badge variant="secondary">
                  {getActiveFiltersCount()} filtros aplicados
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Period Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Período</label>
                <Select value={filters.period} onValueChange={handlePeriodChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last-6-months">Últimos 6 Meses</SelectItem>
                    <SelectItem value="this-year">Este Ano</SelectItem>
                    <SelectItem value="last-year">Último Ano</SelectItem>
                    <SelectItem value="last-2-years">Últimos 2 Anos</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Picker */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Intervalo de Datas</label>
                <DateRangePicker
                  from={filters.dateRange.from}
                  to={filters.dateRange.to}
                  onSelect={handleDateRangeChange}
                />
              </div>

              {/* Analysis Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Análise</label>
                <Select value={filters.analysisType} onValueChange={(value) =>
                  setFilters(prev => ({ ...prev, analysisType: value as TrendsFilters['analysisType'] }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de análise" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consumption">Consumo</SelectItem>
                    <SelectItem value="seasonal">Sazonal</SelectItem>
                    <SelectItem value="predictive">Preditiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Granularity */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Granularidade</label>
                <Select value={filters.granularity} onValueChange={(value) =>
                  setFilters(prev => ({ ...prev, granularity: value as TrendsFilters['granularity'] }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Granularidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trends Analysis Tabs */}
        <div className="flex-1 min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="consumption-trends">Tendências de Consumo</TabsTrigger>
              <TabsTrigger value="seasonal-analysis">Análise Sazonal</TabsTrigger>
              <TabsTrigger value="predictive-insights">Insights Preditivos</TabsTrigger>
              <TabsTrigger value="anomalies">Anomalias</TabsTrigger>
            </TabsList>

            <div className="flex-1 mt-6">
              {/* Consumption Trends Tab */}
              <TabsContent value="consumption-trends" className="h-full space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle>Tendência de Consumo</CardTitle>
                      <CardDescription>
                        Evolução do consumo com média móvel e tendência
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart data={mockConsumptionTrend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="consumed" fill="#3b82f6" name="Consumido" opacity={0.7} />
                          <Line
                            type="monotone"
                            dataKey="average"
                            stroke="#ef4444"
                            strokeWidth={2}
                            name="Média Móvel"
                          />
                          <Line
                            type="monotone"
                            dataKey="trend"
                            stroke="#22c55e"
                            strokeWidth={2}
                            name="Taxa de Crescimento (%)"
                            yAxisId="right"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Tendências por Categoria</CardTitle>
                      <CardDescription>
                        Comparativo de crescimento entre categorias
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {mockCategoryTrends.map((category) => (
                          <div key={category.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium">{category.name}</p>
                              <p className="text-sm text-gray-500">
                                {category.currentMonth} unidades este mês
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className={`text-sm font-medium ${
                                  category.growth > 0 ? 'text-green-600' :
                                  category.growth < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {category.growth > 0 ? '+' : ''}{category.growth.toFixed(1)}%
                                </p>
                                <p className="text-xs text-gray-500">vs mês anterior</p>
                              </div>
                              {getTrendIcon(category.trend)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Seasonal Analysis Tab */}
              <TabsContent value="seasonal-analysis" className="h-full space-y-6">
                <div className="grid grid-cols-1 gap-6 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle>Padrões Sazonais</CardTitle>
                      <CardDescription>
                        Comparação do consumo por mês ao longo dos anos
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={mockSeasonalData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="year2022"
                            stroke="#94a3b8"
                            strokeWidth={2}
                            name="2022"
                          />
                          <Line
                            type="monotone"
                            dataKey="year2023"
                            stroke="#64748b"
                            strokeWidth={2}
                            name="2023"
                          />
                          <Line
                            type="monotone"
                            dataKey="year2024"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            name="2024"
                          />
                          <Line
                            type="monotone"
                            dataKey="average"
                            stroke="#ef4444"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            name="Média"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Pico Sazonal</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-blue-600">Julho</p>
                        <p className="text-sm text-gray-500">Maior consumo médio: 185 unidades</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Vale Sazonal</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-orange-600">Janeiro</p>
                        <p className="text-sm text-gray-500">Menor consumo médio: 127 unidades</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Variação Sazonal</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-green-600">45.7%</p>
                        <p className="text-sm text-gray-500">Diferença pico-vale</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* Predictive Insights Tab */}
              <TabsContent value="predictive-insights" className="h-full space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle>Previsão de Demanda</CardTitle>
                      <CardDescription>
                        Projeção baseada em dados históricos com intervalo de confiança
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart data={mockPredictiveData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar
                            dataKey="actual"
                            fill="#3b82f6"
                            name="Consumo Real"
                          />
                          <Line
                            type="monotone"
                            dataKey="predicted"
                            stroke="#ef4444"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            name="Previsão"
                          />
                          <Line
                            type="monotone"
                            dataKey="confidence"
                            stroke="#22c55e"
                            strokeWidth={1}
                            name="Confiança (%)"
                            yAxisId="right"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Insights Preditivos</CardTitle>
                      <CardDescription>
                        Análises e recomendações baseadas nos dados
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <h4 className="font-medium text-blue-900">Tendência de Crescimento</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            Projeção de aumento de 8.5% no consumo para o próximo trimestre
                          </p>
                        </div>
                        <div className="p-4 bg-yellow-50 rounded-lg">
                          <h4 className="font-medium text-yellow-900">Atenção Sazonal</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            Dezembro historicamente apresenta queda de 15% no consumo
                          </p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                          <h4 className="font-medium text-green-900">Recomendação</h4>
                          <p className="text-sm text-green-700 mt-1">
                            Considere aumentar estoque em 12% antes do pico de dezembro
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Anomalies Tab */}
              <TabsContent value="anomalies" className="h-full space-y-6">
                <div className="grid grid-cols-1 gap-6 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle>Detecção de Anomalias</CardTitle>
                      <CardDescription>
                        Identificação automática de padrões anômalos no consumo
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {mockAnomalies.map((anomaly, index) => (
                          <div key={index} className="flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-red-900">{anomaly.item}</h4>
                                <Badge variant="destructive" className="text-xs">
                                  +{anomaly.deviation.toFixed(1)}%
                                </Badge>
                              </div>
                              <p className="text-sm text-red-700">
                                Consumo: {anomaly.consumption} unidades (esperado: {anomaly.expected})
                              </p>
                              <p className="text-xs text-red-600">
                                {format(new Date(anomaly.date), 'dd/MM/yyyy', { locale: ptBR })}
                              </p>
                            </div>
                            <Button variant="outline" size="sm">
                              Investigar
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Anomalias Detectadas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-red-600">3</p>
                        <p className="text-sm text-gray-500">Nos últimos 30 dias</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Maior Desvio</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-orange-600">110.5%</p>
                        <p className="text-sm text-gray-500">Parafuso M8</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Taxa de Falsos Positivos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-green-600">5.2%</p>
                        <p className="text-sm text-gray-500">Precisão do modelo</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default TrendsStatisticsPage;