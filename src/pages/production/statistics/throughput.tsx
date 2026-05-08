// web/src/pages/production/statistics/throughput.tsx

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Combobox } from '@/components/ui/combobox';
import { routes, SECTOR_PRIVILEGES } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useTaskProductionStats } from '@/hooks/production/use-production-analytics';
import type {
  TaskProductionFilters,
  TaskProductionChartType,
  TaskProductionXAxisMode,
  TaskProductionYAxisMode,
  TaskProductionCompareMode,
  TaskProductionItem,
} from '@/types/production-analytics';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import { formatNumber } from '@/types/statistics-common';
import type { YAxisMode, StatisticsChartType } from '@/types/statistics-common';
import { getSectors } from '@/api-client/sector';
import { sectorKeys } from '@/hooks/common/query-keys';
import {
  IconChartBar,
  IconChartLine,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconCalendarStats,
  IconChartArea,
  IconStack2,
  IconBuilding,
  IconX,
  IconUsers,
  IconCheckbox,
  IconChartArcs3,
  IconWaveSine,
  IconMinus,
  IconTrendingUp,
  IconFileTypePdf,
  IconFileTypeCsv,
  IconFileTypeXls,
} from '@tabler/icons-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import * as XLSX from 'xlsx';
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

const generateYearOptions = (yearsBack = 6) => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: yearsBack + 1 }, (_, i) => {
    const y = currentYear - i;
    return { value: y.toString(), label: y.toString() };
  });
};
const YEAR_OPTIONS = generateYearOptions();

type ChartTypeOption = { value: TaskProductionChartType; label: string; icon: typeof IconChartBar; description: string };

const BASE_CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { value: 'bar',  label: 'Colunas', icon: IconChartBar,  description: 'Colunas agrupadas' },
  { value: 'line', label: 'Linhas',  icon: IconChartLine, description: 'Gráfico de linhas' },
  { value: 'area', label: 'Área',    icon: IconChartArea, description: 'Gráfico de área preenchida' },
];

const STACKED_CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { value: 'bar-stacked',  label: 'Colunas Empilhadas', icon: IconStack2, description: 'Colunas empilhadas por setor' },
  { value: 'line-stacked', label: 'Linhas Empilhadas',  icon: IconStack2, description: 'Linhas empilhadas por setor' },
];

// In "both" mode only these two chart types make sense (single series per metric, no comparison)
const BOTH_MODE_CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { value: 'bar-stacked',  label: 'Colunas', icon: IconChartBar,  description: 'Colunas com Total + Média/Usuário' },
  { value: 'line-stacked', label: 'Linhas',  icon: IconChartLine, description: 'Linhas com Total + Média/Usuário' },
];

const SMOOTH_APPLICABLE: TaskProductionChartType[] = ['line', 'line-stacked', 'area'];

const X_AXIS_OPTIONS: Array<{ value: TaskProductionXAxisMode; label: string }> = [
  { value: 'month', label: 'Meses' },
  { value: 'year',  label: 'Anos' },
];

const Y_AXIS_OPTIONS: Array<{ value: TaskProductionYAxisMode; label: string }> = [
  { value: 'count',      label: 'Quantidade de Tarefas' },
  { value: 'avgPerUser', label: 'Média por Usuário Ativo' },
  { value: 'both',       label: 'Ambos (Total + Média/Usuário)' },
];

const COMPARE_MODE_OPTIONS: Array<{ value: TaskProductionCompareMode; label: string }> = [
  { value: 'combined',           label: 'Combinado (uma série)' },
  { value: 'separated',          label: 'Separado (por setor)' },
  { value: 'separatedWithTotal', label: 'Separado + Total (setor + Ambos)' },
];

// Business period date helpers (26th to 25th, matching backend logic)
function businessPeriodStartDate(year: number, month: number): Date {
  if (month === 1) return startOfDay(new Date(year - 1, 11, 26));
  return startOfDay(new Date(year, month - 2, 26));
}
function businessPeriodEndDate(year: number, month: number): Date {
  return endOfDay(new Date(year, month - 1, 25));
}

function computeDateRange(
  years: string[],
  months: string[],
): { startDate?: Date; endDate?: Date } {
  if (!years.length) return {};
  const yearNums = years.map(Number).sort((a, b) => a - b);
  const minY = yearNums[0];
  const maxY = yearNums[yearNums.length - 1];

  if (months.length > 0) {
    const monthNums = months.map(Number).sort((a, b) => a - b);
    const minM = monthNums[0];
    const maxM = monthNums[monthNums.length - 1];
    return {
      startDate: businessPeriodStartDate(minY, minM),
      endDate: businessPeriodEndDate(maxY, maxM),
    };
  }

  return {
    startDate: businessPeriodStartDate(minY, 1),
    endDate: businessPeriodEndDate(maxY, 12),
  };
}

// Aggregate monthly comparison data into yearly buckets
function aggregateComparisons(
  monthItems: TaskProductionItem[],
): TaskProductionItem['comparisons'] {
  if (!monthItems.length || !monthItems[0]?.comparisons) return undefined;
  const map = new Map<string, { name: string; counts: number[]; avgPerUsers: number[]; activeUsersList: number[] }>();
  monthItems.forEach(item => {
    item.comparisons?.forEach(comp => {
      if (!map.has(comp.sectorId)) map.set(comp.sectorId, { name: comp.sectorName, counts: [], avgPerUsers: [], activeUsersList: [] });
      const s = map.get(comp.sectorId)!;
      s.counts.push(comp.count);
      s.avgPerUsers.push(comp.avgPerUser);
      s.activeUsersList.push(comp.activeUsers);
    });
  });
  return Array.from(map.entries()).map(([sectorId, s]) => ({
    sectorId,
    sectorName: s.name,
    count: s.counts.reduce((a, b) => a + b, 0),
    activeUsers: Math.round(s.activeUsersList.reduce((a, b) => a + b, 0) / s.activeUsersList.length),
    avgPerUser: s.avgPerUsers.length ? s.avgPerUsers.reduce((a, b) => a + b, 0) / s.avgPerUsers.length : 0,
  }));
}

// =====================
// Filter Sheet
// =====================

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: TaskProductionFilters;
  selectedYears: string[];
  selectedMonths: string[];
  onApply: (filters: TaskProductionFilters, years: string[], months: string[]) => void;
}

function TaskProductionFiltersSheet({
  open, onOpenChange, filters, selectedYears, selectedMonths, onApply,
}: FilterSheetProps) {
  const [localX, setLocalX]     = useState<TaskProductionXAxisMode>(filters.xAxisMode || 'month');
  const [localY, setLocalY]     = useState<TaskProductionYAxisMode>(filters.yAxisMode || 'count');
  const [localCmp, setLocalCmp] = useState<TaskProductionCompareMode>(filters.compareMode || 'combined');
  const [localSectors, setLocalSectors] = useState<string[]>(filters.sectorIds || []);
  const [localYears, setLocalYears]     = useState<string[]>(selectedYears);
  const [localMonths, setLocalMonths]   = useState<string[]>(selectedMonths);

  useEffect(() => {
    if (open) {
      setLocalX(filters.xAxisMode || 'month');
      setLocalY(filters.yAxisMode || 'count');
      setLocalCmp(filters.compareMode || 'combined');
      setLocalSectors(filters.sectorIds || []);
      setLocalYears(selectedYears);
      setLocalMonths(selectedMonths);
    }
  }, [open, filters, selectedYears, selectedMonths]);

  const fetchSectors = useCallback(async (search: string, page = 1) => {
    const res = await getSectors({
      searchingFor: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
      privilege: SECTOR_PRIVILEGES.PRODUCTION,
    });
    return {
      data: (res.data || []).map(s => ({ value: s.id, label: s.name })),
      hasMore: res.meta?.hasNextPage || false,
    };
  }, []);

  // 'both' mode shows two metrics on one chart — sector comparison not applicable
  useEffect(() => {
    if (localY === 'both' && localSectors.length > 0) setLocalSectors([]);
  }, [localY, localSectors.length]);

  const canCompare = localSectors.length >= 2 && localY !== 'both';

  const handleApply = useCallback(() => {
    const { startDate, endDate } = computeDateRange(localYears, localMonths);
    const finalFilters: TaskProductionFilters = {
      startDate,
      endDate,
      xAxisMode: localX,
      yAxisMode: localY,
      compareMode: canCompare ? localCmp : 'combined',
      sectorIds: localSectors.length > 0 ? localSectors : undefined,
    };
    onApply(finalFilters, localYears, localMonths);
    onOpenChange(false);
  }, [localX, localY, localCmp, localSectors, localYears, localMonths, canCompare, onApply, onOpenChange]);

  const handleClear = useCallback(() => {
    setLocalX('month');
    setLocalY('count');
    setLocalCmp('combined');
    setLocalSectors([]);
    setLocalYears([]);
    setLocalMonths([]);
  }, []);

  const activeCount = [localSectors.length > 0, localYears.length > 0].filter(Boolean).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros
            {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
          </SheetTitle>
          <SheetDescription>Configure o período, métricas e setores para análise</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-4">

            {/* X-axis mode */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconCalendarStats className="h-4 w-4" />
                Agrupamento do Eixo X
              </Label>
              <Combobox
                value={localX}
                onValueChange={v => setLocalX(v as TaskProductionXAxisMode)}
                options={X_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
            </div>

            {/* Y-axis mode */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconChartArcs3 className="h-4 w-4" />
                Métrica do Eixo Y
              </Label>
              <Combobox
                value={localY}
                onValueChange={v => setLocalY(v as TaskProductionYAxisMode)}
                options={Y_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
              {localY === 'avgPerUser' && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Considera apenas usuários ativos no período (26–25). Usuários demitidos não contam no mês após a demissão.
                </p>
              )}
              {localY === 'both' && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Exibe Total de Tarefas e Média por Usuário Ativo no mesmo gráfico. Seleção de setores não disponível neste modo.
                </p>
              )}
            </div>

            {/* Year selector — always visible */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconCalendarStats className="h-4 w-4" />
                Anos
              </Label>
              <Combobox
                mode="multiple"
                value={localYears}
                onValueChange={v => setLocalYears(Array.isArray(v) ? v : v ? [v] : [])}
                options={YEAR_OPTIONS}
                placeholder="Selecione os anos..."
                searchPlaceholder="Buscar ano..."
                emptyText="Nenhum ano encontrado"
                searchable={true}
                clearable={true}
              />
              <p className="text-xs text-muted-foreground">
                {localYears.length === 0
                  ? 'Sem seleção → últimos 12 períodos'
                  : localX === 'year'
                    ? `${localYears.length} ${localYears.length === 1 ? 'ano' : 'anos'} selecionados`
                    : `Exibe os meses dos anos: ${localYears.sort().join(', ')}`}
              </p>
            </div>

            {/* Month filter — hidden when grouping by year */}
            {localX !== 'year' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconCalendarStats className="h-4 w-4" />
                  Meses
                </Label>
                <Combobox
                  mode="multiple"
                  value={localMonths}
                  onValueChange={v => setLocalMonths(Array.isArray(v) ? v : v ? [v] : [])}
                  options={MONTH_OPTIONS}
                  placeholder="Todos os meses..."
                  searchPlaceholder="Buscar mês..."
                  emptyText="Nenhum mês"
                  searchable={true}
                  clearable={true}
                />
                <p className="text-xs text-muted-foreground">
                  {localMonths.length === 0
                    ? 'Sem seleção → todos os meses dos anos selecionados'
                    : `Exibe apenas: ${localMonths.sort().map(m => MONTH_OPTIONS.find(o => o.value === m)?.label).join(', ')}`}
                </p>
              </div>
            )}

            {/* Sectors — hidden in 'both' mode */}
            {localY !== 'both' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconBuilding className="h-4 w-4" />
                  Setores
                </Label>
                <Combobox
                  mode="multiple"
                  async
                  value={localSectors}
                  onValueChange={v => setLocalSectors(Array.isArray(v) && v.length > 0 ? v : [])}
                  queryKey={[...sectorKeys.lists()]}
                  queryFn={fetchSectors}
                  minSearchLength={0}
                  placeholder="Todos os setores..."
                  searchPlaceholder="Buscar setor..."
                  emptyText="Nenhum setor encontrado"
                  loadingText="Carregando setores..."
                  searchable={true}
                  clearable={true}
                />
                <p className="text-xs text-muted-foreground">
                  Sem seleção = todos. Selecione 2+ para habilitar comparação.
                </p>
              </div>
            )}

            {/* Compare mode — only when 2+ sectors */}
            {canCompare && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconUsers className="h-4 w-4" />
                  Modo de Comparação
                </Label>
                <Combobox
                  value={localCmp}
                  onValueChange={v => setLocalCmp(v as TaskProductionCompareMode)}
                  options={COMPARE_MODE_OPTIONS}
                  placeholder="Selecione..."
                  searchable={false}
                  clearable={false}
                />
                {localCmp === 'separated' && (
                  <p className="text-xs text-muted-foreground">
                    Exibe uma série por setor, sem total combinado.
                  </p>
                )}
                {localCmp === 'separatedWithTotal' && (
                  <p className="text-xs text-muted-foreground">
                    Exibe uma série por setor + série "Ambos" (total combinado) = {localSectors.length + 1} séries.
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            <IconX className="h-4 w-4 mr-2" />
            Limpar
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
// Main Page
// =====================

const TaskProductionPage = () => {
  usePageTracker({ page: 'production-task-statistics', title: 'Produção de Tarefas' });

  const [showFilters, setShowFilters] = useState(false);

  const [chartType, setChartType] = useState<TaskProductionChartType>('bar');
  const [smooth, setSmooth] = useState(false);

  const chartContainerRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState<TaskProductionFilters>({
    xAxisMode: 'month',
    yAxisMode: 'count',
    compareMode: 'combined',
  });

  const [selectedYears, setSelectedYears]   = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const isBothMode = filters.yAxisMode === 'both';
  const useAvg     = filters.yAxisMode === 'avgPerUser';

  const isComparisonMode =
    (filters.compareMode === 'separated' || filters.compareMode === 'separatedWithTotal') &&
    (filters.sectorIds?.length ?? 0) >= 2;

  // Stacked variants are only meaningful in comparison mode; drop back to base type if not
  const isStackedType = chartType === 'bar-stacked' || chartType === 'line-stacked';

  // "Ambos" series makes no sense when stacked (top of stack already equals total)
  const includeAmbos =
    isComparisonMode &&
    filters.compareMode === 'separatedWithTotal' &&
    !isStackedType;

  // User picks the exact chart type — StatisticsChart renders it directly
  const effectiveChartType: StatisticsChartType = chartType;

  // Smooth toggle: applicable to line/area types, and to both mode (controls the avg line)
  const showSmoothToggle = SMOOTH_APPLICABLE.includes(chartType) || isBothMode;

  // Available chart types depend on the current mode
  const availableChartTypes = useMemo(() => {
    if (isBothMode) return BOTH_MODE_CHART_TYPE_OPTIONS;
    if (isComparisonMode) return [...BASE_CHART_TYPE_OPTIONS, ...STACKED_CHART_TYPE_OPTIONS];
    return BASE_CHART_TYPE_OPTIONS;
  }, [isBothMode, isComparisonMode]);

  // Keep chartType valid whenever mode changes
  useEffect(() => {
    const valid = availableChartTypes.some(t => t.value === chartType);
    if (!valid) {
      if (isBothMode) setChartType('bar-stacked');
      else if (isStackedType) setChartType(chartType === 'bar-stacked' ? 'bar' : 'line');
      else setChartType('bar');
    }
  }, [availableChartTypes, chartType, isBothMode, isStackedType]);

  // Reset smooth default when chart type changes
  useEffect(() => {
    setSmooth(chartType === 'line' || chartType === 'line-stacked');
  }, [chartType]);

  // Always fetch monthly data; year aggregation is done on the frontend
  const apiFilters = useMemo(
    () => ({ ...filters, xAxisMode: 'month' as const }),
    [filters],
  );

  const { data, isLoading, isError, error, refetch } = useTaskProductionStats(apiFilters);
  const rawItems: TaskProductionItem[] = data?.data?.items || [];
  const summary = data?.data?.summary;

  // Client-side filter + optional year aggregation
  const items = useMemo(() => {
    if (!rawItems.length) return rawItems;

    const hasYearFilter  = selectedYears.length > 0;
    const hasMonthFilter = selectedMonths.length > 0;

    if (filters.xAxisMode !== 'year') {
      // Month mode: filter by selected years and months
      if (!hasYearFilter && !hasMonthFilter) return rawItems;
      return rawItems.filter(item => {
        const [yearPart, monthPart] = item.period.split('-');
        return (!hasYearFilter || selectedYears.includes(yearPart)) &&
               (!hasMonthFilter || selectedMonths.includes(monthPart));
      });
    }

    // Year mode: group monthly items into yearly buckets, then aggregate
    const yearGroups = new Map<string, TaskProductionItem[]>();
    rawItems.forEach(item => {
      const yearPart = item.period.split('-')[0];
      if (hasYearFilter && !selectedYears.includes(yearPart)) return;
      if (!yearGroups.has(yearPart)) yearGroups.set(yearPart, []);
      yearGroups.get(yearPart)!.push(item);
    });

    return Array.from(yearGroups.entries())
      .map(([year, monthItems]) => ({
        period: year,
        periodLabel: year,
        totalCount: monthItems.reduce((s, i) => s + i.totalCount, 0),
        // Mean of monthly averages — matches expected yearly avg/user
        avgPerUser: monthItems.length
          ? monthItems.reduce((s, i) => s + i.avgPerUser, 0) / monthItems.length
          : 0,
        activeUsers: monthItems.length
          ? Math.round(monthItems.reduce((s, i) => s + i.activeUsers, 0) / monthItems.length)
          : 0,
        comparisons: aggregateComparisons(monthItems),
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [rawItems, filters.xAxisMode, selectedYears, selectedMonths]);

  const handleFilterApply = useCallback((f: TaskProductionFilters, years: string[], months: string[]) => {
    setFilters(f);
    setSelectedYears(years);
    setSelectedMonths(months);
  }, []);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.sectorIds?.length) c++;
    if (selectedYears.length) c++;
    if (selectedMonths.length) c++;
    if (filters.xAxisMode !== 'month') c++;
    if (filters.yAxisMode !== 'count') c++;
    return c;
  }, [filters, selectedYears, selectedMonths]);

  // Sectors that have at least one non-zero value across all displayed periods
  const activeSectorIds = useMemo(() => {
    const ids = new Set<string>();
    if (!isComparisonMode) return ids;
    items.forEach(item => {
      item.comparisons?.forEach(comp => {
        if ((useAvg ? comp.avgPerUser : comp.count) > 0) ids.add(comp.sectorId);
      });
    });
    return ids;
  }, [items, isComparisonMode, useAvg]);

  // Derive dynamic sector column names — only active sectors
  const sectorColumns = useMemo(() => {
    if (!isComparisonMode || !items.length || !items[0].comparisons) return [];
    const cols = items[0].comparisons
      .filter(c => activeSectorIds.has(c.sectorId))
      .map(c => c.sectorName);
    if (includeAmbos) cols.push('Ambos');
    return cols;
  }, [isComparisonMode, items, includeAmbos, activeSectorIds]);

  // Build chart data — exclude sectors with no activity in the selected period
  const chartData = useMemo(() => {
    if (!items.length) return [];
    return items.map(item => ({
      name: item.periodLabel,
      value: useAvg ? item.avgPerUser : item.totalCount,
      secondaryValue: isBothMode ? item.avgPerUser : undefined,
      comparisons: isComparisonMode && item.comparisons
        ? [
            ...item.comparisons
              .filter(c => activeSectorIds.has(c.sectorId))
              .map(c => ({
                entityName: c.sectorName,
                value: useAvg ? c.avgPerUser : c.count,
                secondaryValue: isBothMode ? c.avgPerUser : undefined,
              })),
            ...(includeAmbos
              ? [{
                  entityName: 'Ambos',
                  value: useAvg ? item.avgPerUser : item.totalCount,
                  secondaryValue: isBothMode ? item.avgPerUser : undefined,
                }]
              : []),
          ]
        : undefined,
    }));
  }, [items, isComparisonMode, includeAmbos, useAvg, isBothMode, activeSectorIds]);

  const chartDataKey = `${isComparisonMode}-${filters.yAxisMode}-${filters.compareMode}`;

  // Average per display period (month or year) computed from aggregated items
  const avgPerDisplayPeriod = useMemo(
    () => (items.length ? items.reduce((s, i) => s + i.totalCount, 0) / items.length : 0),
    [items],
  );

  // Mean of period-level avgPerUser values — always represents monthly productivity
  // (month mode: each period is one month; year mode: each item is already the mean of its months)
  const summaryAvgPerUser = useMemo(() => {
    const active = items.filter(i => i.activeUsers > 0);
    if (!active.length) return 0;
    return active.reduce((s, i) => s + i.avgPerUser, 0) / active.length;
  }, [items]);

  // yAxisMode passed to the chart component
  const chartYAxisMode: YAxisMode = isBothMode ? 'both' : 'count';

  const valueFormatter = useCallback((value: number): string => {
    if (useAvg) return value.toFixed(2);
    return Math.round(value).toString();
  }, [useAvg]);

  const secondaryValueFormatter = useCallback((value: number) => value.toFixed(1), []);

  const maxPeriodCount = useMemo(
    () => (items.length ? Math.max(...items.map(i => i.totalCount)) : 0),
    [items],
  );

  const handleExportCSV = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const baseHeaders = ['Período', 'Total de Tarefas'];
      if (useAvg || isBothMode) baseHeaders.push('Usuários Ativos', 'Média/Usuário');
      if (isComparisonMode) sectorColumns.forEach(col => baseHeaders.push(col));

      const rows = items.map(item => {
        const row = [item.periodLabel, String(item.totalCount)];
        if (useAvg || isBothMode) {
          row.push(String(item.activeUsers), item.avgPerUser.toFixed(2));
        }
        if (isComparisonMode && item.comparisons) {
          sectorColumns.forEach(col => {
            if (col === 'Ambos') {
              row.push(String(item.totalCount));
            } else {
              const c = item.comparisons!.find(x => x.sectorName === col);
              row.push(String(c?.count ?? 0));
            }
          });
        }
        return row;
      });

      const csv = [baseHeaders, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `producao-tarefas-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('Dados exportados!');
    } catch {
      toast.error('Erro ao exportar dados');
    }
  }, [items, isComparisonMode, useAvg, isBothMode, sectorColumns]);

  const handleExportXLSX = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers: string[] = ['Período', 'Total de Tarefas'];
      if (useAvg || isBothMode) headers.push('Usuários Ativos', 'Média/Usuário');
      if (isComparisonMode) sectorColumns.forEach(col => headers.push(col));

      const rows = items.map(item => {
        const row: (string | number)[] = [item.periodLabel, item.totalCount];
        if (useAvg || isBothMode) {
          row.push(item.activeUsers, parseFloat(item.avgPerUser.toFixed(2)));
        }
        if (isComparisonMode && item.comparisons) {
          sectorColumns.forEach(col => {
            if (col === 'Ambos') {
              row.push(item.totalCount);
            } else {
              const c = item.comparisons!.find(x => x.sectorName === col);
              row.push(c?.count ?? 0);
            }
          });
        }
        return row;
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((_, i) => ({ wch: i === 0 ? 18 : 14 }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rendimento');
      XLSX.writeFile(wb, `producao-tarefas-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`);
      toast.success('Planilha exportada com sucesso!');
    } catch {
      toast.error('Erro ao exportar planilha');
    }
  }, [items, isComparisonMode, useAvg, isBothMode, sectorColumns]);

  const handleExportPDF = useCallback(async () => {
    if (!chartData.length) { toast.error('Nenhum dado para exportar'); return; }
    if (!chartContainerRef.current) return;

    const toastId = toast.loading('Gerando PDF...');
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(chartContainerRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');

      // A4 Landscape: 297 x 210 mm
      const pageW = 297;
      const pageH = 210;
      const margin = 12;
      const contentW = pageW - margin * 2;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      doc.setFontSize(15);
      doc.setTextColor(40, 40, 40);
      doc.text('Produção de Tarefas por Período', pageW / 2, 14, { align: 'center' });

      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pageW / 2, 20, { align: 'center' });

      const filterParts: string[] = [];
      filterParts.push(filters.xAxisMode === 'year' ? 'Agrupamento: Anos' : 'Agrupamento: Meses (26–25)');
      if (selectedYears.length) filterParts.push(`Anos: ${[...selectedYears].sort().join(', ')}`);
      if (selectedMonths.length) filterParts.push(`Meses: ${selectedMonths.length} selecionados`);
      if (useAvg) filterParts.push('Métrica: Média/Usuário');
      else if (isBothMode) filterParts.push('Métrica: Total + Média/Usuário');
      if (isComparisonMode && sectorColumns.length) {
        filterParts.push(`Setores: ${sectorColumns.filter(c => c !== 'Ambos').join(', ')}`);
      }

      doc.setFontSize(7.5);
      doc.setTextColor(130, 130, 130);
      doc.text(filterParts.join('  •  '), pageW / 2, 25.5, { align: 'center' });

      const chartAreaY = 30;
      const maxChartH = pageH - chartAreaY - 18;
      const imgAspect = canvas.height / canvas.width;
      const chartH = Math.min(contentW * imgAspect, maxChartH);
      const chartW = chartH / imgAspect;
      const chartX = margin + (contentW - chartW) / 2;

      doc.addImage(imgData, 'PNG', chartX, chartAreaY, chartW, chartH);

      const footerY = chartAreaY + chartH + 6;
      if (footerY < pageH - 3) {
        doc.setFontSize(8);
        doc.setTextColor(70, 70, 70);
        const stats: string[] = [
          `Total Concluídas: ${formatNumber(summary?.totalCompleted ?? 0)}`,
          `Média/${filters.xAxisMode === 'year' ? 'Ano' : 'Mês'}: ${formatNumber(avgPerDisplayPeriod, 1)}`,
        ];
        if (useAvg || isBothMode) stats.push(`Média/Usuário: ${summaryAvgPerUser.toFixed(2)}`);
        else stats.push(`Pico: ${formatNumber(maxPeriodCount)}`);
        stats.push(`Períodos: ${items.length}`);
        doc.text(stats.join('   |   '), pageW / 2, footerY, { align: 'center' });
      }

      doc.save(`producao-tarefas-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.pdf`);
      toast.dismiss(toastId);
      toast.success('PDF exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      toast.dismiss(toastId);
      toast.error('Erro ao exportar PDF');
    }
  }, [chartData, filters, selectedYears, selectedMonths, useAvg, isBothMode, isComparisonMode, sectorColumns, summary, avgPerDisplayPeriod, summaryAvgPerUser, maxPeriodCount, items]);

  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="h-[480px] flex items-center justify-center">
          <div className="space-y-3 w-full px-8">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-[380px] w-full" />
          </div>
        </div>
      );
    }
    if (isError) {
      return (
        <div className="h-[480px] flex flex-col items-center justify-center gap-4">
          <IconAlertCircle className="h-12 w-12 text-destructive" />
          <div className="text-center">
            <p className="font-semibold">Erro ao carregar dados</p>
            <p className="text-sm text-muted-foreground">{error?.message}</p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <IconRefresh className="mr-2 h-4 w-4" />
            Tentar Novamente
          </Button>
        </div>
      );
    }
    if (!chartData.length) {
      return (
        <div className="h-[480px] flex flex-col items-center justify-center gap-4">
          <IconCalendarStats className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-semibold">Nenhum dado encontrado</p>
            <p className="text-sm text-muted-foreground">Ajuste os filtros para visualizar os dados</p>
          </div>
        </div>
      );
    }
    return (
      <StatisticsChart
        key={chartDataKey}
        data={chartData}
        chartType={effectiveChartType}
        yAxisMode={chartYAxisMode}
        isComparisonMode={isComparisonMode}
        height="480px"
        yAxisLabel={useAvg ? 'Média/Usuário' : 'Tarefas Concluídas'}
        valueFormatter={valueFormatter}
        secondaryValueFormatter={secondaryValueFormatter}
        tooltipLabels={{
          primary:   isBothMode ? 'Total Tarefas' : (useAvg ? 'Média por Usuário' : 'Tarefas Concluídas'),
          secondary: isBothMode ? 'Média/Usuário' : undefined,
        }}
        smooth={smooth}
      />
    );
  };

  const currentChartType = availableChartTypes.find(t => t.value === chartType) ?? availableChartTypes[0];
  const ChartIcon = currentChartType.icon;

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Produção de Tarefas"
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
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle>Produção de Tarefas por Período</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span>Tarefas concluídas por {filters.xAxisMode === 'year' ? 'ano' : 'mês (período 26–25)'}</span>
                    {isBothMode  && <Badge variant="outline"  className="text-xs">Total + Média/Usuário</Badge>}
                    {useAvg      && <Badge variant="outline"  className="text-xs">Média/Usuário</Badge>}
                    {isComparisonMode && (
                      <Badge variant="secondary" className="text-xs">
                        {filters.compareMode === 'separatedWithTotal' ? 'Comparação + Ambos' : 'Comparação Setores'}
                      </Badge>
                    )}
                    {selectedYears.length > 0 && (
                      <Badge variant="outline" className="text-xs">{selectedYears.sort().join(', ')}</Badge>
                    )}
                    {selectedMonths.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {selectedMonths.length} {selectedMonths.length === 1 ? 'mês' : 'meses'}
                      </Badge>
                    )}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Chart type selector */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ChartIcon className="h-4 w-4 mr-2" />
                        {currentChartType.label}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      <DropdownMenuLabel>Tipo de Gráfico</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={chartType}
                        onValueChange={v => setChartType(v as TaskProductionChartType)}
                      >
                        {availableChartTypes.map(ct => {
                          const Icon = ct.icon;
                          return (
                            <DropdownMenuRadioItem key={ct.value} value={ct.value} className="group">
                              <Icon className="h-4 w-4 mr-2" />
                              <div className="flex flex-col">
                                <span>{ct.label}</span>
                                <span className="text-xs text-muted-foreground group-data-[highlighted]:text-white/80">
                                  {ct.description}
                                </span>
                              </div>
                            </DropdownMenuRadioItem>
                          );
                        })}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Smooth toggle */}
                  {showSmoothToggle && (
                    <Button
                      variant={smooth ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSmooth(s => !s)}
                      title={smooth ? 'Traçado suave (clique para reto)' : 'Traçado reto (clique para suave)'}
                    >
                      {smooth
                        ? <><IconWaveSine className="h-4 w-4 mr-1.5" />Suave</>
                        : <><IconMinus   className="h-4 w-4 mr-1.5" />Reto</>}
                    </Button>
                  )}

                  {/* Filters */}
                  <Button
                    variant={activeFilterCount > 0 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowFilters(true)}
                  >
                    <IconFilter className="h-4 w-4 mr-2" />
                    Filtros
                    {activeFilterCount > 0 && <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>}
                  </Button>

                  {/* Export */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLoading || !items.length}
                      >
                        <IconDownload className="h-4 w-4 mr-2" />
                        Exportar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Formato de Exportação</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleExportPDF}>
                        <IconFileTypePdf className="h-4 w-4 mr-2" />
                        PDF do Gráfico
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleExportCSV}>
                        <IconFileTypeCsv className="h-4 w-4 mr-2" />
                        CSV dos Dados
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportXLSX}>
                        <IconFileTypeXls className="h-4 w-4 mr-2" />
                        Excel (XLSX) dos Dados
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Summary Cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="py-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium">Total Concluídas</CardTitle>
                    <IconCheckbox className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading
                      ? <Skeleton className="h-7 w-20" />
                      : <div className="text-xl font-bold">{formatNumber(summary?.totalCompleted ?? 0)}</div>
                    }
                  </CardContent>
                </Card>

                <Card className="py-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium">
                      Média por {filters.xAxisMode === 'year' ? 'Ano' : 'Mês'}
                    </CardTitle>
                    <IconCalendarStats className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading
                      ? <Skeleton className="h-7 w-20" />
                      : <div className="text-xl font-bold">{formatNumber(avgPerDisplayPeriod, 1)}</div>
                    }
                  </CardContent>
                </Card>

                {/* 3rd and 4th cards vary by mode */}
                {(useAvg || isBothMode) ? (
                  <>
                    <Card className="py-2">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                        <CardTitle className="text-xs font-medium">Média/Usuário (geral)</CardTitle>
                        <IconUsers className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="pb-0 px-4">
                        {isLoading
                          ? <Skeleton className="h-7 w-20" />
                          : <div className="text-xl font-bold">{summaryAvgPerUser.toFixed(2)}</div>
                        }
                      </CardContent>
                    </Card>

                    <Card className="py-2">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                        <CardTitle className="text-xs font-medium">Usuários no Período</CardTitle>
                        <IconBuilding className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="pb-0 px-4">
                        {isLoading
                          ? <Skeleton className="h-7 w-20" />
                          : <div className="text-xl font-bold">{formatNumber(summary?.totalActiveUsers ?? 0)}</div>
                        }
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <>
                    <Card className="py-2">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                        <CardTitle className="text-xs font-medium">Pico de Produção</CardTitle>
                        <IconTrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="pb-0 px-4">
                        {isLoading
                          ? <Skeleton className="h-7 w-20" />
                          : <div className="text-xl font-bold">{formatNumber(maxPeriodCount)}</div>
                        }
                        {!isLoading && items.length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {items.find(i => i.totalCount === maxPeriodCount)?.periodLabel}
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="py-2">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                        <CardTitle className="text-xs font-medium">Períodos Analisados</CardTitle>
                        <IconCalendarStats className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="pb-0 px-4">
                        {isLoading
                          ? <Skeleton className="h-7 w-20" />
                          : <div className="text-xl font-bold">{formatNumber(items.length)}</div>
                        }
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              {/* Chart */}
              <Card>
                <CardContent className="p-4">
                  <div ref={chartContainerRef}>
                    {renderChart()}
                  </div>
                </CardContent>
              </Card>

              {/* Data Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalhamento</CardTitle>
                  <CardDescription>
                    {items.length > 0
                      ? `${items.length} ${items.length === 1 ? 'período' : 'períodos'} exibidos`
                      : 'Nenhum período para exibir'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[360px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Período</TableHead>
                          <TableHead className="text-right">Tarefas</TableHead>
                          {(useAvg || isBothMode) && (
                            <>
                              <TableHead className="text-right">Usu. Ativos</TableHead>
                              <TableHead className="text-right">Média/Usu.</TableHead>
                            </>
                          )}
                          {isComparisonMode && sectorColumns.map(col => (
                            <TableHead key={col} className="text-right">{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                              Carregando...
                            </TableCell>
                          </TableRow>
                        ) : items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                              Nenhum dado disponível
                            </TableCell>
                          </TableRow>
                        ) : (
                          items.map((item, idx) => (
                            <TableRow key={item.period || idx}>
                              <TableCell className="font-medium">{item.periodLabel}</TableCell>
                              <TableCell className="text-right">{formatNumber(item.totalCount)}</TableCell>
                              {(useAvg || isBothMode) && (
                                <>
                                  <TableCell className="text-right">{formatNumber(item.activeUsers)}</TableCell>
                                  <TableCell className="text-right">{item.avgPerUser.toFixed(2)}</TableCell>
                                </>
                              )}
                              {isComparisonMode && sectorColumns.map(col => {
                                if (col === 'Ambos') {
                                  return (
                                    <TableCell key="Ambos" className="text-right font-medium">
                                      {formatNumber(item.totalCount)}
                                    </TableCell>
                                  );
                                }
                                const sector = item.comparisons?.find(c => c.sectorName === col);
                                return (
                                  <TableCell key={col} className="text-right">
                                    {formatNumber(sector?.count ?? 0)}
                                  </TableCell>
                                );
                              })}
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

          <TaskProductionFiltersSheet
            open={showFilters}
            onOpenChange={setShowFilters}
            filters={filters}
            selectedYears={selectedYears}
            selectedMonths={selectedMonths}
            onApply={handleFilterApply}
          />
        </div>
      </div>
    </div>
  );
};

export const ProductionThroughputStatisticsPage = () => <TaskProductionPage />;
export default ProductionThroughputStatisticsPage;
