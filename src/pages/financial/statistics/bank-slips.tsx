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
import { useBankSlipPerformance } from '@/hooks/financial/use-financial-analytics';
import type { FinancialAnalyticsFilters, FinancialChartType } from '@/types/financial-analytics';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import { CHART_COLORS, formatCurrency, formatNumber, formatPercentage } from '@/types/statistics-common';
import type { YAxisMode } from '@/types/statistics-common';
import { getCustomers } from '@/api-client/customer';
import { customerKeys } from '@/hooks/common/query-keys';
import {
  IconChartBar,
  IconChartPie,
  IconChartLine,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconPercentage,
  IconClock,
  IconCalendarStats,
  IconArrowsSort,
  IconChartArea,
  IconUsers,
  IconCalendar,
  IconNumbers,
  IconRuler,
  IconX,
  IconFileText,
  IconAlertTriangle,
  IconActivity,
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

const COMBOBOX_PAGE_SIZE = 20;

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

const BANK_SLIP_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'PAID', label: 'Pago' },
  { value: 'OVERDUE', label: 'Vencido' },
  { value: 'CANCELLED', label: 'Cancelado' },
  { value: 'ERROR', label: 'Erro' },
  { value: 'REJECTED', label: 'Rejeitado' },
];

type BankSlipYAxisMode = 'count' | 'percentage' | 'value';

const Y_AXIS_OPTIONS: Array<{ value: BankSlipYAxisMode; label: string }> = [
  { value: 'count', label: 'Quantidade' },
  { value: 'percentage', label: 'Porcentagem (%)' },
  { value: 'value', label: 'Valor (R$)' },
];

const getAvailableChartTypes = (): Array<{
  value: FinancialChartType;
  label: string;
  icon: typeof IconChartBar;
  description: string;
}> => [
  { value: 'bar', label: 'Barras', icon: IconChartBar, description: 'Grafico de barras vertical' },
  { value: 'line', label: 'Linhas', icon: IconChartLine, description: 'Grafico de linhas' },
  { value: 'area', label: 'Area', icon: IconChartArea, description: 'Grafico de area' },
  { value: 'pie', label: 'Pizza', icon: IconChartPie, description: 'Grafico de pizza' },
];

// =====================
// Filter Sheet Component
// =====================

interface BankSlipFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FinancialAnalyticsFilters;
  onApply: (filters: FinancialAnalyticsFilters) => void;
  yAxisMode: BankSlipYAxisMode;
  onYAxisModeChange: (mode: BankSlipYAxisMode) => void;
}

function BankSlipFilters({
  open,
  onOpenChange,
  filters,
  onApply,
  yAxisMode,
  onYAxisModeChange,
}: BankSlipFiltersProps) {
  const [localFilters, setLocalFilters] = useState<FinancialAnalyticsFilters>(filters);
  const [localYAxisMode, setLocalYAxisMode] = useState<BankSlipYAxisMode>(yAxisMode);
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

  const fetchCustomers = useCallback(async (search: string, page: number = 1) => {
    const response = await getCustomers({
      search: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
    });
    return {
      data: (response.data || []).map((customer) => ({
        value: customer.id,
        label: customer.fantasyName,
      })),
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localFilters.customerIds && localFilters.customerIds.length > 0) count++;
    if (localFilters.status && localFilters.status.length > 0) count++;
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
    const defaultFilters: FinancialAnalyticsFilters = {
      startDate: startOfDay(subMonths(new Date(), 6)),
      endDate: endOfDay(new Date()),
      sortBy: 'totalSlips',
      sortOrder: 'desc',
      limit: 50,
    };
    setLocalFilters(defaultFilters);
    setLocalYAxisMode('count');
    setSelectedYear(undefined);
    setSelectedMonths([]);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Boletos - Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para refinar a análise de boletos
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
                onValueChange={(value) => setLocalYAxisMode(value as BankSlipYAxisMode)}
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

            {/* Customers Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconUsers className="h-4 w-4" />
                Clientes
              </Label>
              <Combobox
                mode="multiple"
                async
                value={localFilters.customerIds || []}
                onValueChange={(value) => setLocalFilters({
                  ...localFilters,
                  customerIds: Array.isArray(value) && value.length > 0 ? value : undefined,
                })}
                queryKey={[...customerKeys.lists()]}
                queryFn={fetchCustomers}
                minSearchLength={0}
                placeholder="Selecione clientes..."
                searchPlaceholder="Buscar cliente..."
                emptyText="Nenhum cliente encontrado"
                loadingText="Carregando clientes..."
                searchable={true}
                clearable={true}
              />
            </div>

            {/* Bank Slip Status Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconFileText className="h-4 w-4" />
                Status do Boleto
              </Label>
              <Combobox
                mode="multiple"
                value={localFilters.status || []}
                onValueChange={(value) => setLocalFilters({
                  ...localFilters,
                  status: Array.isArray(value) && value.length > 0 ? value : undefined,
                })}
                options={BANK_SLIP_STATUS_OPTIONS}
                placeholder="Todos os status..."
                searchable={false}
                clearable={true}
              />
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

const BankSlipsPage = () => {
  usePageTracker({
    page: 'financial-bank-slips-analytics',
    title: 'Desempenho de Boletos',
  });

  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const [filters, setFilters] = useState<FinancialAnalyticsFilters>({
    startDate: startOfDay(subMonths(new Date(), 6)),
    endDate: endOfDay(new Date()),
    sortBy: 'totalSlips',
    sortOrder: 'desc',
    limit: 50,
  });

  const [selectedChartType, setSelectedChartType] = useState<FinancialChartType>('line');
  const [yAxisMode, setYAxisMode] = useState<BankSlipYAxisMode>('count');

  const availableChartTypes = useMemo(() => getAvailableChartTypes(), []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.customerIds && filters.customerIds.length > 0) count++;
    if (filters.status && filters.status.length > 0) count++;
    return count;
  }, [filters]);

  const { data, isLoading, isError, error, refetch } = useBankSlipPerformance(filters);

  const items = data?.data?.items || [];
  const summary = data?.data?.summary;
  const statusDistribution = data?.data?.statusDistribution || [];
  const typeDistribution = data?.data?.typeDistribution || [];

  const handleFilterApply = useCallback((newFilters: FinancialAnalyticsFilters) => {
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
      const headers = ['Período', 'Total de Boletos', 'Boletos Pagos', 'Taxa de Conversão (%)', 'Atraso Médio (dias)'];
      const rows = items.map((item) => [
        item.periodLabel,
        item.totalSlips.toString(),
        item.paidSlips.toString(),
        item.conversionRate.toFixed(1),
        item.avgDelay.toFixed(1),
      ]);

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `boletos-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();

      toast.success('Dados exportados com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      toast.error('Erro ao exportar dados');
    }
  }, [items]);

  // Map Y-axis mode for StatisticsChart
  const chartYAxisMode: YAxisMode = yAxisMode;

  // Prepare chart data for conversion rate trend
  const chartData = useMemo(() => {
    if (!items || items.length === 0) return [];
    return items.map((item) => ({
      name: item.periodLabel,
      value:
        yAxisMode === 'percentage'
          ? item.conversionRate
          : yAxisMode === 'count'
            ? item.totalSlips
            : item.totalSlips, // fallback
      secondaryValue: item.paidSlips,
    }));
  }, [items, yAxisMode]);

  // Value formatter
  const valueFormatter = useCallback((value: number, mode: YAxisMode): string => {
    if (mode === 'percentage') return `${value.toFixed(1)}%`;
    if (mode === 'value') return formatCurrency(value);
    return Math.round(value).toString();
  }, []);

  // Status distribution pie chart
  const statusPieOption = useMemo(() => {
    if (!statusDistribution || statusDistribution.length === 0) return {};

    return {
      tooltip: {
        trigger: 'item' as const,
        formatter: (params: any) =>
          `<strong>${params.name}</strong><br/>Quantidade: ${params.value}<br/>${params.percent}%`,
      },
      legend: { bottom: 0, left: 'center' },
      color: CHART_COLORS,
      series: [
        {
          type: 'pie' as const,
          radius: '60%',
          data: statusDistribution.map((item) => ({
            name: item.statusLabel,
            value: item.count,
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
          label: {
            formatter: (params: any) => `${params.name}: ${params.value}`,
          },
        },
      ],
    };
  }, [statusDistribution]);

  // Type distribution chart (PIX vs Boleto)
  const typeChartOption = useMemo(() => {
    if (!typeDistribution || typeDistribution.length === 0) return {};

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
      },
      legend: { bottom: 0, left: 'center' },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: typeDistribution.map((t) => t.typeLabel),
      },
      yAxis: { type: 'value' as const },
      color: [CHART_COLORS[0], CHART_COLORS[1]],
      series: [
        {
          name: 'Total',
          type: 'bar' as const,
          data: typeDistribution.map((t) => t.count),
          label: {
            show: true,
            position: 'top' as const,
            fontSize: 10,
          },
        },
        {
          name: 'Pagos',
          type: 'bar' as const,
          data: typeDistribution.map((t) => t.paidCount),
          label: {
            show: true,
            position: 'top' as const,
            fontSize: 10,
          },
        },
      ],
    };
  }, [typeDistribution]);

  // Render main chart
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
        yAxisLabel={yAxisMode === 'count' ? 'Boletos' : yAxisMode === 'percentage' ? 'Taxa (%)' : 'Valor (R$)'}
        valueFormatter={valueFormatter}
        tooltipLabels={{
          primary: yAxisMode === 'count' ? 'Total de Boletos' : yAxisMode === 'percentage' ? 'Taxa de Conversão' : 'Valor',
          secondary: 'Pagos',
        }}
      />
    );
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Desempenho de Boletos"
          icon={IconFileText}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Financeiro', href: routes.statistics.financial.root },
            { label: 'Boletos' },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Desempenho de Boletos</CardTitle>
                  <CardDescription>
                    Visualize taxas de conversão, atrasos e distribuição de status dos boletos
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
                        onValueChange={(value) => setSelectedChartType(value as FinancialChartType)}
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
                      <DropdownMenuItem onClick={() => handleSortChange('totalSlips', 'desc')}>
                        <IconFileText className="h-4 w-4 mr-2" />
                        Quantidade (maior primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('conversionRate', 'desc')}>
                        <IconPercentage className="h-4 w-4 mr-2" />
                        Taxa de Conversão (maior primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('avgDelay', 'desc')}>
                        <IconClock className="h-4 w-4 mr-2" />
                        Atraso Médio (maior primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('avgDelay', 'asc')}>
                        <IconClock className="h-4 w-4 mr-2" />
                        Atraso Médio (menor primeiro)
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
                      <CardTitle className="text-xs font-medium">Taxa de Conversão</CardTitle>
                      <IconPercentage className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatPercentage(summary.conversionRate)}</div>
                      <p className="text-xs text-muted-foreground">boletos pagos / total</p>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Atraso Médio</CardTitle>
                      <IconClock className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{summary.avgDelayDays.toFixed(1)}</div>
                      <p className="text-xs text-muted-foreground">dias após vencimento</p>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Taxa de Erro</CardTitle>
                      <IconAlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold text-destructive">{formatPercentage(summary.errorRate)}</div>
                      <p className="text-xs text-muted-foreground">erros + rejeitados</p>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Boletos Ativos</CardTitle>
                      <IconActivity className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatNumber(summary.activeSlips)}</div>
                      <p className="text-xs text-muted-foreground">ativos + vencidos</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Main Chart Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Tendência por Período</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {renderChart()}
                </CardContent>
              </Card>

              {/* Status Distribution + Type Distribution side by side */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Status Distribution Pie */}
                <Card>
                  <CardHeader>
                    <CardTitle>Distribuição por Status</CardTitle>
                    <CardDescription>Quantidade de boletos por status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : statusDistribution.length > 0 ? (
                      <ReactECharts option={statusPieOption} style={{ height: '300px', width: '100%' }} />
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        Nenhum dado disponível
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Type Distribution (PIX vs Boleto) */}
                <Card>
                  <CardHeader>
                    <CardTitle>PIX vs Boleto</CardTitle>
                    <CardDescription>Comparação entre tipos de cobrança</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : typeDistribution.length > 0 ? (
                      <ReactECharts option={typeChartOption} style={{ height: '300px', width: '100%' }} />
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        Nenhum dado disponível
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

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
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Pagos</TableHead>
                          <TableHead className="text-right">Taxa (%)</TableHead>
                          <TableHead className="text-right">Atraso Médio (dias)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center">
                              Carregando...
                            </TableCell>
                          </TableRow>
                        ) : items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center">
                              Nenhum dado disponível
                            </TableCell>
                          </TableRow>
                        ) : (
                          items.map((item, index) => (
                            <TableRow key={item.period || index}>
                              <TableCell className="font-medium">{item.periodLabel}</TableCell>
                              <TableCell className="text-right">{formatNumber(item.totalSlips)}</TableCell>
                              <TableCell className="text-right">{formatNumber(item.paidSlips)}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={item.conversionRate >= 80 ? 'default' : item.conversionRate >= 50 ? 'secondary' : 'destructive'}>
                                  {formatPercentage(item.conversionRate)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {item.avgDelay > 0 ? `${item.avgDelay.toFixed(1)}` : '-'}
                              </TableCell>
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
          <BankSlipFilters
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

export const FinancialBankSlipsStatisticsPage = () => {
  return <BankSlipsPage />;
};

export default FinancialBankSlipsStatisticsPage;
