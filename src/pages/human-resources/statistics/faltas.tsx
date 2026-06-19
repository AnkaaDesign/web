import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterDrawer } from '@/components/common/filters/ui/FilterDrawer';
import { Combobox } from '@/components/ui/combobox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { GOAL_METRIC, GOAL_METRIC_UNIT, routes } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useDefaultGoal } from '@/hooks/administration/use-default-goal';
import { useAbsenteeismAnalytics } from '@/hooks/human-resources/use-hr-analytics';
import { GoalMetaPopover } from '@/components/statistics/goal-meta-popover';
import type { AbsenteeismFilters, HrChartType } from '@/types/hr-analytics';
import { StatisticsChart, type StatisticsChartHandle } from '@/components/statistics/statistics-chart';
import { formatNumber, formatPercentage } from '@/types/statistics-common';
import type { YAxisMode, TrendLineType } from '@/types/statistics-common';
import { getSectors } from '@/api-client/sector';
import { sectorKeys } from '@/hooks/common/query-keys';
import {
  IconChartBar,
  IconChartLine,
  IconChartArea,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconBuilding,
  IconCalendarStats,
  IconInfoCircle,
  IconClock,
  IconCalendarOff,
  IconBeach,
  IconLoader2,
  IconTrendingUp,
  IconFileTypeCsv,
  IconFileTypeXls,
  IconRuler,
} from '@tabler/icons-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { useStatisticsPagePersistence } from '@/hooks/common/use-statistics-page-persistence';
import { StatisticsPresetsMenu } from '@/components/statistics/statistics-presets-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const COMBOBOX_PAGE_SIZE = 20;

const MONTH_OPTIONS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
];

const generateYearOptions = (yearsBack = 6) => {
  const cy = new Date().getFullYear();
  return Array.from({ length: yearsBack + 1 }, (_, i) => ({
    value: (cy - i).toString(),
    label: (cy - i).toString(),
  }));
};
const YEAR_OPTIONS = generateYearOptions();

type AbsenteeismYMode = 'rate' | 'hours' | 'faltas' | 'atrasos';

const Y_AXIS_OPTIONS: Array<{ value: AbsenteeismYMode; label: string }> = [
  { value: 'rate',    label: 'Taxa de faltas (%)' },
  { value: 'hours',   label: 'Horas de ausência' },
  { value: 'faltas',  label: 'Faltas (dias)' },
  { value: 'atrasos', label: 'Atrasos (minutos)' },
];

const CHART_TYPE_OPTIONS: Array<{ value: HrChartType; label: string; icon: typeof IconChartBar; description: string }> = [
  { value: 'line', label: 'Linhas', icon: IconChartLine, description: 'Linha simples' },
  { value: 'bar',  label: 'Barras', icon: IconChartBar,  description: 'Barras verticais' },
  { value: 'area', label: 'Área',   icon: IconChartArea, description: 'Área preenchida' },
];

const TREND_LABELS: Record<TrendLineType, string> = {
  linear: 'Linear', sma3: 'Média 3m', sma6: 'Média 6m', sma12: 'Média 12m',
};

const ABSENCE_TYPE_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'justified', label: 'Justificadas' },
  { value: 'unjustified', label: 'Não justificadas' },
  { value: 'medical', label: 'Atestados' },
];

// Business period helpers (26→25, matching backend / productivity page)
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
    return {
      startDate: businessPeriodStartDate(minY, monthNums[0]),
      endDate:   businessPeriodEndDate(maxY,   monthNums[monthNums.length - 1]),
    };
  }
  return {
    startDate: businessPeriodStartDate(minY, 1),
    endDate:   businessPeriodEndDate(maxY,   12),
  };
}

// Build the explicit business-period buckets that drive the chart's x-axis.
// Without these the backend buckets by calendar month and a "Dezembro <Y-1>"
// stub appears at the left edge (e.g. business-period Jan 2026 starts on
// Dec 26 2025, which a calendar grouper splits across two month buckets).
function buildBusinessPeriods(
  years: string[],
  months: string[],
): Array<{ id: string; label: string; startDate: Date; endDate: Date }> {
  if (!years.length) return [];
  const yearNums = years.map(Number).sort((a, b) => a - b);
  const monthList = months.length > 0
    ? months.map(Number).sort((a, b) => a - b)
    : Array.from({ length: 12 }, (_, i) => i + 1);
  const out: Array<{ id: string; label: string; startDate: Date; endDate: Date }> = [];
  for (const y of yearNums) {
    for (const m of monthList) {
      out.push({
        id: `${y}-${String(m).padStart(2, '0')}`,
        label: `${MONTH_OPTIONS[m - 1].label} ${y}`,
        startDate: businessPeriodStartDate(y, m),
        endDate:   businessPeriodEndDate(y, m),
      });
    }
  }
  return out;
}

function formatMinutesToHm(min: number): string {
  if (!min || min <= 0) return '0h';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}min`;
}

// =====================
// Page config persistence (last-seen config + named presets)
// =====================
//
// Plain-JSON snapshot of every user-configurable knob on this page. The filter
// date range and `periods` are intentionally NOT persisted — they are derived
// from selectedYears/selectedMonths and rebuilt in applyPageConfig exactly as
// the filter sheet does. Per-field `.catch()` keeps stale stored configs from
// ever breaking the page. `goalOverride` and drill-down state are session-only.
const pageConfigSchema = z.object({
  version: z.literal(1).catch(1),
  selectedYears: z.array(z.string()).catch([]),
  selectedMonths: z.array(z.string()).catch([]),
  yAxisMode: z.enum(['rate', 'hours', 'faltas', 'atrasos']).catch('rate'),
  chartType: z.enum(['line', 'bar', 'area']).catch('line'),
  trendLine: z.enum(['linear', 'sma3', 'sma6', 'sma12']).nullable().catch(null),
  sectorIds: z.array(z.string()).catch([]),
  absenceType: z.enum(['all', 'justified', 'unjustified', 'medical']).catch('all'),
  topN: z.number().int().min(1).catch(50),
});

type PageConfig = z.infer<typeof pageConfigSchema>;

// =====================
// Filter Sheet
// =====================

interface AbsenteeismFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AbsenteeismFilters;
  selectedYears: string[];
  selectedMonths: string[];
  yAxisMode: AbsenteeismYMode;
  onApply: (next: {
    filters: AbsenteeismFilters;
    selectedYears: string[];
    selectedMonths: string[];
    yAxisMode: AbsenteeismYMode;
  }) => void;
}

function AbsenteeismFilterSheet({
  open, onOpenChange, filters, selectedYears, selectedMonths, yAxisMode, onApply,
}: AbsenteeismFilterSheetProps) {
  const [local, setLocal] = useState<AbsenteeismFilters>(filters);
  const [localYMode, setLocalYMode] = useState<AbsenteeismYMode>(yAxisMode);
  const [localYears, setLocalYears] = useState<string[]>(selectedYears);
  const [localMonths, setLocalMonths] = useState<string[]>(selectedMonths);

  useEffect(() => {
    if (open) {
      setLocal(filters);
      setLocalYMode(yAxisMode);
      setLocalYears(selectedYears);
      setLocalMonths(selectedMonths);
    }
  }, [open, filters, yAxisMode, selectedYears, selectedMonths]);

  const fetchSectors = useCallback(async (search: string, page = 1) => {
    const r = await getSectors({ searchingFor: search || undefined, page, limit: COMBOBOX_PAGE_SIZE });
    return {
      data: (r.data || []).map(s => ({ value: s.id, label: s.name })),
      hasMore: r.meta?.hasNextPage || false,
    };
  }, []);

  const activeCount = useMemo(() => {
    let n = 0;
    if (local.sectorIds?.length) n++;
    if (local.absenceType && local.absenceType !== 'all') n++;
    const cy = new Date().getFullYear().toString();
    const isDefaultYear = localYears.length === 1 && localYears[0] === cy;
    const isDefaultMonths = localMonths.length === 0;
    if (!(isDefaultYear && isDefaultMonths)) n++;
    return n;
  }, [local, localYears, localMonths]);

  const handleApply = useCallback(() => {
    const { startDate, endDate } = computeDateRange(localYears, localMonths);
    const next: AbsenteeismFilters = {
      ...local,
      startDate: startDate ?? local.startDate,
      endDate:   endDate   ?? local.endDate,
      // Explicit 26→25 buckets so the chart x-axis matches the other
      // statistics pages instead of falling back to calendar-month grouping.
      periods: buildBusinessPeriods(localYears, localMonths),
    };
    onApply({
      filters: next,
      selectedYears: localYears,
      selectedMonths: localMonths,
      yAxisMode: localYMode,
    });
    onOpenChange(false);
  }, [local, localYears, localMonths, localYMode, onApply, onOpenChange]);

  const handleClear = useCallback(() => {
    const cy = new Date().getFullYear().toString();
    setLocalYMode('rate');
    setLocalYears([cy]);
    setLocalMonths([]);
    setLocal({
      ...local,
      sectorIds: undefined,
      absenceType: 'all',
      topN: 10,
    });
  }, [local]);

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Configure período, métrica e setores"
      activeFilterCount={activeCount}
      onApply={handleApply}
      onReset={handleClear}
      applyLabel="Aplicar"
      resetLabel="Limpar"
    >
            {/* Y-axis */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconRuler className="h-4 w-4" />
                Métrica do Eixo Y
              </Label>
              <Combobox
                value={localYMode}
                onValueChange={v => setLocalYMode(v as AbsenteeismYMode)}
                options={Y_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
            </div>

            {/* Absence type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de ausência</Label>
              <Combobox
                value={local.absenceType ?? 'all'}
                onValueChange={v => setLocal({ ...local, absenceType: (Array.isArray(v) ? v[0] : v) as AbsenteeismFilters['absenceType'] })}
                options={ABSENCE_TYPE_OPTIONS}
                placeholder="Tipo..."
                searchable={false}
                clearable={false}
              />
            </div>

            {/* Years */}
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
                searchable
                clearable
              />
              <p className="text-xs text-muted-foreground">
                {localYears.length === 0
                  ? 'Sem seleção → ano atual'
                  : `Exibe os meses dos anos: ${[...localYears].sort().join(', ')}`}
              </p>
            </div>

            {/* Months */}
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
                searchable
                clearable
              />
              <p className="text-xs text-muted-foreground">
                {localMonths.length === 0
                  ? 'Sem seleção → todos os meses do(s) ano(s). Períodos longos demoram (dados ao vivo do Secullum).'
                  : `Exibe apenas: ${[...localMonths].sort().map(m => MONTH_OPTIONS.find(o => o.value === m)?.label).join(', ')}`}
              </p>
            </div>

            {/* Sectors */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconBuilding className="h-4 w-4" />
                Setores
              </Label>
              <Combobox
                mode="multiple"
                async
                value={local.sectorIds || []}
                onValueChange={v => setLocal({
                  ...local,
                  sectorIds: Array.isArray(v) && v.length > 0 ? v : undefined,
                })}
                queryKey={[...sectorKeys.lists()]}
                queryFn={fetchSectors}
                minSearchLength={0}
                placeholder="Todos os setores..."
                searchPlaceholder="Buscar setor..."
                emptyText="Nenhum setor encontrado"
                searchable
                clearable
              />
            </div>
    </FilterDrawer>
  );
}

// =====================
// Per-employee drill-down modal
//
// Uses topAbsentees from the analytics response — these are REAL per-user
// records (userId, userName, sectorName, plus all the absence counts).
// Each KPI sorts the list by the metric the user clicked on so they see
// the colaboradores driving that number first.
// =====================

type AbsenteeismDrillMode = 'hours' | 'faltas' | 'atrasos';

interface AbsenteeismUserRow {
  userId: string;
  userName: string;
  sectorName: string | null;
  rate: number;
  absenceHours: number;
  faltasJustified: number;
  faltasUnjustified: number;
  atestados: number;
  atrasosMinutes: number;
}

interface AbsenteeismDrillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AbsenteeismDrillMode | null;
  topAbsentees: AbsenteeismUserRow[];
  periodLabel: string;
}

function AbsenteeismDrillModal({
  open, onOpenChange, mode, topAbsentees, periodLabel,
}: AbsenteeismDrillModalProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  // Sort with the clicked metric first so the modal shows the worst offenders
  // at the top — the user clicked a KPI; they want the people driving it.
  const sorted = useMemo(() => {
    const arr = [...topAbsentees];
    arr.sort((a, b) => {
      switch (mode) {
        case 'faltas':
          return (b.faltasJustified + b.faltasUnjustified) - (a.faltasJustified + a.faltasUnjustified);
        case 'atrasos':
          return b.atrasosMinutes - a.atrasosMinutes;
        case 'hours':
        default:
          return b.absenceHours - a.absenceHours;
      }
    });
    return arr;
  }, [topAbsentees, mode]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sorted;
    return sorted.filter(u =>
      u.userName.toLowerCase().includes(term) ||
      (u.sectorName ?? '').toLowerCase().includes(term),
    );
  }, [sorted, search]);

  const title = mode === 'faltas'
    ? 'Faltas por colaborador'
    : mode === 'atrasos'
      ? 'Atrasos por colaborador'
      : 'Horas ausentes por colaborador';

  const HeaderIcon = mode === 'faltas' ? IconBeach
    : mode === 'atrasos' ? IconClock
    : IconClock;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HeaderIcon className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            <span className="font-semibold text-foreground">{periodLabel}</span>
            {' · '}
            <span className="font-semibold text-foreground">{topAbsentees.length}</span>{' '}
            colaborador{topAbsentees.length === 1 ? '' : 'es'} com ausências
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b shrink-0">
          <Input
            type="text"
            value={search}
            onChange={v => setSearch(v == null ? '' : String(v))}
            placeholder="Buscar por nome ou setor..."
            className="w-full"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <Table className="[&>div]:border-0 w-full [&_th]:px-6 [&_td]:px-6">
            <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_hsl(var(--border))]">
              <TableRow>
                <TableHead className="text-sm">Colaborador</TableHead>
                <TableHead className="text-sm">Setor</TableHead>
                <TableHead className="text-sm text-right">Taxa</TableHead>
                <TableHead className="text-sm text-right whitespace-nowrap">Horas ausentes</TableHead>
                <TableHead className="text-sm text-right whitespace-nowrap">Faltas (just./não)</TableHead>
                <TableHead className="text-sm text-right">Atrasos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-foreground/60">
                    {search ? 'Nenhum colaborador encontrado.' : 'Sem ocorrências no período.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(u => {
                  const userRateColor = u.rate >= 10
                    ? 'text-red-700 dark:text-red-400'
                    : u.rate >= 5
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-foreground';
                  return (
                    <TableRow key={u.userId} className="text-sm">
                      <TableCell className="py-3 font-medium whitespace-nowrap">{u.userName}</TableCell>
                      <TableCell className="text-foreground/85 whitespace-nowrap">{u.sectorName ?? '—'}</TableCell>
                      <TableCell className={`text-right font-medium whitespace-nowrap ${userRateColor}`}>
                        {formatPercentage(u.rate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{u.absenceHours.toFixed(1)}h</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <span className="text-emerald-700 dark:text-emerald-400">{u.faltasJustified}</span>
                        {' / '}
                        <span className="text-red-700 dark:text-red-400">{u.faltasUnjustified}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{formatMinutesToHm(u.atrasosMinutes)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {search && (
          <div className="px-6 py-2 border-t shrink-0 text-xs text-foreground/60">
            Mostrando {filtered.length} de {sorted.length}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =====================
// Page
// =====================

const FaltasStatisticsPage = () => {
  usePageTracker({
    page: 'hr-faltas',
    title: 'Faltas',
  });

  const initialYear = useMemo(() => new Date().getFullYear().toString(), []);
  const [selectedYears, setSelectedYears] = useState<string[]>([initialYear]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const [filters, setFilters] = useState<AbsenteeismFilters>(() => {
    const { startDate, endDate } = computeDateRange([initialYear], []);
    return {
      startDate,
      endDate,
      // Pass explicit business-period buckets so the API groups by 26→25
      // months instead of calendar months (which would otherwise add a stub
      // "Dezembro Y-1" bucket at the left edge of the chart).
      periods: buildBusinessPeriods([initialYear], []),
      absenceType: 'all',
      topN: 50,
    };
  });

  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const chartHandleRef = useRef<StatisticsChartHandle>(null);
  // This page only offers line/bar/area (see CHART_TYPE_OPTIONS); keep the
  // state in sync with the persisted PageConfig union.
  const [chartType, setChartType] = useState<PageConfig['chartType']>('line');
  const [trendLine, setTrendLine] = useState<TrendLineType | null>(null);
  const [yAxisMode, setYAxisMode] = useState<AbsenteeismYMode>('rate');
  const [drillDown, setDrillDown] = useState<AbsenteeismDrillMode | null>(null);
  // Drill-down triggered by clicking an x-axis value on the chart. We reuse
  // the same AbsenteeismDrillModal — `topAbsentees` is the whole-window list
  // returned by the API, so the contents stay the same but the period label
  // reflects the clicked bucket.
  const [periodDrill, setPeriodDrill] = useState<{
    mode: AbsenteeismDrillMode;
    label: string;
  } | null>(null);

  const { data, isLoading, isError, error, refetch } = useAbsenteeismAnalytics(filters);
  const summary = data?.data?.summary;
  const items = data?.data?.items ?? [];
  const topAbsentees = data?.data?.topAbsentees ?? [];

  // 'rate' → HR_ABSENTEEISM_RATE (%, MINIMIZE). 'hours' (absence hours),
  // 'faltas' (count) and 'atrasos' (minutes) don't have first-class goals today.
  const goalMetric = yAxisMode === 'rate' ? GOAL_METRIC.HR_ABSENTEEISM_RATE : null;

  const [goalOverride, setGoalOverride] = useState<number | null>(null);

  useEffect(() => {
    setGoalOverride(null);
  }, [yAxisMode]);

  const defaultGoal = useDefaultGoal({
    metric: goalMetric ?? GOAL_METRIC.HR_ABSENTEEISM_RATE,
    period:
      filters.startDate && filters.endDate
        ? { from: filters.startDate, to: filters.endDate }
        : null,
    sectorIds: filters.sectorIds,
    aggregation: 'AVERAGE_PER_PERIOD',
    enabled: goalMetric !== null,
  });

  const goalValue = goalOverride ?? defaultGoal.value;
  const goalSource: 'override' | 'default' | 'none' =
    goalOverride != null ? 'override' : defaultGoal.value != null ? 'default' : 'none';

  const perPeriodGoalValues = useMemo(() => {
    if (goalOverride != null || goalMetric === null || !defaultGoal.perPeriodValues) return null;
    return items.map(item => defaultGoal.perPeriodValues!.get(item.period) ?? null);
  }, [goalOverride, goalMetric, defaultGoal.perPeriodValues, items]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.sectorIds?.length) n++;
    if (filters.absenceType && filters.absenceType !== 'all') n++;
    const cy = new Date().getFullYear().toString();
    const isDefaultYear = selectedYears.length === 1 && selectedYears[0] === cy;
    const isDefaultMonths = selectedMonths.length === 0;
    if (!(isDefaultYear && isDefaultMonths)) n++;
    return n;
  }, [filters, selectedYears, selectedMonths]);

  const chartData = useMemo(() => {
    if (!items.length) return [];
    return items.map(item => {
      let value: number;
      let secondaryValue: number;
      switch (yAxisMode) {
        case 'hours':   value = item.absenceHours;                                   secondaryValue = item.scheduledHours; break;
        case 'faltas':  value = item.faltasJustified + item.faltasUnjustified;       secondaryValue = item.atestados;      break;
        case 'atrasos': value = item.atrasosMinutes;                                 secondaryValue = item.affectedUsers;  break;
        default:        value = item.rate;                                           secondaryValue = item.absenceHours;   break;
      }
      return { name: item.label, value, secondaryValue };
    });
  }, [items, yAxisMode]);

  const chartYAxisMode: YAxisMode = yAxisMode === 'rate' ? 'percentage' : 'count';

  const valueFormatter = useCallback((value: number, mode: YAxisMode): string => {
    if (mode === 'percentage') return formatPercentage(value);
    if (yAxisMode === 'hours') return `${value.toFixed(1)}h`;
    return Math.round(value).toString();
  }, [yAxisMode]);

  const tooltipLabels = useMemo(() => {
    switch (yAxisMode) {
      case 'hours':   return { primary: 'Ausência',       secondary: 'Previstas' };
      case 'faltas':  return { primary: 'Faltas',         secondary: 'Atestados' };
      case 'atrasos': return { primary: 'Atrasos (min)',  secondary: 'Pessoas afetadas' };
      default:        return { primary: 'Taxa de faltas',  secondary: 'Horas de ausência' };
    }
  }, [yAxisMode]);

  const yAxisLabel = useMemo(() => {
    switch (yAxisMode) {
      case 'hours':   return 'Horas';
      case 'faltas':  return 'Dias';
      case 'atrasos': return 'Minutos';
      default:        return 'Taxa (%)';
    }
  }, [yAxisMode]);

  const periodSummaryLabel = useMemo(() => {
    if (!selectedYears.length) return 'Faltas';
    const yearsSorted = [...selectedYears].sort();
    const monthsSorted = [...selectedMonths].sort();
    if (monthsSorted.length === 0) {
      return yearsSorted.length === 1 ? `Faltas · Ano ${yearsSorted[0]}` : `Faltas · Anos ${yearsSorted.join(', ')}`;
    }
    const monthNames = monthsSorted.map(m => MONTH_OPTIONS.find(o => o.value === m)?.label).join(', ');
    return yearsSorted.length === 1
      ? `Faltas · ${monthNames} ${yearsSorted[0]}`
      : `Faltas · ${monthNames} · ${yearsSorted.length} anos`;
  }, [selectedYears, selectedMonths]);

  const handleFilterApply = useCallback((next: {
    filters: AbsenteeismFilters;
    selectedYears: string[];
    selectedMonths: string[];
    yAxisMode: AbsenteeismYMode;
  }) => {
    setFilters(next.filters);
    setSelectedYears(next.selectedYears);
    setSelectedMonths(next.selectedMonths);
    setYAxisMode(next.yAxisMode);
  }, []);

  // ── Page config persistence (auto-restore last config + named presets) ──
  const pageConfig = useMemo<PageConfig>(() => ({
    version: 1,
    selectedYears,
    selectedMonths,
    yAxisMode,
    chartType,
    trendLine,
    sectorIds: filters.sectorIds ?? [],
    absenceType: (filters.absenceType ?? 'all') as PageConfig['absenceType'],
    topN: filters.topN ?? 50,
  }), [selectedYears, selectedMonths, yAxisMode, chartType, trendLine, filters]);

  const applyPageConfig = useCallback((config: PageConfig) => {
    // selectedYears defaults to [currentYear] — never leave it empty.
    const years = config.selectedYears.length
      ? config.selectedYears
      : [new Date().getFullYear().toString()];
    const months = config.selectedMonths;
    // Rebuild the derived date range + business-period buckets the same way
    // the filter sheet's handleApply does.
    const { startDate, endDate } = computeDateRange(years, months);
    setFilters(f => ({
      ...f,
      startDate: startDate ?? f.startDate,
      endDate:   endDate   ?? f.endDate,
      periods:   buildBusinessPeriods(years, months),
      sectorIds: config.sectorIds.length ? config.sectorIds : undefined,
      absenceType: config.absenceType,
      topN: config.topN,
    }));
    setSelectedYears(years);
    setSelectedMonths(months);
    setYAxisMode(config.yAxisMode);
    setChartType(config.chartType);
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
    pageKey: routes.statistics.personnelDepartment.absenteeism,
    schema: pageConfigSchema,
    current: pageConfig,
    apply: applyPageConfig,
  });

  const handleExportCSV = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Taxa (%)', 'Horas ausentes', 'Horas previstas', 'Faltas just.', 'Faltas n/just.', 'Atestados', 'Atrasos (min)'];
      const rows = items.map(i => [i.label, i.rate.toFixed(1), i.absenceHours.toFixed(1), i.scheduledHours.toFixed(0), i.faltasJustified, i.faltasUnjustified, i.atestados, i.atrasosMinutes]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `faltas-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('CSV exportado!');
    } catch { toast.error('Erro ao exportar CSV'); }
  }, [items]);

  const handleExportXLSX = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Taxa (%)', 'Horas ausentes', 'Horas previstas', 'Faltas just.', 'Faltas n/just.', 'Atestados', 'Atrasos (min)'];
      const rows = items.map(i => [i.label, i.rate, i.absenceHours, i.scheduledHours, i.faltasJustified, i.faltasUnjustified, i.atestados, i.atrasosMinutes]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((_, idx) => ({ wch: idx === 0 ? 22 : 16 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Faltas');
      XLSX.writeFile(wb, `faltas-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`);
      toast.success('XLSX exportado!');
    } catch { toast.error('Erro ao exportar planilha'); }
  }, [items]);

  const renderChart = () => {
    const chartHeightStyle = { height: '100%' };
    if (isLoading) {
      return (
        <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-3">
          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <div className="text-center max-w-md">
            <p className="text-sm font-medium">Buscando dados do Secullum</p>
            <p className="text-xs text-muted-foreground mt-1">
              Estamos consultando o ponto eletrônico ao vivo.
            </p>
          </div>
        </div>
      );
    }
    if (isError) {
      return (
        <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
          <IconAlertCircle className="h-12 w-12 text-destructive" />
          <p className="font-semibold">Erro ao carregar dados</p>
          <p className="text-sm text-muted-foreground">{error?.message || 'Erro inesperado'}</p>
          <Button onClick={() => refetch()} variant="outline">
            <IconRefresh className="h-4 w-4 mr-2" />Tentar novamente
          </Button>
        </div>
      );
    }
    if (!chartData.length) {
      return (
        <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
          <IconCalendarStats className="h-12 w-12 text-muted-foreground" />
          <p className="font-semibold">Nenhum dado encontrado</p>
          <p className="text-sm text-muted-foreground">Ajuste os filtros para visualizar</p>
        </div>
      );
    }
    return (
      <StatisticsChart
        ref={chartHandleRef}
        data={chartData}
        chartType={chartType}
        yAxisMode={chartYAxisMode}
        isComparisonMode={false}
        height="100%"
        yAxisLabel={yAxisLabel}
        valueFormatter={valueFormatter}
        tooltipLabels={tooltipLabels}
        trendLine={trendLine}
        goalLine={goalValue != null && !perPeriodGoalValues?.some(v => v != null) ? { value: goalValue, label: 'Meta Limite Faltas' } : null}
        perPeriodGoalLine={perPeriodGoalValues?.some(v => v != null) ? { values: perPeriodGoalValues, label: 'Meta Limite Faltas' } : null}
        onDataPointClick={(dataIndex) => {
          const it = items[dataIndex];
          if (!it || topAbsentees.length === 0) return;
          // Pick a drill mode that matches what the user is currently viewing
          // on the chart. Defaults to 'hours' so the list ranks by ausência.
          const driveMode: AbsenteeismDrillMode =
            yAxisMode === 'faltas' ? 'faltas'
              : yAxisMode === 'atrasos' ? 'atrasos'
                : 'hours';
          setPeriodDrill({ mode: driveMode, label: it.label });
        }}
      />
    );
  };

  // Threshold: if a positive goal is configured for the rate (default or
  // override), use it as the cutoff between green/amber/red. Falls back to
  // legacy 5%/2% bands when no goal is set OR when the goal is zero (a zero
  // ceiling would paint every non-zero rate red, defeating the purpose).
  const rateGoalForColor =
    goalMetric === GOAL_METRIC.HR_ABSENTEEISM_RATE && goalValue != null && goalValue > 0
      ? goalValue
      : null;
  const redCutoff = rateGoalForColor ?? 5;
  const amberCutoff = rateGoalForColor != null ? rateGoalForColor * 0.6 : 2;
  const rateColor = summary && summary.rate >= redCutoff
    ? 'text-red-700 dark:text-red-400'
    : summary && summary.rate >= amberCutoff
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-emerald-700 dark:text-emerald-400';

  const currentChartType = CHART_TYPE_OPTIONS.find(c => c.value === chartType) ?? CHART_TYPE_OPTIONS[0];
  const ChartIcon = currentChartType.icon;

  const hasData = !isLoading && items.length > 0;
  const canDrill = hasData && topAbsentees.length > 0;
  const openDrillDown = (m: AbsenteeismDrillMode) => { if (canDrill) setDrillDown(m); };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="h-full flex flex-col px-4 pt-4 pb-4 overflow-hidden">
        <div className="flex-shrink-0">
          <PageHeader
            title="Faltas"
            icon={IconCalendarOff}
            breadcrumbs={[
              { label: 'Início', href: routes.home },
              { label: 'Estatísticas', href: routes.statistics.root },
              { label: 'Recursos Humanos', href: routes.statistics.personnelDepartment.root },
              { label: 'Faltas' },
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
                  <CardTitle className="flex items-center gap-2">
                    <IconCalendarOff className="h-5 w-5 text-primary" />
                    {periodSummaryLabel}
                  </CardTitle>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Chart type */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ChartIcon className="h-4 w-4 mr-2" />
                        {currentChartType.label}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      <DropdownMenuLabel>Tipo de gráfico</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup value={chartType} onValueChange={v => setChartType(v as PageConfig['chartType'])}>
                        {CHART_TYPE_OPTIONS.map(c => {
                          const Icon = c.icon;
                          return (
                            <DropdownMenuRadioItem key={c.value} value={c.value} className="group">
                              <Icon className="h-4 w-4 mr-2" />
                              <div className="flex flex-col">
                                <span>{c.label}</span>
                                <span className="text-xs text-muted-foreground group-data-[highlighted]:text-white/80">{c.description}</span>
                              </div>
                            </DropdownMenuRadioItem>
                          );
                        })}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Trend */}
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
                      <DropdownMenuRadioGroup value={trendLine ?? ''} onValueChange={v => setTrendLine(v ? (v as TrendLineType) : null)}>
                        <DropdownMenuRadioItem value="">Desativada</DropdownMenuRadioItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioItem value="linear">Linear</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma3">Média 3 meses</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma6">Média 6 meses</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma12">Média 12 meses</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Goal line */}
                  <GoalMetaPopover
                    enabled={goalMetric !== null}
                    value={goalValue}
                    defaultValue={defaultGoal.value}
                    source={goalSource}
                    onOverride={setGoalOverride}
                    unit={goalMetric ? GOAL_METRIC_UNIT[goalMetric] : GOAL_METRIC_UNIT[GOAL_METRIC.HR_ABSENTEEISM_RATE]}
                  />

                  {/* Filters */}
                  <Button
                    variant={activeFilterCount > 0 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowFilterDrawer(true)}
                  >
                    <IconFilter className="h-4 w-4 mr-2" />Filtros
                    {activeFilterCount > 0 && <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>}
                  </Button>

                  {/* Export */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={isLoading || !items.length}>
                        <IconDownload className="h-4 w-4 mr-2" />Exportar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleExportCSV}>
                        <IconFileTypeCsv className="h-4 w-4 mr-2" /> CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportXLSX}>
                        <IconFileTypeXls className="h-4 w-4 mr-2" /> Excel (XLSX)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 flex flex-col gap-5 overflow-hidden">
              {/* KPI cards — Taxa de Faltas is a rate → not clickable.
                  Horas Ausentes, Faltas and Atrasos drill into per-employee lists. */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 flex-shrink-0">
                <Card className="py-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <IconCalendarOff className="h-3.5 w-3.5" /> Taxa de Faltas
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <IconInfoCircle className="h-3 w-3 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          Horas de ausência ÷ horas previstas. Inclui faltas e atestados.
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading ? <Skeleton className="h-7 w-20" /> : (
                      <>
                        <div className={`text-xl font-bold ${rateColor}`}>
                          {summary ? formatPercentage(summary.rate) : '0%'}
                        </div>
                        {summary && (
                          <div className="text-[11px] text-foreground/70 mt-0.5">
                            {summary.absenceHours.toFixed(1)}h / {summary.scheduledHours.toFixed(0)}h previstas
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card
                  className={cn('py-2', canDrill && 'cursor-pointer hover:bg-muted/50 transition-colors')}
                  onClick={canDrill ? () => openDrillDown('hours') : undefined}
                  role={canDrill ? 'button' : undefined}
                  tabIndex={canDrill ? 0 : undefined}
                  onKeyDown={e => {
                    if (canDrill && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      openDrillDown('hours');
                    }
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <IconClock className="h-3.5 w-3.5" /> Horas Ausentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading ? <Skeleton className="h-7 w-20" /> : (
                      <>
                        <div className="text-xl font-bold">
                          {summary ? `${summary.absenceHours.toFixed(1)}h` : '0h'}
                        </div>
                        {!canDrill && (
                          <div className="text-[11px] text-foreground/70 mt-0.5">Total no período</div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card
                  className={cn('py-2', canDrill && 'cursor-pointer hover:bg-muted/50 transition-colors')}
                  onClick={canDrill ? () => openDrillDown('faltas') : undefined}
                  role={canDrill ? 'button' : undefined}
                  tabIndex={canDrill ? 0 : undefined}
                  onKeyDown={e => {
                    if (canDrill && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      openDrillDown('faltas');
                    }
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <IconBeach className="h-3.5 w-3.5" /> Faltas
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <IconInfoCircle className="h-3 w-3 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          Justificadas (com abono no Secullum) e não justificadas.
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading ? <Skeleton className="h-7 w-20" /> : (
                      <>
                        <div className="text-xl font-bold">
                          {summary ? formatNumber(summary.faltasJustified + summary.faltasUnjustified) : '0'}
                        </div>
                        {summary ? (
                          <div className="text-[11px] text-foreground/70 mt-0.5">
                            <span className="text-emerald-700 dark:text-emerald-400">{summary.faltasJustified} just.</span>
                            {' · '}
                            <span className="text-red-700 dark:text-red-400">{summary.faltasUnjustified} s/ abono</span>
                          </div>
                        ) : !canDrill ? (
                          <div className="text-[11px] text-foreground/70 mt-0.5">Sem dados</div>
                        ) : null}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card
                  className={cn('py-2', canDrill && 'cursor-pointer hover:bg-muted/50 transition-colors')}
                  onClick={canDrill ? () => openDrillDown('atrasos') : undefined}
                  role={canDrill ? 'button' : undefined}
                  tabIndex={canDrill ? 0 : undefined}
                  onKeyDown={e => {
                    if (canDrill && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      openDrillDown('atrasos');
                    }
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                      <IconClock className="h-3.5 w-3.5" /> Atrasos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading ? <Skeleton className="h-7 w-20" /> : (
                      <>
                        <div className="text-xl font-bold">
                          {summary ? formatMinutesToHm(summary.atrasosMinutes) : '0h'}
                        </div>
                        {summary ? (
                          <div className="text-[11px] text-foreground/70 mt-0.5">
                            {`${summary.affectedUsers} pessoa${summary.affectedUsers === 1 ? '' : 's'} com ausências`}
                          </div>
                        ) : !canDrill ? (
                          <div className="text-[11px] text-foreground/70 mt-0.5">Sem dados</div>
                        ) : null}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Chart */}
              <Card className="flex-1 min-h-0 flex flex-col">
                <CardContent className="flex-1 min-h-0 p-4">
                  {renderChart()}
                </CardContent>
              </Card>
            </CardContent>
          </Card>

        <AbsenteeismFilterSheet
          open={showFilterDrawer}
          onOpenChange={setShowFilterDrawer}
          filters={filters}
          selectedYears={selectedYears}
          selectedMonths={selectedMonths}
          yAxisMode={yAxisMode}
          onApply={handleFilterApply}
        />

        <AbsenteeismDrillModal
          open={drillDown !== null}
          onOpenChange={o => { if (!o) setDrillDown(null); }}
          mode={drillDown}
          topAbsentees={topAbsentees}
          periodLabel={periodSummaryLabel.replace(/^Faltas\s·\s/, '')}
        />

        {/* Period drill-down — opens when the user clicks an x-axis value */}
        <AbsenteeismDrillModal
          open={periodDrill !== null}
          onOpenChange={o => { if (!o) setPeriodDrill(null); }}
          mode={periodDrill?.mode ?? null}
          topAbsentees={topAbsentees}
          periodLabel={periodDrill?.label ?? ''}
        />
      </div>
    </TooltipProvider>
  );
};

export default FaltasStatisticsPage;
