// web/src/pages/production/statistics/bonus-value.tsx
//
// "Relação Bônus / Produção" — day-by-day visualization of how the aggregate
// bonus value accrues across a single business period (26th → 25th), shown
// alongside cumulative tasks completed.
//
// Math note: the bonus formula is non-monotonic at low B1 values (calibrated
// for end-of-period averages, see bonus.service.ts:getBonusTimeline). The
// backend computes a single projected end-of-period bonus and distributes it
// proportionally to weighted task contribution per day, giving a monotonic
// accrual curve. This file just renders that data — no per-day bonus math
// happens here.

import { useState, useMemo, useCallback, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Combobox } from '@/components/ui/combobox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { routes, SECTOR_PRIVILEGES } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useBonusValueTimeline } from '@/hooks/production/use-production-analytics';
import { getSectors } from '@/api-client/sector';
import { sectorKeys } from '@/hooks/common/query-keys';
import { formatCurrency } from '@/types/statistics-common';
import {
  IconCoins,
  IconFilter,
  IconBuilding,
  IconCalendarStats,
  IconX,
  IconAlertCircle,
  IconRefresh,
  IconTrendingUp,
  IconClock,
  IconChecks,
  IconChartLine,
  IconChartArea,
  IconChartAreaLine,
  IconWaveSine,
  IconLine,
} from '@tabler/icons-react';

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

// Business period rule: the period ending on day 25 of month M (year Y) is
// referenced as (Y, M). So 13 May → period (2026, 5); 26 May → period (2026, 6).
function getCurrentBusinessPeriod(): { year: number; month: number } {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (now.getDate() > 25) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return { year, month };
}

// =====================
// Chart types
// =====================

type BonusChartType = 'dual-area' | 'mixed' | 'dual-line';

const CHART_TYPE_OPTIONS: Array<{
  value: BonusChartType;
  label: string;
  description: string;
  icon: typeof IconChartArea;
}> = [
  {
    value: 'dual-area',
    label: 'Áreas Duplas',
    description: 'Bônus e Tarefas em áreas, eixos separados',
    icon: IconChartArea,
  },
  {
    value: 'mixed',
    label: 'Combinado',
    description: 'Tarefas em área + Bônus em linha',
    icon: IconChartAreaLine,
  },
  {
    value: 'dual-line',
    label: 'Linhas',
    description: 'Bônus e Tarefas em linhas',
    icon: IconChartLine,
  },
];

const CURVE_STYLE_OPTIONS: Array<{
  value: 'rect' | 'smooth';
  label: string;
  description: string;
  icon: typeof IconLine;
}> = [
  { value: 'rect',   label: 'Reto',  description: 'Segmentos retos entre pontos',   icon: IconLine },
  { value: 'smooth', label: 'Suave', description: 'Curva suavizada entre pontos',   icon: IconWaveSine },
];

// Dark-mode contrast palette. Chosen so labels read clearly against a near-black
// canvas without bleeding white.
const COLORS = {
  bonus: '#10b981',          // emerald-500
  bonusFade: 'rgba(16, 185, 129, 0.18)',
  tasks: '#3b82f6',          // blue-500
  tasksFade: 'rgba(59, 130, 246, 0.18)',
  forecastBonus: '#6ee7b7',  // emerald-300, dashed
  forecastTasks: '#93c5fd',  // blue-300, dashed
  today: '#fbbf24',          // amber-400 — the "now" vertical line
  axisLabel: '#d1d5db',      // gray-300
  axisName: '#f3f4f6',       // gray-100
  splitLine: 'rgba(148, 163, 184, 0.18)', // slate-400 @ 18%
};

// =====================
// Filter sheet
// =====================

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  sectorIds: string[];
  onApply: (year: number, month: number, sectorIds: string[]) => void;
}

function BonusValueFiltersSheet({
  open, onOpenChange, year, month, sectorIds, onApply,
}: FilterSheetProps) {
  const [localYear, setLocalYear] = useState<string>(String(year));
  const [localMonth, setLocalMonth] = useState<string>(String(month).padStart(2, '0'));
  const [localSectors, setLocalSectors] = useState<string[]>(sectorIds);

  useEffect(() => {
    if (open) {
      setLocalYear(String(year));
      setLocalMonth(String(month).padStart(2, '0'));
      setLocalSectors(sectorIds);
    }
  }, [open, year, month, sectorIds]);

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

  const handleApply = useCallback(() => {
    onApply(parseInt(localYear, 10), parseInt(localMonth, 10), localSectors);
    onOpenChange(false);
  }, [localYear, localMonth, localSectors, onApply, onOpenChange]);

  const handleClear = useCallback(() => {
    const current = getCurrentBusinessPeriod();
    setLocalYear(String(current.year));
    setLocalMonth(String(current.month).padStart(2, '0'));
    setLocalSectors([]);
  }, []);

  const activeCount = sectorIds.length > 0 ? 1 : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros
            {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
          </SheetTitle>
          <SheetDescription>Escolha o período e os setores para analisar a relação bônus/produção</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconCalendarStats className="h-4 w-4" />
                Ano
              </Label>
              <Combobox
                value={localYear}
                onValueChange={v => typeof v === 'string' && setLocalYear(v)}
                options={YEAR_OPTIONS}
                placeholder="Selecione o ano..."
                searchable={false}
                clearable={false}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconCalendarStats className="h-4 w-4" />
                Mês
              </Label>
              <Combobox
                value={localMonth}
                onValueChange={v => typeof v === 'string' && setLocalMonth(v)}
                options={MONTH_OPTIONS}
                placeholder="Selecione o mês..."
                searchable={false}
                clearable={false}
              />
              <p className="text-xs text-muted-foreground">
                O período vai do dia 26 do mês anterior ao dia 25 do mês escolhido.
              </p>
            </div>

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
                Sem seleção = todos os setores de produção.
              </p>
            </div>
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
// Summary card
// =====================

interface SummaryCardProps {
  title: string;
  value: string;
  hint?: string;
  icon: typeof IconCoins;
  emphasis?: 'primary' | 'forecast' | 'muted';
}

function SummaryCard({ title, value, hint, icon: Icon, emphasis = 'muted' }: SummaryCardProps) {
  const valueColor =
    emphasis === 'primary'  ? 'text-foreground' :
    emphasis === 'forecast' ? 'text-emerald-400' :
    'text-foreground';
  const iconColor =
    emphasis === 'forecast' ? 'text-emerald-400' :
    emphasis === 'primary'  ? 'text-blue-400' :
    'text-muted-foreground';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-xs">{title}</CardDescription>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${valueColor}`}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

// =====================
// Chart option builder
// =====================

interface BuildChartArgs {
  days: Array<{
    dayIndex: number;
    date: string;
    dateLabel: string;
    taskCount: number;
    weightedTaskCount: number;
    activeUsers: number;
    averageTasksPerUser: number;
    totalBonusValue: number;
    isForecast: boolean;
  }>;
  chartType: BonusChartType;
  smooth: boolean;
}

function buildChartOption({ days, chartType, smooth }: BuildChartArgs): EChartsOption {
  const xLabels = days.map(d => d.dateLabel);

  // Today boundary: last index where isForecast=false. Both Realizado and
  // Previsão series include this index so the two lines visually connect.
  let lastRealIdx = -1;
  for (let i = days.length - 1; i >= 0; i--) {
    if (!days[i].isForecast) { lastRealIdx = i; break; }
  }
  const hasForecast = days.some(d => d.isForecast);

  // Series data — null where not applicable so the line breaks cleanly.
  const tasksReal     = days.map((d, i) => (i <= lastRealIdx ? d.weightedTaskCount : null));
  const tasksForecast = days.map((d, i) => (i >= lastRealIdx && lastRealIdx >= 0 ? d.weightedTaskCount : null));
  const bonusReal     = days.map((d, i) => (i <= lastRealIdx ? d.totalBonusValue : null));
  const bonusForecast = days.map((d, i) => (i >= lastRealIdx && lastRealIdx >= 0 ? d.totalBonusValue : null));

  // Common axis styling (dark mode contrast).
  const axisCommon = {
    axisLine:  { lineStyle: { color: COLORS.axisLabel, opacity: 0.4 } },
    axisLabel: { color: COLORS.axisLabel, fontSize: 11 },
    splitLine: { lineStyle: { color: COLORS.splitLine } },
    nameTextStyle: { color: COLORS.axisName, fontWeight: 600, fontSize: 12 },
  };

  // Today marker — vertical dashed amber line, attached to a hidden series so
  // it renders on top of all real series.
  const todayMarkLine = hasForecast && lastRealIdx >= 0
    ? {
        markLine: {
          silent: true,
          symbol: ['none', 'none'] as ['none', 'none'],
          lineStyle: { color: COLORS.today, type: 'dashed' as const, width: 1.5, opacity: 0.85 },
          label: {
            show: true,
            color: COLORS.today,
            position: 'insideEndTop' as const,
            formatter: 'Hoje',
            fontWeight: 600,
            fontSize: 11,
            padding: [2, 6, 2, 6] as [number, number, number, number],
          },
          data: [{ xAxis: lastRealIdx } as any],
        },
      }
    : {};

  const tasksAsArea = chartType === 'dual-area' || chartType === 'mixed';
  const bonusAsArea = chartType === 'dual-area';

  const tooltip = {
    trigger: 'axis' as const,
    confine: true,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderColor: 'rgba(148, 163, 184, 0.3)',
    textStyle: { color: COLORS.axisName },
    formatter: (params: any) => {
      if (!Array.isArray(params) || params.length === 0) return '';
      const idx = params[0]?.dataIndex;
      if (idx == null) return '';
      const day = days[idx];
      const tag = day.isForecast
        ? `<span style="color:${COLORS.today};">(previsão)</span>`
        : '';
      return [
        `<strong>${day.dateLabel}</strong> ${tag}`,
        `Bônus: <strong style="color:${COLORS.bonus};">${formatCurrency(day.totalBonusValue)}</strong>`,
        `Tarefas concluídas: <strong style="color:${COLORS.tasks};">${day.taskCount}</strong> (peso ${day.weightedTaskCount.toFixed(2)})`,
        `Média por colaborador: ${day.averageTasksPerUser.toFixed(2)}`,
      ].join('<br/>');
    },
  };

  // Dual-axis chart. Left axis = Tarefas (blue), right axis = Bônus (emerald).
  // `alignTicks: true` on the right axis forces its split points to mirror the
  // left axis's, so horizontal grid lines line up cleanly between both metrics.
  return {
    tooltip,
    legend: {
      data: hasForecast
        ? ['Tarefas (realizado)', 'Tarefas (previsão)', 'Bônus (realizado)', 'Bônus (previsão)']
        : ['Tarefas (realizado)', 'Bônus (realizado)'],
      bottom: 0,
      textStyle: { color: COLORS.axisName },
      itemGap: 16,
    },
    grid: { left: 60, right: 70, top: 32, bottom: 44, containLabel: true },
    xAxis: {
      type: 'category',
      data: xLabels,
      ...axisCommon,
      axisLabel: { ...axisCommon.axisLabel, interval: Math.max(0, Math.floor(xLabels.length / 12) - 1) },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Tarefas',
        nameLocation: 'end',
        nameGap: 16,
        position: 'left',
        min: 0,
        splitNumber: 5,
        ...axisCommon,
        nameTextStyle: { ...axisCommon.nameTextStyle, color: COLORS.tasks },
      },
      {
        type: 'value',
        name: 'R$',
        nameLocation: 'end',
        nameGap: 16,
        position: 'right',
        min: 0,
        alignTicks: true,
        ...axisCommon,
        // Hide the right axis's own split lines — the left axis's lines already
        // span the full plot width, so showing both creates a double grid that
        // looks busy and offset. Must come AFTER ...axisCommon to override.
        splitLine: { show: false },
        nameTextStyle: { ...axisCommon.nameTextStyle, color: COLORS.bonus },
        axisLabel: { ...axisCommon.axisLabel, formatter: (v: number) => formatCurrency(v) },
      },
    ],
    series: [
      {
        name: 'Tarefas (realizado)',
        type: 'line',
        yAxisIndex: 0,
        data: tasksReal,
        smooth,
        showSymbol: false,
        lineStyle: { width: 2.5, color: COLORS.tasks },
        itemStyle: { color: COLORS.tasks },
        ...(tasksAsArea ? { areaStyle: { color: COLORS.tasksFade } } : {}),
        connectNulls: false,
        ...todayMarkLine,
      },
      ...(hasForecast ? [{
        name: 'Tarefas (previsão)',
        type: 'line' as const,
        yAxisIndex: 0,
        data: tasksForecast,
        smooth,
        showSymbol: false,
        lineStyle: { width: 2.5, color: COLORS.forecastTasks, type: 'dashed' as const },
        itemStyle: { color: COLORS.forecastTasks },
        connectNulls: false,
      }] : []),
      {
        name: 'Bônus (realizado)',
        type: 'line',
        yAxisIndex: 1,
        data: bonusReal,
        smooth,
        showSymbol: false,
        lineStyle: { width: 2.5, color: COLORS.bonus },
        itemStyle: { color: COLORS.bonus },
        ...(bonusAsArea ? { areaStyle: { color: COLORS.bonusFade } } : {}),
        connectNulls: false,
      },
      ...(hasForecast ? [{
        name: 'Bônus (previsão)',
        type: 'line' as const,
        yAxisIndex: 1,
        data: bonusForecast,
        smooth,
        showSymbol: false,
        lineStyle: { width: 2.5, color: COLORS.forecastBonus, type: 'dashed' as const },
        itemStyle: { color: COLORS.forecastBonus },
        connectNulls: false,
      }] : []),
    ],
  };
}

// =====================
// Page
// =====================

export default function ProductionBonusValuePage() {
  usePageTracker({
    title: 'Relação Bônus / Produção',
    icon: 'coins',
  });

  const initial = useMemo(getCurrentBusinessPeriod, []);
  const [year, setYear] = useState<number>(initial.year);
  const [month, setMonth] = useState<number>(initial.month);
  const [sectorIds, setSectorIds] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [chartType, setChartType] = useState<BonusChartType>('dual-area');
  const [curveStyle, setCurveStyle] = useState<'rect' | 'smooth'>('rect');

  const filters = useMemo(
    () => ({ year, month, sectorIds: sectorIds.length > 0 ? sectorIds : undefined }),
    [year, month, sectorIds],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useBonusValueTimeline(filters);

  const handleApplyFilters = useCallback(
    (newYear: number, newMonth: number, newSectorIds: string[]) => {
      setYear(newYear);
      setMonth(newMonth);
      setSectorIds(newSectorIds);
    },
    [],
  );

  const result = data?.data;
  const periodLabel = useMemo(
    () => `${MONTH_OPTIONS[month - 1]?.label} ${year}`,
    [year, month],
  );

  const chartOption = useMemo<EChartsOption | null>(() => {
    if (!result || result.days.length === 0) return null;
    return buildChartOption({ days: result.days, chartType, smooth: curveStyle === 'smooth' });
  }, [result, chartType, curveStyle]);

  const currentChartType = CHART_TYPE_OPTIONS.find(o => o.value === chartType) ?? CHART_TYPE_OPTIONS[0];
  const ChartIcon = currentChartType.icon;
  const currentCurveStyle = CURVE_STYLE_OPTIONS.find(o => o.value === curveStyle) ?? CURVE_STYLE_OPTIONS[0];
  const CurveIcon = currentCurveStyle.icon;

  return (
    <div className="h-full flex flex-col px-4 pt-4 pb-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Relação Bônus / Produção"
          icon={IconCoins}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Produção', href: routes.statistics.production.root },
            { label: 'Relação Bônus / Produção' },
          ]}
        />
      </div>

      <Card className="mt-4 flex-1 flex flex-col min-h-0">
        <CardHeader className="flex-shrink-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Período {periodLabel}</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-1.5 mt-1">
                <span>
                  Bônus do período acumulado proporcionalmente às tarefas concluídas, do dia 26 ao dia 25
                </span>
                {result?.period.isClosed ? (
                  <Badge variant="outline" className="text-xs">Período fechado</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Período aberto · com previsão</Badge>
                )}
                {sectorIds.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {sectorIds.length} {sectorIds.length === 1 ? 'setor' : 'setores'}
                  </Badge>
                )}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ChartIcon className="h-4 w-4 mr-2" />
                    {currentChartType.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Tipo de gráfico</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={chartType}
                    onValueChange={v => setChartType(v as BonusChartType)}
                  >
                    {CHART_TYPE_OPTIONS.map(opt => {
                      const OptIcon = opt.icon;
                      return (
                        <DropdownMenuRadioItem key={opt.value} value={opt.value} className="gap-2">
                          <OptIcon className="h-4 w-4 shrink-0" />
                          <div className="flex flex-col">
                            <span>{opt.label}</span>
                            <span className="text-xs text-muted-foreground">{opt.description}</span>
                          </div>
                        </DropdownMenuRadioItem>
                      );
                    })}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CurveIcon className="h-4 w-4 mr-2" />
                    {currentCurveStyle.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Estilo da curva</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={curveStyle}
                    onValueChange={v => setCurveStyle(v as 'rect' | 'smooth')}
                  >
                    {CURVE_STYLE_OPTIONS.map(opt => {
                      const OptIcon = opt.icon;
                      return (
                        <DropdownMenuRadioItem key={opt.value} value={opt.value} className="gap-2">
                          <OptIcon className="h-4 w-4 shrink-0" />
                          <div className="flex flex-col">
                            <span>{opt.label}</span>
                            <span className="text-xs text-muted-foreground">{opt.description}</span>
                          </div>
                        </DropdownMenuRadioItem>
                      );
                    })}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <IconRefresh className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilterOpen(true)}
              >
                <IconFilter className="h-4 w-4 mr-2" />
                Filtros
                {sectorIds.length > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1.5 py-0 h-4 text-[10px]">
                    {sectorIds.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-4 min-h-0 pb-4">
          {isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
              <IconAlertCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
              <p className="text-sm text-destructive">
                Erro ao carregar os dados: {(error as Error)?.message || 'Erro desconhecido'}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
                Tentar novamente
              </Button>
            </div>
          ) : isLoading || !result ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 flex-shrink-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
              <Skeleton className="flex-1 min-h-[300px] w-full" />
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 flex-shrink-0">
                <SummaryCard
                  title={result.period.isClosed ? 'Bônus final' : 'Bônus acumulado'}
                  value={formatCurrency(result.summary.currentBonusValue)}
                  hint={result.period.isClosed ? 'Fechamento do período' : 'Acumulado até hoje'}
                  icon={IconCoins}
                  emphasis="primary"
                />
                <SummaryCard
                  title="Previsão de fechamento"
                  value={formatCurrency(result.summary.forecastedFinalBonusValue)}
                  hint={result.period.isClosed ? 'Igual ao bônus final' : 'No ritmo atual de tarefas'}
                  icon={IconTrendingUp}
                  emphasis="forecast"
                />
                <SummaryCard
                  title="Tarefas concluídas"
                  value={result.summary.currentTaskCount.toString()}
                  hint={`Peso total: ${result.summary.currentWeightedTaskCount.toFixed(2)}`}
                  icon={IconChecks}
                />
                <SummaryCard
                  title="Taxa diária"
                  value={`${result.summary.dailyTaskRate.toFixed(2)} / dia`}
                  hint="Tarefas ponderadas por dia"
                  icon={IconTrendingUp}
                />
                <SummaryCard
                  title="Dias restantes"
                  value={result.summary.remainingDays.toString()}
                  hint={result.period.isClosed ? 'Período encerrado' : 'Até o dia 25'}
                  icon={IconClock}
                />
              </div>

              {result.days.length === 0 || !chartOption ? (
                <div className="flex-1 min-h-[300px] flex items-center justify-center rounded-lg border border-border bg-muted/20">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma tarefa concluída neste período.
                  </p>
                </div>
              ) : (
                <div className="flex-1 min-h-[320px]">
                  <ReactECharts
                    option={chartOption}
                    style={{ height: '100%', width: '100%' }}
                    notMerge
                    lazyUpdate
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <BonusValueFiltersSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        year={year}
        month={month}
        sectorIds={sectorIds}
        onApply={handleApplyFilters}
      />
    </div>
  );
}
