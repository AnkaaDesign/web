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

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GOAL_METRIC, routes, SECTOR_PRIVILEGES } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useDefaultGoal } from '@/hooks/administration/use-default-goal';
import { useActiveProductionUserCount } from '@/hooks/administration/use-active-production-user-count';
import { getBonusPeriodStart, getBonusPeriodEnd } from '@/utils/bonus';
import { useBonusValueTimeline } from '@/hooks/production/use-production-analytics';
import { getSectors } from '@/api-client/sector';
import { sectorKeys } from '@/hooks/common/query-keys';
import { CHART_COLORS, formatCurrency } from '@/types/statistics-common';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { BonusValueDayModal } from '@/components/production/bonus-value-day-modal';
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
  IconDownload,
  IconFileTypeCsv,
  IconFileTypeXls,
} from '@tabler/icons-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { toast } from '@/components/ui/sonner';

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
//
// Each option bakes the curve style (reto vs suave) into the chart type so the
// header only needs one dropdown — no second "curve style" toggle.
type BonusChartType = 'area-rect' | 'area-smooth' | 'line-rect' | 'line-smooth';

const CHART_TYPE_OPTIONS: Array<{
  value: BonusChartType;
  label: string;
  description: string;
  icon: typeof IconChartArea;
}> = [
  {
    value: 'area-rect',
    label: 'Áreas Empilhadas Retas',
    description: 'Áreas preenchidas com segmentos retos',
    icon: IconChartArea,
  },
  {
    value: 'area-smooth',
    label: 'Áreas Empilhadas Suaves',
    description: 'Áreas preenchidas com curva suavizada',
    icon: IconChartArea,
  },
  {
    value: 'line-rect',
    label: 'Linhas Retas',
    description: 'Linhas com segmentos retos',
    icon: IconChartLine,
  },
  {
    value: 'line-smooth',
    label: 'Linhas Suaves',
    description: 'Linhas com curva suavizada',
    icon: IconChartLine,
  },
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
  onClick?: () => void;
}

function SummaryCard({ title, value, hint, icon: Icon, emphasis = 'muted', onClick }: SummaryCardProps) {
  const valueColor =
    emphasis === 'primary'  ? 'text-foreground' :
    emphasis === 'forecast' ? 'text-emerald-400' :
    'text-foreground';
  const iconColor =
    emphasis === 'forecast' ? 'text-emerald-400' :
    emphasis === 'primary'  ? 'text-blue-400' :
    'text-muted-foreground';

  const interactive = !!onClick;

  return (
    <Card
      className={`py-2 ${interactive ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
      onClick={interactive ? onClick : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={e => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
        <CardTitle className="text-xs font-medium flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-0 px-4">
        <div className={`text-xl font-bold ${valueColor}`}>{value}</div>
        {hint && <div className="text-[11px] text-foreground/70 mt-0.5">{hint}</div>}
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
  seriesColors: Record<string, string>;
}

// Default palette per series name — used when the user hasn't customized a color.
// Forecast shares the realized color (just rendered dashed) so the line reads
// as one continuous series with a style change at "Hoje".
const DEFAULT_SERIES_COLORS: Record<string, string> = {
  'Tarefas': '#3b82f6', // blue-500
  'Bônus':   '#10b981', // emerald-500
};

const colorFor = (
  name: keyof typeof DEFAULT_SERIES_COLORS | string,
  overrides: Record<string, string>,
): string => overrides[name] ?? DEFAULT_SERIES_COLORS[name] ?? '#3b82f6';

// Convert a hex color (e.g. '#10b981') to an rgba string with the requested
// alpha. Used to derive the area-fill (faded) variant of each user-picked
// series color so the area still tints to match the line.
function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 3 && cleaned.length !== 6) {
    return `rgba(59, 130, 246, ${alpha})`;
  }
  const full = cleaned.length === 3
    ? cleaned.split('').map(c => c + c).join('')
    : cleaned;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildChartOption({ days, chartType, seriesColors }: BuildChartArgs): EChartsOption {
  const smooth = chartType === 'area-smooth' || chartType === 'line-smooth';
  // X labels show day numbers only (the period spans 26 → 25, so days roll
  // over from the previous month into the current one). The header already
  // states the period's month/year, so dropping the month here removes clutter
  // and lets us label every day instead of every other.
  const xLabels = days.map(d => String(new Date(d.date).getUTCDate()));

  // Today boundary: last index where isForecast=false. Both Realizado and
  // Previsão series include this index so the two lines visually connect.
  let lastRealIdx = -1;
  for (let i = days.length - 1; i >= 0; i--) {
    if (!days[i].isForecast) { lastRealIdx = i; break; }
  }
  const hasForecast = days.some(d => d.isForecast);
  const lastIdx = days.length - 1;

  // Realized series: solid line over the real-data portion only.
  const tasksReal = days.map((d, i) => (i <= lastRealIdx ? d.weightedTaskCount : null));
  const bonusReal = days.map((d, i) => (i <= lastRealIdx ? d.totalBonusValue : null));

  // Forecast (previsão) series — continuation of the realized lines starting
  // exactly at "Hoje". The first non-null index is `lastRealIdx`, holding
  // today's REAL value (same as where `tasksReal`/`bonusReal` end), so the
  // dashed line picks up where the solid line stops with zero gap — the eye
  // reads it as a single line that simply changes style at Hoje. After today
  // we use the backend's per-day projected values (cumulative bonus follows
  // the projected task accumulation), so the dashed segment traces the actual
  // forecast trajectory rather than a flat slope.
  //
  // Closed periods have `hasForecast=false`, so this falls back to all-null
  // and no forecast line is drawn.
  const showForecast = hasForecast && lastRealIdx >= 0 && lastRealIdx < lastIdx;
  const tasksForecast: Array<number | null> = days.map((d, i) =>
    showForecast && i >= lastRealIdx ? d.weightedTaskCount : null,
  );
  const bonusForecast: Array<number | null> = days.map((d, i) =>
    showForecast && i >= lastRealIdx ? d.totalBonusValue : null,
  );

  // Common axis styling (dark mode contrast).
  const axisCommon = {
    axisLine:  { lineStyle: { color: COLORS.axisLabel, opacity: 0.4 } },
    axisLabel: { color: COLORS.axisLabel, fontSize: 11 },
    splitLine: { lineStyle: { color: COLORS.splitLine } },
    nameTextStyle: { color: COLORS.axisName, fontWeight: 600, fontSize: 12 },
  };

  // Forecast region hachure (diagonal-stripe background) covering "today → end".
  // Same `custom` renderItem technique as the productivity chart's year bands:
  // it gives pixel-precise alignment with category slot edges under any
  // dataZoom level, where `markArea` would snap to integer indices.
  const forecastHatchSeries: any[] = [];
  if (hasForecast && lastRealIdx >= 0 && lastRealIdx < lastIdx) {
    forecastHatchSeries.push({
      type: 'custom',
      silent: true,
      animation: false,
      legendHoverLink: false,
      tooltip: { show: false },
      z: -5,
      data: [[0, 0]],
      renderItem: (params: any, api: any) => {
        const grid = params.coordSys ?? { x: 0, y: 0, width: 0, height: 0 };
        const yTop = grid.y;
        const yBot = grid.y + grid.height;
        const startCenter = api.coord([lastRealIdx, 0])[0];
        const endCenter   = api.coord([lastIdx,     0])[0];
        // With boundaryGap: false on the x-axis, data points sit exactly on
        // ticks — so today's data point AND the end-of-period data point are
        // each at precise pixel positions. Anchor the band there directly,
        // no half-slot adjustment, so the band meets the area chart's right
        // edge with no visible gap and, when zoomed to end at today, has
        // zero visible width past today's column.
        const x1 = startCenter;
        const x2 = endCenter;
        const w  = x2 - x1;
        const h  = yBot - yTop;
        if (w <= 0 || h <= 0) return { type: 'group', children: [] };

        const children: any[] = [];

        // Subtle wash so the band reads as a region even without the stripes.
        children.push({
          type: 'rect',
          shape: { x: x1, y: yTop, width: w, height: h },
          style: { fill: 'rgba(251, 191, 36, 0.05)' }, // amber-400 @ 5%
        });

        // Diagonal stripes at 45°. We over-shoot the rect on the left so
        // every line that intersects the rect is drawn, then ECharts clips
        // children to the parent rect via the `clipPath` below.
        const stripeSpacing = 9;
        const stripeColor   = 'rgba(251, 191, 36, 0.18)'; // amber-400 @ 18%
        for (let xs = x1 - h; xs <= x2; xs += stripeSpacing) {
          children.push({
            type: 'line',
            shape: { x1: xs, y1: yTop, x2: xs + h, y2: yBot },
            style: { stroke: stripeColor, lineWidth: 1 },
          });
        }

        return {
          type: 'group',
          children,
          // Clip every child to the band rect so the over-shot stripes don't
          // bleed outside, and so the band stays contained when zooming.
          clipPath: {
            type: 'rect',
            shape: { x: x1, y: yTop, width: w, height: h },
          },
        };
      },
      clip: true,
      // "Hoje" label sits on top of the band's left edge.
      markLine: {
        silent: true,
        symbol: ['none', 'none'] as ['none', 'none'],
        lineStyle: { color: 'transparent' as const, width: 0 },
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
    });
  }

  const tasksAsArea = chartType === 'area-rect' || chartType === 'area-smooth';
  const bonusAsArea = chartType === 'area-rect' || chartType === 'area-smooth';

  // Resolved per-series colors (user override → default). Forecast shares the
  // realized color so the dashed continuation reads as one logical series.
  // Derived fade values are computed from the resolved color so the area
  // shading always matches the line — even after the user picks a custom color.
  const tasksColor = colorFor('Tarefas', seriesColors);
  const bonusColor = colorFor('Bônus',   seriesColors);
  const tasksFade = hexToRgba(tasksColor, 0.18);
  const bonusFade = hexToRgba(bonusColor, 0.18);

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
        `Bônus: <strong style="color:${bonusColor};">${formatCurrency(day.totalBonusValue)}</strong>`,
        `Tarefas concluídas: <strong style="color:${tasksColor};">${day.taskCount}</strong> (peso ${day.weightedTaskCount.toFixed(2)})`,
        `Média por colaborador: ${day.averageTasksPerUser.toFixed(2)}`,
      ].join('<br/>');
    },
  };

  // Dual-axis chart. Left axis = Tarefas (blue), right axis = Bônus (emerald).
  // `alignTicks: true` on the right axis forces its split points to mirror the
  // left axis's, so horizontal grid lines line up cleanly between both metrics.
  return {
    tooltip,
    // Layout stack from top to bottom:
    //   chart plot area  ←  top: 32, bottom: 110 (room for x-axis labels + custom legend + zoom)
    //   x-axis labels    ←  just below the plot, ~20px tall
    //   custom legend    ←  rendered in React, overlays at bottom: 48 (between x-axis and zoom)
    //   zoom slider      ←  bottom: 12, height: 24
    //
    // The native ECharts legend is suppressed (`show: false`) so the custom
    // React legend can take its place — but the series names are kept in
    // `data` so `dispatchAction('legendSelect' | 'legendUnSelect')` still
    // works for toggling visibility.
    legend: {
      show: false,
      data: hasForecast
        ? ['Tarefas', 'Tarefas (previsão)', 'Bônus', 'Bônus (previsão)']
        : ['Tarefas', 'Bônus'],
    },
    grid: { left: 60, right: 70, top: 32, bottom: 110, containLabel: true },
    dataZoom: [
      {
        type: 'slider' as const,
        bottom: 12,
        height: 24,
        borderRadius: 6,
        textStyle: { color: COLORS.axisLabel, fontSize: 10 },
        fillerColor: 'rgba(63,63,70,0.4)',
        borderColor: 'rgba(148,163,184,0.18)',
        handleStyle: { color: COLORS.axisName, borderColor: 'rgba(148,163,184,0.4)' },
        moveHandleStyle: { color: 'rgba(148,163,184,0.4)' },
        dataBackground: { lineStyle: { color: COLORS.splitLine }, areaStyle: { color: COLORS.splitLine } },
        selectedDataBackground: { lineStyle: { color: bonusFade }, areaStyle: { color: bonusFade } },
      },
    ],
    xAxis: {
      type: 'category',
      data: xLabels,
      // Line/area chart: data points sit on ticks, not at slot centers. This
      // also makes the hachure forecast band meet the area chart's right
      // edge with no visual gap.
      boundaryGap: false,
      ...axisCommon,
      axisLabel: { ...axisCommon.axisLabel, interval: 0, fontSize: 10 },
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
        nameTextStyle: { ...axisCommon.nameTextStyle, color: tasksColor },
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
        nameTextStyle: { ...axisCommon.nameTextStyle, color: bonusColor },
        axisLabel: { ...axisCommon.axisLabel, formatter: (v: number) => formatCurrency(v) },
      },
    ],
    series: [
      ...forecastHatchSeries,
      {
        name: 'Tarefas',
        type: 'line',
        yAxisIndex: 0,
        data: tasksReal,
        smooth,
        showSymbol: false,
        lineStyle: { width: 2.5, color: tasksColor },
        itemStyle: { color: tasksColor },
        ...(tasksAsArea ? { areaStyle: { color: tasksFade } } : {}),
        connectNulls: false,
      },
      ...(hasForecast ? [{
        name: 'Tarefas (previsão)',
        type: 'line' as const,
        yAxisIndex: 0,
        data: tasksForecast,
        smooth,
        showSymbol: false,
        lineStyle: { width: 2.5, color: tasksColor, type: 'dashed' as const },
        itemStyle: { color: tasksColor },
        ...(tasksAsArea ? { areaStyle: { color: tasksFade } } : {}),
        connectNulls: false,
      }] : []),
      {
        name: 'Bônus',
        type: 'line',
        yAxisIndex: 1,
        data: bonusReal,
        smooth,
        showSymbol: false,
        lineStyle: { width: 2.5, color: bonusColor },
        itemStyle: { color: bonusColor },
        ...(bonusAsArea ? { areaStyle: { color: bonusFade } } : {}),
        connectNulls: false,
      },
      ...(hasForecast ? [{
        name: 'Bônus (previsão)',
        type: 'line' as const,
        yAxisIndex: 1,
        data: bonusForecast,
        smooth,
        showSymbol: false,
        lineStyle: { width: 2.5, color: bonusColor, type: 'dashed' as const },
        itemStyle: { color: bonusColor },
        ...(bonusAsArea ? { areaStyle: { color: bonusFade } } : {}),
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
  const [chartType, setChartType] = useState<BonusChartType>('area-rect');
  // Custom legend state — mirrors `statistics-chart.tsx`. The legend lets the
  // user (a) pick a custom color via popover, and (b) toggle visibility by
  // clicking the label. The native ECharts legend is hidden so the click on
  // the swatch can open the picker instead of toggling visibility immediately.
  const [seriesColors, setSeriesColors] = useState<Record<string, string>>({});
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
  const chartRef = useRef<ReactECharts | null>(null);
  const [clickedDay, setClickedDay] = useState<{
    date: string;
    dateLabel: string;
    totalBonusValue: number;
    taskCount: number;
    weightedTaskCount: number;
    isForecast: boolean;
    focus?: 'tasks' | 'collaborators';
  } | null>(null);

  const filters = useMemo(
    () => ({ year, month, sectorIds: sectorIds.length > 0 ? sectorIds : undefined }),
    [year, month, sectorIds],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useBonusValueTimeline(filters);

  // Bonus-value visualizes a single business period. We pull TASKS_COMPLETED
  // for that exact (year, month) so the "Tarefas concluídas" card can show
  // progress against the configured monthly target. When the user filters to
  // specific sectors, rescale the company target to the filtered subset.
  const hasSectorFilter = sectorIds.length > 0;
  const { count: totalProductionUserCount } = useActiveProductionUserCount({
    enabled: hasSectorFilter,
  });
  const { count: filteredProductionUserCount } = useActiveProductionUserCount({
    sectorIds,
    enabled: hasSectorFilter,
  });

  const periodGoal = useDefaultGoal({
    metric: GOAL_METRIC.TASKS_COMPLETED,
    period: { from: getBonusPeriodStart(year, month), to: getBonusPeriodEnd(year, month) },
    aggregation: 'TOTAL',
    scaleBy: hasSectorFilter
      ? { numerator: filteredProductionUserCount, denominator: totalProductionUserCount }
      : null,
  });

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
    return buildChartOption({ days: result.days, chartType, seriesColors });
  }, [result, chartType, seriesColors]);

  // Whether the current result has forecast days — drives the conditional set
  // of legend entries (with or without "previsão" series).
  const hasForecast = useMemo(
    () => (result?.days?.some(d => d.isForecast) ?? false),
    [result],
  );

  // One chip per logical metric. Forecast (when present) shares the metric's
  // color and is toggled together with its realized counterpart, so the legend
  // doesn't need a separate "previsão" entry — the dashed continuation is
  // self-explanatory inside the hatched forecast band.
  const legendItems = useMemo(() => {
    const items: Array<{ name: string; color: string; seriesNames: string[] }> = [
      {
        name: 'Tarefas',
        color: colorFor('Tarefas', seriesColors),
        seriesNames: hasForecast ? ['Tarefas', 'Tarefas (previsão)'] : ['Tarefas'],
      },
      {
        name: 'Bônus',
        color: colorFor('Bônus', seriesColors),
        seriesNames: hasForecast ? ['Bônus', 'Bônus (previsão)'] : ['Bônus'],
      },
    ];
    return items;
  }, [seriesColors, hasForecast]);

  const toggleSeries = useCallback((name: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // Drop hidden entries that no longer exist (e.g. after switching to a closed
  // period that has no "previsão" series).
  useEffect(() => {
    if (!hiddenSeries.size) return;
    const valid = new Set(legendItems.map(i => i.name));
    let changed = false;
    hiddenSeries.forEach(n => { if (!valid.has(n)) changed = true; });
    if (changed) {
      setHiddenSeries(prev => new Set([...prev].filter(n => valid.has(n))));
    }
  }, [legendItems, hiddenSeries]);

  // Apply hiddenSeries to ECharts via dispatchAction. We can't use
  // legend.selected because notMerge=true wipes legend state on every update.
  // Each legend chip controls both its realized and forecast series.
  useEffect(() => {
    const inst = chartRef.current?.getEchartsInstance?.();
    if (!inst) return;
    legendItems.forEach(item => {
      const action = hiddenSeries.has(item.name) ? 'legendUnSelect' : 'legendSelect';
      item.seriesNames.forEach(name => {
        inst.dispatchAction({ type: action, name });
      });
    });
  }, [legendItems, hiddenSeries, chartOption]);

  const currentChartType = CHART_TYPE_OPTIONS.find(o => o.value === chartType) ?? CHART_TYPE_OPTIONS[0];
  const ChartIcon = currentChartType.icon;

  // Column-hover click: the chart uses `trigger: 'axis'`, so the vertical
  // axis pointer (dashed grey line in the screenshot) already snaps to the
  // closest day as the user moves the cursor. We track that index via
  // `updateAxisPointer` and fire the modal when the wrapper div is clicked —
  // that way the user doesn't have to hit the tiny line segment, anywhere in
  // the day's column works.
  const hoveredDayRef = useRef<number | null>(null);

  const onEvents = useMemo(() => ({
    updateAxisPointer: (params: any) => {
      const info = Array.isArray(params?.axesInfo)
        ? params.axesInfo.find((a: any) => a?.axisDim === 'x') ?? params.axesInfo[0]
        : undefined;
      const val = info?.value;
      if (val == null || val === '') {
        hoveredDayRef.current = null;
        return;
      }
      hoveredDayRef.current = typeof val === 'number' ? val : null;
    },
    globalout: () => { hoveredDayRef.current = null; },
  }), []);

  const handleChartContainerClick = useCallback(() => {
    if (!result) return;
    const idx = hoveredDayRef.current;
    if (idx == null) return;
    const day = result.days[idx];
    if (!day) return;
    setClickedDay({
      date: day.date,
      dateLabel: day.dateLabel,
      totalBonusValue: day.totalBonusValue,
      taskCount: day.taskCount,
      weightedTaskCount: day.weightedTaskCount,
      isForecast: day.isForecast,
    });
  }, [result]);

  // Last real (non-forecast) day in the period — drives the drilldown from
  // summary cards that show "current" snapshots ("hoje" for open periods, or
  // the final day for closed ones).
  const lastRealDay = useMemo(() => {
    if (!result?.days?.length) return null;
    for (let i = result.days.length - 1; i >= 0; i--) {
      if (!result.days[i].isForecast) return result.days[i];
    }
    return null;
  }, [result]);

  const openLastDay = useCallback((focus?: 'tasks' | 'collaborators') => {
    if (!lastRealDay) return;
    setClickedDay({
      date: lastRealDay.date,
      dateLabel: lastRealDay.dateLabel,
      totalBonusValue: lastRealDay.totalBonusValue,
      taskCount: lastRealDay.taskCount,
      weightedTaskCount: lastRealDay.weightedTaskCount,
      isForecast: lastRealDay.isForecast,
      focus,
    });
  }, [lastRealDay]);

  const handleExportCSV = useCallback(() => {
    if (!result?.days?.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Data', 'Tarefas', 'Tarefas (Ponderadas)', 'Colaboradores Ativos', 'Média/Colaborador', 'Bônus Acumulado (R$)', 'Previsão'];
      const rows = result.days.map(d => [
        d.dateLabel,
        String(d.taskCount),
        d.weightedTaskCount.toFixed(2),
        String(d.activeUsers),
        d.averageTasksPerUser.toFixed(2),
        d.totalBonusValue.toFixed(2),
        d.isForecast ? 'Sim' : 'Não',
      ]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `bonus-producao-${periodLabel.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('CSV exportado');
    } catch { toast.error('Erro ao exportar CSV'); }
  }, [result, periodLabel]);

  const handleExportXLSX = useCallback(() => {
    if (!result?.days?.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Data', 'Tarefas', 'Tarefas (Ponderadas)', 'Colaboradores Ativos', 'Média/Colaborador', 'Bônus Acumulado (R$)', 'Previsão'];
      const rows = result.days.map(d => [
        d.dateLabel,
        d.taskCount,
        parseFloat(d.weightedTaskCount.toFixed(2)),
        d.activeUsers,
        parseFloat(d.averageTasksPerUser.toFixed(2)),
        parseFloat(d.totalBonusValue.toFixed(2)),
        d.isForecast ? 'Sim' : 'Não',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((_, i) => ({ wch: i === 0 ? 14 : 16 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Relação Bônus');
      XLSX.writeFile(wb, `bonus-producao-${periodLabel.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`);
      toast.success('XLSX exportado');
    } catch { toast.error('Erro ao exportar XLSX'); }
  }, [result, periodLabel]);

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

              <Button
                variant={sectorIds.length > 0 ? 'default' : 'outline'}
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

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoading || !result?.days?.length}
                  >
                    <IconDownload className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Formato de Exportação</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleExportCSV}>
                    <IconFileTypeCsv className="h-4 w-4 mr-2" /> CSV dos Dados
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleExportXLSX}>
                    <IconFileTypeXls className="h-4 w-4 mr-2" /> Excel (XLSX)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                title="Atualizar"
              >
                <IconRefresh className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
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
              <Skeleton className="flex-1 min-h-[380px] w-full" />
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
                  onClick={lastRealDay ? () => openLastDay('collaborators') : undefined}
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
                  hint={
                    periodGoal.value != null
                      ? `Meta: ${Math.round(periodGoal.value)} • ${Math.round((result.summary.currentTaskCount / periodGoal.value) * 100)}% atingido`
                      : `Peso total: ${result.summary.currentWeightedTaskCount.toFixed(2)}`
                  }
                  icon={IconChecks}
                  onClick={lastRealDay ? () => openLastDay('tasks') : undefined}
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
                <div className="flex-1 min-h-[380px] flex items-center justify-center rounded-lg border border-border bg-muted/20">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma tarefa concluída neste período.
                  </p>
                </div>
              ) : (
                <div
                  className="relative flex-1 min-h-[380px] cursor-pointer [&_canvas]:!cursor-pointer"
                  onClick={handleChartContainerClick}
                >
                  <ReactECharts
                    ref={chartRef}
                    option={chartOption}
                    style={{ height: '100%', width: '100%' }}
                    notMerge
                    lazyUpdate
                    onEvents={onEvents}
                  />
                  {/* Custom legend — replaces ECharts' built-in legend so the
                      color swatch opens a color picker (Popover) instead of
                      toggling visibility. The label still toggles visibility
                      via legendSelect/legendUnSelect dispatch. */}
                  {legendItems.length > 0 && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 flex flex-wrap justify-center gap-x-4 gap-y-1 px-2"
                      style={{ bottom: 48 }}
                      onClick={e => e.stopPropagation()}
                    >
                      {legendItems.map(item => {
                        const hidden = hiddenSeries.has(item.name);
                        return (
                          <div
                            key={item.name}
                            className="pointer-events-auto flex items-center gap-1.5 bg-card/60 backdrop-blur-sm px-1.5 py-0.5 rounded"
                            onClick={e => e.stopPropagation()}
                          >
                            <Popover
                              open={openPickerFor === item.name}
                              onOpenChange={open => setOpenPickerFor(open ? item.name : null)}
                            >
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={`Cor da série ${item.name}`}
                                  className="w-4 h-4 rounded-sm transition-transform hover:scale-110 focus:outline-none"
                                  style={{ background: item.color, opacity: hidden ? 0.35 : 1 }}
                                />
                              </PopoverTrigger>
                              <PopoverContent align="center" className="w-auto p-3">
                                <p className="text-xs font-medium mb-2 text-muted-foreground">Cor da série</p>
                                <div className="grid grid-cols-5 gap-1.5">
                                  {CHART_COLORS.map(color => (
                                    <button
                                      type="button"
                                      key={color}
                                      className="w-6 h-6 rounded-sm hover:scale-110 transition-transform"
                                      style={{
                                        background: color,
                                        outline: color === item.color ? '2px solid currentColor' : '2px solid transparent',
                                        outlineOffset: '2px',
                                      }}
                                      onClick={() => {
                                        setSeriesColors(prev => ({ ...prev, [item.name]: color }));
                                        setOpenPickerFor(null);
                                      }}
                                    />
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                            <button
                              type="button"
                              onClick={() => toggleSeries(item.name)}
                              aria-pressed={!hidden}
                              className={cn(
                                'text-sm transition-colors cursor-pointer select-none',
                                hidden ? 'text-muted-foreground line-through' : 'text-foreground/85 hover:text-foreground',
                              )}
                            >
                              {item.name}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
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

      {clickedDay && result && (
        <BonusValueDayModal
          open={!!clickedDay}
          onOpenChange={open => { if (!open) setClickedDay(null); }}
          year={year}
          month={month}
          sectorIds={sectorIds.length > 0 ? sectorIds : undefined}
          dayDate={clickedDay.date}
          dayDateLabel={clickedDay.dateLabel}
          dayBonusValue={clickedDay.totalBonusValue}
          dayTaskCount={clickedDay.taskCount}
          dayWeightedTaskCount={clickedDay.weightedTaskCount}
          dayIsForecast={clickedDay.isForecast}
          focus={clickedDay.focus}
          periodStartIso={result.summary.periodStart}
          forecastedFinalBonusValue={result.summary.forecastedFinalBonusValue}
          forecastedFinalWeightedTaskCount={
            result.days.length > 0
              ? result.days[result.days.length - 1].weightedTaskCount
              : 0
          }
        />
      )}
    </div>
  );
}
