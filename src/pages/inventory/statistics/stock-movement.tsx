import { useState, useMemo } from "react";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportButton } from "@/components/ui/export-button";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES, ACTIVITY_REASON, ACTIVITY_REASON_LABELS } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconTrendingUp, IconDownload, IconFilter, IconReload, IconArrowUp, IconArrowDown } from "@tabler/icons-react";
import { addDays, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ChartExportData } from "../../../utils";

// Chart components (to be implemented)
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
  PieChart,
  Pie,
  Cell
} from "recharts";

// Types for filters and data
interface DateRange {
  from: Date;
  to: Date;
}

interface StockMovementFilters {
  dateRange: DateRange;
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  itemId?: string;
  categoryId?: string;
  brandId?: string;
  movementType?: 'all' | 'in' | 'out';
  reason?: string;
  userId?: string;
}

// Mock data for charts
const mockMovementData = [
  { date: '2024-09-01', entradas: 45, saidas: 32, saldo: 13 },
  { date: '2024-09-02', entradas: 52, saidas: 41, saldo: 11 },
  { date: '2024-09-03', entradas: 38, saidas: 29, saldo: 9 },
  { date: '2024-09-04', entradas: 61, saidas: 55, saldo: 6 },
  { date: '2024-09-05', entradas: 43, saidas: 38, saldo: 5 },
  { date: '2024-09-06', entradas: 49, saidas: 42, saldo: 7 },
  { date: '2024-09-07', entradas: 56, saidas: 47, saldo: 9 },
];

const mockReasonData = [
  { name: 'Compra', value: 35, color: '#8884d8' },
  { name: 'Produção', value: 25, color: '#82ca9d' },
  { name: 'Venda', value: 20, color: '#ffc658' },
  { name: 'Perda', value: 10, color: '#ff7c7c' },
  { name: 'Ajuste', value: 10, color: '#8dd1e1' },
];

const mockHourlyData = [
  { hour: '08:00', movements: 12 },
  { hour: '09:00', movements: 18 },
  { hour: '10:00', movements: 25 },
  { hour: '11:00', movements: 22 },
  { hour: '12:00', movements: 8 },
  { hour: '13:00', movements: 15 },
  { hour: '14:00', movements: 28 },
  { hour: '15:00', movements: 31 },
  { hour: '16:00', movements: 24 },
  { hour: '17:00', movements: 19 },
];

const mockTopItems = [
  { name: 'Parafuso M6', movements: 156, trend: 'up' },
  { name: 'Tinta Branca', movements: 142, trend: 'up' },
  { name: 'Porca M8', movements: 138, trend: 'down' },
  { name: 'Cabo Elétrico', movements: 125, trend: 'up' },
  { name: 'Solda MIG', movements: 118, trend: 'down' },
];

export const StockMovementStatisticsPage = () => {
  // Page tracking
  usePageTracker({
    title: "Movimentação de Estoque",
    icon: "trending-up",
  });

  // State for filters and data refreshing
  const [filters, setFilters] = useState<StockMovementFilters>({
    dateRange: {
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    },
    period: 'month',
    movementType: 'all',
  });

  const [activeTab, setActiveTab] = useState("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Quick date range presets
  const datePresets = [
    {
      label: "Hoje",
      value: "today",
      getRange: () => ({ from: new Date(), to: new Date() }),
    },
    {
      label: "Última Semana",
      value: "last-week",
      getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }),
    },
    {
      label: "Último Mês",
      value: "last-month",
      getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
    },
    {
      label: "Últimos 3 Meses",
      value: "last-3-months",
      getRange: () => ({ from: subDays(new Date(), 90), to: new Date() }),
    },
    {
      label: "Este Ano",
      value: "this-year",
      getRange: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }),
    },
  ];

  const handlePeriodChange = (period: string) => {
    const preset = datePresets.find(p => p.value === period);
    if (preset) {
      setFilters(prev => ({
        ...prev,
        period: period as StockMovementFilters['period'],
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

  // Prepare export data based on current filters and active tab
  const exportData = useMemo((): ChartExportData[] => {
    const data: ChartExportData[] = [];

    // Add overview data
    if (activeTab === "overview" || activeTab === "all") {
      data.push({
        chartTitle: "Movimentação ao Longo do Tempo",
        data: mockMovementData.map(item => ({
          data: item.date,
          entradas: item.entradas,
          saidas: item.saidas,
          saldo: item.saldo,
        })),
        metadata: {
          "Tipo de Análise": "Visão Geral",
          "Período": `${format(filters.dateRange.from, 'dd/MM/yyyy', { locale: ptBR })} - ${format(filters.dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}`,
          "Tipo de Movimentação": filters.movementType === 'all' ? 'Todas' : filters.movementType === 'in' ? 'Entradas' : 'Saídas',
        },
      });

      data.push({
        chartTitle: "Distribuição por Motivo",
        data: mockReasonData.map(item => ({
          motivo: item.name,
          quantidade: item.value,
          percentual: `${item.value}%`,
        })),
        metadata: {
          "Tipo de Análise": "Distribuição por Motivo",
          "Total de Registros": mockReasonData.reduce((sum, item) => sum + item.value, 0).toString(),
        },
      });

      data.push({
        chartTitle: "Volume por Horário",
        data: mockHourlyData.map(item => ({
          horario: item.hour,
          movimentacoes: item.movements,
        })),
        metadata: {
          "Tipo de Análise": "Padrão Horário",
          "Horário de Pico": "15:00",
          "Média por Hora": "20.5",
        },
      });

      data.push({
        chartTitle: "Itens Mais Movimentados",
        data: mockTopItems.map((item, index) => ({
          posicao: index + 1,
          item: item.name,
          movimentacoes: item.movements,
          tendencia: item.trend === 'up' ? 'Crescimento' : 'Declínio',
        })),
        metadata: {
          "Tipo de Análise": "Top Itens",
          "Critério de Ordenação": "Número de Movimentações",
        },
      });
    }

    // Add trends data
    if (activeTab === "trends") {
      data.push({
        chartTitle: "Tendência de Crescimento",
        data: mockMovementData.map(item => ({
          data: item.date,
          entradas: item.entradas,
          saidas: item.saidas,
          crescimento: ((item.entradas - item.saidas) / item.saidas * 100).toFixed(1) + '%',
        })),
        metadata: {
          "Tipo de Análise": "Tendências",
          "Método de Cálculo": "Variação percentual",
        },
      });
    }

    return data;
  }, [activeTab, filters, mockMovementData, mockReasonData, mockHourlyData, mockTopItems]);

  // Export configuration
  const exportConfig = useMemo(() => ({
    title: "Relatório de Movimentação de Estoque",
    subtitle: `Análise detalhada - ${activeTab === 'overview' ? 'Visão Geral' : activeTab === 'trends' ? 'Tendências' : activeTab === 'patterns' ? 'Padrões' : 'Itens'}`,
    filename: `movimentacao_estoque_${format(new Date(), 'yyyyMMdd_HHmmss')}`,
    includeTimestamp: true,
    includeFilters: true,
    filters: {
      periodo: `${format(filters.dateRange.from, 'dd/MM/yyyy', { locale: ptBR })} - ${format(filters.dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}`,
      agrupamento: filters.period,
      tipoMovimentacao: filters.movementType === 'all' ? 'Todas' : filters.movementType === 'in' ? 'Entradas' : 'Saídas',
      motivo: filters.reason ? ACTIVITY_REASON_LABELS[filters.reason as keyof typeof ACTIVITY_REASON_LABELS] : 'Todos',
      abaAtiva: activeTab === 'overview' ? 'Visão Geral' : activeTab === 'trends' ? 'Tendências' : activeTab === 'patterns' ? 'Padrões' : 'Itens',
    },
  }), [activeTab, filters]);

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.itemId) count++;
    if (filters.categoryId) count++;
    if (filters.brandId) count++;
    if (filters.movementType !== 'all') count++;
    if (filters.reason) count++;
    if (filters.userId) count++;
    return count;
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full space-y-6">
        {/* Page Header */}
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Movimentação de Estoque"
            icon={IconTrendingUp}
            favoritePage={FAVORITE_PAGES.ESTOQUE_ESTATISTICAS_MOVIMENTACAO}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Estatísticas", href: routes.inventory.statistics.root },
              { label: "Movimentação" }
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
            ]}
          />
        </div>

        {/* Export Section */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Relatórios e Exportação</h2>
            <p className="text-sm text-muted-foreground">
              Exporte os dados de movimentação em diferentes formatos
            </p>
          </div>
          <ExportButton
            data={exportData}
            config={exportConfig}
            variant="default"
            showDataCount={true}
            availableFormats={["csv", "excel", "pdf"]}
            onExportStart={(format) => {
              console.log(`Iniciando exportação em formato ${format}`);
            }}
            onExportComplete={(format) => {
              console.log(`Exportação concluída em formato ${format}`);
            }}
          />
        </div>

        {/* Filters Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <IconFilter className="h-5 w-5" />
                  Filtros
                </CardTitle>
                <CardDescription>
                  Configure os filtros para personalizar a análise de movimentação
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
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="last-week">Última Semana</SelectItem>
                    <SelectItem value="last-month">Último Mês</SelectItem>
                    <SelectItem value="last-3-months">Últimos 3 Meses</SelectItem>
                    <SelectItem value="this-year">Este Ano</SelectItem>
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

              {/* Movement Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Movimentação</label>
                <Select value={filters.movementType} onValueChange={(value) =>
                  setFilters(prev => ({ ...prev, movementType: value as StockMovementFilters['movementType'] }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de movimentação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="in">Entradas</SelectItem>
                    <SelectItem value="out">Saídas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reason Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo</label>
                <Select value={filters.reason || ""} onValueChange={(value) =>
                  setFilters(prev => ({ ...prev, reason: value || undefined }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os motivos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os motivos</SelectItem>
                    {Object.entries(ACTIVITY_REASON_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Tabs */}
        <div className="flex-1 min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="trends">Tendências</TabsTrigger>
              <TabsTrigger value="patterns">Padrões</TabsTrigger>
              <TabsTrigger value="items">Itens</TabsTrigger>
            </TabsList>

            <div className="flex-1 mt-6">
              {/* Overview Tab */}
              <TabsContent value="overview" className="h-full space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle>Movimentação ao Longo do Tempo</CardTitle>
                      <CardDescription>
                        Entradas e saídas de estoque por período
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={mockMovementData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: ptBR })}
                          />
                          <YAxis />
                          <Tooltip
                            labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy', { locale: ptBR })}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="entradas"
                            stroke="#22c55e"
                            strokeWidth={2}
                            name="Entradas"
                          />
                          <Line
                            type="monotone"
                            dataKey="saidas"
                            stroke="#ef4444"
                            strokeWidth={2}
                            name="Saídas"
                          />
                          <Line
                            type="monotone"
                            dataKey="saldo"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            name="Saldo Líquido"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Distribuição por Motivo</CardTitle>
                      <CardDescription>
                        Breakdown das movimentações por motivo
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={mockReasonData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {mockReasonData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Volume por Horário</CardTitle>
                      <CardDescription>
                        Distribuição das movimentações ao longo do dia
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={mockHourlyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" />
                          <YAxis />
                          <Tooltip />
                          <Area
                            type="monotone"
                            dataKey="movements"
                            stroke="#8884d8"
                            fill="#8884d8"
                            fillOpacity={0.6}
                            name="Movimentações"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Itens Mais Movimentados</CardTitle>
                      <CardDescription>
                        Top 5 itens com maior número de movimentações
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {mockTopItems.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-gray-500">{item.movements} movimentações</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {item.trend === 'up' ? (
                                <IconArrowUp className="h-4 w-4 text-green-600" />
                              ) : (
                                <IconArrowDown className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Trends Tab */}
              <TabsContent value="trends" className="h-full space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle>Tendência de Crescimento</CardTitle>
                      <CardDescription>
                        Análise de crescimento das movimentações
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={mockMovementData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: ptBR })}
                          />
                          <YAxis />
                          <Tooltip />
                          <Area
                            type="monotone"
                            dataKey="entradas"
                            stackId="1"
                            stroke="#22c55e"
                            fill="#22c55e"
                            fillOpacity={0.8}
                            name="Entradas"
                          />
                          <Area
                            type="monotone"
                            dataKey="saidas"
                            stackId="1"
                            stroke="#ef4444"
                            fill="#ef4444"
                            fillOpacity={0.8}
                            name="Saídas"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Velocidade de Movimentação</CardTitle>
                      <CardDescription>
                        Comparativo entre períodos
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={mockMovementData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: ptBR })}
                          />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="entradas" fill="#22c55e" name="Entradas" />
                          <Bar dataKey="saidas" fill="#ef4444" name="Saídas" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Patterns Tab */}
              <TabsContent value="patterns" className="h-full space-y-6">
                <div className="grid grid-cols-1 gap-6 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle>Padrões de Movimentação</CardTitle>
                      <CardDescription>
                        Identificação de padrões e anomalias nas movimentações
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-gray-500">
                        <p>Análise de padrões será implementada em versão futura</p>
                        <p className="text-sm">Recursos incluirão detecção de anomalias, sazonalidade e previsões</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Items Tab */}
              <TabsContent value="items" className="h-full space-y-6">
                <div className="grid grid-cols-1 gap-6 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle>Análise Detalhada por Item</CardTitle>
                      <CardDescription>
                        Movimentação individual de cada item do estoque
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-gray-500">
                        <p>Análise detalhada por item será implementada em versão futura</p>
                        <p className="text-sm">Incluirá histórico completo, tendências e previsões por item</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default StockMovementStatisticsPage;