// web/src/pages/production/statistics/throughput.tsx

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
import { useProductionThroughput, getComparisonType } from '@/hooks/production/use-production-analytics';
import type { ProductionAnalyticsFilters, ProductionChartType } from '@/types/production-analytics';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import { CHART_COLORS, formatNumber, formatPercentage } from '@/types/statistics-common';
import type { YAxisMode } from '@/types/statistics-common';
import { getSectors } from '@/api-client/sector';
import { getCustomers } from '@/api-client/customer';
import { sectorKeys, customerKeys } from '@/hooks/common/query-keys';
import {
  IconChartBar,
  IconChartPie,
  IconChartLine,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconTrendingUp,
  IconTrendingDown,
  IconCheckbox,
  IconClock,
  IconCalendarStats,
  IconTargetArrow,
  IconArrowsSort,
  IconChartArea,
  IconStack2,
  IconBuilding,
  IconUsers,
  IconCalendar,
  IconNumbers,
  IconRuler,
  IconX,
  IconInfoCircle,
} from '@tabler/icons-react';
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

type ThroughputYAxisMode = 'count' | 'days';

const Y_AXIS_OPTIONS: Array<{ value: ThroughputYAxisMode; label: string }> = [
  { value: 'count', label: 'Quantidade (tarefas)' },
  { value: 'days', label: 'Dias (tempo de conclusão)' },
];

// Chart type options with context awareness
const getAvailableChartTypes = (isComparisonMode: boolean): Array<{
  value: ProductionChartType;
  label: string;
  icon: typeof IconChartBar;
  description: string;
}> => {
  const baseTypes: Array<{
    value: ProductionChartType;
    label: string;
    icon: typeof IconChartBar;
    description: string;
  }> = [
    {
      value: 'bar',
      label: 'Barras',
      icon: IconChartBar,
      description: 'Gráfico de barras vertical',
    },
    {
      value: 'line',
      label: 'Linhas',
      icon: IconChartLine,
      description: 'Gráfico de linhas',
    },
    {
      value: 'area',
      label: 'Área',
      icon: IconChartArea,
      description: 'Gráfico de área',
    },
  ];

  if (isComparisonMode) {
    baseTypes.push({
      value: 'bar-stacked',
      label: 'Barras Empilhadas',
      icon: IconStack2,
      description: 'Barras empilhadas para comparação',
    });
  } else {
    baseTypes.push({
      value: 'pie',
      label: 'Pizza',
      icon: IconChartPie,
      description: 'Gráfico de pizza',
    });
  }

  return baseTypes;
};

// =====================
// Filter Sheet Component (inline)
// =====================

interface ThroughputFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ProductionAnalyticsFilters;
  onApply: (filters: ProductionAnalyticsFilters) => void;
  onReset: () => void;
  yAxisMode: ThroughputYAxisMode;
  onYAxisModeChange: (mode: ThroughputYAxisMode) => void;
}

function ThroughputFilters({
  open,
  onOpenChange,
  filters,
  onApply,
  onReset: _onReset,
  yAxisMode,
  onYAxisModeChange,
}: ThroughputFiltersProps) {
  const [localFilters, setLocalFilters] = useState<ProductionAnalyticsFilters>(filters);
  const [localYAxisMode, setLocalYAxisMode] = useState<ThroughputYAxisMode>(yAxisMode);

  // Year and month state for period selector
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // Sync local state when drawer opens or filters change
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
      setLocalYAxisMode(yAxisMode);
      setSelectedYear(undefined);
      setSelectedMonths([]);
    }
  }, [open, filters, yAxisMode]);

  // Handle Y-axis mode change - automatically update sortBy
  const handleYAxisModeChange = useCallback((mode: ThroughputYAxisMode) => {
    setLocalYAxisMode(mode);
    setLocalFilters(prev => ({
      ...prev,
      sortBy: mode === 'days' ? 'avgCompletionDays' : 'completedCount',
    }));
  }, []);

  // Async query functions for comboboxes
  const fetchSectors = useCallback(async (search: string, page: number = 1) => {
    const response = await getSectors({
      searchingFor: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
    });
    return {
      data: (response.data || []).map((sector) => ({
        value: sector.id,
        label: sector.name,
      })),
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

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

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localFilters.sectorIds && localFilters.sectorIds.length > 0) count++;
    if (localFilters.customerIds && localFilters.customerIds.length > 0) count++;
    if (selectedMonths.length > 0) count++;
    return count;
  }, [localFilters, selectedMonths]);

  // Check comparison mode warnings
  const sectorFilterDisabled = useMemo(
    () => (localFilters.customerIds?.length ?? 0) >= 2,
    [localFilters.customerIds]
  );

  const customerFilterDisabled = useMemo(
    () => (localFilters.sectorIds?.length ?? 0) >= 2,
    [localFilters.sectorIds]
  );

  // Calculate period date range when year/months are selected
  const periodDateRange = useMemo(() => {
    if (!selectedYear || selectedMonths.length === 0) return null;

    const monthNumbers = selectedMonths.map(m => parseInt(m));
    const minMonth = Math.min(...monthNumbers);
    const maxMonth = Math.max(...monthNumbers);

    const fromDate = startOfMonth(new Date(selectedYear, minMonth - 1));
    const toDate = endOfMonth(new Date(selectedYear, maxMonth - 1));

    return { from: startOfDay(fromDate), to: endOfDay(toDate) };
  }, [selectedYear, selectedMonths]);

  // Build periods for comparison when multiple months selected
  const buildPeriods = useCallback(() => {
    if (!selectedYear || selectedMonths.length < 2) return undefined;

    return selectedMonths
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(monthStr => {
        const monthNum = parseInt(monthStr);
        const monthStart = startOfMonth(new Date(selectedYear, monthNum - 1));
        const monthEnd = endOfMonth(new Date(selectedYear, monthNum - 1));
        const monthLabel = MONTH_OPTIONS.find(m => m.value === monthStr)?.label || monthStr;

        return {
          id: `${selectedYear}-${monthStr}`,
          label: `${monthLabel} ${selectedYear}`,
          startDate: startOfDay(monthStart),
          endDate: endOfDay(monthEnd),
        };
      });
  }, [selectedYear, selectedMonths]);

  const handleApply = useCallback(() => {
    let finalFilters = { ...localFilters };

    // Handle year/month selection
    if (selectedYear && selectedMonths.length > 0) {
      if (selectedMonths.length === 1) {
        // Single month: use as date range filter
        const monthNum = parseInt(selectedMonths[0]);
        finalFilters.startDate = startOfDay(startOfMonth(new Date(selectedYear, monthNum - 1)));
        finalFilters.endDate = endOfDay(endOfMonth(new Date(selectedYear, monthNum - 1)));
        finalFilters.periods = undefined;
      } else {
        // Multiple months: use for period comparison
        const periods = buildPeriods();
        finalFilters.periods = periods;
        if (periodDateRange) {
          finalFilters.startDate = periodDateRange.from;
          finalFilters.endDate = periodDateRange.to;
        }
      }
    } else {
      finalFilters.periods = undefined;
    }

    onApply(finalFilters);
    onYAxisModeChange(localYAxisMode);
    onOpenChange(false);
  }, [localFilters, selectedYear, selectedMonths, buildPeriods, periodDateRange, onApply, onOpenChange, localYAxisMode, onYAxisModeChange]);

  const handleClear = useCallback(() => {
    const defaultFilters: ProductionAnalyticsFilters = {
      startDate: startOfDay(subMonths(new Date(), 1)),
      endDate: endOfDay(new Date()),
      sortBy: 'completedCount',
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
            Rendimento - Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para refinar a análise de rendimento
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
                  setLocalFilters({
                    ...localFilters,
                    limit: numValue,
                  });
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
                onValueChange={(value) => handleYAxisModeChange(value as ThroughputYAxisMode)}
                options={Y_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
              <p className="text-xs text-muted-foreground">
                Define o valor exibido no eixo Y e a ordenação padrão
              </p>
            </div>

            {/* Period Selection - Year and Month */}
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
                      if (!newYear) {
                        setSelectedMonths([]);
                      }
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
                      if (Array.isArray(months)) {
                        setSelectedMonths(months);
                      } else if (months) {
                        setSelectedMonths([months]);
                      } else {
                        setSelectedMonths([]);
                      }
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
                        setLocalFilters({
                          ...localFilters,
                          startDate: startOfDay(date),
                        });
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
                        setLocalFilters({
                          ...localFilters,
                          endDate: endOfDay(date),
                        });
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

            {/* Sectors Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconBuilding className="h-4 w-4" />
                Setores
              </Label>
              {sectorFilterDisabled && (
                <div className="rounded-md border px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <IconInfoCircle className="h-4 w-4" />
                    Selecione 2+ setores para comparação. Desativa filtro de clientes.
                  </div>
                </div>
              )}
              <Combobox
                mode="multiple"
                async
                value={localFilters.sectorIds || []}
                onValueChange={(value) => setLocalFilters({
                  ...localFilters,
                  sectorIds: Array.isArray(value) && value.length > 0 ? value : undefined,
                })}
                queryKey={[...sectorKeys.lists()]}
                queryFn={fetchSectors}
                minSearchLength={0}
                placeholder="Selecione setores..."
                searchPlaceholder="Buscar setor..."
                emptyText="Nenhum setor encontrado"
                loadingText="Carregando setores..."
                disabled={sectorFilterDisabled}
                searchable={true}
                clearable={true}
              />
            </div>

            {/* Customers Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconUsers className="h-4 w-4" />
                Clientes
              </Label>
              {customerFilterDisabled && (
                <div className="rounded-md border px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <IconInfoCircle className="h-4 w-4" />
                    Selecione 2+ clientes para comparação. Desativa filtro de setores.
                  </div>
                </div>
              )}
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
                disabled={customerFilterDisabled}
                searchable={true}
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

const ThroughputPage = () => {
  usePageTracker({
    page: 'production-throughput-analytics',
    title: 'Rendimento de Produção',
  });

  // Filter drawer state
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<ProductionAnalyticsFilters>({
    startDate: startOfDay(subMonths(new Date(), 1)),
    endDate: endOfDay(new Date()),
    sortBy: 'completedCount',
    sortOrder: 'desc',
    limit: 50,
  });

  // Chart type state
  const [selectedChartType, setSelectedChartType] = useState<ProductionChartType>('bar');

  // Y-axis mode state (count or days)
  const [yAxisMode, setYAxisMode] = useState<ThroughputYAxisMode>('count');

  // Determine comparison mode
  const comparisonType = useMemo(() => getComparisonType(filters), [filters]);
  const isComparisonMode = comparisonType !== 'simple';

  // Get available chart types based on mode
  const availableChartTypes = useMemo(
    () => getAvailableChartTypes(isComparisonMode),
    [isComparisonMode]
  );

  // Auto-switch chart type if current type becomes unavailable
  useMemo(() => {
    const isCurrentTypeAvailable = availableChartTypes.some(
      (type) => type.value === selectedChartType
    );
    if (!isCurrentTypeAvailable) {
      setSelectedChartType('bar');
    }
  }, [availableChartTypes, selectedChartType]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.sectorIds && filters.sectorIds.length > 0) count++;
    if (filters.customerIds && filters.customerIds.length > 0) count++;
    if (filters.periods && filters.periods.length >= 2) count++;
    return count;
  }, [filters]);

  // Fetch data
  const { data, isLoading, isError, error, refetch } = useProductionThroughput(filters);

  const items = data?.data?.items || [];
  const summary = data?.data?.summary;

  // Handle filter apply
  const handleFilterApply = useCallback((newFilters: ProductionAnalyticsFilters) => {
    const updatedFilters = {
      ...newFilters,
      limit: newFilters.limit || 50,
    };
    setFilters(updatedFilters);
  }, []);

  // Handle filter reset
  const handleFilterReset = useCallback(() => {
    const defaultFilters: ProductionAnalyticsFilters = {
      startDate: startOfDay(subMonths(new Date(), 1)),
      endDate: endOfDay(new Date()),
      sortBy: 'completedCount',
      sortOrder: 'desc',
      limit: 50,
    };
    setFilters(defaultFilters);
  }, []);

  // Handle sort change
  const handleSortChange = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder,
    }));
  }, []);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    if (!items || items.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    try {
      const headers = isComparisonMode
        ? ['Período', 'Concluídas Total', 'Planejadas Total', 'Média Dias', 'Precisão Previsão', 'Entidades']
        : ['Período', 'Concluídas', 'Planejadas', 'Média Dias', 'Precisão Previsão (%)'];

      const rows = items.map((item) => {
        if (isComparisonMode && item.comparisons) {
          const entities = item.comparisons
            .map((c) => `${c.entityName}: ${c.completedCount}`)
            .join('; ');
          return [
            item.periodLabel,
            item.completedCount.toString(),
            item.plannedCount.toString(),
            item.avgCompletionDays.toFixed(1),
            item.forecastAccuracy.toFixed(1),
            entities,
          ];
        } else {
          return [
            item.periodLabel,
            item.completedCount.toString(),
            item.plannedCount.toString(),
            item.avgCompletionDays.toFixed(1),
            item.forecastAccuracy.toFixed(1),
          ];
        }
      });

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `rendimento-producao-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();

      toast.success('Dados exportados com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      toast.error('Erro ao exportar dados');
    }
  }, [items, isComparisonMode]);

  // Map Y-axis mode for StatisticsChart
  const chartYAxisMode: YAxisMode = yAxisMode === 'days' ? 'days' : 'count';

  // Prepare chart data for StatisticsChart component
  const chartData = useMemo(() => {
    if (!items || items.length === 0) return [];

    return items.map((item) => ({
      name: item.periodLabel,
      value: yAxisMode === 'days' ? item.avgCompletionDays : item.completedCount,
      secondaryValue: yAxisMode === 'days' ? item.completedCount : item.avgCompletionDays,
      comparisons: item.comparisons?.map((c) => ({
        entityName: c.entityName,
        value: yAxisMode === 'days' ? c.avgCompletionDays : c.completedCount,
        secondaryValue: yAxisMode === 'days' ? c.completedCount : c.avgCompletionDays,
      })),
    }));
  }, [items, yAxisMode]);

  // Value formatter for chart tooltips
  const valueFormatter = useCallback((value: number, mode: YAxisMode): string => {
    if (mode === 'days') return `${value.toFixed(1)} dias`;
    return Math.round(value).toString();
  }, []);

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
        isComparisonMode={isComparisonMode}
        height="600px"
        yAxisLabel={yAxisMode === 'days' ? 'Dias' : 'Tarefas Concluídas'}
        valueFormatter={valueFormatter}
        tooltipLabels={{
          primary: yAxisMode === 'days' ? 'Média de Dias' : 'Concluídas',
          secondary: yAxisMode === 'days' ? 'Concluídas' : 'Média de Dias',
        }}
      />
    );
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Rendimento de Produção"
          icon={IconChartBar}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Produção', href: routes.statistics.production.root },
            { label: 'Rendimento' },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Análise de Rendimento</CardTitle>
                  <CardDescription>
                    Visualize e compare o rendimento de produção por período, setor e cliente
                    {isComparisonMode && (
                      <Badge variant="secondary" className="ml-2">
                        Modo Comparação: {comparisonType === 'sectors' ? 'Setores' : comparisonType === 'customers' ? 'Clientes' : 'Períodos'}
                      </Badge>
                    )}
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
                        onValueChange={(value) => setSelectedChartType(value as ProductionChartType)}
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
                      <DropdownMenuItem onClick={() => handleSortChange('completedCount', 'desc')}>
                        <IconTrendingDown className="h-4 w-4 mr-2" />
                        Concluídas (maior primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('completedCount', 'asc')}>
                        <IconTrendingUp className="h-4 w-4 mr-2" />
                        Concluídas (menor primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('avgCompletionDays', 'asc')}>
                        <IconClock className="h-4 w-4 mr-2" />
                        Tempo (mais rápido primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('avgCompletionDays', 'desc')}>
                        <IconClock className="h-4 w-4 mr-2" />
                        Tempo (mais lento primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('forecastAccuracy', 'desc')}>
                        <IconTargetArrow className="h-4 w-4 mr-2" />
                        Precisão (maior primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('forecastAccuracy', 'asc')}>
                        <IconTargetArrow className="h-4 w-4 mr-2" />
                        Precisão (menor primeiro)
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
                      <CardTitle className="text-xs font-medium">Total Concluídas</CardTitle>
                      <IconCheckbox className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatNumber(summary.totalCompleted)}</div>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Média de Dias</CardTitle>
                      <IconClock className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{summary.avgCompletionDays.toFixed(1)}</div>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Entrega no Prazo</CardTitle>
                      <IconTargetArrow className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatPercentage(summary.onTimeDeliveryRate)}</div>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Tarefas/Semana</CardTitle>
                      <IconCalendarStats className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatNumber(summary.tasksPerWeek, 1)}</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Chart Section */}
              <Card>
                <CardContent className="p-4">
                  {renderChart()}
                </CardContent>
              </Card>

              {/* Data Table */}
              <Card className="flex-1 flex flex-col">
                <CardHeader>
                  <CardTitle>Detalhamento dos Dados</CardTitle>
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
                          {isComparisonMode ? (
                            <>
                              <TableHead className="text-right">Concluídas Total</TableHead>
                              <TableHead className="text-right">Planejadas Total</TableHead>
                              <TableHead className="text-right">Média Dias</TableHead>
                              <TableHead>Comparações</TableHead>
                            </>
                          ) : (
                            <>
                              <TableHead className="text-right">Concluídas</TableHead>
                              <TableHead className="text-right">Planejadas</TableHead>
                              <TableHead className="text-right">Média Dias</TableHead>
                              <TableHead className="text-right">Precisão (%)</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={isComparisonMode ? 5 : 5} className="text-center">
                              Carregando...
                            </TableCell>
                          </TableRow>
                        ) : items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isComparisonMode ? 5 : 5} className="text-center">
                              Nenhum dado disponível
                            </TableCell>
                          </TableRow>
                        ) : (
                          items.map((item, index) => (
                            <TableRow key={item.period || index}>
                              <TableCell className="font-medium">{item.periodLabel}</TableCell>
                              {isComparisonMode && item.comparisons ? (
                                <>
                                  <TableCell className="text-right">{formatNumber(item.completedCount)}</TableCell>
                                  <TableCell className="text-right">{formatNumber(item.plannedCount)}</TableCell>
                                  <TableCell className="text-right">{item.avgCompletionDays.toFixed(1)}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {item.comparisons.map((comp, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs">
                                          {comp.entityName}: {comp.completedCount}
                                        </Badge>
                                      ))}
                                    </div>
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="text-right">{formatNumber(item.completedCount)}</TableCell>
                                  <TableCell className="text-right">{formatNumber(item.plannedCount)}</TableCell>
                                  <TableCell className="text-right">{item.avgCompletionDays.toFixed(1)}</TableCell>
                                  <TableCell className="text-right">{formatPercentage(item.forecastAccuracy)}</TableCell>
                                </>
                              )}
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
          <ThroughputFilters
            open={showFilterDrawer}
            onOpenChange={setShowFilterDrawer}
            filters={filters}
            onApply={handleFilterApply}
            onReset={handleFilterReset}
            yAxisMode={yAxisMode}
            onYAxisModeChange={setYAxisMode}
          />
        </div>
      </div>
    </div>
  );
};

export const ProductionThroughputStatisticsPage = () => {
  return <ThroughputPage />;
};

export default ProductionThroughputStatisticsPage;
