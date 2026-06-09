// web/src/pages/production/statistics/productivity.tsx

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterDrawer } from '@/components/common/filters/ui/FilterDrawer';
import { Combobox } from '@/components/ui/combobox';
import { GOAL_METRIC, routes, SECTOR_PRIVILEGES, COMMISSION_STATUS } from '@/constants';
import { COMMISSION_STATUS_LABELS } from '@/constants/enum-labels';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useTaskProductionStats } from '@/hooks/production/use-production-analytics';
import { useDefaultGoal } from '@/hooks/administration/use-default-goal';
import { useActiveProductionUserCount } from '@/hooks/administration/use-active-production-user-count';
import { countWorkingDays } from '@/utils/business-days';
import { getBusinessPeriodsInRange } from '@/utils/bonus';
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
import { formatNumber, CHART_COLORS } from '@/types/statistics-common';
import type { YAxisMode, StatisticsChartType, TrendLineType } from '@/types/statistics-common';
import { getSectors } from '@/api-client/sector';
import { getUsers } from '@/api-client/user';
import { sectorKeys, userKeys } from '@/hooks/common/query-keys';
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
import { z } from 'zod';
import { useStatisticsPagePersistence } from '@/hooks/common/use-statistics-page-persistence';
import { StatisticsPresetsMenu } from '@/components/statistics/statistics-presets-menu';

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

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => {
  const d = String(i + 1).padStart(2, '0');
  return { value: d, label: d };
});

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
  { value: 'day',   label: 'Dias' },
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
  _xAxisMode: TaskProductionXAxisMode = 'month',
): { startDate?: Date; endDate?: Date } {
  if (!years.length) return {};
  const yearNums = years.map(Number).sort((a, b) => a - b);
  const minY = yearNums[0];
  const maxY = yearNums[yearNums.length - 1];

  // All modes (month, year, day) share the same business-period date range —
  // month M of year Y covers day 26 of M-1 through day 25 of M. Day mode
  // shows each calendar day inside that window (e.g. Apr 26 .. May 25 for
  // month=Maio), matching the bônus timeline rather than calendar May 1..31.
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
// Page config persistence (last-seen config + named presets)
// =====================
//
// Plain-JSON snapshot of every user-configurable knob on this page. Dates and
// the derived startDate/endDate/bonusPeriod* fields are intentionally NOT
// persisted — only the source inputs (selectedYears/Months/Days, axis modes)
// are stored, and applyPageConfig rebuilds `filters` exactly the way the
// sheet's Apply handler does. Per-field `.catch()` keeps stale stored configs
// from ever breaking the page; goal/modal state is session-only by design.
const pageConfigSchema = z.object({
  version: z.literal(1).catch(1),
  chartType: z
    .enum(['bar', 'bar-stacked', 'line', 'line-smooth', 'line-stacked', 'area', 'area-smooth'])
    .catch('bar'),
  primaryChartType: z.enum(['bar', 'line', 'line-smooth', 'area', 'area-smooth']).catch('bar'),
  secondaryChartType: z.enum(['bar', 'line', 'line-smooth', 'area', 'area-smooth']).catch('line'),
  trendLine: z.enum(['linear', 'sma3', 'sma6', 'sma12']).nullable().catch(null),
  yearCompareMode: z.boolean().catch(false),
  selectedYears: z.array(z.string()).catch([]),
  selectedMonths: z.array(z.string()).catch([]),
  selectedDays: z.array(z.string()).catch([]),
  xAxisMode: z.enum(['day', 'month', 'year']).catch('month'),
  yAxisMode: z.enum(['count', 'avgPerUser', 'both']).catch('count'),
  compareMode: z.enum(['combined', 'separated', 'separatedWithTotal']).catch('combined'),
  sectorIds: z.array(z.string()).catch([]),
  commissionStatuses: z.array(z.string()).catch([]),
  userIds: z.array(z.string()).catch([]),
});

type PageConfig = z.infer<typeof pageConfigSchema>;

// =====================
// Filter Sheet
// =====================

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: TaskProductionFilters;
  selectedYears: string[];
  selectedMonths: string[];
  selectedDays: string[];
  yearCompareMode: boolean;
  onApply: (filters: TaskProductionFilters, years: string[], months: string[], days: string[], yearCompare: boolean) => void;
}

const COMMISSION_OPTIONS = Object.values(COMMISSION_STATUS).map(v => ({
  value: v,
  label: COMMISSION_STATUS_LABELS[v],
}));

function TaskProductionFiltersSheet({
  open, onOpenChange, filters, selectedYears, selectedMonths, selectedDays, yearCompareMode, onApply,
}: FilterSheetProps) {
  const [localX, setLocalX]     = useState<TaskProductionXAxisMode>(filters.xAxisMode || 'month');
  const [localY, setLocalY]     = useState<TaskProductionYAxisMode>(filters.yAxisMode || 'count');
  const [localCmp, setLocalCmp] = useState<TaskProductionCompareMode>(filters.compareMode || 'combined');
  const [localSectors, setLocalSectors]         = useState<string[]>(filters.sectorIds || []);
  const [localYears, setLocalYears]             = useState<string[]>(selectedYears);
  const [localMonths, setLocalMonths]           = useState<string[]>(selectedMonths);
  const [localDays, setLocalDays]               = useState<string[]>(selectedDays);
  const [localYearCompare, setLocalYearCompare] = useState(yearCompareMode);
  const [localCommissions, setLocalCommissions] = useState<string[]>(filters.commissionStatuses || []);
  const [localUserIds, setLocalUserIds]         = useState<string[]>(filters.userIds || []);

  useEffect(() => {
    if (open) {
      setLocalX(filters.xAxisMode || 'month');
      setLocalY(filters.yAxisMode || 'count');
      setLocalCmp(filters.compareMode || 'combined');
      setLocalSectors(filters.sectorIds || []);
      setLocalYears(selectedYears);
      setLocalMonths(selectedMonths);
      setLocalDays(selectedDays);
      setLocalYearCompare(yearCompareMode);
      setLocalCommissions(filters.commissionStatuses || []);
      setLocalUserIds(filters.userIds || []);
    }
  }, [open, filters, selectedYears, selectedMonths, selectedDays, yearCompareMode]);

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

  const fetchUsers = useCallback(async (search: string, page = 1) => {
    const res = await getUsers({ where: { isActive: true }, search: search || undefined, page, limit: COMBOBOX_PAGE_SIZE });
    return {
      data: (res.data || []).map((u: any) => ({ value: u.id, label: u.name })),
      hasMore: res.meta?.hasNextPage || false,
    };
  }, []);

  // 'both' mode shows two metrics on one chart — sector comparison not applicable
  useEffect(() => {
    if (localY === 'both' && localSectors.length > 0) setLocalSectors([]);
  }, [localY, localSectors.length]);

  const canCompare = localSectors.length >= 2 && localY !== 'both';

  const handleApply = useCallback(() => {
    const { startDate, endDate } = computeDateRange(localYears, localMonths, localX);
    // Canonical bonus-period inputs: when years are picked, ALSO send year +
    // months so the backend can compute the exact window via the same helpers
    // bonus uses. Eliminates browser-TZ vs server-TZ drift at the boundaries.
    // For multi-year selections we fall back to startDate/endDate only —
    // bonusPeriodYear is single-year by design (mirrors the bonus endpoint).
    const singleYear = localYears.length === 1 ? Number(localYears[0]) : undefined;
    const bonusPeriodMonths = singleYear !== undefined && localMonths.length > 0
      ? localMonths.map(m => Number(m))
      : undefined;
    const finalFilters: TaskProductionFilters = {
      startDate,
      endDate,
      bonusPeriodYear: singleYear,
      bonusPeriodMonths,
      xAxisMode: localX,
      yAxisMode: localY,
      compareMode: canCompare ? localCmp : 'combined',
      sectorIds: localSectors.length > 0 ? localSectors : undefined,
      commissionStatuses: localCommissions.length > 0 ? localCommissions : undefined,
      userIds: localUserIds.length > 0 ? localUserIds : undefined,
    };
    const daysOut = localX === 'day' ? localDays : [];
    const yearCompare = localYears.length >= 2 && localX === 'month' ? localYearCompare : false;
    onApply(finalFilters, localYears, localMonths, daysOut, yearCompare);
    onOpenChange(false);
  }, [localX, localY, localCmp, localSectors, localYears, localMonths, localDays, localYearCompare, localCommissions, localUserIds, canCompare, onApply, onOpenChange]);

  const handleClear = useCallback(() => {
    setLocalX('month');
    setLocalY('count');
    setLocalCmp('combined');
    setLocalSectors([]);
    setLocalYears([]);
    setLocalMonths([]);
    setLocalDays([]);
    setLocalCommissions([]);
    setLocalUserIds([]);
  }, []);

  const activeCount = [localSectors.length > 0, localYears.length > 0, localCommissions.length > 0, localUserIds.length > 0].filter(Boolean).length;

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Configure o período, métricas e setores para análise"
      activeFilterCount={activeCount}
      onApply={handleApply}
      onReset={handleClear}
      applyLabel="Aplicar"
      resetLabel="Limpar"
    >

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
                    : localX === 'day'
                      ? `Exibe os dias dos anos: ${localYears.sort().join(', ')}`
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

            {/* Day filter — only when grouping by day */}
            {localX === 'day' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconCalendarStats className="h-4 w-4" />
                  Dias
                </Label>
                <Combobox
                  mode="multiple"
                  value={localDays}
                  onValueChange={v => setLocalDays(Array.isArray(v) ? v : v ? [v] : [])}
                  options={DAY_OPTIONS}
                  placeholder="Todos os dias..."
                  searchPlaceholder="Buscar dia..."
                  emptyText="Nenhum dia"
                  searchable={true}
                  clearable={true}
                />
                <p className="text-xs text-muted-foreground">
                  {localDays.length === 0
                    ? 'Sem seleção → todos os dias dos meses/anos selecionados'
                    : `Exibe apenas dia${localDays.length === 1 ? '' : 's'}: ${localDays.sort().join(', ')}`}
                </p>
              </div>
            )}

            {/* Year-over-year comparison toggle — only when 2+ years and month mode */}
            {localYears.length >= 2 && localX === 'month' && (
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

            {/* Commission status filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconCheckbox className="h-4 w-4" />
                Status de Comissão
              </Label>
              <Combobox
                mode="multiple"
                value={localCommissions}
                onValueChange={v => setLocalCommissions(Array.isArray(v) && v.length > 0 ? v : [])}
                options={COMMISSION_OPTIONS}
                placeholder="Todos os status..."
                searchable={false}
                clearable={true}
              />
              <p className="text-xs text-muted-foreground">
                Filtra tarefas pelo status de comissão. Sem seleção = todos.
              </p>
            </div>

            {/* Collaborator (user) filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconUsers className="h-4 w-4" />
                Colaborador
              </Label>
              <Combobox
                mode="multiple"
                async
                value={localUserIds}
                onValueChange={v => setLocalUserIds(Array.isArray(v) && v.length > 0 ? v : [])}
                queryKey={[...userKeys.lists()]}
                queryFn={fetchUsers}
                minSearchLength={0}
                placeholder="Todos os colaboradores..."
                searchPlaceholder="Buscar colaborador..."
                emptyText="Nenhum colaborador encontrado"
                loadingText="Carregando..."
                searchable={true}
                clearable={true}
              />
              <p className="text-xs text-muted-foreground">
                Filtra por quem registrou a tarefa. Sem seleção = todos.
              </p>
            </div>
    </FilterDrawer>
  );
}

// =====================
// Main Page
// =====================

const TaskProductionPage = () => {
  usePageTracker({ page: 'production-productivity-statistics', title: 'Produtividade' });

  const [showFilters, setShowFilters] = useState(false);

  const [chartType, setChartType] = useState<TaskProductionChartType>('bar');
  // Independent chart types for the primary and secondary series in both-mode.
  const [primaryChartType, setPrimaryChartType] = useState<'bar' | 'line' | 'line-smooth' | 'area' | 'area-smooth'>('bar');
  const [secondaryChartType, setSecondaryChartType] = useState<'bar' | 'line' | 'line-smooth' | 'area' | 'area-smooth'>('line');
  const [trendLine, setTrendLine] = useState<TrendLineType | null>(null);
  // `goalOverride` is the value the user typed in the popover. Null means
  // "use the admin-configured default from the goals feature". See useDefaultGoal below.
  const [goalOverride, setGoalOverride] = useState<number | null>(null);
  const [goalInput, setGoalInput] = useState('');
  const [goalPopoverOpen, setGoalPopoverOpen] = useState(false);
  const [yearCompareMode, setYearCompareMode] = useState(false);
  const [clickedPeriod, setClickedPeriod] = useState<{ period: string; label: string; activeUsers?: number } | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartHandleRef = useRef<StatisticsChartHandle>(null);

  const [filters, setFilters] = useState<TaskProductionFilters>(() => {
    const y = new Date().getFullYear();
    const { startDate, endDate } = computeDateRange([y.toString()], [], 'month');
    return {
      xAxisMode: 'month',
      yAxisMode: 'count',
      compareMode: 'combined',
      startDate,
      endDate,
      // Canonical input: backend computes the exact window via the same
      // helpers bonus uses. Browser-TZ drift no longer affects boundaries.
      bonusPeriodYear: y,
    };
  });

  const [selectedYears, setSelectedYears]   = useState<string[]>(() => [new Date().getFullYear().toString()]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedDays, setSelectedDays]     = useState<string[]>([]);

  // ── Page config persistence (auto-restore last config + named presets) ──
  //
  // We persist only the SOURCE inputs (axis modes, year/month/day selections,
  // entity filters). The derived startDate/endDate/bonusPeriod* are rebuilt in
  // applyPageConfig the same way the sheet's handleApply does.
  const pageConfig = useMemo<PageConfig>(() => ({
    version: 1,
    chartType,
    primaryChartType,
    secondaryChartType,
    trendLine,
    yearCompareMode,
    selectedYears,
    selectedMonths,
    selectedDays,
    xAxisMode: (filters.xAxisMode ?? 'month') as PageConfig['xAxisMode'],
    yAxisMode: (filters.yAxisMode ?? 'count') as PageConfig['yAxisMode'],
    compareMode: (filters.compareMode ?? 'combined') as PageConfig['compareMode'],
    sectorIds: filters.sectorIds ?? [],
    commissionStatuses: filters.commissionStatuses ?? [],
    userIds: filters.userIds ?? [],
  }), [chartType, primaryChartType, secondaryChartType, trendLine, yearCompareMode, selectedYears, selectedMonths, selectedDays, filters]);

  const applyPageConfig = useCallback((config: PageConfig) => {
    // An empty selectedYears would drop the page to the "últimos 12 períodos"
    // default; restore the page default (current year) instead.
    const years = config.selectedYears.length ? config.selectedYears : [new Date().getFullYear().toString()];
    const months = config.selectedMonths;
    const days = config.xAxisMode === 'day' ? config.selectedDays : [];

    // Rebuild filters exactly like the sheet's handleApply.
    const { startDate, endDate } = computeDateRange(years, months, config.xAxisMode);
    const singleYear = years.length === 1 ? Number(years[0]) : undefined;
    const bonusPeriodMonths = singleYear !== undefined && months.length > 0
      ? months.map(m => Number(m))
      : undefined;
    setFilters({
      startDate,
      endDate,
      bonusPeriodYear: singleYear,
      bonusPeriodMonths,
      xAxisMode: config.xAxisMode,
      yAxisMode: config.yAxisMode,
      compareMode: config.compareMode,
      sectorIds: config.sectorIds.length ? config.sectorIds : undefined,
      commissionStatuses: config.commissionStatuses.length ? config.commissionStatuses : undefined,
      userIds: config.userIds.length ? config.userIds : undefined,
    });
    setSelectedYears(years);
    setSelectedMonths(months);
    setSelectedDays(days);
    setYearCompareMode(years.length >= 2 && config.xAxisMode === 'month' ? config.yearCompareMode : false);
    setChartType(config.chartType);
    setPrimaryChartType(config.primaryChartType);
    setSecondaryChartType(config.secondaryChartType);
    setTrendLine(config.trendLine);
  }, []);

  const {
    presets,
    activePreset,
    savePreset,
    applyPreset,
    overwritePreset,
    renamePreset,
    deletePreset,
    isSavingPreset,
  } = useStatisticsPagePersistence({
    pageKey: routes.statistics.production.productivity,
    schema: pageConfigSchema,
    current: pageConfig,
    apply: applyPageConfig,
  });

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

  // Disable year-compare when not enough years or outside month mode
  useEffect(() => {
    if (filters.xAxisMode !== 'month' || selectedYears.length < 2) {
      setYearCompareMode(false);
    }
  }, [filters.xAxisMode, selectedYears.length]);

  // A goal override set for one metric (e.g. 100 tasks) is meaningless after
  // switching to a different scale (e.g. 2.36 tasks/colaborador). Clearing the
  // override falls back to the admin-configured default for the new metric.
  useEffect(() => {
    setGoalOverride(null);
    setGoalInput('');
  }, [filters.yAxisMode]);


  // Year mode is aggregated client-side from monthly data; day mode goes
  // straight through to the API which returns YYYY-MM-DD periods.
  const apiFilters = useMemo(
    () => ({
      ...filters,
      xAxisMode: filters.xAxisMode === 'day' ? ('day' as const) : ('month' as const),
    }),
    [filters],
  );

  const { data, isLoading, isError, error, refetch } = useTaskProductionStats(apiFilters);
  const rawItems: TaskProductionItem[] = data?.data?.items || [];
  const summary = data?.data?.summary;

  // Two user counts: the COMPANY total (denominator of the "tasks per user"
  // ratio implicit in the goal) and the FILTERED count (the subset of users
  // whose tasks the chart is currently showing). The goal-line needs to
  // rescale by filtered/total so the meta matches the chart's actual scope.
  const hasSectorFilter = (filters.sectorIds?.length ?? 0) > 0;
  const { count: totalProductionUserCount } = useActiveProductionUserCount({
    enabled: useAvg || isBothMode || hasSectorFilter,
  });
  const { count: filteredProductionUserCount } = useActiveProductionUserCount({
    sectorIds: filters.sectorIds,
    enabled: hasSectorFilter,
  });

  // When the x-axis is days, spread the monthly goal across the WORKING days
  // of the bonus periods in the range (excludes Saturdays and Sundays). For
  // the typical full-month view this is ~22 working days. Computed from the
  // actual filter range so multi-month and partial selections stay accurate.
  // Falls back to 22 when the range isn't yet known (initial render).
  const workingDaysInRange = useMemo(() => {
    if (!filters.startDate || !filters.endDate) return 22;
    const n = countWorkingDays(filters.startDate, filters.endDate);
    return n > 0 ? n : 22;
  }, [filters.startDate, filters.endDate]);

  // How many bonus periods (months) the range spans. The bonus period closing
  // on day 25 of month M is referenced as month M, so a range Apr-26 → May-25
  // is ONE period (May), not two calendar months. Use the same enumerator
  // useDefaultGoal uses internally to stay consistent.
  const periodCount = useMemo(() => {
    if (!filters.startDate || !filters.endDate) return 1;
    return Math.max(1, getBusinessPeriodsInRange(filters.startDate, filters.endDate).length);
  }, [filters.startDate, filters.endDate]);

  const workingDaysPerPeriod = workingDaysInRange / periodCount;

  // The goal aggregation depends on what each chart bar represents:
  // - xAxisMode='month' or 'day' → start from per-month average. For 'day' we
  //   further divide by AVG_DAYS_PER_PERIOD via scaleBy below.
  // - xAxisMode='year' → one bar per year (12 months summed) → annual TOTAL.
  // For avgPerUser charts we use AVERAGE_PER_USER which the hook implements as
  // (per-period avg / activeUserCount), matching what each bar shows.
  const periodAggregation = useAvg
    ? 'AVERAGE_PER_USER'
    : filters.xAxisMode === 'year'
      ? 'TOTAL'
      : 'AVERAGE_PER_PERIOD';

  // scaleBy composes two transforms:
  //   1. Sector slice — when filtered, rescale company-wide goal by
  //      filtered_users / total_users so the line matches the bars' scope.
  //      Skipped in avgPerUser mode (the per-user formula already normalises).
  //   2. Day spread — when the x-axis is days, divide the per-month value by
  //      AVG_DAYS_PER_PERIOD so each daily bar can be compared to a single
  //      day's expected share of the monthly target.
  const scaleBy = useMemo(() => {
    let num: number | null = null;
    let denom: number | null = null;

    if (hasSectorFilter && !useAvg) {
      num = filteredProductionUserCount;
      denom = totalProductionUserCount;
    }

    if (filters.xAxisMode === 'day') {
      if (num == null) {
        num = 1;
        denom = workingDaysPerPeriod;
      } else if (denom != null) {
        denom = denom * workingDaysPerPeriod;
      }
    }

    if (num == null || denom == null || denom <= 0) return null;
    return { numerator: num, denominator: denom };
  }, [hasSectorFilter, useAvg, filteredProductionUserCount, totalProductionUserCount, filters.xAxisMode, workingDaysPerPeriod]);

  const defaultGoalRaw = useDefaultGoal({
    metric: GOAL_METRIC.TASKS_COMPLETED,
    period:
      filters.startDate && filters.endDate
        ? { from: filters.startDate, to: filters.endDate }
        : null,
    aggregation: periodAggregation,
    // For avgPerUser: when no sector filter, use total production count; when
    // filtered, use the filtered count so the line tracks "tasks per user
    // inside the filtered scope".
    activeUserCount: useAvg
      ? hasSectorFilter
        ? filteredProductionUserCount
        : totalProductionUserCount
      : null,
    scaleBy,
    // Year-over-year comparison shows two series with different scales; a
    // single default goal-line doesn't fit.
    enabled: !yearCompareMode,
  });

  // In day-mode the goal-line value comes from dividing a monthly target by
  // working days (e.g. 65 / 21 ≈ 3.1). Daily task counts can't be fractional,
  // and the y-axis only renders at integer gridlines, so a 3.1 line floats
  // above the y=3 gridline and the column tops — perceived as misaligned.
  // Snap to the nearest integer in count mode for clean visual alignment;
  // avgPerUser stays decimal because per-user values are intrinsically so.
  const defaultGoal = useMemo(() => {
    if (defaultGoalRaw.value == null) return defaultGoalRaw;
    if (filters.xAxisMode === 'day' && !useAvg) {
      return { ...defaultGoalRaw, value: Math.round(defaultGoalRaw.value) };
    }
    return defaultGoalRaw;
  }, [defaultGoalRaw, filters.xAxisMode, useAvg]);

  // In separated comparison mode each bar represents ONE sector, so a
  // company-wide goal (say 65 tasks/period) needs to be divided across the
  // sectors being compared (65 / 2 = 32.5 per sector) — otherwise every
  // single-sector bar would look catastrophically under-performing. avgPerUser
  // stays unsplit: it's already a per-user rate.
  const goalSectorSplit = useMemo(() => {
    if (!isComparisonMode || useAvg) return 1;
    const n = filters.sectorIds?.length ?? 0;
    return n > 0 ? n : 1;
  }, [isComparisonMode, useAvg, filters.sectorIds]);

  const goalValue = useMemo(() => {
    const raw = goalOverride ?? defaultGoal.value;
    if (raw == null) return null;
    if (goalSectorSplit <= 1) return raw;
    const split = raw / goalSectorSplit;
    // Day-mode count goals stay integer for visual alignment with the y-axis.
    return filters.xAxisMode === 'day' && !useAvg ? Math.round(split) : split;
  }, [goalOverride, defaultGoal.value, goalSectorSplit, filters.xAxisMode, useAvg]);

  const goalSource: 'override' | 'default' | 'none' =
    goalOverride != null ? 'override' : defaultGoal.value != null ? 'default' : 'none';

  // Second goal for "both" mode — tracks Tarefas por colaborador ativo on the
  // right Y-axis. The TASKS_PER_ACTIVE_USER metric is already a per-user rate,
  // so use AVERAGE_PER_PERIOD (not AVERAGE_PER_USER which would divide again).
  const avgPerUserGoalRaw = useDefaultGoal({
    metric: GOAL_METRIC.TASKS_PER_ACTIVE_USER,
    period:
      filters.startDate && filters.endDate
        ? { from: filters.startDate, to: filters.endDate }
        : null,
    aggregation: 'AVERAGE_PER_PERIOD',
    enabled: isBothMode && !yearCompareMode,
  });

  // Client-side filter + optional year aggregation
  const items = useMemo(() => {
    if (!rawItems.length) return rawItems;

    const hasYearFilter  = selectedYears.length > 0;
    const hasMonthFilter = selectedMonths.length > 0;
    const hasDayFilter   = selectedDays.length > 0;

    if (filters.xAxisMode === 'day') {
      // Day mode: items have YYYY-MM-DD periods. The year/month filters
      // operate in BUSINESS-PERIOD terms (day 26 → 25), so a daily item must
      // be mapped to its business month/year before comparing — otherwise
      // Apr 26-30 would be excluded when "Maio" is selected, even though they
      // belong to the business period Maio. The day filter compares the
      // calendar day-of-month verbatim.
      if (!hasYearFilter && !hasMonthFilter && !hasDayFilter) return rawItems;
      return rawItems.filter(item => {
        const [yearStr, monthStr, dayStr] = item.period.split('-');
        const d = parseInt(dayStr, 10);
        let bizYear  = parseInt(yearStr, 10);
        let bizMonth = parseInt(monthStr, 10);
        if (d > 25) {
          bizMonth++;
          if (bizMonth > 12) { bizMonth = 1; bizYear++; }
        }
        const bizYearStr  = String(bizYear);
        const bizMonthStr = String(bizMonth).padStart(2, '0');
        return (!hasYearFilter  || selectedYears.includes(bizYearStr)) &&
               (!hasMonthFilter || selectedMonths.includes(bizMonthStr)) &&
               (!hasDayFilter   || selectedDays.includes(dayStr));
      });
    }

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
  }, [rawItems, filters.xAxisMode, selectedYears, selectedMonths, selectedDays]);

  // Per-period goal values for stepped goal line — must come AFTER `items` since
  // it maps over the filtered+processed items array. Only applies when no
  // override is set (override is a flat scalar, not a per-period schedule).
  //
  // In avgPerUser mode the chart bars are per-user rates (e.g. 2.76 tasks/user
  // per month), so the goal line MUST be divided by each period's active user
  // count too — otherwise the line plots raw monthly task targets (45, 65, …)
  // on a per-user-rate axis and dwarfs the bars. Uses `item.activeUsers` which
  // comes from the same API as the bar values, keeping numerator/denominator
  // consistent per period.
  const perPeriodGoalValues = useMemo(() => {
    if (goalOverride != null || yearCompareMode || !defaultGoalRaw.perPeriodValues) return null;
    return items.map(item => {
      let rawSum: number | null;
      if (filters.xAxisMode === 'year') {
        // item.period = "2026"; aggregate all months for that year
        let total = 0; let hasAny = false;
        for (let m = 1; m <= 12; m++) {
          const key = `${item.period}-${String(m).padStart(2, '0')}`;
          const v = defaultGoalRaw.perPeriodValues!.get(key);
          if (v != null) { total += v; hasAny = true; }
        }
        rawSum = hasAny ? total : null;
      } else {
        rawSum = defaultGoalRaw.perPeriodValues!.get(item.period) ?? null;
      }
      if (rawSum == null) return null;
      let val = rawSum;
      if (scaleBy?.numerator != null && scaleBy.denominator != null && scaleBy.denominator > 0) {
        val = val * (scaleBy.numerator / scaleBy.denominator);
      }
      if (goalSectorSplit > 1) val = val / goalSectorSplit;
      if (useAvg) {
        const activeUsers = item.activeUsers ?? 0;
        if (activeUsers <= 0) return null;
        val = val / activeUsers;
      }
      if (filters.xAxisMode === 'day' && !useAvg) val = Math.round(val);
      return val;
    });
  }, [goalOverride, yearCompareMode, defaultGoalRaw.perPeriodValues, items, scaleBy, goalSectorSplit, filters.xAxisMode, useAvg]);

  // Per-period goal line for the secondary (avg/user) series on the right axis.
  // TASKS_PER_ACTIVE_USER is already a per-user rate, so year-mode averages
  // monthly values instead of summing them.
  const perPeriodSecondaryGoalValues = useMemo(() => {
    if (!isBothMode || yearCompareMode || !avgPerUserGoalRaw.perPeriodValues) return null;
    return items.map(item => {
      if (filters.xAxisMode === 'year') {
        let total = 0; let count = 0;
        for (let m = 1; m <= 12; m++) {
          const key = `${item.period}-${String(m).padStart(2, '0')}`;
          const v = avgPerUserGoalRaw.perPeriodValues!.get(key);
          if (v != null) { total += v; count++; }
        }
        return count > 0 ? total / count : null;
      }
      return avgPerUserGoalRaw.perPeriodValues!.get(item.period) ?? null;
    });
  }, [isBothMode, yearCompareMode, avgPerUserGoalRaw.perPeriodValues, items, filters.xAxisMode]);

  const handleFilterApply = useCallback((f: TaskProductionFilters, years: string[], months: string[], days: string[], yearCompare: boolean) => {
    setFilters(f);
    setSelectedYears(years);
    setSelectedMonths(months);
    setSelectedDays(days);
    setYearCompareMode(yearCompare);
  }, []);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.sectorIds?.length) c++;
    if (selectedYears.length) c++;
    if (selectedMonths.length) c++;
    if (selectedDays.length) c++;
    if (filters.xAxisMode !== 'month') c++;
    if (filters.yAxisMode !== 'count') c++;
    if (filters.commissionStatuses?.length) c++;
    if (filters.userIds?.length) c++;
    return c;
  }, [filters, selectedYears, selectedMonths, selectedDays]);

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

  // sectorId → bar color. Mirrors statistics-chart.tsx's per-comparison color
  // assignment so the task name tints in the drill-down modal match the bars
  // the user just clicked.
  const sectorColorMap = useMemo<Record<string, string> | undefined>(() => {
    if (!isComparisonMode || !items.length || !items[0].comparisons) return undefined;
    const map: Record<string, string> = {};
    const active = items[0].comparisons.filter(c => activeSectorIds.has(c.sectorId));
    active.forEach((c, i) => {
      map[c.sectorId] = CHART_COLORS[i % CHART_COLORS.length];
    });
    return map;
  }, [isComparisonMode, items, activeSectorIds]);

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

  // Year-over-year comparison: x = month name, series = one per year. Only
  // applies in month mode — year/day modes have nothing to compare side-by-side.
  const yearCompareChartData = useMemo(() => {
    if (!yearCompareMode || filters.xAxisMode !== 'month' || selectedYears.length < 2) return null;
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
    // Day-mode values are derived from a monthly goal divided by working days,
    // so they're rarely whole numbers. Show one decimal so the chart's goal
    // label matches its drawn position between y-axis integer gridlines.
    if (filters.xAxisMode === 'day') return value.toFixed(1);
    return Math.round(value).toString();
  }, [useAvg, filters.xAxisMode]);

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
  // - day mode → the server-formatted "14 Mai 2026" (strip year if single)
  const peakLabel = useMemo(() => {
    if (!items.length || maxPeriodCount === 0) return '';
    const peak = items.find(i => i.totalCount === maxPeriodCount);
    if (!peak) return '';
    if (filters.xAxisMode === 'year') return peak.period; // "2026"
    if (filters.xAxisMode === 'day') {
      return selectedYears.length > 1
        ? peak.periodLabel
        : peak.periodLabel.replace(/\s+\d{4}\s*$/, '').trim();
    }
    const [yearPart, monthPart] = peak.period.split('-');
    const monthName = MONTH_NAMES[parseInt(monthPart, 10) - 1] ?? monthPart;
    return selectedYears.length > 1 ? `${monthName} ${yearPart}` : monthName;
  }, [items, maxPeriodCount, filters.xAxisMode, selectedYears]);

  // Drill-down handlers for summary cards. Pico opens the modal scoped to the
  // peak period; Total Concluídas opens a year-level rollup when a single year
  // is selected (the modal already accepts "YYYY" as a period).
  const peakItem = useMemo(
    () => (items.length && maxPeriodCount > 0 ? items.find(i => i.totalCount === maxPeriodCount) ?? null : null),
    [items, maxPeriodCount],
  );

  const openPeakPeriod = useCallback(() => {
    if (!peakItem) return;
    setClickedPeriod({ period: peakItem.period, label: peakItem.periodLabel, activeUsers: peakItem.activeUsers });
  }, [peakItem]);

  // For "Total Concluídas": when a single year is selected and we're showing
  // months, open the year-level rollup. Otherwise drill into the most-recent
  // active period — gives some meaningful navigation without inventing
  // synthetic ranges the modal can't represent.
  const openTotalDrilldown = useCallback(() => {
    if (filters.xAxisMode !== 'year' && selectedYears.length === 1) {
      const y = selectedYears[0];
      setClickedPeriod({ period: y, label: y, activeUsers: undefined });
      return;
    }
    const sortedActive = [...periodsWithData].sort((a, b) => b.period.localeCompare(a.period));
    const target = sortedActive[0];
    if (target) setClickedPeriod({ period: target.period, label: target.periodLabel, activeUsers: target.activeUsers });
  }, [filters.xAxisMode, selectedYears, periodsWithData]);

  const canDrillPeak  = !!peakItem;
  const canDrillTotal = (summary?.totalCompleted ?? 0) > 0 && (
    (filters.xAxisMode !== 'year' && selectedYears.length === 1) || periodsWithData.length > 0
  );

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
        filters.xAxisMode === 'year' ? 'Agrupamento: Anos' :
        filters.xAxisMode === 'day'  ? 'Agrupamento: Dias (26–25)' :
        'Agrupamento: Meses (26–25)',
      );
      if (selectedYears.length) filterLines.push(`Anos: ${[...selectedYears].sort().join(', ')}`);
      if (selectedMonths.length) filterLines.push(`Meses: ${selectedMonths.length} selecionados`);
      if (selectedDays.length) filterLines.push(`Dias: ${[...selectedDays].sort().join(', ')}`);
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
          label: `Média/${
            filters.xAxisMode === 'year' ? 'Ano' :
            filters.xAxisMode === 'day'  ? 'Dia' :
            'Mês'
          }`,
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
  }, [chartData, filters, selectedYears, selectedMonths, selectedDays, useAvg, isBothMode, isComparisonMode, sectorColumns, summary, avgPerDisplayPeriod, summaryAvgPerUser, maxPeriodCount, periodsWithData, trendLine, goalValue]);

  const renderChart = () => {
    if (isLoading) {
      return (
        <div style={{ height: '100%' }} className="flex items-center justify-center">
          <div className="space-y-3 w-full px-8">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-[380px] w-full" />
          </div>
        </div>
      );
    }
    if (isError) {
      return (
        <div style={{ height: '100%' }} className="flex flex-col items-center justify-center gap-4">
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
        <div style={{ height: '100%' }} className="flex flex-col items-center justify-center gap-4">
          <IconCalendarStats className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-semibold">Nenhum dado encontrado</p>
            <p className="text-sm text-muted-foreground">Ajuste os filtros para visualizar os dados</p>
          </div>
        </div>
      );
    }
    const hasPerPeriodGoal = perPeriodGoalValues && perPeriodGoalValues.some(v => v != null);
    return (
      <StatisticsChart
        ref={chartHandleRef}
        key={chartDataKey}
        data={effectiveChartData}
        chartType={effectiveChartType}
        yAxisMode={chartYAxisMode}
        isComparisonMode={effectiveIsComparison}
        height="100%"
        yAxisLabel={useAvg ? 'Média/Colaborador' : 'Tarefas Concluídas'}
        valueFormatter={valueFormatter}
        secondaryValueFormatter={secondaryValueFormatter}
        tooltipLabels={{
          primary:   isBothMode ? 'Total Tarefas' : (useAvg ? 'Média por Colaborador' : 'Tarefas Concluídas'),
          secondary: isBothMode ? 'Média/Colaborador' : undefined,
        }}
        trendLine={trendLine}
        goalLine={!hasPerPeriodGoal && goalValue != null ? { value: goalValue, label: useAvg && !isBothMode ? 'Meta Média/Colaborador' : 'Meta Tarefas Concluídas' } : null}
        perPeriodGoalLine={hasPerPeriodGoal ? { values: perPeriodGoalValues!, label: useAvg && !isBothMode ? 'Meta Média/Colaborador' : 'Meta Tarefas Concluídas' } : null}
        perPeriodSecondaryGoalLine={
          isBothMode && perPeriodSecondaryGoalValues?.some(v => v != null)
            ? { values: perPeriodSecondaryGoalValues!, label: 'Meta Média/Colaborador' }
            : null
        }
        secondaryGoalLine={
          isBothMode && !perPeriodSecondaryGoalValues?.some(v => v != null) && avgPerUserGoalRaw.value != null
            ? { value: avgPerUserGoalRaw.value, label: 'Meta Média/Colaborador' }
            : null
        }
        primaryChartType={isBothMode ? primaryChartType : undefined}
        secondaryChartType={isBothMode ? secondaryChartType : undefined}
        onDataPointClick={handleChartClick}
      />
    );
  };

  const currentChartType = availableChartTypes.find(t => t.value === chartType) ?? availableChartTypes[0];
  const ChartIcon = currentChartType.icon;

  return (
    <div className="h-full flex flex-col px-4 pt-4 pb-4 overflow-hidden">
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
          headerExtra={
            <>
              <StatisticsPresetsMenu
                presets={presets}
                activePreset={activePreset}
                onSave={savePreset}
                onApply={applyPreset}
                onOverwrite={overwritePreset}
                onRename={renamePreset}
                onDelete={deletePreset}
                isSaving={isSavingPreset}
              />
            </>
          }
        />
      </div>

      <Card className="mt-4 flex-1 min-h-0 flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle>Produção de Tarefas por Período</CardTitle>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Chart type selector — dual pickers in both-mode */}
                  {isBothMode ? (
                    <>
                      {/* Primary series (left axis) */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            {BASE_CHART_TYPE_OPTIONS.find(t => t.value === primaryChartType)?.icon
                              ? (() => { const I = BASE_CHART_TYPE_OPTIONS.find(t => t.value === primaryChartType)!.icon; return <I className="h-4 w-4 mr-1" />; })()
                              : <IconChartBar className="h-4 w-4 mr-1" />}
                            Total
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Total Tarefas</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuRadioGroup value={primaryChartType} onValueChange={v => setPrimaryChartType(v as typeof primaryChartType)}>
                            {BASE_CHART_TYPE_OPTIONS.map(ct => { const I = ct.icon; return (
                              <DropdownMenuRadioItem key={ct.value} value={ct.value} className="group">
                                <I className="h-4 w-4 mr-2" />
                                <span>{ct.label}</span>
                              </DropdownMenuRadioItem>
                            ); })}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {/* Secondary series (right axis) */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            {BASE_CHART_TYPE_OPTIONS.find(t => t.value === secondaryChartType)?.icon
                              ? (() => { const I = BASE_CHART_TYPE_OPTIONS.find(t => t.value === secondaryChartType)!.icon; return <I className="h-4 w-4 mr-1" />; })()
                              : <IconChartLine className="h-4 w-4 mr-1" />}
                            Média
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Média/Colaborador</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuRadioGroup value={secondaryChartType} onValueChange={v => setSecondaryChartType(v as typeof secondaryChartType)}>
                            {BASE_CHART_TYPE_OPTIONS.map(ct => { const I = ct.icon; return (
                              <DropdownMenuRadioItem key={ct.value} value={ct.value} className="group">
                                <I className="h-4 w-4 mr-2" />
                                <span>{ct.label}</span>
                              </DropdownMenuRadioItem>
                            ); })}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  ) : (
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
                  )}

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
                        {goalValue != null
                          ? `Meta: ${formatNumber(goalValue, useAvg ? 2 : filters.xAxisMode === 'day' ? 1 : 0)}`
                          : 'Meta'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Definir Meta</p>
                          {goalSource === 'default' && (
                            <p className="text-xs text-muted-foreground">
                              Padrão de Administração › Metas
                              {useAvg && defaultGoal.value != null && (hasSectorFilter ? filteredProductionUserCount : totalProductionUserCount)
                                ? ` (média de tarefas ÷ ${hasSectorFilter ? filteredProductionUserCount : totalProductionUserCount} colaboradores)`
                                : ''}
                            </p>
                          )}
                          {goalSource === 'override' && (
                            <p className="text-xs text-muted-foreground">
                              Sobrescrevendo padrão{defaultGoal.value != null
                                ? ` (${formatNumber(defaultGoal.value, useAvg ? 2 : filters.xAxisMode === 'day' ? 1 : 0)})`
                                : ''}
                            </p>
                          )}
                          {goalSource === 'none' && (
                            <p className="text-xs text-muted-foreground">
                              Sem meta padrão configurada para este período
                            </p>
                          )}
                        </div>
                        <Input
                          type="number"
                          min={0}
                          placeholder={
                            defaultGoal.value != null
                              ? `Padrão: ${defaultGoal.value}`
                              : 'Ex: 100'
                          }
                          value={goalInput}
                          onChange={v => setGoalInput(v == null ? '' : String(v))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const v = parseFloat(goalInput);
                              setGoalOverride(isNaN(v) ? null : v);
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
                              setGoalOverride(isNaN(v) ? null : v);
                              setGoalPopoverOpen(false);
                            }}
                          >
                            Aplicar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setGoalOverride(null);
                              setGoalInput('');
                              setGoalPopoverOpen(false);
                            }}
                          >
                            {goalSource === 'override' ? 'Usar padrão' : 'Limpar'}
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

            <CardContent className="flex-1 min-h-0 flex flex-col gap-5 overflow-hidden">
              {/* Summary Cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 flex-shrink-0">
                <Card
                  className={`py-2 ${canDrillTotal ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                  onClick={canDrillTotal ? openTotalDrilldown : undefined}
                  role={canDrillTotal ? 'button' : undefined}
                  tabIndex={canDrillTotal ? 0 : undefined}
                  onKeyDown={e => {
                    if (canDrillTotal && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      openTotalDrilldown();
                    }
                  }}
                >
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
                    <Card
                      className={`py-2 ${canDrillPeak ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                      onClick={canDrillPeak ? openPeakPeriod : undefined}
                      role={canDrillPeak ? 'button' : undefined}
                      tabIndex={canDrillPeak ? 0 : undefined}
                      onKeyDown={e => {
                        if (canDrillPeak && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          openPeakPeriod();
                        }
                      }}
                    >
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
              <Card className="flex-1 min-h-0 flex flex-col">
                <CardContent className="flex-1 min-h-0 p-4">
                  <div ref={chartContainerRef} className="h-full">
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
            selectedDays={selectedDays}
            yearCompareMode={yearCompareMode}
            onApply={handleFilterApply}
          />

      {clickedPeriod && (
        <ProductionPeriodTasksModal
          open={!!clickedPeriod}
          onOpenChange={open => { if (!open) setClickedPeriod(null); }}
          period={clickedPeriod.period}
          label={clickedPeriod.label}
          sectorIds={filters.sectorIds}
          commissionStatuses={filters.commissionStatuses}
          userIds={filters.userIds}
          activeUsers={clickedPeriod.activeUsers}
          sectorColorMap={sectorColorMap}
        />
      )}
    </div>
  );
};

export const ProductionProductivityStatisticsPage = () => <TaskProductionPage />;
export default ProductionProductivityStatisticsPage;
