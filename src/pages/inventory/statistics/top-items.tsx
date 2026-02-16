import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconTrophy, IconDownload, IconFilter, IconReload, IconMedal, IconCrown, IconStar, IconTrendingUp, IconTrendingDown, IconArrowUp, IconArrowDown } from "@tabler/icons-react";
import { subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "../../../utils";

// Chart components
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

// Types for filters and data
interface DateRange {
  from: Date;
  to: Date;
}

interface TopItemsFilters {
  dateRange: DateRange;
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  categoryId?: string;
  brandId?: string;
  analysisType: 'consumption' | 'cost' | 'frequency' | 'value';
  limit: number;
}

// Mock data for top items analysis
const mockTopConsumed = [
  { name: 'Parafuso M6 x 20mm', quantity: 1250, cost: 1875.00, category: 'Fixadores', trend: 12.5, rank: 1 },
  { name: 'Tinta Branca 20L', quantity: 145, cost: 14500.00, category: 'Tintas', trend: 8.3, rank: 2 },
  { name: 'Cabo Flex 2.5mm', quantity: 850, cost: 6800.00, category: 'Elétricos', trend: -2.1, rank: 3 },
  { name: 'Porca M8', quantity: 980, cost: 1960.00, category: 'Fixadores', trend: 15.7, rank: 4 },
  { name: 'Solda MIG 1.2mm', quantity: 65, cost: 3250.00, category: 'Soldas', trend: 6.9, rank: 5 },
  { name: 'Lixa 220', quantity: 420, cost: 840.00, category: 'Abrasivos', trend: -4.2, rank: 6 },
  { name: 'Thinner 5L', quantity: 98, cost: 4900.00, category: 'Solventes', trend: 22.1, rank: 7 },
  { name: 'Eletrodo E6013', quantity: 180, cost: 1800.00, category: 'Soldas', trend: 11.3, rank: 8 },
  { name: 'Disco de Corte 9"', quantity: 320, cost: 3200.00, category: 'Abrasivos', trend: 18.7, rank: 9 },
  { name: 'Luva Nitrílica', quantity: 2400, cost: 1200.00, category: 'EPIs', trend: 5.4, rank: 10 },
];

const mockTopCost = [
  { name: 'Tinta Branca 20L', totalCost: 14500.00, quantity: 145, unitCost: 100.00, trend: 8.3, impact: 'Alto' },
  { name: 'Cabo Flex 2.5mm', totalCost: 6800.00, quantity: 850, unitCost: 8.00, trend: -2.1, impact: 'Alto' },
  { name: 'Thinner 5L', totalCost: 4900.00, quantity: 98, unitCost: 50.00, trend: 22.1, impact: 'Médio' },
  { name: 'Solda MIG 1.2mm', totalCost: 3250.00, quantity: 65, unitCost: 50.00, trend: 6.9, impact: 'Médio' },
  { name: 'Disco de Corte 9"', totalCost: 3200.00, quantity: 320, unitCost: 10.00, trend: 18.7, impact: 'Médio' },
];

const mockCategoryBreakdown = [
  { name: 'Fixadores', quantity: 2230, cost: 3835.00, percentage: 28.5, color: '#3b82f6' },
  { name: 'Tintas', quantity: 145, cost: 14500.00, percentage: 18.7, color: '#10b981' },
  { name: 'Elétricos', quantity: 850, cost: 6800.00, percentage: 15.3, color: '#f59e0b' },
  { name: 'Soldas', quantity: 245, cost: 5050.00, percentage: 12.1, color: '#ef4444' },
  { name: 'Abrasivos', quantity: 740, cost: 4040.00, percentage: 11.8, color: '#8b5cf6' },
  { name: 'EPIs', quantity: 2400, cost: 1200.00, percentage: 8.9, color: '#06b6d4' },
  { name: 'Solventes', quantity: 98, cost: 4900.00, percentage: 4.7, color: '#84cc16' },
];

const mockFrequencyData = [
  { name: 'Parafuso M6', frequency: 45, averageQuantity: 28, lastUsed: '2024-09-26' },
  { name: 'Tinta Branca', frequency: 38, averageQuantity: 4, lastUsed: '2024-09-26' },
  { name: 'Cabo Flex', frequency: 42, averageQuantity: 20, lastUsed: '2024-09-25' },
  { name: 'Porca M8', frequency: 35, averageQuantity: 28, lastUsed: '2024-09-25' },
  { name: 'Solda MIG', frequency: 29, averageQuantity: 2, lastUsed: '2024-09-24' },
];

const mockLeastConsumed = [
  { name: 'Parafuso Especial M12', quantity: 2, lastMovement: '2024-08-15', daysIdle: 42 },
  { name: 'Tinta Especial Azul', quantity: 1, lastMovement: '2024-07-22', daysIdle: 66 },
  { name: 'Cabo Blindado 10mm', quantity: 5, lastMovement: '2024-09-01', daysIdle: 25 },
  { name: 'Eletrodo Especial', quantity: 3, lastMovement: '2024-08-08', daysIdle: 49 },
  { name: 'Lixa 400', quantity: 8, lastMovement: '2024-09-10', daysIdle: 16 },
];

const mockTrendData = [
  { month: 'Mai', top1: 1180, top2: 135, top3: 890, top4: 920, top5: 58 },
  { month: 'Jun', top1: 1205, top2: 142, top3: 865, top4: 945, top5: 61 },
  { month: 'Jul', top1: 1220, top2: 148, top3: 820, top4: 985, top5: 63 },
  { month: 'Ago', top1: 1195, top2: 140, top3: 875, top4: 965, top5: 67 },
  { month: 'Set', top1: 1250, top2: 145, top3: 850, top4: 980, top5: 65 },
];

export const TopItemsStatisticsPage = () => {
  // Page tracking
  usePageTracker({
    title: "Top Itens",
    icon: "trophy",
  });

  // State for filters and data refreshing
  const [filters, setFilters] = useState<TopItemsFilters>({
    dateRange: {
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    },
    period: 'month',
    analysisType: 'consumption',
    limit: 10,
  });

  const [activeTab, setActiveTab] = useState("most-consumed");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Quick date range presets
  const datePresets = [
    {
      label: "Este Mês",
      value: "this-month",
      getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
    },
    {
      label: "Último Mês",
      value: "last-month",
      getRange: () => ({ from: startOfMonth(subDays(new Date(), 30)), to: endOfMonth(subDays(new Date(), 30)) }),
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
        period: period as TopItemsFilters['period'],
        dateRange: preset.getRange(),
      }));
    }
  };

  const handleDateRangeChange = (range: any | undefined) => {
    if (range && range.from && range.to) {
      setFilters(prev => ({
        ...prev,
        dateRange: { from: range.from, to: range.to },
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
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.categoryId) count++;
    if (filters.brandId) count++;
    if (filters.analysisType !== 'consumption') count++;
    if (filters.limit !== 10) count++;
    return count;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <IconCrown className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <IconMedal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <IconStar className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-xs flex items-center justify-center font-semibold">{rank}</span>;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'Alto':
        return 'text-red-600 bg-red-100';
      case 'Médio':
        return 'text-yellow-600 bg-yellow-100';
      case 'Baixo':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="h-full flex flex-col px-4 pt-4">
        {/* Page Header */}
        <div className="flex-shrink-0">
          <PageHeader
            title="Top Itens"
            icon={IconTrophy}
            favoritePage={FAVORITE_PAGES.ESTOQUE_TOP_ITENS}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Estatísticas", href: routes.statistics.inventory.root },
              { label: "Top Itens" }
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

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="mt-4 space-y-6">
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
                  Configure os parâmetros para análise dos itens mais relevantes
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
                    <SelectItem value="this-month">Este Mês</SelectItem>
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
                  onDateRangeChange={handleDateRangeChange}
                />
              </div>

              {/* Analysis Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Critério de Análise</label>
                <Select value={filters.analysisType} onValueChange={(value) =>
                  setFilters(prev => ({ ...prev, analysisType: value as TopItemsFilters['analysisType'] }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Critério" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consumption">Quantidade Consumida</SelectItem>
                    <SelectItem value="cost">Custo Total</SelectItem>
                    <SelectItem value="frequency">Frequência de Uso</SelectItem>
                    <SelectItem value="value">Valor Movimentado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Limit */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantidade</label>
                <Select value={filters.limit.toString()} onValueChange={(value) =>
                  setFilters(prev => ({ ...prev, limit: parseInt(value) }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Quantidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Top 5</SelectItem>
                    <SelectItem value="10">Top 10</SelectItem>
                    <SelectItem value="20">Top 20</SelectItem>
                    <SelectItem value="50">Top 50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

            {/* Top Items Analysis Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="most-consumed">Mais Consumidos</TabsTrigger>
                <TabsTrigger value="highest-cost">Maior Custo</TabsTrigger>
                <TabsTrigger value="most-frequent">Mais Frequentes</TabsTrigger>
                <TabsTrigger value="least-consumed">Menos Consumidos</TabsTrigger>
                <TabsTrigger value="trends">Tendências</TabsTrigger>
              </TabsList>

              <div className="mt-6">
              {/* Most Consumed Tab */}
              <TabsContent value="most-consumed" className="h-full space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle>Ranking por Quantidade</CardTitle>
                      <CardDescription>
                        Itens mais consumidos no período selecionado
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {mockTopConsumed.slice(0, filters.limit).map((item) => (
                          <div key={item.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              {getRankIcon(item.rank)}
                              <div className="flex-1">
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-gray-500">{item.category}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{item.quantity.toLocaleString()} un</p>
                              <p className="text-sm text-gray-500">{formatCurrency(item.cost)}</p>
                              <div className="flex items-center gap-1 justify-end">
                                {item.trend > 0 ? (
                                  <IconArrowUp className="h-3 w-3 text-green-600" />
                                ) : (
                                  <IconArrowDown className="h-3 w-3 text-red-600" />
                                )}
                                <span className={`text-xs ${item.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {Math.abs(item.trend)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Distribuição por Categoria</CardTitle>
                      <CardDescription>
                        Breakdown do consumo por categoria de produto
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={mockCategoryBreakdown}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percentage }) => `${name} (${(percentage as number).toFixed(1)}%)`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="percentage"
                          >
                            {mockCategoryBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => [`${value.toFixed(1)}%`, 'Percentual']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Highest Cost Tab */}
              <TabsContent value="highest-cost" className="h-full space-y-6">
                <div className="grid grid-cols-1 gap-6 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle>Itens com Maior Impacto no Custo</CardTitle>
                      <CardDescription>
                        Análise financeira dos itens mais custosos no período
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {mockTopCost.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600">
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-gray-500">
                                  {item.quantity} unidades × {formatCurrency(item.unitCost)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-4">
                              <div>
                                <p className="font-semibold text-lg">{formatCurrency(item.totalCost)}</p>
                                <div className="flex items-center gap-1 justify-end">
                                  {item.trend > 0 ? (
                                    <IconTrendingUp className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <IconTrendingDown className="h-3 w-3 text-red-600" />
                                  )}
                                  <span className={`text-xs ${item.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {Math.abs(item.trend)}%
                                  </span>
                                </div>
                              </div>
                              <Badge className={getImpactColor(item.impact)}>
                                {item.impact}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Análise de Custo por Categoria</CardTitle>
                      <CardDescription>
                        Comparação dos custos totais entre categorias
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={mockCategoryBreakdown} layout="horizontal">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                          <YAxis dataKey="name" type="category" width={100} />
                          <Tooltip formatter={(value: any) => [formatCurrency(value), 'Custo Total']} />
                          <Bar dataKey="cost" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Most Frequent Tab */}
              <TabsContent value="most-frequent" className="h-full space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle>Itens Mais Utilizados</CardTitle>
                      <CardDescription>
                        Frequência de movimentação dos itens
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {mockFrequencyData.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm font-semibold text-green-600">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-gray-500">
                                  Último uso: {format(new Date(item.lastUsed), 'dd/MM/yyyy', { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{item.frequency} vezes</p>
                              <p className="text-sm text-gray-500">Média: {item.averageQuantity} un/uso</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Padrão de Frequência</CardTitle>
                      <CardDescription>
                        Distribuição da frequência de uso
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={mockFrequencyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="frequency" fill="#10b981" name="Frequência (vezes)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Least Consumed Tab */}
              <TabsContent value="least-consumed" className="h-full space-y-6">
                <div className="grid grid-cols-1 gap-6 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle>Itens Menos Consumidos</CardTitle>
                      <CardDescription>
                        Identificação de itens com baixa rotatividade
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {mockLeastConsumed.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between p-4 border border-orange-200 bg-orange-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-sm font-semibold text-orange-600">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium text-orange-900">{item.name}</p>
                                <p className="text-sm text-orange-700">
                                  Último movimento: {format(new Date(item.lastMovement), 'dd/MM/yyyy', { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-orange-900">{item.quantity} unidades</p>
                              <Badge variant="outline" className="text-orange-600 border-orange-300">
                                {item.daysIdle} dias parado
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Itens Inativos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-orange-600">15</p>
                        <p className="text-sm text-gray-500">Mais de 30 dias sem movimento</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Tempo Médio Parado</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-red-600">40 dias</p>
                        <p className="text-sm text-gray-500">Para itens inativos</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Valor Imobilizado</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-gray-600">{formatCurrency(8450)}</p>
                        <p className="text-sm text-gray-500">Em itens parados</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* Trends Tab */}
              <TabsContent value="trends" className="h-full space-y-6">
                <div className="grid grid-cols-1 gap-6 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle>Evolução dos Top 5 Itens</CardTitle>
                      <CardDescription>
                        Tendência de consumo dos itens mais relevantes ao longo dos meses
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={mockTrendData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="top1"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            name="#1 Parafuso M6"
                          />
                          <Line
                            type="monotone"
                            dataKey="top2"
                            stroke="#10b981"
                            strokeWidth={2}
                            name="#2 Tinta Branca"
                          />
                          <Line
                            type="monotone"
                            dataKey="top3"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            name="#3 Cabo Flex"
                          />
                          <Line
                            type="monotone"
                            dataKey="top4"
                            stroke="#ef4444"
                            strokeWidth={2}
                            name="#4 Porca M8"
                          />
                          <Line
                            type="monotone"
                            dataKey="top5"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            name="#5 Solda MIG"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Maior Crescimento</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xl font-bold text-green-600">Thinner 5L</p>
                        <p className="text-sm text-gray-500">+22.1% no período</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Maior Queda</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xl font-bold text-red-600">Lixa 220</p>
                        <p className="text-sm text-gray-500">-4.2% no período</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default TopItemsStatisticsPage;