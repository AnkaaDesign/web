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
import { Combobox } from '@/components/ui/combobox';
import { routes } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useTeamPerformance, getHrComparisonType } from '@/hooks/human-resources/use-hr-analytics';
import type { HrAnalyticsFilters, HrChartType } from '@/types/hr-analytics';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import { CHART_COLORS, formatNumber, formatPercentage } from '@/types/statistics-common';
import type { YAxisMode } from '@/types/statistics-common';
import { getSectors } from '@/api-client/sector';
import { sectorKeys } from '@/hooks/common/query-keys';
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
  IconUsers,
  IconStar,
  IconAlertTriangle,
  IconBeach,
  IconChartArea,
  IconStack2,
  IconBuilding,
  IconCalendar,
  IconNumbers,
  IconRuler,
  IconX,
  IconInfoCircle,
  IconCalendarStats,
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

const WARNING_CATEGORY_LABELS: Record<string, string> = {
  SAFETY: 'Segurança',
  MISCONDUCT: 'Má Conduta',
  INSUBORDINATION: 'Insubordinação',
  POLICY_VIOLATION: 'Violação de Política',
  ATTENDANCE: 'Frequência',
  PERFORMANCE: 'Desempenho',
  BEHAVIOR: 'Comportamento',
  OTHER: 'Outros',
};

type TeamYAxisMode = 'headcount' | 'warnings' | 'turnover';

const Y_AXIS_OPTIONS: Array<{ value: TeamYAxisMode; label: string }> = [
  { value: 'headcount', label: 'Efetivo (pessoas)' },
  { value: 'warnings', label: 'Advertências' },
  { value: 'turnover', label: 'Turnover (%)' },
];

const getAvailableChartTypes = (isComparisonMode: boolean): Array<{
  value: HrChartType;
  label: string;
  icon: typeof IconChartBar;
  description: string;
}> => {
  const baseTypes: Array<{
    value: HrChartType;
    label: string;
    icon: typeof IconChartBar;
    description: string;
  }> = [
    { value: 'bar', label: 'Barras', icon: IconChartBar, description: 'Gráfico de barras vertical' },
    { value: 'line', label: 'Linhas', icon: IconChartLine, description: 'Gráfico de linhas' },
    { value: 'area', label: 'Área', icon: IconChartArea, description: 'Gráfico de área' },
  ];

  if (isComparisonMode) {
    baseTypes.push({ value: 'bar-stacked', label: 'Barras Empilhadas', icon: IconStack2, description: 'Barras empilhadas para comparação' });
  } else {
    baseTypes.push({ value: 'pie', label: 'Pizza', icon: IconChartPie, description: 'Gráfico de pizza' });
  }

  return baseTypes;
};

// =====================
// Filter Sheet Component
// =====================

interface TeamFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: HrAnalyticsFilters;
  onApply: (filters: HrAnalyticsFilters) => void;
  onReset: () => void;
  yAxisMode: TeamYAxisMode;
  onYAxisModeChange: (mode: TeamYAxisMode) => void;
}

function TeamFilters({
  open,
  onOpenChange,
  filters,
  onApply,
  onReset: _onReset,
  yAxisMode,
  onYAxisModeChange,
}: TeamFiltersProps) {
  const [localFilters, setLocalFilters] = useState<HrAnalyticsFilters>(filters);
  const [localYAxisMode, setLocalYAxisMode] = useState<TeamYAxisMode>(yAxisMode);
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localFilters.sectorIds && localFilters.sectorIds.length > 0) count++;
    if (selectedMonths.length > 0) count++;
    return count;
  }, [localFilters, selectedMonths]);

  const buildPeriods = useCallback(() => {
    if (!selectedYear || selectedMonths.length < 2) return undefined;
    return selectedMonths
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((monthStr) => {
        const monthNum = parseInt(monthStr);
        const monthStart = startOfMonth(new Date(selectedYear, monthNum - 1));
        const monthEnd = endOfMonth(new Date(selectedYear, monthNum - 1));
        const label = MONTH_OPTIONS.find((m) => m.value === monthStr)?.label || monthStr;
        return {
          id: `${selectedYear}-${monthStr}`,
          label: `${label} ${selectedYear}`,
          startDate: startOfDay(monthStart),
          endDate: endOfDay(monthEnd),
        };
      });
  }, [selectedYear, selectedMonths]);

  const handleApply = useCallback(() => {
    let finalFilters = { ...localFilters };

    if (selectedYear && selectedMonths.length > 0) {
      if (selectedMonths.length === 1) {
        const monthNum = parseInt(selectedMonths[0]);
        finalFilters.startDate = startOfDay(startOfMonth(new Date(selectedYear, monthNum - 1)));
        finalFilters.endDate = endOfDay(endOfMonth(new Date(selectedYear, monthNum - 1)));
        finalFilters.periods = undefined;
      } else {
        const periods = buildPeriods();
        finalFilters.periods = periods;
        const monthNums = selectedMonths.map((m) => parseInt(m));
        finalFilters.startDate = startOfDay(startOfMonth(new Date(selectedYear, Math.min(...monthNums) - 1)));
        finalFilters.endDate = endOfDay(endOfMonth(new Date(selectedYear, Math.max(...monthNums) - 1)));
      }
    } else {
      finalFilters.periods = undefined;
    }

    onApply(finalFilters);
    onYAxisModeChange(localYAxisMode);
    onOpenChange(false);
  }, [localFilters, selectedYear, selectedMonths, buildPeriods, onApply, onOpenChange, localYAxisMode, onYAxisModeChange]);

  const handleClear = useCallback(() => {
    const defaultFilters: HrAnalyticsFilters = {
      startDate: startOfDay(subMonths(new Date(), 6)),
      endDate: endOfDay(new Date()),
      sortBy: 'headcount',
      sortOrder: 'desc',
      limit: 50,
    };
    setLocalFilters(defaultFilters);
    setLocalYAxisMode('headcount');
    setSelectedYear(undefined);
    setSelectedMonths([]);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Equipe - Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para refinar a análise da equipe
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
                onValueChange={(value) => setLocalYAxisMode(value as TeamYAxisMode)}
                options={Y_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
              <p className="text-xs text-muted-foreground">
                Define o valor exibido no eixo Y do gráfico
              </p>
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

            {/* Sectors Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconBuilding className="h-4 w-4" />
                Setores
              </Label>
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
                searchable={true}
                clearable={true}
              />
              <p className="text-xs text-muted-foreground">
                Selecione 2+ setores para modo de comparação
              </p>
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

const TeamPerformancePage = () => {
  usePageTracker({
    page: 'hr-team-performance-analytics',
    title: 'Performance da Equipe - Estatísticas',
  });

  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const [filters, setFilters] = useState<HrAnalyticsFilters>({
    startDate: startOfDay(subMonths(new Date(), 6)),
    endDate: endOfDay(new Date()),
    sortBy: 'headcount',
    sortOrder: 'desc',
    limit: 50,
  });

  const [selectedChartType, setSelectedChartType] = useState<HrChartType>('area');
  const [yAxisMode, setYAxisMode] = useState<TeamYAxisMode>('headcount');

  const comparisonType = useMemo(() => getHrComparisonType(filters), [filters]);
  const isComparisonMode = comparisonType !== 'simple';

  const availableChartTypes = useMemo(() => getAvailableChartTypes(isComparisonMode), [isComparisonMode]);

  useMemo(() => {
    const isCurrentTypeAvailable = availableChartTypes.some((type) => type.value === selectedChartType);
    if (!isCurrentTypeAvailable) setSelectedChartType('area');
  }, [availableChartTypes, selectedChartType]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.sectorIds && filters.sectorIds.length > 0) count++;
    if (filters.periods && filters.periods.length >= 2) count++;
    return count;
  }, [filters]);

  const { data, isLoading, isError, error, refetch } = useTeamPerformance(filters);

  const items = data?.data?.items || [];
  const summary = data?.data?.summary;

  const handleFilterApply = useCallback((newFilters: HrAnalyticsFilters) => {
    setFilters({ ...newFilters, limit: newFilters.limit || 50 });
  }, []);

  const handleFilterReset = useCallback(() => {
    setFilters({
      startDate: startOfDay(subMonths(new Date(), 6)),
      endDate: endOfDay(new Date()),
      sortBy: 'headcount',
      sortOrder: 'desc',
      limit: 50,
    });
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!items || items.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    try {
      const headers = ['Período', 'Efetivo', 'Admissões', 'Demissões', 'Turnover %', 'Advertências', 'Férias'];
      const rows = items.map((item) => [
        item.label,
        item.headcount.toString(),
        item.newHires.toString(),
        item.dismissals.toString(),
        item.turnoverRate.toFixed(1),
        item.totalWarnings.toString(),
        item.vacationCount.toString(),
      ]);

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `equipe-performance-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('Dados exportados com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      toast.error('Erro ao exportar dados');
    }
  }, [items]);

  const chartYAxisMode: YAxisMode = yAxisMode === 'turnover' ? 'percentage' : 'count';

  const chartData = useMemo(() => {
    if (!items || items.length === 0) return [];

    return items.map((item) => {
      let value: number;
      let secondaryValue: number;

      switch (yAxisMode) {
        case 'warnings':
          value = item.totalWarnings;
          secondaryValue = item.headcount;
          break;
        case 'turnover':
          value = item.turnoverRate;
          secondaryValue = item.dismissals;
          break;
        default:
          value = item.headcount;
          secondaryValue = item.newHires;
          break;
      }

      return {
        name: item.label,
        value,
        secondaryValue,
      };
    });
  }, [items, yAxisMode]);

  const valueFormatter = useCallback((value: number, mode: YAxisMode): string => {
    if (mode === 'percentage') return formatPercentage(value);
    return Math.round(value).toString();
  }, []);

  const yAxisLabel = useMemo(() => {
    switch (yAxisMode) {
      case 'warnings': return 'Advertências';
      case 'turnover': return 'Turnover (%)';
      default: return 'Efetivo';
    }
  }, [yAxisMode]);

  const tooltipLabels = useMemo(() => {
    switch (yAxisMode) {
      case 'warnings': return { primary: 'Advertências', secondary: 'Efetivo' };
      case 'turnover': return { primary: 'Turnover', secondary: 'Demissões' };
      default: return { primary: 'Efetivo', secondary: 'Admissões' };
    }
  }, [yAxisMode]);

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
        yAxisLabel={yAxisLabel}
        valueFormatter={valueFormatter}
        tooltipLabels={tooltipLabels}
      />
    );
  };

  // Compute warning breakdown from all items
  const warningBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const item of items) {
      for (const [cat, count] of Object.entries(item.warningsByCategory)) {
        totals[cat] = (totals[cat] || 0) + count;
      }
    }
    return Object.entries(totals)
      .map(([category, count]) => ({
        category,
        label: WARNING_CATEGORY_LABELS[category] || category,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Performance da Equipe"
          icon={IconUsers}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Recursos Humanos', href: routes.statistics.humanResources.root },
            { label: 'Equipe' },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Efetivo</CardTitle>
              <IconUsers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-[80px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {summary ? formatNumber(summary.currentHeadcount) : '0'}
                  </div>
                  {summary && summary.turnoverRate > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Turnover: {formatPercentage(summary.turnoverRate)}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Performance Média</CardTitle>
              <IconStar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-[60px]" />
              ) : (
                <div className="text-2xl font-bold">
                  {summary ? summary.avgPerformanceLevel.toFixed(1) : '0'}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Advertências</CardTitle>
              <IconAlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-[60px]" />
              ) : (
                <div className="text-2xl font-bold">
                  {summary ? formatNumber(summary.totalWarnings) : '0'}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Férias</CardTitle>
              <IconBeach className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-[60px]" />
              ) : (
                <div className="text-2xl font-bold">
                  {summary ? formatNumber(summary.onVacationCount) : '0'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <div className="mt-4">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Evolução da Equipe</CardTitle>
                  <CardDescription>
                    Visualize a evolução do efetivo, advertências e turnover por período
                    {isComparisonMode && (
                      <Badge variant="secondary" className="ml-2">
                        Modo Comparação: {comparisonType === 'sectors' ? 'Setores' : 'Períodos'}
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
                          const currentType = availableChartTypes.find((t) => t.value === selectedChartType);
                          const Icon = currentType?.icon;
                          return (
                            <>
                              {Icon && <Icon className="h-4 w-4 mr-2" />}
                              {currentType?.label}
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
                        onValueChange={(value) => setSelectedChartType(value as HrChartType)}
                      >
                        {availableChartTypes.map((chartType) => {
                          const ChartIcon = chartType.icon;
                          return (
                            <DropdownMenuRadioItem key={chartType.value} value={chartType.value} className="group">
                              <ChartIcon className="h-4 w-4 mr-2" />
                              <div>
                                <div className="font-medium">{chartType.label}</div>
                                <div className="text-xs text-muted-foreground">{chartType.description}</div>
                              </div>
                            </DropdownMenuRadioItem>
                          );
                        })}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Filter Button */}
                  <Button variant="outline" size="sm" onClick={() => setShowFilterDrawer(true)}>
                    <IconFilter className="h-4 w-4 mr-2" />
                    Filtros
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>

                  {/* Export */}
                  <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <IconDownload className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>

                  {/* Refresh */}
                  <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <IconRefresh className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              {renderChart()}
            </CardContent>
          </Card>
        </div>

        {/* Warning Breakdown */}
        {warningBreakdown.length > 0 && (
          <div className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Advertências por Categoria</CardTitle>
                <CardDescription>Distribuição das advertências no período selecionado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  {warningBreakdown.map((item) => (
                    <div key={item.category} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm font-medium">{item.label}</span>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Data Table */}
        {items.length > 0 && (
          <div className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento por Período</CardTitle>
                <CardDescription>Dados mensais da equipe</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Efetivo</TableHead>
                      <TableHead className="text-right">Admissões</TableHead>
                      <TableHead className="text-right">Demissões</TableHead>
                      <TableHead className="text-right">Turnover</TableHead>
                      <TableHead className="text-right">Advertências</TableHead>
                      <TableHead className="text-right">Férias</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.period}>
                        <TableCell className="font-medium">{item.label}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.headcount)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.newHires)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.dismissals)}</TableCell>
                        <TableCell className="text-right">{formatPercentage(item.turnoverRate)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.totalWarnings)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.vacationCount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Filter Drawer */}
      <TeamFilters
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        filters={filters}
        onApply={handleFilterApply}
        onReset={handleFilterReset}
        yAxisMode={yAxisMode}
        onYAxisModeChange={setYAxisMode}
      />
    </div>
  );
};

export default TeamPerformancePage;
