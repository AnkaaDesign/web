// web/src/pages/production/statistics/productivity.tsx

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { StatisticsChart, type StatisticsChartHandle } from '@/components/statistics/statistics-chart';
import { exportProductivityPdf } from '@/utils/productivity-pdf-generator';
import { ProductionPeriodTasksModal } from '@/components/production/production-period-tasks-modal';
import { formatNumber } from '@/types/statistics-common';
import type { YAxisMode, StatisticsChartType, TrendLineType } from '@/types/statistics-common';
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
  IconTrendingUp,
  IconFileTypePdf,
  IconFileTypeCsv,
  IconFileTypeXls,
  IconTarget,
  IconArrowsExchange2,
} from '@tabler/icons-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
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

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const MONTH_NAME_TO_NUM: Record<string, string> = {
  'Janeiro':'01','Fevereiro':'02','Março':'03','Abril':'04',
  'Maio':'05','Junho':'06','Julho':'07','Agosto':'08',
  'Setembro':'09','Outubro':'10','Novembro':'11','Dezembro':'12',
};

const TREND_LABELS: Record<TrendLineType, string> = {
  linear: 'Linear', sma3: 'Média 3m', sma6: 'Média 6m', sma12: 'Média 12m',
};

type ChartTypeOption = { value: TaskProductionChartType; label: string; icon: typeof IconChartBar; description: string };

const BASE_CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { value: 'bar',         label: 'Colunas',     icon: IconChartBar,  description: 'Colunas agrupadas' },
  { value: 'line',        label: 'Linha Reta',  icon: IconChartLine, description: 'Gráfico de linhas retas' },
  { value: 'line-smooth', label: 'Linha Suave', icon: IconChartLine, description: 'Gráfico de linhas suavizadas' },
  { value: 'area',        label: 'Área Reta',   icon: IconChartArea, description: 'Área preenchida com linhas retas' },
  { value: 'area-smooth', label: 'Área Suave',  icon: IconChartArea, description: 'Área preenchida suavizada' },
];

const STACKED_CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { value: 'bar-stacked',  label: 'Colunas Empilhadas', icon: IconStack2, description: 'Colunas empilhadas por setor' },
  { value: 'line-stacked', label: 'Linhas Empilhadas',  icon: IconStack2, description: 'Linhas empilhadas por setor' },
];

const BOTH_MODE_CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { value: 'bar-stacked',  label: 'Colunas', icon: IconChartBar,  description: 'Colunas com Total + Média/Colaborador' },
  { value: 'line-stacked', label: 'Linhas',  icon: IconChartLine, description: 'Linhas com Total + Média/Colaborador' },
];

const X_AXIS_OPTIONS: Array<{ value: TaskProductionXAxisMode; label: string }> = [
  { value: 'month', label: 'Meses' },
  { value: 'year',  label: 'Anos' },
];

const Y_AXIS_OPTIONS: Array<{ value: TaskProductionYAxisMode; label: string }> = [
  { value: 'count',      label: 'Quantidade de Tarefas' },
  { value: 'avgPerUser', label: 'Média por Colaborador Ativo' },
  { value: 'both',       label: 'Ambos (Total + Média/Colaborador)' },
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

// Aggregate monthly comparison data into yearly buckets.
//
// Math rules:
//  - count: Σ monthly counts (annual total tasks).
//  - activeUsers: mean of monthly headcounts (rounded). Represents an "avg
//    monthly FTE" for the year; sector history isn't tracked finely enough
//    to compute a true distinct-user count per year client-side.
//  - avgPerUser: count / activeUsers — derived from the aggregated values
//    above so the math is self-consistent. NOT the mean of monthly avgs,
//    which is wrong when staffing varies month to month (e.g. annual=500
//    with months [100/10, 400/20] → mean-of-avgs = 15, but correct = 33.3).
function aggregateComparisons(
  monthItems: TaskProductionItem[],
): TaskProductionItem['comparisons'] {
  if (!monthItems.length || !monthItems[0]?.comparisons) return undefined;
  const map = new Map<string, { name: string; counts: number[]; activeUsersList: number[] }>();
  monthItems.forEach(item => {
    item.comparisons?.forEach(comp => {
      if (!map.has(comp.sectorId)) map.set(comp.sectorId, { name: comp.sectorName, counts: [], activeUsersList: [] });
      const s = map.get(comp.sectorId)!;
      s.counts.push(comp.count);
      s.activeUsersList.push(comp.activeUsers);
    });
  });
  return Array.from(map.entries()).map(([sectorId, s]) => {
    const count = s.counts.reduce((a, b) => a + b, 0);
    const activeUsers = s.activeUsersList.length
      ? Math.round(s.activeUsersList.reduce((a, b) => a + b, 0) / s.activeUsersList.length)
      : 0;
    return {
      sectorId,
      sectorName: s.name,
      count,
      activeUsers,
      avgPerUser: activeUsers > 0 ? +(count / activeUsers).toFixed(2) : 0,
    };
  });
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
  yearCompareMode: boolean;
  onApply: (filters: TaskProductionFilters, years: string[], months: string[], yearCompare: boolean) => void;
}

function TaskProductionFiltersSheet({
  open, onOpenChange, filters, selectedYears, selectedMonths, yearCompareMode, onApply,
}: FilterSheetProps) {
  const [localX, setLocalX]     = useState<TaskProductionXAxisMode>(filters.xAxisMode || 'month');
  const [localY, setLocalY]     = useState<TaskProductionYAxisMode>(filters.yAxisMode || 'count');
  const [localCmp, setLocalCmp] = useState<TaskProductionCompareMode>(filters.compareMode || 'combined');
  const [localSectors, setLocalSectors] = useState<string[]>(filters.sectorIds || []);
  const [localYears, setLocalYears]     = useState<string[]>(selectedYears);
  const [localMonths, setLocalMonths]   = useState<string[]>(selectedMonths);
  const [localYearCompare, setLocalYearCompare] = useState(yearCompareMode);

  useEffect(() => {
    if (open) {
      setLocalX(filters.xAxisMode || 'month');
      setLocalY(filters.yAxisMode || 'count');
      setLocalCmp(filters.compareMode || 'combined');
      setLocalSectors(filters.sectorIds || []);
      setLocalYears(selectedYears);
      setLocalMonths(selectedMonths);
      setLocalYearCompare(yearCompareMode);
    }
  }, [open, filters, selectedYears, selectedMonths, yearCompareMode]);

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
    const yearCompare = localYears.length >= 2 && localX !== 'year' ? localYearCompare : false;
    onApply(finalFilters, localYears, localMonths, yearCompare);
    onOpenChange(false);
  }, [localX, localY, localCmp, localSectors, localYears, localMonths, localYearCompare, canCompare, onApply, onOpenChange]);

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
                  Considera apenas colaboradores ativos no período (26–25). Colaboradores desligados não contam no mês após a demissão.
                </p>
              )}
              {localY === 'both' && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Exibe Total de Tarefas e Média por Colaborador Ativo no mesmo gráfico. Seleção de setores não disponível neste modo.
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

            {/* Year-over-year comparison toggle — only when 2+ years and month mode */}
            {localYears.length >= 2 && localX !== 'year' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconArrowsExchange2 className="h-4 w-4" />
                  Comparação Ano a Ano
                </Label>
                <div className="flex items-center justify-between rounded-lg border border-border bg-transparent px-3 py-2">
                  <div className="space-y-0.5">
                    <p className="text-sm">Comparar meses entre anos</p>
                    <p className="text-xs text-muted-foreground">
                      Exibe Janeiro dos {localYears.length} anos lado a lado, depois Fevereiro, etc.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={localYearCompare}
                    onClick={() => setLocalYearCompare(v => !v)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                      localYearCompare ? 'bg-primary' : 'bg-input'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
                        localYearCompare ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
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
  usePageTracker({ page: 'production-productivity-statistics', title: 'Produtividade' });

  const [showFilters, setShowFilters] = useState(false);

  const [chartType, setChartType] = useState<TaskProductionChartType>('bar');
  const [trendLine, setTrendLine] = useState<TrendLineType | null>(null);
  const [goalValue, setGoalValue] = useState<number | null>(null);
  const [goalInput, setGoalInput] = useState('');
  const [goalPopoverOpen, setGoalPopoverOpen] = useState(false);
  const [yearCompareMode, setYearCompareMode] = useState(false);
  const [clickedPeriod, setClickedPeriod] = useState<{ period: string; label: string; activeUsers?: number } | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartHandleRef = useRef<StatisticsChartHandle>(null);

  const [filters, setFilters] = useState<TaskProductionFilters>(() => {
    const y = new Date().getFullYear().toString();
    const { startDate, endDate } = computeDateRange([y], []);
    return { xAxisMode: 'month', yAxisMode: 'count', compareMode: 'combined', startDate, endDate };
  });

  const [selectedYears, setSelectedYears]   = useState<string[]>(() => [new Date().getFullYear().toString()]);
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

  // Disable year-compare when not enough years or in year-axis mode
  useEffect(() => {
    if (filters.xAxisMode === 'year' || selectedYears.length < 2) {
      setYearCompareMode(false);
    }
  }, [filters.xAxisMode, selectedYears.length]);

  // A goal set in one metric (e.g. 100 tasks) is meaningless after switching
  // to a different scale (e.g. 2.36 tasks/colaborador). Reset on metric change.
  useEffect(() => {
    setGoalValue(null);
    setGoalInput('');
  }, [filters.yAxisMode]);


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
      .map(([year, monthItems]) => {
        const totalCount = monthItems.reduce((s, i) => s + i.totalCount, 0);
        const activeUsers = monthItems.length
          ? Math.round(monthItems.reduce((s, i) => s + i.activeUsers, 0) / monthItems.length)
          : 0;
        // Derive avgPerUser from aggregated values so the trio (count,
        // activeUsers, avgPerUser) stays mathematically self-consistent.
        // mean(monthly avgs) is wrong when staffing varies between months.
        return {
          period: year,
          periodLabel: year,
          totalCount,
          activeUsers,
          avgPerUser: activeUsers > 0 ? +(totalCount / activeUsers).toFixed(2) : 0,
          comparisons: aggregateComparisons(monthItems),
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [rawItems, filters.xAxisMode, selectedYears, selectedMonths]);

  const handleFilterApply = useCallback((f: TaskProductionFilters, years: string[], months: string[], yearCompare: boolean) => {
    setFilters(f);
    setSelectedYears(years);
    setSelectedMonths(months);
    setYearCompareMode(yearCompare);
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

  // Build chart data — exclude sectors with no activity in the selected period.
  // When all displayed months share a single year, drop the year suffix from
  // the chart's x-axis labels ("Janeiro 2026" → "Janeiro"); the modal and
  // exports still receive the full periodLabel via items[i].periodLabel.
  const stripYearOnAxis = filters.xAxisMode !== 'year' && selectedYears.length === 1;
  const chartData = useMemo(() => {
    if (!items.length) return [];
    return items.map(item => ({
      name: stripYearOnAxis ? item.periodLabel.replace(/\s+\d{4}\s*$/, '').trim() : item.periodLabel,
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
  }, [items, isComparisonMode, includeAmbos, useAvg, isBothMode, activeSectorIds, stripYearOnAxis]);

  // Year-over-year comparison: x = month name, series = one per year
  const yearCompareChartData = useMemo(() => {
    if (!yearCompareMode || filters.xAxisMode === 'year' || selectedYears.length < 2) return null;
    const sortedYears = [...selectedYears].sort();
    const monthsToShow = selectedMonths.length > 0 ? [...selectedMonths].sort() : ['01','02','03','04','05','06','07','08','09','10','11','12'];

    return monthsToShow
      .map(month => {
        const monthIdx = parseInt(month) - 1;
        const comparisons = sortedYears.map(year => {
          const item = rawItems.find(i => i.period === `${year}-${month}`);
          return {
            entityName: year,
            value: item ? (useAvg ? item.avgPerUser : item.totalCount) : 0,
            secondaryValue: isBothMode && item ? item.avgPerUser : undefined,
          };
        });
        return {
          name: MONTH_NAMES[monthIdx],
          value: comparisons[0]?.value ?? 0,
          comparisons,
        };
      })
      .filter(row => row.comparisons.some(c => c.value > 0));
  }, [rawItems, yearCompareMode, filters.xAxisMode, selectedYears, selectedMonths, useAvg, isBothMode]);

  const effectiveChartData  = yearCompareChartData ?? chartData;
  const effectiveIsComparison = yearCompareMode && yearCompareChartData != null ? true : isComparisonMode;

  const chartDataKey = `${effectiveIsComparison}-${filters.yAxisMode}-${filters.compareMode}-${yearCompareMode}`;

  // Periods that actually contributed production — used as the denominator
  // for averages and as the "Períodos Analisados" count so empty future
  // months left on the x-axis (e.g. Jun-Dec of the current year) don't drag
  // statistics down. They still render on the chart as empty slots.
  const periodsWithData = useMemo(
    () => items.filter(i => (i.totalCount ?? 0) > 0),
    [items],
  );

  const avgPerDisplayPeriod = useMemo(
    () => (periodsWithData.length
      ? periodsWithData.reduce((s, i) => s + i.totalCount, 0) / periodsWithData.length
      : 0),
    [periodsWithData],
  );

  // Mean of period-level avgPerUser values across periods that produced.
  // Uses periodsWithData (totalCount > 0) so the filter agrees with
  // every other summary metric and the "Períodos Analisados" card.
  const summaryAvgPerUser = useMemo(() => {
    if (!periodsWithData.length) return 0;
    return periodsWithData.reduce((s, i) => s + (i.avgPerUser ?? 0), 0) / periodsWithData.length;
  }, [periodsWithData]);

  // "Melhor Média" — the best (highest) avgPerUser across displayed periods.
  const bestAvgPerUser = useMemo(
    () => (items.length ? Math.max(...items.map(i => i.avgPerUser ?? 0)) : 0),
    [items],
  );

  // "Média de Colaboradores Efetivos" — mean of effective colaborador count per period.
  const avgActiveUsers = useMemo(() => {
    const periods = items.filter(i => (i.activeUsers ?? 0) > 0);
    if (!periods.length) return 0;
    return periods.reduce((s, i) => s + (i.activeUsers ?? 0), 0) / periods.length;
  }, [items]);

  // yAxisMode passed to the chart component
  const chartYAxisMode: YAxisMode = isBothMode ? 'both' : 'count';

  const valueFormatter = useCallback((value: number): string => {
    if (useAvg) return value.toFixed(2);
    return Math.round(value).toString();
  }, [useAvg]);

  const secondaryValueFormatter = useCallback((value: number) => value.toFixed(1), []);

  const handleChartClick = useCallback((dataIndex: number, name: string, seriesName: string) => {
    if (yearCompareChartData) {
      // In year-compare mode: seriesName = year (e.g. "2025"), name = month label (e.g. "Janeiro")
      const monthNum = MONTH_NAME_TO_NUM[name];
      if (monthNum && /^\d{4}$/.test(seriesName)) {
        const period = `${seriesName}-${monthNum}`;
        const raw = rawItems.find(i => i.period === period);
        setClickedPeriod({ period, label: `${name} ${seriesName}`, activeUsers: raw?.activeUsers });
      }
    } else {
      const item = items[dataIndex];
      if (item) setClickedPeriod({ period: item.period, label: item.periodLabel, activeUsers: item.activeUsers });
    }
  }, [yearCompareChartData, items, rawItems]);

  const maxPeriodCount = useMemo(
    () => (items.length ? Math.max(...items.map(i => i.totalCount)) : 0),
    [items],
  );

  // Label for the peak inside the "Pico de Produção" card title.
  // - year mode → "2026"
  // - month mode, single year selected → "Março"
  // - month mode, multiple years selected → "Março 2026"
  const peakLabel = useMemo(() => {
    if (!items.length || maxPeriodCount === 0) return '';
    const peak = items.find(i => i.totalCount === maxPeriodCount);
    if (!peak) return '';
    if (filters.xAxisMode === 'year') return peak.period; // "2026"
    const [yearPart, monthPart] = peak.period.split('-');
    const monthName = MONTH_NAMES[parseInt(monthPart, 10) - 1] ?? monthPart;
    return selectedYears.length > 1 ? `${monthName} ${yearPart}` : monthName;
  }, [items, maxPeriodCount, filters.xAxisMode, selectedYears]);

  const handleExportCSV = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const baseHeaders = ['Período', 'Total de Tarefas'];
      if (useAvg || isBothMode) baseHeaders.push('Colaboradores Ativos', 'Média/Colaborador');
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
      if (useAvg || isBothMode) headers.push('Colaboradores Ativos', 'Média/Colaborador');
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
      XLSX.utils.book_append_sheet(wb, ws, 'Produtividade');
      XLSX.writeFile(wb, `producao-tarefas-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`);
      toast.success('Planilha exportada com sucesso!');
    } catch {
      toast.error('Erro ao exportar planilha');
    }
  }, [items, isComparisonMode, useAvg, isBothMode, sectorColumns]);

  const handleExportPDF = useCallback(async () => {
    if (!chartData.length) { toast.error('Nenhum dado para exportar'); return; }
    const chartOption = chartHandleRef.current?.getOption();
    if (!chartOption) { toast.error('Gráfico ainda não está pronto'); return; }

    const toastId = toast.loading('Gerando PDF...');
    try {
      // Filter chips reproduced in the PDF header, matching the on-screen
      // description so the export is self-explanatory.
      const filterLines: string[] = [];
      filterLines.push(
        filters.xAxisMode === 'year' ? 'Agrupamento: Anos' : 'Agrupamento: Meses (26–25)',
      );
      if (selectedYears.length) filterLines.push(`Anos: ${[...selectedYears].sort().join(', ')}`);
      if (selectedMonths.length) filterLines.push(`Meses: ${selectedMonths.length} selecionados`);
      if (useAvg) filterLines.push('Métrica: Média/Colaborador');
      else if (isBothMode) filterLines.push('Métrica: Total + Média/Colaborador');
      if (isComparisonMode && sectorColumns.length) {
        filterLines.push(`Setores: ${sectorColumns.filter(c => c !== 'Ambos').join(', ')}`);
      }
      if (trendLine) {
        filterLines.push(`Tendência: ${TREND_LABELS[trendLine]}`);
      }
      if (goalValue != null) {
        filterLines.push(`Meta: ${goalValue}`);
      }

      const summaryStats: Array<{ label: string; value: string }> = [
        { label: 'Total Concluídas', value: formatNumber(summary?.totalCompleted ?? 0) },
        {
          label: `Média/${filters.xAxisMode === 'year' ? 'Ano' : 'Mês'}`,
          value: formatNumber(avgPerDisplayPeriod, 1),
        },
      ];
      if (useAvg || isBothMode) {
        summaryStats.push({ label: 'Média/Colaborador', value: summaryAvgPerUser.toFixed(2) });
      } else {
        summaryStats.push({ label: 'Pico', value: formatNumber(maxPeriodCount) });
      }
      summaryStats.push({ label: 'Períodos', value: String(periodsWithData.length) });

      await exportProductivityPdf({
        title: 'Produtividade',
        subtitle: 'Produção de Tarefas por Período',
        filterLines,
        chartOption,
        summaryStats,
        fileSuffix: 'produtividade',
      });

      toast.dismiss(toastId);
      toast.success('PDF exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      toast.dismiss(toastId);
      toast.error('Erro ao exportar PDF');
    }
  }, [chartData, filters, selectedYears, selectedMonths, useAvg, isBothMode, isComparisonMode, sectorColumns, summary, avgPerDisplayPeriod, summaryAvgPerUser, maxPeriodCount, periodsWithData, trendLine, goalValue]);

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
    if (!effectiveChartData.length) {
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
        ref={chartHandleRef}
        key={chartDataKey}
        data={effectiveChartData}
        chartType={effectiveChartType}
        yAxisMode={chartYAxisMode}
        isComparisonMode={effectiveIsComparison}
        height="min(720px, calc(100vh - 360px))"
        yAxisLabel={useAvg ? 'Média/Colaborador' : 'Tarefas Concluídas'}
        valueFormatter={valueFormatter}
        secondaryValueFormatter={secondaryValueFormatter}
        tooltipLabels={{
          primary:   isBothMode ? 'Total Tarefas' : (useAvg ? 'Média por Colaborador' : 'Tarefas Concluídas'),
          secondary: isBothMode ? 'Média/Colaborador' : undefined,
        }}
        trendLine={trendLine}
        goalLine={goalValue != null ? { value: goalValue, label: 'Meta' } : null}
        onDataPointClick={handleChartClick}
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
            { label: 'Produtividade' },
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
                    {isBothMode  && <Badge variant="outline"  className="text-xs">Total + Média/Colaborador</Badge>}
                    {useAvg      && <Badge variant="outline"  className="text-xs">Média/Colaborador</Badge>}
                    {isComparisonMode && (
                      <Badge variant="secondary" className="text-xs">
                        {filters.compareMode === 'separatedWithTotal' ? 'Comparação + Ambos' : 'Comparação Setores'}
                      </Badge>
                    )}
                    {yearCompareMode && (
                      <Badge variant="secondary" className="text-xs">Ano a Ano</Badge>
                    )}
                    {trendLine && (
                      <Badge variant="outline" className="text-xs">{TREND_LABELS[trendLine]}</Badge>
                    )}
                    {goalValue != null && (
                      <Badge variant="outline" className="text-xs">Meta: {goalValue}</Badge>
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

                  {/* Trend line selector */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant={trendLine ? 'default' : 'outline'} size="sm">
                        <IconTrendingUp className="h-4 w-4 mr-2" />
                        {trendLine ? TREND_LABELS[trendLine] : 'Tendência'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel>Linha de Tendência</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={trendLine ?? ''}
                        onValueChange={v => setTrendLine(v ? (v as TrendLineType) : null)}
                      >
                        <DropdownMenuRadioItem value="">Desativada</DropdownMenuRadioItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioItem value="linear">Linear</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma3">Média Móvel 3 meses</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma6">Média Móvel 6 meses</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma12">Média Móvel 12 meses</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Goal line */}
                  <Popover open={goalPopoverOpen} onOpenChange={setGoalPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant={goalValue != null ? 'default' : 'outline'} size="sm">
                        <IconTarget className="h-4 w-4 mr-2" />
                        {goalValue != null ? `Meta: ${goalValue}` : 'Meta'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-52">
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Definir Meta</p>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Ex: 100"
                          value={goalInput}
                          onChange={v => setGoalInput(v == null ? '' : String(v))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const v = parseFloat(goalInput);
                              setGoalValue(isNaN(v) ? null : v);
                              setGoalPopoverOpen(false);
                            }
                          }}
                          className="bg-transparent"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              const v = parseFloat(goalInput);
                              setGoalValue(isNaN(v) ? null : v);
                              setGoalPopoverOpen(false);
                            }}
                          >
                            Aplicar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setGoalValue(null);
                              setGoalInput('');
                              setGoalPopoverOpen(false);
                            }}
                          >
                            Limpar
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

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
                      {useAvg
                        ? `Média por Colaborador ao ${filters.xAxisMode === 'year' ? 'Ano' : 'Mês'}`
                        : `Média por ${filters.xAxisMode === 'year' ? 'Ano' : 'Mês'}`}
                    </CardTitle>
                    <IconCalendarStats className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading
                      ? <Skeleton className="h-7 w-20" />
                      : (
                        <div className="text-xl font-bold">
                          {useAvg
                            ? summaryAvgPerUser.toFixed(2)
                            : formatNumber(avgPerDisplayPeriod, 1)}
                        </div>
                      )
                    }
                  </CardContent>
                </Card>

                {/* 3rd and 4th cards vary by mode */}
                {(useAvg || isBothMode) ? (
                  <>
                    <Card className="py-2">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                        <CardTitle className="text-xs font-medium">Melhor Média</CardTitle>
                        <IconUsers className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="pb-0 px-4">
                        {isLoading
                          ? <Skeleton className="h-7 w-20" />
                          : <div className="text-xl font-bold">{bestAvgPerUser.toFixed(2)}</div>
                        }
                      </CardContent>
                    </Card>

                    <Card className="py-2">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                        <CardTitle className="text-xs font-medium">Média de Colaboradores Efetivos</CardTitle>
                        <IconBuilding className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="pb-0 px-4">
                        {isLoading
                          ? <Skeleton className="h-7 w-20" />
                          : <div className="text-xl font-bold">{formatNumber(avgActiveUsers, 1)}</div>
                        }
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <>
                    <Card className="py-2">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                        <CardTitle className="text-xs font-medium">
                          Pico de Produção{peakLabel ? ` (${peakLabel})` : ''}
                        </CardTitle>
                        <IconTrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="pb-0 px-4">
                        {isLoading
                          ? <Skeleton className="h-7 w-20" />
                          : <div className="text-xl font-bold">{formatNumber(maxPeriodCount)}</div>
                        }
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
                          : <div className="text-xl font-bold">{formatNumber(periodsWithData.length)}</div>
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

            </CardContent>
          </Card>

          <TaskProductionFiltersSheet
            open={showFilters}
            onOpenChange={setShowFilters}
            filters={filters}
            selectedYears={selectedYears}
            selectedMonths={selectedMonths}
            yearCompareMode={yearCompareMode}
            onApply={handleFilterApply}
          />
        </div>
      </div>

      {clickedPeriod && (
        <ProductionPeriodTasksModal
          open={!!clickedPeriod}
          onOpenChange={open => { if (!open) setClickedPeriod(null); }}
          period={clickedPeriod.period}
          label={clickedPeriod.label}
          sectorIds={filters.sectorIds}
          activeUsers={clickedPeriod.activeUsers}
        />
      )}
    </div>
  );
};

export const ProductionProductivityStatisticsPage = () => <TaskProductionPage />;
export default ProductionProductivityStatisticsPage;
