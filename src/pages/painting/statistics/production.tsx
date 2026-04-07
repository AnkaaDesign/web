import { useState, useMemo, useCallback, useEffect } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DateTimeInput } from '@/components/ui/date-time-input';
import { Combobox } from '@/components/ui/combobox';
import { routes } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { usePaintAnalytics } from '@/hooks/painting/use-paint-analytics';
import type { PaintAnalyticsFilters, PaintChartType } from '@/types/paint-analytics';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import { CHART_COLORS, formatCurrency, formatNumber } from '@/types/statistics-common';
import type { YAxisMode } from '@/types/statistics-common';
import {
  IconChartBar,
  IconChartPie,
  IconChartLine,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconDroplet,
  IconFlask,
  IconCash,
  IconPalette,
  IconArrowsSort,
  IconChartArea,
  IconCalendar,
  IconNumbers,
  IconRuler,
  IconX,
  IconCalendarStats,
} from '@tabler/icons-react';
import ReactECharts from 'echarts-for-react';
import { format, startOfDay, endOfDay, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';

// =====================
// Constants
// =====================

const MONTH_OPTIONS = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = 0; i <= 3; i++) {
    const year = currentYear - i;
    years.push({ value: year.toString(), label: year.toString() });
  }
  return years;
};

const YEAR_OPTIONS = generateYearOptions();

type PaintYAxisMode = 'quantity' | 'value';

const Y_AXIS_OPTIONS: Array<{ value: PaintYAxisMode; label: string }> = [
  { value: 'quantity', label: 'Quantidade (produções)' },
  { value: 'value', label: 'Valor (R$/litro)' },
];

const getAvailableChartTypes = (): Array<{
  value: PaintChartType;
  label: string;
  icon: typeof IconChartBar;
  description: string;
}> => [
  { value: 'bar', label: 'Barras', icon: IconChartBar, description: 'Gráfico de barras vertical' },
  { value: 'line', label: 'Linhas', icon: IconChartLine, description: 'Gráfico de linhas' },
  { value: 'area', label: 'Área', icon: IconChartArea, description: 'Gráfico de área' },
  { value: 'pie', label: 'Pizza', icon: IconChartPie, description: 'Gráfico de pizza' },
];

// =====================
// Filter Sheet Component
// =====================

interface PaintFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PaintAnalyticsFilters;
  onApply: (filters: PaintAnalyticsFilters) => void;
  yAxisMode: PaintYAxisMode;
  onYAxisModeChange: (mode: PaintYAxisMode) => void;
}

function PaintFilters({
  open,
  onOpenChange,
  filters,
  onApply,
  yAxisMode,
  onYAxisModeChange,
}: PaintFiltersProps) {
  const [localFilters, setLocalFilters] = useState<PaintAnalyticsFilters>(filters);
  const [localYAxisMode, setLocalYAxisMode] = useState<PaintYAxisMode>(yAxisMode);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
      setLocalYAxisMode(yAxisMode);
      setSelectedYear(undefined);
      setSelectedMonths([]);
    }
  }, [open, filters, yAxisMode]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localFilters.paintTypeIds && localFilters.paintTypeIds.length > 0) count++;
    if (localFilters.paintBrandIds && localFilters.paintBrandIds.length > 0) count++;
    if (selectedMonths.length > 0) count++;
    return count;
  }, [localFilters, selectedMonths]);

  const handleApply = useCallback(() => {
    let finalFilters = { ...localFilters };

    if (selectedYear && selectedMonths.length > 0) {
      if (selectedMonths.length === 1) {
        const monthNum = parseInt(selectedMonths[0]);
        finalFilters.startDate = startOfDay(startOfMonth(new Date(selectedYear, monthNum - 1)));
        finalFilters.endDate = endOfDay(endOfMonth(new Date(selectedYear, monthNum - 1)));
      } else {
        const monthNumbers = selectedMonths.map((m) => parseInt(m));
        const minMonth = Math.min(...monthNumbers);
        const maxMonth = Math.max(...monthNumbers);
        finalFilters.startDate = startOfDay(startOfMonth(new Date(selectedYear, minMonth - 1)));
        finalFilters.endDate = endOfDay(endOfMonth(new Date(selectedYear, maxMonth - 1)));
      }
    }

    onApply(finalFilters);
    onYAxisModeChange(localYAxisMode);
    onOpenChange(false);
  }, [localFilters, selectedYear, selectedMonths, onApply, onOpenChange, localYAxisMode, onYAxisModeChange]);

  const handleClear = useCallback(() => {
    const defaultFilters: PaintAnalyticsFilters = {
      startDate: startOfDay(subMonths(new Date(), 6)),
      endDate: endOfDay(new Date()),
      sortBy: 'volume',
      sortOrder: 'desc',
      limit: 50,
    };
    setLocalFilters(defaultFilters);
    setLocalYAxisMode('quantity');
    setSelectedYear(undefined);
    setSelectedMonths([]);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Produção de Tintas - Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para refinar a análise de produção de tintas
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Limit */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconNumbers className="h-4 w-4" />
                Número de Resultados
              </Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={localFilters.limit || 50}
                onChange={(value: string | number | null) => {
                  const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseInt(value) || 50 : 50);
                  setLocalFilters({ ...localFilters, limit: numValue });
                }}
                placeholder="50"
                className="bg-transparent"
              />
            </div>

            {/* Y-Axis Mode */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconRuler className="h-4 w-4" />
                Eixo Y (Gráfico)
              </Label>
              <Combobox
                value={localYAxisMode}
                onValueChange={(value) => setLocalYAxisMode(value as PaintYAxisMode)}
                options={Y_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
            </div>

            {/* Period Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconCalendar className="h-4 w-4" />
                Período
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <Combobox
                    value={selectedYear?.toString() || ''}
                    onValueChange={(year) => {
                      const yearStr = Array.isArray(year) ? year[0] : year;
                      const newYear = yearStr ? parseInt(yearStr) : undefined;
                      setSelectedYear(newYear);
                      if (!newYear) setSelectedMonths([]);
                    }}
                    options={YEAR_OPTIONS}
                    placeholder="Ano..."
                    searchable={false}
                    clearable={true}
                  />
                </div>
                <div className="col-span-2">
                  <Combobox
                    mode="multiple"
                    value={selectedMonths}
                    onValueChange={(months) => {
                      if (Array.isArray(months)) setSelectedMonths(months);
                      else if (months) setSelectedMonths([months]);
                      else setSelectedMonths([]);
                    }}
                    options={MONTH_OPTIONS}
                    placeholder={selectedYear ? 'Selecione os meses...' : 'Selecione um ano primeiro'}
                    searchPlaceholder="Buscar meses..."
                    emptyText="Nenhum mês encontrado"
                    disabled={!selectedYear}
                    searchable={true}
                    clearable={true}
                  />
                </div>
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconCalendar className="h-4 w-4" />
                Data Personalizada
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                  <DateTimeInput
                    mode="date"
                    value={localFilters.startDate}
                    onChange={(date) => {
                      if (date && date instanceof Date) {
                        setLocalFilters({ ...localFilters, startDate: startOfDay(date) });
                        setSelectedYear(undefined);
                        setSelectedMonths([]);
                      }
                    }}
                    hideLabel
                    placeholder="Selecionar data inicial..."
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                  <DateTimeInput
                    mode="date"
                    value={localFilters.endDate}
                    onChange={(date) => {
                      if (date && date instanceof Date) {
                        setLocalFilters({ ...localFilters, endDate: endOfDay(date) });
                        setSelectedYear(undefined);
                        setSelectedMonths([]);
                      }
                    }}
                    hideLabel
                    placeholder="Selecionar data final..."
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            <IconX className="h-4 w-4 mr-2" />
            Limpar Tudo
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Aplicar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =====================
// Main Page Component
// =====================

const PaintProductionPage = () => {
  usePageTracker({
    page: 'paint-production-analytics',
    title: 'Produção de Tintas',
  });

  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const [filters, setFilters] = useState<PaintAnalyticsFilters>({
    startDate: startOfDay(subMonths(new Date(), 6)),
    endDate: endOfDay(new Date()),
    sortBy: 'volume',
    sortOrder: 'desc',
    limit: 50,
  });

  const [selectedChartType, setSelectedChartType] = useState<PaintChartType>('bar');
  const [yAxisMode, setYAxisMode] = useState<PaintYAxisMode>('quantity');

  const availableChartTypes = useMemo(() => getAvailableChartTypes(), []);

  useMemo(() => {
    const isCurrentTypeAvailable = availableChartTypes.some((type) => type.value === selectedChartType);
    if (!isCurrentTypeAvailable) setSelectedChartType('bar');
  }, [availableChartTypes, selectedChartType]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.paintTypeIds && filters.paintTypeIds.length > 0) count++;
    if (filters.paintBrandIds && filters.paintBrandIds.length > 0) count++;
    return count;
  }, [filters]);

  const { data, isLoading, isError, error, refetch } = usePaintAnalytics(filters);

  const items = data?.data?.items || [];
  const summary = data?.data?.summary;
  const popularPaints = data?.data?.popularPaints || [];

  const handleFilterApply = useCallback((newFilters: PaintAnalyticsFilters) => {
    setFilters({ ...newFilters, limit: newFilters.limit || 50 });
  }, []);

  const handleSortChange = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters((prev) => ({ ...prev, sortBy, sortOrder }));
  }, []);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    if (!items || items.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    try {
      const headers = ['Período', 'Produções', 'Volume (L)', 'Custo Médio (R$/L)'];
      const rows = items.map((item) => [
        item.periodLabel,
        item.productionCount.toString(),
        item.totalVolumeLiters.toFixed(2),
        item.avgCostPerLiter.toFixed(2),
      ]);

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `producao-tintas-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();

      toast.success('Dados exportados com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      toast.error('Erro ao exportar dados');
    }
  }, [items]);

  const chartYAxisMode: YAxisMode = yAxisMode === 'value' ? 'value' : 'quantity';

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!items || items.length === 0) return [];
    return items.map((item) => ({
      name: item.periodLabel,
      value: yAxisMode === 'value' ? item.avgCostPerLiter : item.productionCount,
      secondaryValue: item.totalVolumeLiters,
    }));
  }, [items, yAxisMode]);

  // Value formatter
  const valueFormatter = useCallback((value: number, mode: YAxisMode): string => {
    if (mode === 'value') return formatCurrency(value);
    return formatNumber(value);
  }, []);

  // Popular paints chart
  const popularPaintsChartOption = useMemo(() => {
    if (!popularPaints || popularPaints.length === 0) return {};

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const p = params[0];
          const paint = popularPaints[p.dataIndex];
          return `<strong>${paint.paintName}</strong><br/>Produções: ${paint.productionCount}<br/>Volume: ${paint.totalVolumeLiters.toFixed(2)} L`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: popularPaints.map((p) => p.paintName),
        axisLabel: { rotate: 45, interval: 0, fontSize: 10 },
      },
      yAxis: {
        type: 'value' as const,
        name: 'Produções',
      },
      color: CHART_COLORS,
      series: [
        {
          type: 'bar' as const,
          data: popularPaints.map((p, i) => ({
            value: p.productionCount,
            itemStyle: { color: p.hex ? `#${p.hex.replace('#', '')}` : CHART_COLORS[i % CHART_COLORS.length] },
          })),
          label: {
            show: true,
            position: 'top' as const,
            fontSize: 9,
            formatter: (params: any) => (params.value > 0 ? params.value : ''),
          },
        },
      ],
    };
  }, [popularPaints]);

  // Render chart
  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="h-[600px] flex items-center justify-center">
          <div className="space-y-3">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-[400px] w-[600px]" />
          </div>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="h-[600px] flex flex-col items-center justify-center gap-4">
          <IconAlertCircle className="h-12 w-12 text-destructive" />
          <div className="text-center">
            <p className="font-semibold">Erro ao carregar dados</p>
            <p className="text-sm text-muted-foreground">
              {error?.message || 'Ocorreu um erro ao buscar os dados'}
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <IconRefresh className="mr-2 h-4 w-4" />
            Tentar Novamente
          </Button>
        </div>
      );
    }

    if (!chartData || chartData.length === 0) {
      return (
        <div className="h-[600px] flex flex-col items-center justify-center gap-4">
          <IconCalendarStats className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-semibold">Nenhum dado encontrado</p>
            <p className="text-sm text-muted-foreground">
              Tente ajustar os filtros para visualizar os dados
            </p>
          </div>
        </div>
      );
    }

    return (
      <StatisticsChart
        data={chartData}
        chartType={selectedChartType}
        yAxisMode={chartYAxisMode}
        isComparisonMode={false}
        height="600px"
        yAxisLabel={yAxisMode === 'value' ? 'Custo (R$/L)' : 'Produções'}
        valueFormatter={valueFormatter}
        tooltipLabels={{
          primary: yAxisMode === 'value' ? 'Custo Médio' : 'Produções',
          secondary: 'Volume (L)',
        }}
      />
    );
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Produção de Tintas"
          icon={IconPalette}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Pintura', href: routes.statistics.painting.root },
            { label: 'Produção' },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Produção de Tintas</CardTitle>
                  <CardDescription>
                    Visualize volumes, custos e cores mais utilizadas na produção de tintas
                  </CardDescription>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Chart Type Selector */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        {(() => {
                          const currentChartType = availableChartTypes.find((t) => t.value === selectedChartType);
                          const Icon = currentChartType?.icon;
                          return (
                            <>
                              {Icon && <Icon className="h-4 w-4 mr-2" />}
                              {currentChartType?.label}
                            </>
                          );
                        })()}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Tipo de Gráfico</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={selectedChartType}
                        onValueChange={(value) => setSelectedChartType(value as PaintChartType)}
                      >
                        {availableChartTypes.map((chartType) => {
                          const ChartIcon = chartType.icon;
                          return (
                            <DropdownMenuRadioItem key={chartType.value} value={chartType.value} className="group">
                              <ChartIcon className="h-4 w-4 mr-2" />
                              <div className="flex flex-col">
                                <span>{chartType.label}</span>
                                <span className="text-xs text-muted-foreground group-data-[highlighted]:text-white/90">{chartType.description}</span>
                              </div>
                            </DropdownMenuRadioItem>
                          );
                        })}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Sort Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <IconArrowsSort className="h-4 w-4 mr-2" />
                        Ordenar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleSortChange('volume', 'desc')}>
                        <IconDroplet className="h-4 w-4 mr-2" />
                        Volume (maior primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('count', 'desc')}>
                        <IconFlask className="h-4 w-4 mr-2" />
                        Produções (maior primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('cost', 'desc')}>
                        <IconCash className="h-4 w-4 mr-2" />
                        Custo (maior primeiro)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Filter Button */}
                  <Button
                    variant={activeFilterCount > 0 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowFilterDrawer(true)}
                  >
                    <IconFilter className="h-4 w-4 mr-2" />
                    Filtros
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>

                  {/* Export Button */}
                  <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={isLoading || !items.length}>
                    <IconDownload className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-4 space-y-6">
              {/* Summary Cards */}
              {summary && (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Total Produções</CardTitle>
                      <IconFlask className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatNumber(summary.totalProductions)}</div>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Volume Total (L)</CardTitle>
                      <IconDroplet className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatNumber(summary.totalVolumeLiters, 2)}</div>
                      <p className="text-xs text-muted-foreground">litros produzidos</p>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Custo Médio</CardTitle>
                      <IconCash className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatCurrency(summary.avgCostPerLiter)}</div>
                      <p className="text-xs text-muted-foreground">por litro</p>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Cor Mais Usada</CardTitle>
                      <IconPalette className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold truncate">{summary.mostUsedPaint}</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Main Chart - Volume Over Time */}
              <Card>
                <CardHeader>
                  <CardTitle>Volume ao Longo do Tempo</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {renderChart()}
                </CardContent>
              </Card>

              {/* Popular Paints Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Tintas Mais Utilizadas (Top 15)</CardTitle>
                  <CardDescription>Ranking das tintas com maior número de produções</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[400px] w-full" />
                  ) : popularPaints.length > 0 ? (
                    <ReactECharts option={popularPaintsChartOption} style={{ height: '400px', width: '100%' }} />
                  ) : (
                    <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                      Nenhuma tinta encontrada
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Data Table */}
              <Card className="flex-1 flex flex-col">
                <CardHeader>
                  <CardTitle>Detalhamento por Período</CardTitle>
                  <CardDescription>
                    {items.length > 0
                      ? `Exibindo ${items.length} ${items.length === 1 ? 'período' : 'períodos'}`
                      : 'Nenhum período para exibir'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Período</TableHead>
                          <TableHead className="text-right">Produções</TableHead>
                          <TableHead className="text-right">Volume (L)</TableHead>
                          <TableHead className="text-right">Custo Médio (R$/L)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center">
                              Carregando...
                            </TableCell>
                          </TableRow>
                        ) : items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center">
                              Nenhum dado disponível
                            </TableCell>
                          </TableRow>
                        ) : (
                          items.map((item, index) => (
                            <TableRow key={item.period || index}>
                              <TableCell className="font-medium">{item.periodLabel}</TableCell>
                              <TableCell className="text-right">{formatNumber(item.productionCount)}</TableCell>
                              <TableCell className="text-right">{formatNumber(item.totalVolumeLiters, 2)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.avgCostPerLiter)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          {/* Filter Drawer */}
          <PaintFilters
            open={showFilterDrawer}
            onOpenChange={setShowFilterDrawer}
            filters={filters}
            onApply={handleFilterApply}
            yAxisMode={yAxisMode}
            onYAxisModeChange={setYAxisMode}
          />
        </div>
      </div>
    </div>
  );
};

export const PaintingProductionStatisticsPage = () => {
  return <PaintProductionPage />;
};

export default PaintingProductionStatisticsPage;
