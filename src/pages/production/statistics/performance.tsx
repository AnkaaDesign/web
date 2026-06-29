// web/src/pages/production/statistics/performance.tsx
//
// Desempenho — per-user task attribution.
//
// Splits each period's task count among active colaboradores proportionally
// to (position weight × working days). Position weight grows in steps of 0.6
// from a configurable base, ranked globally by Position.hierarchy ascending.
//
//   contribution(u, P) = weight(u) × workingDays(u, P)
//   tasksAllocated(u, P) = T_P × contribution(u, P) / Σ contribution
//   dailyProductivity(u, P) = tasksAllocated(u, P) / workingDays(u, P)
//
// The table is the page: every active user gets a row showing the tasks the
// model attributes to them. The chart is kept as a small secondary view of
// task volume per period.

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Combobox } from '@/components/ui/combobox';
import { GOAL_METRIC, routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useTaskPerformanceStats } from '@/hooks/production/use-production-analytics';
import { useDefaultGoal } from '@/hooks/administration/use-default-goal';
import { useActiveProductionUserCount } from '@/hooks/administration/use-active-production-user-count';
import type {
  TaskPerformanceFilters,
  TaskPerformanceChartType,
  TaskPerformanceXAxisMode,
  TaskPerformanceYAxisMode,
  TaskPerformanceCompareMode,
  TaskPerformanceItem,
  TaskPerformancePeriodUser,
} from '@/types/production-analytics';
import { StatisticsChart, type StatisticsChartHandle } from '@/components/statistics/statistics-chart';
import { exportProductivityPdf } from '@/utils/productivity-pdf-generator';
import { PerformancePeriodModal } from '@/components/production/performance-period-modal';
import { formatNumber, CHART_COLORS } from '@/types/statistics-common';
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
  IconActivity,
  IconScale,
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

type ChartTypeOption = { value: TaskPerformanceChartType; label: string; icon: typeof IconChartBar; description: string };

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
  { value: 'bar-stacked',  label: 'Colunas', icon: IconChartBar,  description: 'Total + Média ajustada' },
  { value: 'line-stacked', label: 'Linhas',  icon: IconChartLine, description: 'Total + Média ajustada' },
];

const X_AXIS_OPTIONS: Array<{ value: TaskPerformanceXAxisMode; label: string }> = [
  { value: 'month', label: 'Meses' },
  { value: 'year',  label: 'Anos' },
];

const Y_AXIS_OPTIONS: Array<{ value: TaskPerformanceYAxisMode; label: string }> = [
  { value: 'count',       label: 'Quantidade de Tarefas' },
  { value: 'performance', label: 'Média por Colaborador (ajustada)' },
  { value: 'both',        label: 'Ambos (Total + Média ajustada)' },
];

const COMPARE_MODE_OPTIONS: Array<{ value: TaskPerformanceCompareMode; label: string }> = [
  { value: 'combined',           label: 'Combinado (uma série)' },
  { value: 'separated',          label: 'Separado (por setor)' },
  { value: 'separatedWithTotal', label: 'Separado + Total (setor + Ambos)' },
];

// Business period date helpers (26th to 25th)
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

// =====================
// Page config persistence (last-seen config + named presets)
// =====================
//
// Plain-JSON snapshot of every user-configurable knob on this page. The derived
// startDate/endDate/bonusPeriod* fields are NOT persisted — only the source
// inputs (selectedYears/Months, axis modes, position weights) are stored, and
// applyPageConfig rebuilds `filters` exactly the way the sheet's Apply handler
// does. Per-field `.catch()` keeps stale stored configs from breaking the page;
// goal/modal state is session-only by design.
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
  xAxisMode: z.enum(['month', 'year']).catch('month'),
  yAxisMode: z.enum(['count', 'performance', 'both']).catch('performance'),
  compareMode: z.enum(['combined', 'separated', 'separatedWithTotal']).catch('combined'),
  sectorIds: z.array(z.string()).catch([]),
  positionStep: z.number().catch(0.6),
  positionBase: z.number().catch(1.0),
});

type PageConfig = z.infer<typeof pageConfigSchema>;

// =====================
// Filter Sheet
// =====================

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: TaskPerformanceFilters;
  selectedYears: string[];
  selectedMonths: string[];
  yearCompareMode: boolean;
  onApply: (filters: TaskPerformanceFilters, years: string[], months: string[], yearCompare: boolean) => void;
}

function TaskPerformanceFiltersSheet({
  open, onOpenChange, filters, selectedYears, selectedMonths, yearCompareMode, onApply,
}: FilterSheetProps) {
  const [localX, setLocalX]     = useState<TaskPerformanceXAxisMode>(filters.xAxisMode || 'month');
  const [localY, setLocalY]     = useState<TaskPerformanceYAxisMode>(filters.yAxisMode || 'performance');
  const [localCmp, setLocalCmp] = useState<TaskPerformanceCompareMode>(filters.compareMode || 'combined');
  const [localSectors, setLocalSectors] = useState<string[]>(filters.sectorIds || []);
  const [localYears, setLocalYears]     = useState<string[]>(selectedYears);
  const [localMonths, setLocalMonths]   = useState<string[]>(selectedMonths);
  const [localYearCompare, setLocalYearCompare] = useState(yearCompareMode);
  const [localStep, setLocalStep] = useState<number>(filters.positionStep ?? 0.6);
  const [localBase, setLocalBase] = useState<number>(filters.positionBase ?? 1.0);

  useEffect(() => {
    if (open) {
      setLocalX(filters.xAxisMode || 'month');
      setLocalY(filters.yAxisMode || 'performance');
      setLocalCmp(filters.compareMode || 'combined');
      setLocalSectors(filters.sectorIds || []);
      setLocalYears(selectedYears);
      setLocalMonths(selectedMonths);
      setLocalYearCompare(yearCompareMode);
      setLocalStep(filters.positionStep ?? 0.6);
      setLocalBase(filters.positionBase ?? 1.0);
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

  useEffect(() => {
    if (localY === 'both' && localSectors.length > 0) setLocalSectors([]);
  }, [localY, localSectors.length]);

  const canCompare = localSectors.length >= 2 && localY !== 'both';

  const handleApply = useCallback(() => {
    const { startDate, endDate } = computeDateRange(localYears, localMonths);
    // Send canonical bonus-period inputs alongside startDate/endDate so the
    // backend can compute the exact window via the same helpers bonus uses.
    // See productivity.tsx for the same pattern + rationale.
    const singleYear = localYears.length === 1 ? Number(localYears[0]) : undefined;
    const bonusPeriodMonths = singleYear !== undefined && localMonths.length > 0
      ? localMonths.map(m => Number(m))
      : undefined;
    const finalFilters: TaskPerformanceFilters = {
      startDate,
      endDate,
      bonusPeriodYear: singleYear,
      bonusPeriodMonths,
      xAxisMode: localX,
      yAxisMode: localY,
      compareMode: canCompare ? localCmp : 'combined',
      sectorIds: localSectors.length > 0 ? localSectors : undefined,
      positionStep: localStep,
      positionBase: localBase,
    };
    const yearCompare = localYears.length >= 2 && localX === 'month' ? localYearCompare : false;
    onApply(finalFilters, localYears, localMonths, yearCompare);
    onOpenChange(false);
  }, [localX, localY, localCmp, localSectors, localYears, localMonths, localYearCompare, localStep, localBase, canCompare, onApply, onOpenChange]);

  const handleClear = useCallback(() => {
    setLocalX('month');
    setLocalY('performance');
    setLocalCmp('combined');
    setLocalSectors([]);
    setLocalYears([]);
    setLocalMonths([]);
    setLocalYearCompare(false);
    setLocalStep(0.6);
    setLocalBase(1.0);
  }, []);

  const activeCount = [localSectors.length > 0, localYears.length > 0].filter(Boolean).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-xl border-border/50 flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros
            {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
          </SheetTitle>
          <SheetDescription>Configure o período, métricas, setores e o passo entre cargos</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-4">

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconCalendarStats className="h-4 w-4" />
                Agrupamento do Eixo X
              </Label>
              <Combobox
                value={localX}
                onValueChange={v => setLocalX(v as TaskPerformanceXAxisMode)}
                options={X_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconChartArcs3 className="h-4 w-4" />
                Métrica do Eixo Y
              </Label>
              <Combobox
                value={localY}
                onValueChange={v => setLocalY(v as TaskPerformanceYAxisMode)}
                options={Y_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
              {localY === 'performance' && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Média por colaborador na mesma escala da Produtividade, mas ajustada pelos cargos: setores com colaboradores em cargos mais altos têm o número puxado para baixo (era esperado que produzissem mais); setores com cargos mais baixos têm o número puxado para cima. Conta apenas dias úteis (seg–sex, sem feriados nacionais).
                </p>
              )}
              {localY === 'both' && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Exibe Total de Tarefas e Média ajustada no mesmo gráfico. Seleção de setores não disponível neste modo.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconScale className="h-4 w-4" />
                Passo entre Cargos
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Quanto a produção esperada cresce a cada cargo na hierarquia. Com passo 0,6, um cargo logo acima produz cerca de 1,6× o cargo logo abaixo no mesmo intervalo (peso 1,0 → 1,6 → 2,2 → ...).
              </p>
              <Input
                type="decimal"
                min={0}
                step={0.1}
                decimals={2}
                value={localStep}
                onChange={v => setLocalStep(parseFloat(String(v ?? '0.6')) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconScale className="h-4 w-4" />
                Peso Base
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Peso atribuído ao cargo mais baixo (Junior I). Fórmula: peso = base + passo × rank. Aumentar a base comprime a diferença relativa entre cargos; diminuí-la amplifica.
              </p>
              <Input
                type="decimal"
                min={0}
                step={0.1}
                decimals={2}
                value={localBase}
                onChange={v => setLocalBase(parseFloat(String(v ?? '1.0')) || 0)}
              />
            </div>

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

            {canCompare && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconUsers className="h-4 w-4" />
                  Modo de Comparação
                </Label>
                <Combobox
                  value={localCmp}
                  onValueChange={v => setLocalCmp(v as TaskPerformanceCompareMode)}
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

        <div className="flex gap-2 pt-4 border-t border-border/50">
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

const TaskPerformancePage = () => {
  usePageTracker({ page: 'production-performance-statistics', title: 'Desempenho' });

  const [showFilters, setShowFilters] = useState(false);

  const [chartType, setChartType] = useState<TaskPerformanceChartType>('bar');
  const [primaryChartType, setPrimaryChartType] = useState<'bar' | 'line' | 'line-smooth' | 'area' | 'area-smooth'>('bar');
  const [secondaryChartType, setSecondaryChartType] = useState<'bar' | 'line' | 'line-smooth' | 'area' | 'area-smooth'>('line');
  const [trendLine, setTrendLine] = useState<TrendLineType | null>(null);
  // User override on top of the admin-configured default from the goals feature.
  const [goalOverride, setGoalOverride] = useState<number | null>(null);
  const [goalInput, setGoalInput] = useState('');
  const [goalPopoverOpen, setGoalPopoverOpen] = useState(false);
  const [yearCompareMode, setYearCompareMode] = useState(false);
  const [clickedPeriod, setClickedPeriod] = useState<{
    period: string;
    label: string;
    totalCount: number;
    activeUsers: number;
    workingDays: number;
    avgPerformance: number;
    users: TaskPerformancePeriodUser[];
    mode: 'tasks' | 'collaborators' | 'both';
  } | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartHandleRef = useRef<StatisticsChartHandle>(null);

  const [filters, setFilters] = useState<TaskPerformanceFilters>(() => {
    const y = new Date().getFullYear();
    const { startDate, endDate } = computeDateRange([y.toString()], []);
    return {
      xAxisMode: 'month',
      yAxisMode: 'performance',
      compareMode: 'combined',
      startDate,
      endDate,
      // Canonical input — backend resolves the exact window the same way
      // bonus does, eliminating TZ drift.
      bonusPeriodYear: y,
      positionStep: 0.6,
      positionBase: 1.0,
    };
  });

  const [selectedYears, setSelectedYears]   = useState<string[]>(() => [new Date().getFullYear().toString()]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // ── Page config persistence (auto-restore last config + named presets) ──
  //
  // We persist only the SOURCE inputs; the derived startDate/endDate/bonusPeriod*
  // are rebuilt in applyPageConfig the same way the sheet's handleApply does.
  const pageConfig = useMemo<PageConfig>(() => ({
    version: 1,
    chartType,
    primaryChartType,
    secondaryChartType,
    trendLine,
    yearCompareMode,
    selectedYears,
    selectedMonths,
    xAxisMode: (filters.xAxisMode ?? 'month') as PageConfig['xAxisMode'],
    yAxisMode: (filters.yAxisMode ?? 'performance') as PageConfig['yAxisMode'],
    compareMode: (filters.compareMode ?? 'combined') as PageConfig['compareMode'],
    sectorIds: filters.sectorIds ?? [],
    positionStep: filters.positionStep ?? 0.6,
    positionBase: filters.positionBase ?? 1.0,
  }), [chartType, primaryChartType, secondaryChartType, trendLine, yearCompareMode, selectedYears, selectedMonths, filters]);

  const applyPageConfig = useCallback((config: PageConfig) => {
    // An empty selectedYears would drop the page to the "últimos 12 períodos"
    // default; restore the page default (current year) instead.
    const years = config.selectedYears.length ? config.selectedYears : [new Date().getFullYear().toString()];
    const months = config.selectedMonths;

    // Rebuild filters exactly like the sheet's handleApply.
    const { startDate, endDate } = computeDateRange(years, months);
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
      positionStep: config.positionStep,
      positionBase: config.positionBase,
    });
    setSelectedYears(years);
    setSelectedMonths(months);
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
    pageKey: routes.statistics.production.performance,
    schema: pageConfigSchema,
    current: pageConfig,
    apply: applyPageConfig,
  });

  const isBothMode = filters.yAxisMode === 'both';
  const usePerf    = filters.yAxisMode === 'performance';

  const isComparisonMode =
    (filters.compareMode === 'separated' || filters.compareMode === 'separatedWithTotal') &&
    (filters.sectorIds?.length ?? 0) >= 2;

  const isStackedType = chartType === 'bar-stacked' || chartType === 'line-stacked';

  const includeAmbos =
    isComparisonMode &&
    filters.compareMode === 'separatedWithTotal' &&
    !isStackedType;

  const effectiveChartType: StatisticsChartType = chartType;

  const availableChartTypes = useMemo(() => {
    if (isBothMode) return BOTH_MODE_CHART_TYPE_OPTIONS;
    if (isComparisonMode) return [...BASE_CHART_TYPE_OPTIONS, ...STACKED_CHART_TYPE_OPTIONS];
    return BASE_CHART_TYPE_OPTIONS;
  }, [isBothMode, isComparisonMode]);

  useEffect(() => {
    const valid = availableChartTypes.some(t => t.value === chartType);
    if (!valid) {
      if (isBothMode) setChartType('bar-stacked');
      else if (isStackedType) setChartType(chartType === 'bar-stacked' ? 'bar' : 'line');
      else setChartType('bar');
    }
  }, [availableChartTypes, chartType, isBothMode, isStackedType]);

  useEffect(() => {
    if (filters.xAxisMode === 'year' || selectedYears.length < 2) {
      setYearCompareMode(false);
    }
  }, [filters.xAxisMode, selectedYears.length]);

  useEffect(() => {
    setGoalOverride(null);
    setGoalInput('');
  }, [filters.yAxisMode]);

  // Always fetch monthly data; year aggregation is done on the frontend
  const apiFilters = useMemo(
    () => ({ ...filters, xAxisMode: 'month' as const }),
    [filters],
  );

  const { data, isLoading, isError, error, refetch } = useTaskPerformanceStats(apiFilters);
  const rawItems: TaskPerformanceItem[] = data?.data?.items || [];

  // Two user counts — total production headcount and filtered subset — so the
  // goal-line can be rescaled to the filtered sectors in `count` mode.
  const hasSectorFilter = (filters.sectorIds?.length ?? 0) > 0;
  const { count: totalProductionUserCount } = useActiveProductionUserCount({
    enabled: hasSectorFilter,
  });
  const { count: filteredProductionUserCount } = useActiveProductionUserCount({
    sectorIds: filters.sectorIds,
    enabled: hasSectorFilter,
  });

  // Performance mode pulls the PRODUCTION_AVG_PERFORMANCE goal (tasks per
  // colaborador — a decimal, intrinsically per-user-per-period). Count mode
  // pulls TASKS_COMPLETED; aggregation depends on whether each bar is a month
  // or a year.
  const goalMetric = usePerf
    ? GOAL_METRIC.PRODUCTION_AVG_PERFORMANCE
    : GOAL_METRIC.TASKS_COMPLETED;

  const periodAggregation = usePerf
    ? 'AVERAGE_PER_PERIOD'
    : filters.xAxisMode === 'year'
      ? 'TOTAL'
      : 'AVERAGE_PER_PERIOD';

  // scaleBy only applies in count mode: rescale company-wide TASKS_COMPLETED
  // to the filtered sectors' share of total production users. The performance
  // metric is per-user already, so don't scale.
  const scaleBy = useMemo(() => {
    if (!hasSectorFilter || usePerf) return null;
    return {
      numerator: filteredProductionUserCount,
      denominator: totalProductionUserCount,
    };
  }, [hasSectorFilter, usePerf, filteredProductionUserCount, totalProductionUserCount]);

  const defaultGoal = useDefaultGoal({
    metric: goalMetric,
    period:
      filters.startDate && filters.endDate
        ? { from: filters.startDate, to: filters.endDate }
        : null,
    aggregation: periodAggregation,
    scaleBy,
    enabled: !yearCompareMode,
  });

  // In separated-comparison mode each line represents ONE sector, so the
  // count goal must be split across them. Performance mode is already a
  // per-user rate (PRODUCTION_AVG_PERFORMANCE), so it stays unsplit —
  // splitting would push each sector's expected rate down artificially.
  const goalSectorSplit =
    !isComparisonMode || usePerf ? 1 : Math.max(1, filters.sectorIds?.length ?? 1);

  const goalValue = useMemo(() => {
    const raw = goalOverride ?? defaultGoal.value;
    if (raw == null) return null;
    return goalSectorSplit > 1 ? raw / goalSectorSplit : raw;
  }, [goalOverride, defaultGoal.value, goalSectorSplit]);

  const goalSource: 'override' | 'default' | 'none' =
    goalOverride != null ? 'override' : defaultGoal.value != null ? 'default' : 'none';
  const summary = data?.data?.summary;

  // Period filter / year aggregation. For year mode we sum totalCount and
  // totalContribution across months and recompute avgPerformance from those
  // sums — mean of monthly avgPerformance would be wrong when months differ
  // in size (a 22-day month should count more than an 11-day partial one).
  const items = useMemo(() => {
    if (!rawItems.length) return rawItems;

    const hasYearFilter  = selectedYears.length > 0;
    const hasMonthFilter = selectedMonths.length > 0;

    if (filters.xAxisMode !== 'year') {
      if (!hasYearFilter && !hasMonthFilter) return rawItems;
      return rawItems.filter(item => {
        const [yearPart, monthPart] = item.period.split('-');
        return (!hasYearFilter || selectedYears.includes(yearPart)) &&
               (!hasMonthFilter || selectedMonths.includes(monthPart));
      });
    }

    const yearGroups = new Map<string, TaskPerformanceItem[]>();
    rawItems.forEach(item => {
      const yearPart = item.period.split('-')[0];
      if (hasYearFilter && !selectedYears.includes(yearPart)) return;
      if (!yearGroups.has(yearPart)) yearGroups.set(yearPart, []);
      yearGroups.get(yearPart)!.push(item);
    });

    return Array.from(yearGroups.entries())
      .map(([year, monthItems]) => {
        const totalCount = monthItems.reduce((s, i) => s + i.totalCount, 0);
        const workingDays = monthItems.reduce((s, i) => s + i.workingDays, 0);
        const totalContribution = monthItems.reduce((s, i) => s + i.totalContribution, 0);
        const activeUsers = monthItems.length
          ? Math.round(monthItems.reduce((s, i) => s + i.activeUsers, 0) / monthItems.length)
          : 0;
        const avgPerformance = totalContribution > 0 ? totalCount / totalContribution : 0;
        return {
          period: year,
          periodLabel: year,
          totalCount,
          activeUsers,
          workingDays,
          totalContribution: +totalContribution.toFixed(2),
          avgPerformance: +avgPerformance.toFixed(2),
          // Year-aggregate items leave `users` empty here; the click handler
          // falls back to flattening monthly items' users for the drilldown.
          users: [],
          comparisons: undefined,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [rawItems, filters.xAxisMode, selectedYears, selectedMonths]);

  // Per-period goal values for stepped goal line (performance page).
  const perPeriodGoalValues = useMemo(() => {
    if (goalOverride != null || yearCompareMode || !defaultGoal.perPeriodValues) return null;
    return items.map(item => {
      let rawVal: number | null;
      if (filters.xAxisMode === 'year') {
        let total = 0; let count = 0;
        for (let m = 1; m <= 12; m++) {
          const key = `${item.period}-${String(m).padStart(2, '0')}`;
          const v = defaultGoal.perPeriodValues!.get(key);
          if (v != null) { total += v; count++; }
        }
        if (count === 0) return null;
        // Performance goals are per-user rates (AVERAGE_PER_PERIOD) — average
        // across months. Count goals are totals — sum across months.
        rawVal = usePerf ? total / count : total;
      } else {
        rawVal = defaultGoal.perPeriodValues!.get(item.period) ?? null;
      }
      if (rawVal == null) return null;
      let val = rawVal;
      if (scaleBy?.numerator != null && scaleBy.denominator != null && scaleBy.denominator > 0) {
        val = val * (scaleBy.numerator / scaleBy.denominator);
      }
      if (goalSectorSplit > 1) val = val / goalSectorSplit;
      return val;
    });
  }, [goalOverride, yearCompareMode, usePerf, defaultGoal.perPeriodValues, items, scaleBy, goalSectorSplit, filters.xAxisMode]);

  const handleFilterApply = useCallback((f: TaskPerformanceFilters, years: string[], months: string[], yearCompare: boolean) => {
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
    if (filters.yAxisMode !== 'performance') c++;
    return c;
  }, [filters, selectedYears, selectedMonths]);

  const activeSectorIds = useMemo(() => {
    const ids = new Set<string>();
    if (!isComparisonMode) return ids;
    items.forEach(item => {
      item.comparisons?.forEach(comp => {
        if ((usePerf ? comp.avgPerformance : comp.totalCount) > 0) ids.add(comp.sectorId);
      });
    });
    return ids;
  }, [items, isComparisonMode, usePerf]);

  const sectorColumns = useMemo(() => {
    if (!isComparisonMode || !items.length || !items[0].comparisons) return [];
    const cols = items[0].comparisons
      .filter(c => activeSectorIds.has(c.sectorId))
      .map(c => c.sectorName);
    if (includeAmbos) cols.push('Ambos');
    return cols;
  }, [isComparisonMode, items, includeAmbos, activeSectorIds]);

  // sectorId → bar color. Mirrors statistics-chart.tsx's per-comparison color
  // assignment (CHART_COLORS indexed by the order of items[0].comparisons,
  // filtered to active sectors). Passed to the period modal so the name
  // tinting matches what the user just clicked on the chart.
  const sectorColorMap = useMemo<Record<string, string> | undefined>(() => {
    if (!isComparisonMode || !items.length || !items[0].comparisons) return undefined;
    const map: Record<string, string> = {};
    const active = items[0].comparisons.filter(c => activeSectorIds.has(c.sectorId));
    active.forEach((c, i) => {
      map[c.sectorId] = CHART_COLORS[i % CHART_COLORS.length];
    });
    return map;
  }, [isComparisonMode, items, activeSectorIds]);

  const stripYearOnAxis = filters.xAxisMode !== 'year' && selectedYears.length === 1;
  const chartData = useMemo(() => {
    if (!items.length) return [];
    return items.map(item => ({
      name: stripYearOnAxis ? item.periodLabel.replace(/\s+\d{4}\s*$/, '').trim() : item.periodLabel,
      value: usePerf ? item.avgPerformance : item.totalCount,
      secondaryValue: isBothMode ? item.avgPerformance : undefined,
      comparisons: isComparisonMode && item.comparisons
        ? [
            ...item.comparisons
              .filter(c => activeSectorIds.has(c.sectorId))
              .map(c => ({
                entityName: c.sectorName,
                value: usePerf ? c.avgPerformance : c.totalCount,
                secondaryValue: isBothMode ? c.avgPerformance : undefined,
              })),
            ...(includeAmbos
              ? [{
                  entityName: 'Ambos',
                  value: usePerf ? item.avgPerformance : item.totalCount,
                  secondaryValue: isBothMode ? item.avgPerformance : undefined,
                }]
              : []),
          ]
        : undefined,
    }));
  }, [items, isComparisonMode, includeAmbos, usePerf, isBothMode, activeSectorIds, stripYearOnAxis]);

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
            value: item ? (usePerf ? item.avgPerformance : item.totalCount) : 0,
            secondaryValue: isBothMode && item ? item.avgPerformance : undefined,
          };
        });
        return {
          name: MONTH_NAMES[monthIdx],
          value: comparisons[0]?.value ?? 0,
          comparisons,
        };
      })
      .filter(row => row.comparisons.some(c => c.value > 0));
  }, [rawItems, yearCompareMode, filters.xAxisMode, selectedYears, selectedMonths, usePerf, isBothMode]);

  const effectiveChartData  = yearCompareChartData ?? chartData;
  const effectiveIsComparison = yearCompareMode && yearCompareChartData != null ? true : isComparisonMode;

  const chartDataKey = `${effectiveIsComparison}-${filters.yAxisMode}-${filters.compareMode}-${yearCompareMode}`;

  const periodsWithData = useMemo(
    () => items.filter(i => (i.totalCount ?? 0) > 0),
    [items],
  );

  // Task-weighted mean of per-period avgPerformance — a month with 50 tasks
  // counts ~10× a month with 5. Matches productivity's summary logic.
  const summaryPerformance = useMemo(() => {
    if (!periodsWithData.length) return 0;
    let weighted = 0;
    let total = 0;
    periodsWithData.forEach(i => {
      if (i.totalCount > 0) {
        weighted += i.avgPerformance * i.totalCount;
        total += i.totalCount;
      }
    });
    return total > 0 ? weighted / total : 0;
  }, [periodsWithData]);

  // "Melhor Média" — peak monthly avgPerformance across displayed periods.
  const bestPerformance = useMemo(
    () => (items.length ? Math.max(...items.map(i => i.avgPerformance ?? 0)) : 0),
    [items],
  );

  const avgWorkingDays = useMemo(() => {
    const periods = items.filter(i => (i.workingDays ?? 0) > 0);
    if (!periods.length) return 0;
    return periods.reduce((s, i) => s + (i.workingDays ?? 0), 0) / periods.length;
  }, [items]);

  // Drill-down sources for the summary cards. Total/peak share the same modal
  // payload shape — both pull users from rawItems so year-aggregate rows still
  // have something to show in the drilldown.
  const openPeriodModalFor = useCallback((
    target: TaskPerformanceItem | null | undefined,
    mode: 'tasks' | 'collaborators' | 'both' = 'both',
  ) => {
    if (!target) return;
    let usersList: TaskPerformancePeriodUser[] = target.users ?? [];
    if (filters.xAxisMode === 'year') {
      usersList = rawItems
        .filter(i => i.period.startsWith(`${target.period}-`))
        .flatMap(i => i.users ?? []);
    }
    setClickedPeriod({
      period: target.period,
      label: target.periodLabel,
      totalCount: target.totalCount,
      activeUsers: target.activeUsers,
      workingDays: target.workingDays,
      avgPerformance: target.avgPerformance,
      users: usersList,
      mode,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.xAxisMode, rawItems]);

  // "Total Concluídas" — open the most recent period that has data so the user
  // lands on a meaningful drilldown rather than an empty future month.
  const mostRecentActive = useMemo(
    () => [...periodsWithData].sort((a, b) => b.period.localeCompare(a.period))[0] ?? null,
    [periodsWithData],
  );

  const canDrillTotal = !!mostRecentActive && (summary?.totalCompleted ?? 0) > 0;

  const chartYAxisMode: YAxisMode = isBothMode ? 'both' : 'count';

  const valueFormatter = useCallback((value: number): string => {
    if (usePerf) return value.toFixed(2);
    return Math.round(value).toString();
  }, [usePerf]);

  const secondaryValueFormatter = useCallback((value: number) => value.toFixed(2), []);

  const handleChartClick = useCallback((dataIndex: number, name: string, seriesName: string) => {
    // Drill from year-compare bars: seriesName = year, name = month label;
    // reconstruct the period key and pull the monthly item from rawItems
    // (per-user data lives on the monthly items, not the year-aggregate).
    if (yearCompareChartData) {
      const monthNum = MONTH_NAME_TO_NUM[name];
      if (monthNum && /^\d{4}$/.test(seriesName)) {
        const period = `${seriesName}-${monthNum}`;
        const raw = rawItems.find(i => i.period === period);
        if (raw) {
          setClickedPeriod({
            period,
            label: `${name} ${seriesName}`,
            totalCount: raw.totalCount,
            activeUsers: raw.activeUsers,
            workingDays: raw.workingDays,
            avgPerformance: raw.avgPerformance,
            users: raw.users ?? [],
            mode: 'both',
          });
        }
      }
      return;
    }
    const item = items[dataIndex];
    if (!item) return;
    // In year mode the item is a roll-up — its per-user data isn't carried
    // through the client-side aggregation; fall back to the original monthly
    // items that compose this year so the modal still has something to show.
    let usersList = item.users ?? [];
    if (filters.xAxisMode === 'year') {
      const yearPart = item.period;
      usersList = rawItems
        .filter(i => i.period.startsWith(`${yearPart}-`))
        .flatMap(i => i.users ?? []);
    }
    setClickedPeriod({
      period: item.period,
      label: item.periodLabel,
      totalCount: item.totalCount,
      activeUsers: item.activeUsers,
      workingDays: item.workingDays,
      avgPerformance: item.avgPerformance,
      users: usersList,
      mode: 'both',
    });
  }, [yearCompareChartData, items, rawItems, filters.xAxisMode]);

  const handleExportCSV = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Tarefas', 'Colaboradores Ativos', 'Dias Úteis', 'Média Ajustada'];
      const rows = items.map(i => [
        i.periodLabel,
        String(i.totalCount),
        String(i.activeUsers),
        String(i.workingDays),
        i.avgPerformance.toFixed(2),
      ]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `desempenho-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('Dados exportados!');
    } catch {
      toast.error('Erro ao exportar dados');
    }
  }, [items]);

  const handleExportXLSX = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      // Sheet 1: per-period summary.
      const pHeaders = ['Período', 'Tarefas', 'Colaboradores Ativos', 'Dias Úteis', 'Média Ajustada'];
      const pRows = items.map(i => [
        i.periodLabel,
        i.totalCount,
        i.activeUsers,
        i.workingDays,
        parseFloat(i.avgPerformance.toFixed(2)),
      ]);
      const ws1 = XLSX.utils.aoa_to_sheet([pHeaders, ...pRows]);
      ws1['!cols'] = pHeaders.map((_, i) => ({ wch: i === 0 ? 18 : 14 }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, 'Por Período');

      // Sheet 2: per-user-per-period rows (the per-period attribution that
      // backs the modal's Colaboradores tab — flattened for spreadsheet use).
      const uHeaders = ['Período', 'Colaborador', 'Setor', 'Cargo', 'Peso', 'Dias Úteis', 'Tarefas Atribuídas', 'Por Dia'];
      const uRows: (string | number)[][] = [];
      rawItems.forEach(i => {
        (i.users ?? []).forEach(u => {
          uRows.push([
            i.periodLabel,
            u.userName,
            u.sectorName ?? '',
            u.positionName ?? '',
            parseFloat(u.weight.toFixed(2)),
            u.workingDays,
            parseFloat(u.tasksAllocated.toFixed(2)),
            parseFloat(u.dailyProductivity.toFixed(4)),
          ]);
        });
      });
      if (uRows.length) {
        const ws2 = XLSX.utils.aoa_to_sheet([uHeaders, ...uRows]);
        ws2['!cols'] = uHeaders.map((_, i) => ({ wch: i === 0 ? 18 : i === 1 ? 24 : 14 }));
        XLSX.utils.book_append_sheet(wb, ws2, 'Colaboradores');
      }

      XLSX.writeFile(wb, `desempenho-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`);
      toast.success('Planilha exportada com sucesso!');
    } catch {
      toast.error('Erro ao exportar planilha');
    }
  }, [items, rawItems]);

  const handleExportPDF = useCallback(async () => {
    if (!chartData.length) { toast.error('Nenhum dado para exportar'); return; }
    const chartOption = chartHandleRef.current?.getOption();
    if (!chartOption) { toast.error('Gráfico ainda não está pronto'); return; }

    const toastId = toast.loading('Gerando PDF...');
    try {
      const filterLines: string[] = [];
      filterLines.push(
        filters.xAxisMode === 'year' ? 'Agrupamento: Anos' : 'Agrupamento: Meses (26–25)',
      );
      if (selectedYears.length) filterLines.push(`Anos: ${[...selectedYears].sort().join(', ')}`);
      if (selectedMonths.length) filterLines.push(`Meses: ${selectedMonths.length} selecionados`);
      filterLines.push(`Passo entre cargos: ${(filters.positionStep ?? 0.6).toFixed(2)}`);
      filterLines.push(`Peso base: ${(filters.positionBase ?? 1.0).toFixed(2)}`);
      if (usePerf) filterLines.push('Métrica: Produção média/dia por colaborador');
      else if (isBothMode) filterLines.push('Métrica: Total + Produção/dia');
      if (isComparisonMode && sectorColumns.length) {
        filterLines.push(`Setores: ${sectorColumns.filter(c => c !== 'Ambos').join(', ')}`);
      }
      if (trendLine) filterLines.push(`Tendência: ${TREND_LABELS[trendLine]}`);
      if (goalValue != null) filterLines.push(`Meta: ${goalValue}`);

      const summaryStats: Array<{ label: string; value: string }> = [
        { label: 'Total Concluídas', value: formatNumber(summary?.totalCompleted ?? 0) },
        { label: 'Colaboradores',    value: String(summary?.totalActiveUsers ?? 0) },
        { label: 'Média ajustada',   value: summaryPerformance.toFixed(2) },
        { label: 'Períodos',         value: String(periodsWithData.length) },
      ];

      await exportProductivityPdf({
        title: 'Desempenho',
        subtitle: 'Tarefas atribuídas por colaborador (ponderado por cargo e dias úteis)',
        filterLines,
        chartOption,
        summaryStats,
        fileSuffix: 'desempenho',
      });

      toast.dismiss(toastId);
      toast.success('PDF exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      toast.dismiss(toastId);
      toast.error('Erro ao exportar PDF');
    }
  }, [chartData, filters, selectedYears, selectedMonths, usePerf, isBothMode, isComparisonMode, sectorColumns, summary, summaryPerformance, periodsWithData, trendLine, goalValue]);

  const renderChart = () => {
    if (isLoading) {
      return (
        <div style={{ height: '100%' }} className="flex items-center justify-center">
          <div className="space-y-3 w-full px-8">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-[400px] w-full" />
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
    return (
      <StatisticsChart
        ref={chartHandleRef}
        key={chartDataKey}
        data={effectiveChartData}
        chartType={effectiveChartType}
        yAxisMode={chartYAxisMode}
        isComparisonMode={effectiveIsComparison}
        height="100%"
        yAxisLabel={usePerf ? 'Média/Colaborador (ajustada)' : 'Tarefas Concluídas'}
        valueFormatter={valueFormatter}
        secondaryValueFormatter={secondaryValueFormatter}
        tooltipLabels={{
          primary:   isBothMode ? 'Total Tarefas' : (usePerf ? 'Média ajustada' : 'Tarefas Concluídas'),
          secondary: isBothMode ? 'Média ajustada' : undefined,
        }}
        trendLine={trendLine}
        goalLine={goalValue != null && !perPeriodGoalValues?.some(v => v != null) ? { value: goalValue, label: 'Meta Desempenho' } : null}
        perPeriodGoalLine={perPeriodGoalValues?.some(v => v != null) ? { values: perPeriodGoalValues, label: 'Meta Desempenho' } : null}
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
          title="Desempenho"
          favoritePage={FAVORITE_PAGES.ESTATISTICAS_PRODUCAO_DESEMPENHO}
          icon={IconActivity}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Produção', href: routes.statistics.production.root },
            { label: 'Desempenho' },
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

          {/* ============ Summary + Chart Card ============ */}
          <Card className="mt-4 flex-1 min-h-0 flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle>Tarefas Concluídas por Período</CardTitle>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {isBothMode ? (
                    <>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            {BASE_CHART_TYPE_OPTIONS.find(t => t.value === primaryChartType)?.icon
                              ? (() => { const I = BASE_CHART_TYPE_OPTIONS.find(t => t.value === primaryChartType)!.icon; return <I className="h-4 w-4 mr-1" />; })()
                              : <ChartIcon className="h-4 w-4 mr-1" />}
                            Total
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Total Tarefas</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuRadioGroup value={primaryChartType} onValueChange={v => setPrimaryChartType(v as typeof primaryChartType)}>
                            {BASE_CHART_TYPE_OPTIONS.map(ct => { const I = ct.icon; return (
                              <DropdownMenuRadioItem key={ct.value} value={ct.value}>
                                <I className="h-4 w-4 mr-2" /><span>{ct.label}</span>
                              </DropdownMenuRadioItem>
                            ); })}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            {BASE_CHART_TYPE_OPTIONS.find(t => t.value === secondaryChartType)?.icon
                              ? (() => { const I = BASE_CHART_TYPE_OPTIONS.find(t => t.value === secondaryChartType)!.icon; return <I className="h-4 w-4 mr-1" />; })()
                              : <ChartIcon className="h-4 w-4 mr-1" />}
                            Desempenho
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Média Ajustada</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuRadioGroup value={secondaryChartType} onValueChange={v => setSecondaryChartType(v as typeof secondaryChartType)}>
                            {BASE_CHART_TYPE_OPTIONS.map(ct => { const I = ct.icon; return (
                              <DropdownMenuRadioItem key={ct.value} value={ct.value}>
                                <I className="h-4 w-4 mr-2" /><span>{ct.label}</span>
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
                          onValueChange={v => setChartType(v as TaskPerformanceChartType)}
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

                  <Popover open={goalPopoverOpen} onOpenChange={setGoalPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant={goalValue != null ? 'default' : 'outline'} size="sm">
                        <IconTarget className="h-4 w-4 mr-2" />
                        {goalValue != null
                          ? `Meta: ${formatNumber(goalValue, usePerf ? 2 : 0)}`
                          : 'Meta'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Definir Meta</p>
                          {goalSource === 'default' && (
                            <p className="text-xs text-muted-foreground">Padrão de Administração › Metas</p>
                          )}
                          {goalSource === 'override' && defaultGoal.value != null && (
                            <p className="text-xs text-muted-foreground">
                              Sobrescrevendo padrão ({formatNumber(defaultGoal.value, usePerf ? 2 : 0)})
                            </p>
                          )}
                          {goalSource === 'none' && (
                            <p className="text-xs text-muted-foreground">Sem meta padrão configurada</p>
                          )}
                        </div>
                        <Input
                          type="number"
                          min={0}
                          placeholder={
                            defaultGoal.value != null
                              ? `Padrão: ${defaultGoal.value}`
                              : usePerf ? 'Ex: 75' : 'Ex: 100'
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
                        CSV (Colaboradores)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportXLSX}>
                        <IconFileTypeXls className="h-4 w-4 mr-2" />
                        Excel (XLSX)
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
                  onClick={canDrillTotal ? () => openPeriodModalFor(mostRecentActive, 'tasks') : undefined}
                  role={canDrillTotal ? 'button' : undefined}
                  tabIndex={canDrillTotal ? 0 : undefined}
                  onKeyDown={e => {
                    if (canDrillTotal && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      openPeriodModalFor(mostRecentActive, 'tasks');
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

                <Card
                  className={`py-2 ${canDrillTotal ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                  onClick={canDrillTotal ? () => openPeriodModalFor(mostRecentActive, 'collaborators') : undefined}
                  role={canDrillTotal ? 'button' : undefined}
                  tabIndex={canDrillTotal ? 0 : undefined}
                  onKeyDown={e => {
                    if (canDrillTotal && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      openPeriodModalFor(mostRecentActive, 'collaborators');
                    }
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium">Colaboradores Ativos</CardTitle>
                    <IconUsers className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading
                      ? <Skeleton className="h-7 w-20" />
                      : <div className="text-xl font-bold">{formatNumber(summary?.totalActiveUsers ?? 0)}</div>
                    }
                  </CardContent>
                </Card>

                <Card className="py-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium">Média por Colaborador (ajustada)</CardTitle>
                    <IconActivity className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading
                      ? <Skeleton className="h-7 w-20" />
                      : <div className="text-xl font-bold">{summaryPerformance.toFixed(2)}</div>
                    }
                  </CardContent>
                </Card>

                <Card className="py-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium">
                      {usePerf || isBothMode ? 'Melhor Média' : 'Dias Úteis / Período'}
                    </CardTitle>
                    {usePerf || isBothMode
                      ? <IconTrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                      : <IconCalendarStats className="h-3.5 w-3.5 text-muted-foreground" />}
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading
                      ? <Skeleton className="h-7 w-20" />
                      : (
                        <div className="text-xl font-bold">
                          {usePerf || isBothMode
                            ? bestPerformance.toFixed(2)
                            : formatNumber(avgWorkingDays, 1)}
                        </div>
                      )
                    }
                  </CardContent>
                </Card>
              </div>

              {/* Chart (compact) */}
              <Card className="flex-1 min-h-0 flex flex-col">
                <CardContent className="flex-1 min-h-0 p-4">
                  <div ref={chartContainerRef} className="h-full">
                    {renderChart()}
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          <TaskPerformanceFiltersSheet
            open={showFilters}
            onOpenChange={setShowFilters}
            filters={filters}
            selectedYears={selectedYears}
            selectedMonths={selectedMonths}
            yearCompareMode={yearCompareMode}
            onApply={handleFilterApply}
          />

      {clickedPeriod && (
        <PerformancePeriodModal
          open={!!clickedPeriod}
          onOpenChange={open => { if (!open) setClickedPeriod(null); }}
          period={clickedPeriod.period}
          label={clickedPeriod.label}
          sectorIds={filters.sectorIds}
          totalCount={clickedPeriod.totalCount}
          activeUsers={clickedPeriod.activeUsers}
          workingDays={clickedPeriod.workingDays}
          avgPerformance={clickedPeriod.avgPerformance}
          users={clickedPeriod.users}
          mode={clickedPeriod.mode}
          sectorColorMap={sectorColorMap}
        />
      )}
    </div>
  );
};

export const ProductionPerformanceStatisticsPage = () => <TaskPerformancePage />;
export default ProductionPerformanceStatisticsPage;
