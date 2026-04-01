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
import { useAdministrationAnalytics } from '@/hooks/administration/use-administration-analytics';
import type { AdministrationAnalyticsFilters, AdministrationChartType } from '@/types/administration-analytics';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import { CHART_COLORS, formatNumber } from '@/types/statistics-common';
import type { YAxisMode } from '@/types/statistics-common';
import {
  IconChartBar,
  IconChartPie,
  IconChartLine,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconUsers,
  IconUserPlus,
  IconUserCheck,
  IconChecklist,
  IconArrowsSort,
  IconChartArea,
  IconStack2,
  IconCalendar,
  IconNumbers,
  IconRuler,
  IconX,
  IconCalendarStats,
  IconBuilding,
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

type AdminYAxisMode = 'count' | 'cumulative';

const Y_AXIS_OPTIONS: Array<{ value: AdminYAxisMode; label: string }> = [
  { value: 'count', label: 'Quantidade (novos)' },
  { value: 'cumulative', label: 'Acumulado (total)' },
];

const getAvailableChartTypes = (): Array<{
  value: AdministrationChartType;
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

interface AdminFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AdministrationAnalyticsFilters;
  onApply: (filters: AdministrationAnalyticsFilters) => void;
  yAxisMode: AdminYAxisMode;
  onYAxisModeChange: (mode: AdminYAxisMode) => void;
}

function AdminFilters({
  open,
  onOpenChange,
  filters,
  onApply,
  yAxisMode,
  onYAxisModeChange,
}: AdminFiltersProps) {
  const [localFilters, setLocalFilters] = useState<AdministrationAnalyticsFilters>(filters);
  const [localYAxisMode, setLocalYAxisMode] = useState<AdminYAxisMode>(yAxisMode);
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
    if (selectedMonths.length > 0) count++;
    return count;
  }, [selectedMonths]);

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
    const defaultFilters: AdministrationAnalyticsFilters = {
      startDate: startOfDay(subMonths(new Date(), 6)),
      endDate: endOfDay(new Date()),
      sortBy: 'count',
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
            Administração - Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para refinar a análise administrativa
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
                onValueChange={(value) => setLocalYAxisMode(value as AdminYAxisMode)}
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

const AdministrationOverviewPage = () => {
  usePageTracker({
    page: 'administration-overview-analytics',
    title: 'Visão Geral - Administração',
  });

  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const [filters, setFilters] = useState<AdministrationAnalyticsFilters>({
    startDate: startOfDay(subMonths(new Date(), 6)),
    endDate: endOfDay(new Date()),
    sortBy: 'count',
    sortOrder: 'desc',
    limit: 50,
  });

  const [selectedChartType, setSelectedChartType] = useState<AdministrationChartType>('bar');
  const [yAxisMode, setYAxisMode] = useState<AdminYAxisMode>('count');

  const availableChartTypes = useMemo(() => getAvailableChartTypes(), []);

  useMemo(() => {
    const isCurrentTypeAvailable = availableChartTypes.some((type) => type.value === selectedChartType);
    if (!isCurrentTypeAvailable) setSelectedChartType('bar');
  }, [availableChartTypes, selectedChartType]);

  const activeFilterCount = useMemo(() => {
    return 0;
  }, []);

  const { data, isLoading, isError, error, refetch } = useAdministrationAnalytics(filters);

  const customerAcquisition = data?.data?.customerAcquisition || [];
  const taskTrends = data?.data?.taskTrends || [];
  const summary = data?.data?.summary;

  const handleFilterApply = useCallback((newFilters: AdministrationAnalyticsFilters) => {
    setFilters({ ...newFilters, limit: newFilters.limit || 50 });
  }, []);

  const handleSortChange = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters((prev) => ({ ...prev, sortBy, sortOrder }));
  }, []);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    if ((!customerAcquisition || customerAcquisition.length === 0) && (!taskTrends || taskTrends.length === 0)) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    try {
      const headers = ['Período', 'Novos Clientes', 'Total Clientes', 'Tarefas Criadas', 'Tarefas Concluídas'];
      const allPeriods = new Set([
        ...customerAcquisition.map((c) => c.period),
        ...taskTrends.map((t) => t.period),
      ]);
      const sortedPeriods = Array.from(allPeriods).sort();

      const rows = sortedPeriods.map((period) => {
        const cust = customerAcquisition.find((c) => c.period === period);
        const task = taskTrends.find((t) => t.period === period);
        return [
          cust?.periodLabel || task?.periodLabel || period,
          (cust?.newCustomers || 0).toString(),
          (cust?.totalCustomers || 0).toString(),
          (task?.tasksCreated || 0).toString(),
          (task?.tasksCompleted || 0).toString(),
        ];
      });

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `administracao-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();

      toast.success('Dados exportados com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      toast.error('Erro ao exportar dados');
    }
  }, [customerAcquisition, taskTrends]);

  const chartYAxisMode: YAxisMode = yAxisMode === 'cumulative' ? 'count' : 'quantity';

  // Prepare customer acquisition chart data
  const customerChartData = useMemo(() => {
    if (!customerAcquisition || customerAcquisition.length === 0) return [];
    return customerAcquisition.map((item) => ({
      name: item.periodLabel,
      value: yAxisMode === 'cumulative' ? item.totalCustomers : item.newCustomers,
    }));
  }, [customerAcquisition, yAxisMode]);

  // Value formatter
  const valueFormatter = useCallback((value: number): string => {
    return formatNumber(value);
  }, []);

  // Task trends chart
  const taskTrendsChartOption = useMemo(() => {
    if (!taskTrends || taskTrends.length === 0) return {};

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
      },
      legend: {
        data: ['Tarefas Criadas', 'Tarefas Concluídas'],
        bottom: 0,
      },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: taskTrends.map((t) => t.periodLabel),
        axisLabel: { rotate: 30, interval: 0, fontSize: 10 },
      },
      yAxis: {
        type: 'value' as const,
        name: 'Tarefas',
      },
      color: [CHART_COLORS[0], CHART_COLORS[1]],
      series: [
        {
          name: 'Tarefas Criadas',
          type: 'bar' as const,
          data: taskTrends.map((t) => t.tasksCreated),
        },
        {
          name: 'Tarefas Concluídas',
          type: 'bar' as const,
          data: taskTrends.map((t) => t.tasksCompleted),
        },
      ],
    };
  }, [taskTrends]);

  // Render customer chart
  const renderCustomerChart = () => {
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

    if (!customerChartData || customerChartData.length === 0) {
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
        data={customerChartData}
        chartType={selectedChartType}
        yAxisMode={chartYAxisMode}
        isComparisonMode={false}
        height="600px"
        yAxisLabel={yAxisMode === 'cumulative' ? 'Total de Clientes' : 'Novos Clientes'}
        valueFormatter={valueFormatter}
        tooltipLabels={{
          primary: yAxisMode === 'cumulative' ? 'Total Clientes' : 'Novos Clientes',
        }}
      />
    );
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Visão Geral - Administração"
          icon={IconBuilding}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Administração', href: routes.statistics.administration.root },
            { label: 'Visão Geral' },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Visão Geral - Administração</CardTitle>
                  <CardDescription>
                    Acompanhe a aquisição de clientes, crescimento e tendências de tarefas
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
                        onValueChange={(value) => setSelectedChartType(value as AdministrationChartType)}
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
                      <DropdownMenuItem onClick={() => handleSortChange('count', 'desc')}>
                        <IconUsers className="h-4 w-4 mr-2" />
                        Clientes (maior primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('count', 'asc')}>
                        <IconUsers className="h-4 w-4 mr-2" />
                        Clientes (menor primeiro)
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
                  <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={isLoading || (!customerAcquisition.length && !taskTrends.length)}>
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
                      <CardTitle className="text-xs font-medium">Total Clientes</CardTitle>
                      <IconUsers className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatNumber(summary.totalCustomers)}</div>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Novos este Mês</CardTitle>
                      <IconUserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatNumber(summary.newCustomersThisMonth)}</div>
                      <p className="text-xs text-muted-foreground">clientes cadastrados</p>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Usuários Ativos</CardTitle>
                      <IconUserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatNumber(summary.activeUsers)}</div>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Tarefas no Mês</CardTitle>
                      <IconChecklist className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatNumber(summary.tasksThisMonth)}</div>
                      <p className="text-xs text-muted-foreground">tarefas criadas</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Customer Acquisition Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Aquisição de Clientes</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {renderCustomerChart()}
                </CardContent>
              </Card>

              {/* Task Trends Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Tendência de Tarefas</CardTitle>
                  <CardDescription>Tarefas criadas vs concluídas por período</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[400px] w-full" />
                  ) : taskTrends.length > 0 ? (
                    <ReactECharts option={taskTrendsChartOption} style={{ height: '400px', width: '100%' }} />
                  ) : (
                    <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                      Nenhuma tarefa encontrada
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Data Table */}
              <Card className="flex-1 flex flex-col">
                <CardHeader>
                  <CardTitle>Detalhamento por Período</CardTitle>
                  <CardDescription>
                    {customerAcquisition.length > 0
                      ? `Exibindo ${customerAcquisition.length} ${customerAcquisition.length === 1 ? 'período' : 'períodos'}`
                      : 'Nenhum período para exibir'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Período</TableHead>
                          <TableHead className="text-right">Novos Clientes</TableHead>
                          <TableHead className="text-right">Total Clientes</TableHead>
                          <TableHead className="text-right">Tarefas Criadas</TableHead>
                          <TableHead className="text-right">Tarefas Concluídas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center">
                              Carregando...
                            </TableCell>
                          </TableRow>
                        ) : customerAcquisition.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center">
                              Nenhum dado disponível
                            </TableCell>
                          </TableRow>
                        ) : (
                          customerAcquisition.map((item, index) => {
                            const task = taskTrends.find((t) => t.period === item.period);
                            return (
                              <TableRow key={item.period || index}>
                                <TableCell className="font-medium">{item.periodLabel}</TableCell>
                                <TableCell className="text-right">{formatNumber(item.newCustomers)}</TableCell>
                                <TableCell className="text-right">{formatNumber(item.totalCustomers)}</TableCell>
                                <TableCell className="text-right">{formatNumber(task?.tasksCreated || 0)}</TableCell>
                                <TableCell className="text-right">{formatNumber(task?.tasksCompleted || 0)}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          {/* Filter Drawer */}
          <AdminFilters
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

export const AdministrationOverviewStatisticsPage = () => {
  return <AdministrationOverviewPage />;
};

export default AdministrationOverviewStatisticsPage;
