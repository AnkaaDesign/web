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
import { useCollectionAnalytics } from '@/hooks/financial/use-financial-analytics';
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
  IconCash,
  IconArrowsSort,
  IconChartArea,
  IconStack2,
  IconUsers,
  IconCalendar,
  IconNumbers,
  IconRuler,
  IconX,
  IconReceipt,
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

const INVOICE_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'ACTIVE', label: 'Ativa' },
  { value: 'PARTIALLY_PAID', label: 'Parcialmente Paga' },
  { value: 'PAID', label: 'Paga' },
];

type CollectionYAxisMode = 'value' | 'percentage' | 'count';

const Y_AXIS_OPTIONS: Array<{ value: CollectionYAxisMode; label: string }> = [
  { value: 'value', label: 'Valor (R$)' },
  { value: 'percentage', label: 'Porcentagem (%)' },
  { value: 'count', label: 'Quantidade' },
];

const getAvailableChartTypes = (isSimple: boolean): Array<{
  value: FinancialChartType;
  label: string;
  icon: typeof IconChartBar;
  description: string;
}> => {
  const baseTypes: Array<{
    value: FinancialChartType;
    label: string;
    icon: typeof IconChartBar;
    description: string;
  }> = [
    { value: 'bar', label: 'Barras', icon: IconChartBar, description: 'Grafico de barras vertical' },
    { value: 'line', label: 'Linhas', icon: IconChartLine, description: 'Grafico de linhas' },
    { value: 'area', label: 'Area', icon: IconChartArea, description: 'Grafico de area' },
  ];

  if (isSimple) {
    baseTypes.push({ value: 'pie', label: 'Pizza', icon: IconChartPie, description: 'Grafico de pizza' });
  } else {
    baseTypes.push({ value: 'bar-stacked', label: 'Barras Empilhadas', icon: IconStack2, description: 'Barras empilhadas para comparacao' });
  }

  return baseTypes;
};

// =====================
// Filter Sheet Component
// =====================

interface CollectionFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FinancialAnalyticsFilters;
  onApply: (filters: FinancialAnalyticsFilters) => void;
  yAxisMode: CollectionYAxisMode;
  onYAxisModeChange: (mode: CollectionYAxisMode) => void;
}

function CollectionFilters({
  open,
  onOpenChange,
  filters,
  onApply,
  yAxisMode,
  onYAxisModeChange,
}: CollectionFiltersProps) {
  const [localFilters, setLocalFilters] = useState<FinancialAnalyticsFilters>(filters);
  const [localYAxisMode, setLocalYAxisMode] = useState<CollectionYAxisMode>(yAxisMode);
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
        label: customer.name,
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
      sortBy: 'amount',
      sortOrder: 'desc',
      limit: 50,
    };
    setLocalFilters(defaultFilters);
    setLocalYAxisMode('value');
    setSelectedYear(undefined);
    setSelectedMonths([]);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Cobranças - Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para refinar a análise de cobranças
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
                onValueChange={(value) => setLocalYAxisMode(value as CollectionYAxisMode)}
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

            {/* Invoice Status Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconReceipt className="h-4 w-4" />
                Status da Fatura
              </Label>
              <Combobox
                mode="multiple"
                value={localFilters.status || []}
                onValueChange={(value) => setLocalFilters({
                  ...localFilters,
                  status: Array.isArray(value) && value.length > 0 ? value : undefined,
                })}
                options={INVOICE_STATUS_OPTIONS}
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

const CollectionPage = () => {
  usePageTracker({
    page: 'financial-collection-analytics',
    title: 'Análise de Cobranças',
  });

  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const [filters, setFilters] = useState<FinancialAnalyticsFilters>({
    startDate: startOfDay(subMonths(new Date(), 6)),
    endDate: endOfDay(new Date()),
    sortBy: 'amount',
    sortOrder: 'desc',
    limit: 50,
  });

  const [selectedChartType, setSelectedChartType] = useState<FinancialChartType>('bar');
  const [yAxisMode, setYAxisMode] = useState<CollectionYAxisMode>('value');

  const availableChartTypes = useMemo(() => getAvailableChartTypes(true), []);

  useMemo(() => {
    const isCurrentTypeAvailable = availableChartTypes.some((type) => type.value === selectedChartType);
    if (!isCurrentTypeAvailable) setSelectedChartType('bar');
  }, [availableChartTypes, selectedChartType]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.customerIds && filters.customerIds.length > 0) count++;
    if (filters.status && filters.status.length > 0) count++;
    return count;
  }, [filters]);

  const { data, isLoading, isError, error, refetch } = useCollectionAnalytics(filters);

  const items = data?.data?.items || [];
  const summary = data?.data?.summary;
  const agingAnalysis = data?.data?.agingAnalysis || [];
  const revenueFunnel = data?.data?.revenueFunnel;

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
      const headers = ['Período', 'Faturado (R$)', 'Recebido (R$)', 'Taxa de Recebimento (%)', 'Em Atraso (R$)'];
      const rows = items.map((item) => [
        item.periodLabel,
        item.invoicedAmount.toFixed(2),
        item.paidAmount.toFixed(2),
        item.collectionRate.toFixed(1),
        item.overdueAmount.toFixed(2),
      ]);

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `cobrancas-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();

      toast.success('Dados exportados com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      toast.error('Erro ao exportar dados');
    }
  }, [items]);

  // Map Y-axis mode for StatisticsChart
  const chartYAxisMode: YAxisMode = yAxisMode;

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!items || items.length === 0) return [];
    return items.map((item) => ({
      name: item.periodLabel,
      value:
        yAxisMode === 'percentage'
          ? item.collectionRate
          : yAxisMode === 'count'
            ? item.invoicedAmount > 0 ? 1 : 0
            : item.invoicedAmount,
      secondaryValue: item.paidAmount,
    }));
  }, [items, yAxisMode]);

  // Value formatter
  const valueFormatter = useCallback((value: number, mode: YAxisMode): string => {
    if (mode === 'value') return formatCurrency(value);
    if (mode === 'percentage') return `${value.toFixed(1)}%`;
    return Math.round(value).toString();
  }, []);

  // Aging analysis chart options
  const agingChartOption = useMemo(() => {
    if (!agingAnalysis || agingAnalysis.length === 0) return {};

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const p = params[0];
          const band = agingAnalysis[p.dataIndex];
          return `<strong>${band.bandLabel}</strong><br/>Parcelas: ${band.count}<br/>Valor: ${formatCurrency(band.amount)}`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: agingAnalysis.map((b) => b.bandLabel),
        axisLabel: { rotate: 0, interval: 0 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => formatCurrency(v).replace('R$', '').trim() },
      },
      color: ['#ef4444', '#f97316', '#f59e0b', '#8b5cf6'],
      series: [
        {
          type: 'bar' as const,
          data: agingAnalysis.map((b, i) => ({
            value: b.amount,
            itemStyle: { color: ['#f59e0b', '#f97316', '#ef4444', '#8b5cf6'][i] },
          })),
          label: {
            show: true,
            position: 'top' as const,
            fontSize: 9,
            formatter: (params: any) => (params.value > 0 ? formatCurrency(params.value) : ''),
          },
        },
      ],
    };
  }, [agingAnalysis]);

  // Revenue funnel chart options
  const funnelChartOption = useMemo(() => {
    if (!revenueFunnel) return {};

    const funnelData = [
      { name: 'Faturado', value: revenueFunnel.invoiced },
      { name: 'Boletos Emitidos', value: revenueFunnel.billed },
      { name: 'Recebido', value: revenueFunnel.collected },
      { name: 'Pendente', value: revenueFunnel.outstanding },
    ];

    return {
      tooltip: {
        trigger: 'item' as const,
        formatter: (params: any) =>
          `<strong>${params.name}</strong><br/>${formatCurrency(params.value)}`,
      },
      color: CHART_COLORS,
      series: [
        {
          type: 'funnel' as const,
          left: '10%',
          top: 20,
          bottom: 20,
          width: '80%',
          sort: 'descending' as const,
          gap: 2,
          label: {
            show: true,
            position: 'inside' as const,
            formatter: (params: any) => `${params.name}\n${formatCurrency(params.value)}`,
          },
          data: funnelData,
        },
      ],
    };
  }, [revenueFunnel]);

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
        yAxisLabel={yAxisMode === 'value' ? 'Valor (R$)' : yAxisMode === 'percentage' ? 'Taxa (%)' : 'Quantidade'}
        valueFormatter={valueFormatter}
        tooltipLabels={{
          primary: yAxisMode === 'value' ? 'Faturado' : yAxisMode === 'percentage' ? 'Taxa de Recebimento' : 'Quantidade',
          secondary: 'Recebido',
        }}
      />
    );
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Análise de Cobranças"
          icon={IconReceipt}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Financeiro', href: routes.statistics.financial.root },
            { label: 'Cobranças' },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Análise de Cobranças</CardTitle>
                  <CardDescription>
                    Visualize taxas de recebimento, inadimplência e envelhecimento de parcelas
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
                      <DropdownMenuItem onClick={() => handleSortChange('amount', 'desc')}>
                        <IconCash className="h-4 w-4 mr-2" />
                        Valor (maior primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('amount', 'asc')}>
                        <IconCash className="h-4 w-4 mr-2" />
                        Valor (menor primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('collectionRate', 'desc')}>
                        <IconPercentage className="h-4 w-4 mr-2" />
                        Taxa (maior primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('overdueAmount', 'desc')}>
                        <IconAlertCircle className="h-4 w-4 mr-2" />
                        Inadimplência (maior primeiro)
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
                      <CardTitle className="text-xs font-medium">Taxa de Recebimento</CardTitle>
                      <IconPercentage className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatPercentage(summary.collectionRate)}</div>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Média de Dias</CardTitle>
                      <IconClock className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{summary.avgDaysToPayment.toFixed(1)}</div>
                      <p className="text-xs text-muted-foreground">dias até o pagamento</p>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Total em Atraso</CardTitle>
                      <IconCash className="h-3.5 w-3.5 text-destructive" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold text-destructive">{formatCurrency(summary.totalOverdue)}</div>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Taxa de Inadimplência</CardTitle>
                      <IconAlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatPercentage(summary.overdueRate)}</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Main Chart Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Cobranças por Período</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {renderChart()}
                </CardContent>
              </Card>

              {/* Aging Analysis + Revenue Funnel side by side */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Aging Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle>Envelhecimento de Parcelas em Atraso</CardTitle>
                    <CardDescription>Distribuição por faixa de dias em atraso</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : agingAnalysis.length > 0 ? (
                      <ReactECharts option={agingChartOption} style={{ height: '300px', width: '100%' }} />
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        Nenhuma parcela em atraso
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Revenue Funnel */}
                <Card>
                  <CardHeader>
                    <CardTitle>Funil de Receita</CardTitle>
                    <CardDescription>Do faturamento ao recebimento</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : revenueFunnel ? (
                      <ReactECharts option={funnelChartOption} style={{ height: '300px', width: '100%' }} />
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
                          <TableHead className="text-right">Faturado (R$)</TableHead>
                          <TableHead className="text-right">Recebido (R$)</TableHead>
                          <TableHead className="text-right">Taxa (%)</TableHead>
                          <TableHead className="text-right">Em Atraso (R$)</TableHead>
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
                              <TableCell className="text-right">{formatCurrency(item.invoicedAmount)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.paidAmount)}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={item.collectionRate >= 80 ? 'default' : item.collectionRate >= 50 ? 'secondary' : 'destructive'}>
                                  {formatPercentage(item.collectionRate)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-destructive">
                                {item.overdueAmount > 0 ? formatCurrency(item.overdueAmount) : '-'}
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
          <CollectionFilters
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

export const FinancialCollectionStatisticsPage = () => {
  return <CollectionPage />;
};

export default FinancialCollectionStatisticsPage;
