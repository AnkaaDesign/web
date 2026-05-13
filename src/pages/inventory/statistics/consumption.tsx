// web/src/pages/inventory/statistics/consumption.tsx

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Combobox } from '@/components/ui/combobox';
import { DateTimeInput } from '@/components/ui/date-time-input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { routes, FAVORITE_PAGES, ACTIVITY_OPERATION } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useConsumptionAnalytics, consumptionAnalyticsKeys } from '@/hooks/inventory/use-consumption-analytics';
import { useSectors } from '@/hooks/administration/use-sector';
import { useUsers } from '@/hooks/human-resources/use-user';
import { getConsumptionComparison } from '@/api-client';
import { useQueries } from '@tanstack/react-query';
import type { ConsumptionAnalyticsResponse } from '@/types/consumption-analytics';
import type {
  ConsumptionAnalyticsFilters,
  ConsumptionChartType,
  ConsumptionXAxisMode,
  ConsumptionYAxisMode,
  ConsumptionCompareMode,
  ConsumptionPeriod,
  ConsumptionItem,
} from '@/types/consumption-analytics';
import { isComparisonItem } from '@/types/consumption-analytics';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import {
  formatCurrency,
  formatNumber,
  MONTH_OPTIONS,
  generateYearOptions,
  type StatisticsChartType,
  type YAxisMode,
  type TrendLineType,
} from '@/types/statistics-common';
import { getSectors } from '@/api-client/sector';
import { getUsers } from '@/api-client/user';
import { getItems } from '@/api-client/item';
import { sectorKeys, userKeys, itemKeys } from '@/hooks/common/query-keys';
import {
  IconChartBar, IconChartPie, IconChartLine, IconChartArea, IconStack2,
  IconFilter, IconDownload, IconRefresh, IconAlertCircle,
  IconPackage, IconCash, IconBox, IconCalendarStats, IconChartArcs3,
  IconUsers, IconBuilding, IconX, IconNumbers,
  IconFileTypeCsv, IconFileTypeXls, IconFileTypePdf, IconTrendingUp,
  IconArrowsExchange2,
} from '@tabler/icons-react';
import {
  format, startOfDay, endOfDay, subMonths,
  startOfMonth, endOfMonth, addMonths,
} from 'date-fns';
import * as XLSX from 'xlsx';
import { toast } from '@/components/ui/sonner';

// =====================
// Constants
// =====================

const COMBOBOX_PAGE_SIZE = 20;
const MAX_TEMPORAL_ITEMS = 12;

type ChartTypeOption = {
  value: ConsumptionChartType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
};

const BASE_CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { value: 'bar',         label: 'Colunas',     icon: IconChartBar,  description: 'Colunas agrupadas' },
  { value: 'line',        label: 'Linha Reta',  icon: IconChartLine, description: 'Gráfico de linhas retas' },
  { value: 'line-smooth', label: 'Linha Suave', icon: IconChartLine, description: 'Gráfico de linhas suavizadas' },
  { value: 'area',        label: 'Área Reta',   icon: IconChartArea, description: 'Área preenchida com linhas retas' },
  { value: 'area-smooth', label: 'Área Suave',  icon: IconChartArea, description: 'Área preenchida suavizada' },
];

// Line/area chart types already render one series per entity, so a "stacked
// lines" option visually collapses to the same picture as "Linha Reta" — we
// only keep the stacked variant for bars, where the geometry actually changes.
const STACKED_CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { value: 'bar-stacked', label: 'Colunas Empilhadas', icon: IconStack2, description: 'Colunas empilhadas' },
];

const BOTH_MODE_CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { value: 'bar-stacked',  label: 'Colunas', icon: IconChartBar,  description: 'Colunas com Qtde + Valor' },
  { value: 'line-stacked', label: 'Linhas',  icon: IconChartLine, description: 'Linhas com Qtde + Valor' },
];

const PIE_OPTION: ChartTypeOption = {
  value: 'pie', label: 'Pizza', icon: IconChartPie, description: 'Gráfico de pizza',
};

const X_AXIS_OPTIONS: Array<{ value: ConsumptionXAxisMode; label: string }> = [
  { value: 'item',  label: 'Itens' },
  { value: 'month', label: 'Meses' },
  { value: 'year',  label: 'Anos' },
];

const Y_AXIS_OPTIONS: Array<{ value: ConsumptionYAxisMode; label: string }> = [
  { value: 'quantity', label: 'Quantidade consumida' },
  { value: 'value',    label: 'Valor total (R$)' },
  { value: 'both',     label: 'Ambos (Qtde + Valor)' },
];

const COMPARE_MODE_OPTIONS: Array<{ value: ConsumptionCompareMode; label: string }> = [
  { value: 'combined',           label: 'Combinado (uma série)' },
  { value: 'separated',          label: 'Separado (por setor/usuário)' },
  { value: 'separatedWithTotal', label: 'Separado + Total' },
];

const YEAR_OPTIONS = generateYearOptions(4);

const TREND_LABELS: Record<TrendLineType, string> = {
  linear: 'Linear', sma3: 'Média 3m', sma6: 'Média 6m', sma12: 'Média 12m',
};

// =====================
// Helpers
// =====================

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
      startDate: startOfDay(startOfMonth(new Date(minY, monthNums[0] - 1))),
      endDate:   endOfDay(endOfMonth(new Date(maxY, monthNums[monthNums.length - 1] - 1))),
    };
  }
  return {
    startDate: startOfDay(new Date(minY, 0, 1)),
    endDate:   endOfDay(new Date(maxY, 11, 31)),
  };
}

function generateMonthlyPeriods(
  startDate: Date,
  endDate: Date,
  selectedYears: string[],
  selectedMonths: string[],
): ConsumptionPeriod[] {
  const periods: ConsumptionPeriod[] = [];
  let current = startOfMonth(startDate);
  const bound = endOfMonth(endDate);
  while (current <= bound && periods.length < 24) {
    const y = format(current, 'yyyy');
    const m = format(current, 'MM');
    if (
      (selectedYears.length === 0 || selectedYears.includes(y)) &&
      (selectedMonths.length === 0 || selectedMonths.includes(m))
    ) {
      const monthLabel = MONTH_OPTIONS.find(o => o.value === m)?.label ?? m;
      periods.push({
        id: `${y}-${m}`,
        label: `${monthLabel} ${y}`,
        startDate: startOfDay(current),
        endDate:   endOfDay(endOfMonth(current)),
      });
    }
    current = addMonths(current, 1);
  }
  return periods;
}

function generateYearlyPeriods(
  startDate: Date,
  endDate: Date,
  selectedYears: string[],
): ConsumptionPeriod[] {
  const periods: ConsumptionPeriod[] = [];
  const startYear = parseInt(format(startDate, 'yyyy'));
  const endYear   = parseInt(format(endDate,   'yyyy'));
  for (let y = startYear; y <= endYear; y++) {
    const ys = y.toString();
    if (selectedYears.length > 0 && !selectedYears.includes(ys)) continue;
    periods.push({
      id: ys,
      label: ys,
      startDate: startOfDay(new Date(y, 0, 1)),
      endDate:   endOfDay(new Date(y, 11, 31)),
    });
  }
  return periods;
}

function buildPeriodsFromYearsMonths(years: string[], months: string[]): ConsumptionPeriod[] {
  const periods: ConsumptionPeriod[] = [];
  [...years].sort().forEach(year => {
    [...months].sort().forEach(month => {
      const y = parseInt(year);
      const m = parseInt(month);
      const monthLabel = MONTH_OPTIONS.find(o => o.value === month)?.label ?? month;
      periods.push({
        id: `${year}-${month}`,
        label: `${monthLabel} ${year}`,
        startDate: startOfDay(startOfMonth(new Date(y, m - 1))),
        endDate:   endOfDay(endOfMonth(new Date(y, m - 1))),
      });
    });
  });
  return periods;
}

// =====================
// Filter Sheet (inline)
// =====================

interface ConsumptionFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ConsumptionAnalyticsFilters;
  xAxisMode: ConsumptionXAxisMode;
  yAxisMode: ConsumptionYAxisMode;
  compareMode: ConsumptionCompareMode;
  selectedYears: string[];
  selectedMonths: string[];
  onApply: (
    filters: ConsumptionAnalyticsFilters,
    options: {
      xAxisMode: ConsumptionXAxisMode;
      yAxisMode: ConsumptionYAxisMode;
      compareMode: ConsumptionCompareMode;
      selectedYears: string[];
      selectedMonths: string[];
    },
  ) => void;
}

function ConsumptionFiltersSheet({
  open, onOpenChange,
  filters, xAxisMode, yAxisMode, compareMode, selectedYears, selectedMonths,
  onApply,
}: ConsumptionFiltersSheetProps) {
  const [localFilters, setLocalFilters] = useState<ConsumptionAnalyticsFilters>(filters);
  const [localX, setLocalX]             = useState<ConsumptionXAxisMode>(xAxisMode);
  const [localY, setLocalY]             = useState<ConsumptionYAxisMode>(yAxisMode);
  const [localCmp, setLocalCmp]         = useState<ConsumptionCompareMode>(compareMode);
  const [localYears, setLocalYears]     = useState<string[]>(selectedYears);
  const [localMonths, setLocalMonths]   = useState<string[]>(selectedMonths);

  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
      setLocalX(xAxisMode);
      setLocalY(yAxisMode);
      setLocalCmp(compareMode);
      setLocalYears(selectedYears);
      setLocalMonths(selectedMonths);
    }
  }, [open, filters, xAxisMode, yAxisMode, compareMode, selectedYears, selectedMonths]);

  const isTemporalLocal = localX === 'month' || localX === 'year';

  // 'both' y-mode disables entity comparison
  useEffect(() => {
    if (localY === 'both') {
      setLocalFilters(f => ({ ...f, sectorIds: undefined, userIds: undefined }));
    }
  }, [localY]);

  const localSectors = localFilters.sectorIds ?? [];
  const localUsers   = localFilters.userIds   ?? [];
  const canCompare = !isTemporalLocal && localY !== 'both' &&
    (localSectors.length >= 2 || localUsers.length >= 2);

  useEffect(() => {
    if (!canCompare) setLocalCmp('combined');
  }, [canCompare]);

  const fetchSectors = useCallback(async (search: string, page = 1) => {
    const res = await getSectors({ searchingFor: search || undefined, page, limit: COMBOBOX_PAGE_SIZE });
    return { data: (res.data || []).map(s => ({ value: s.id, label: s.name })), hasMore: res.meta?.hasNextPage ?? false };
  }, []);

  const fetchUsers = useCallback(async (search: string, page = 1) => {
    const res = await getUsers({ where: { isActive: true }, search: search || undefined, page, limit: COMBOBOX_PAGE_SIZE });
    const seen = new Set<string>();
    const unique = (res.data || []).filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true; });
    return { data: unique.map(u => ({ value: u.id, label: u.name })), hasMore: res.meta?.hasNextPage ?? false };
  }, []);

  // Items API expects `searchingFor` (not `search`) — using `search` silently
  // returns unfiltered results, which is why the original async items filter
  // never appeared to "work" from the user's perspective.
  const fetchItems = useCallback(async (search: string, page = 1) => {
    const res = await getItems({
      searchingFor: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
      orderBy: { name: 'asc' },
      include: { brand: true, category: true },
    });
    return {
      data: (res.data || []).map(i => ({
        value: i.id,
        label: i.uniCode ? `${i.name} (${i.uniCode})` : i.name,
        description: i.brand?.name || i.category?.name,
      })),
      hasMore: res.meta?.hasNextPage ?? false,
    };
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localSectors.length > 0) count++;
    if (localUsers.length > 0) count++;
    if ((localFilters.itemIds?.length ?? 0) > 0) count++;
    if (localYears.length > 0) count++;
    if (localMonths.length > 0) count++;
    if (localX !== 'item') count++;
    if (localY !== 'quantity') count++;
    return count;
  }, [localFilters, localSectors, localUsers, localYears, localMonths, localX, localY]);

  const handleApply = useCallback(() => {
    let finalFilters = { ...localFilters };

    if (isTemporalLocal) {
      const { startDate, endDate } = computeDateRange(localYears, localMonths);
      if (startDate) finalFilters.startDate = startDate;
      if (endDate)   finalFilters.endDate   = endDate;
      finalFilters.periods = undefined;
    } else if (localYears.length > 0 && localMonths.length > 0) {
      if (localYears.length === 1 && localMonths.length === 1) {
        const y = parseInt(localYears[0]);
        const m = parseInt(localMonths[0]);
        finalFilters.startDate = startOfDay(startOfMonth(new Date(y, m - 1)));
        finalFilters.endDate   = endOfDay(endOfMonth(new Date(y, m - 1)));
        finalFilters.periods   = undefined;
      } else {
        const periods = buildPeriodsFromYearsMonths(localYears, localMonths);
        finalFilters.periods   = periods;
        const { startDate, endDate } = computeDateRange(localYears, localMonths);
        if (startDate) finalFilters.startDate = startDate;
        if (endDate)   finalFilters.endDate   = endDate;
      }
    } else if (localYears.length > 0) {
      const { startDate, endDate } = computeDateRange(localYears, []);
      if (startDate) finalFilters.startDate = startDate;
      if (endDate)   finalFilters.endDate   = endDate;
      finalFilters.periods = undefined;
    } else {
      finalFilters.periods = undefined;
    }

    finalFilters.operation = ACTIVITY_OPERATION.OUTBOUND;

    onApply(finalFilters, {
      xAxisMode:      localX,
      yAxisMode:      localY,
      compareMode:    canCompare ? localCmp : 'combined',
      selectedYears:  localYears,
      selectedMonths: localMonths,
    });
    onOpenChange(false);
  }, [localFilters, localX, localY, localCmp, localYears, localMonths, isTemporalLocal, canCompare, onApply, onOpenChange]);

  const handleClear = useCallback(() => {
    setLocalFilters({
      startDate: startOfDay(subMonths(new Date(), 1)),
      endDate:   endOfDay(new Date()),
      operation: ACTIVITY_OPERATION.OUTBOUND,
      sortBy:    'quantity',
      sortOrder: 'desc',
      limit:     20,
    });
    setLocalX('item');
    setLocalY('quantity');
    setLocalCmp('combined');
    setLocalYears([]);
    setLocalMonths([]);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros — Análise de Consumo
            {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
          </SheetTitle>
          <SheetDescription>Configure o eixo, métricas, período e entidades para análise</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-4">

            {/* X-axis grouping */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconCalendarStats className="h-4 w-4" />
                Agrupamento do Eixo X
              </Label>
              <Combobox
                value={localX}
                onValueChange={v => setLocalX(v as ConsumptionXAxisMode)}
                options={X_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
              <p className="text-xs text-muted-foreground">
                {localX === 'item'  && 'Cada item no eixo X. Comparação por setor/usuário/período disponível.'}
                {localX === 'month' && 'Evolução temporal mês a mês. Os itens são exibidos como séries.'}
                {localX === 'year'  && 'Evolução temporal ano a ano. Os itens são exibidos como séries.'}
              </p>
            </div>

            {/* Y-axis metric */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconChartArcs3 className="h-4 w-4" />
                Métrica do Eixo Y
              </Label>
              <Combobox
                value={localY}
                onValueChange={v => setLocalY(v as ConsumptionYAxisMode)}
                options={Y_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
              {localY === 'both' && (
                <p className="text-xs text-muted-foreground">
                  Exibe Quantidade e Valor no mesmo gráfico. Comparação de setores/usuários não disponível neste modo.
                </p>
              )}
            </div>

            {/* Compare mode — only when 2+ sectors or users in entity mode */}
            {canCompare && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconArrowsExchange2 className="h-4 w-4" />
                  Modo de Comparação
                </Label>
                <Combobox
                  value={localCmp}
                  onValueChange={v => setLocalCmp(v as ConsumptionCompareMode)}
                  options={COMPARE_MODE_OPTIONS}
                  placeholder="Selecione..."
                  searchable={false}
                  clearable={false}
                />
                {localCmp === 'separated' && (
                  <p className="text-xs text-muted-foreground">Exibe uma série por setor/usuário, sem total combinado.</p>
                )}
                {localCmp === 'separatedWithTotal' && (
                  <p className="text-xs text-muted-foreground">
                    Exibe uma série por setor/usuário + série "Total" = {(localSectors.length || localUsers.length) + 1} séries.
                  </p>
                )}
              </div>
            )}

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
                placeholder="Todos os anos..."
                searchPlaceholder="Buscar ano..."
                emptyText="Nenhum ano"
                searchable={true}
                clearable={true}
              />
              <p className="text-xs text-muted-foreground">
                {localYears.length === 0
                  ? isTemporalLocal ? 'Sem seleção → últimos 12 períodos' : 'Sem seleção → usa data personalizada abaixo'
                  : isTemporalLocal
                    ? `Exibe períodos de: ${[...localYears].sort().join(', ')}`
                    : `Define intervalo: ${[...localYears].sort().join(', ')}`}
              </p>
            </div>

            {/* Months — hidden in year x-axis mode */}
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
                {localMonths.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {localMonths.sort().map(m => MONTH_OPTIONS.find(o => o.value === m)?.label).join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Custom date range — non-temporal mode only */}
            {!isTemporalLocal && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconCalendarStats className="h-4 w-4" />
                  Data Personalizada
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                    <DateTimeInput
                      mode="date"
                      value={localFilters.startDate}
                      onChange={date => {
                        if (date instanceof Date) {
                          setLocalFilters(f => ({ ...f, startDate: startOfDay(date) }));
                          setLocalYears([]);
                          setLocalMonths([]);
                        }
                      }}
                      hideLabel
                      placeholder="Data inicial..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                    <DateTimeInput
                      mode="date"
                      value={localFilters.endDate}
                      onChange={date => {
                        if (date instanceof Date) {
                          setLocalFilters(f => ({ ...f, endDate: endOfDay(date) }));
                          setLocalYears([]);
                          setLocalMonths([]);
                        }
                      }}
                      hideLabel
                      placeholder="Data final..."
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Preencher limpa a seleção de anos/meses acima.</p>
              </div>
            )}

            {/* Items filter — async combobox with proper `searchingFor` param */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconPackage className="h-4 w-4" />
                Itens
              </Label>
              <Combobox
                mode="multiple"
                async
                value={localFilters.itemIds ?? []}
                onValueChange={v => setLocalFilters(f => ({ ...f, itemIds: Array.isArray(v) && v.length > 0 ? v : undefined }))}
                queryKey={[...itemKeys.lists()]}
                queryFn={fetchItems}
                minSearchLength={0}
                placeholder="Todos os itens..."
                searchPlaceholder="Buscar item..."
                emptyText="Nenhum item encontrado"
                loadingText="Carregando..."
                searchable={true}
                clearable={true}
              />
            </div>

            {/* Sectors — hidden in 'both' y-mode */}
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
                  onValueChange={v => setLocalFilters(f => ({ ...f, sectorIds: Array.isArray(v) && v.length > 0 ? v : undefined }))}
                  queryKey={[...sectorKeys.lists()]}
                  queryFn={fetchSectors}
                  minSearchLength={0}
                  placeholder="Todos os setores..."
                  searchPlaceholder="Buscar setor..."
                  emptyText="Nenhum setor encontrado"
                  loadingText="Carregando..."
                  searchable={true}
                  clearable={true}
                />
                <p className="text-xs text-muted-foreground">
                  {isTemporalLocal
                    ? 'Em modo temporal, cada setor selecionado vira uma série no gráfico.'
                    : 'Sem seleção = todos. Selecione 2+ para habilitar comparação.'}
                </p>
              </div>
            )}

            {/* Users — hidden when 'both' y-mode or sector comparison/multi-sector is active */}
            {localY !== 'both' && localSectors.length < 2 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconUsers className="h-4 w-4" />
                  Usuários
                </Label>
                <Combobox
                  mode="multiple"
                  async
                  value={localUsers}
                  onValueChange={v => setLocalFilters(f => ({ ...f, userIds: Array.isArray(v) && v.length > 0 ? v : undefined }))}
                  queryKey={[...userKeys.lists()]}
                  queryFn={fetchUsers}
                  minSearchLength={0}
                  placeholder="Todos os usuários..."
                  searchPlaceholder="Buscar usuário..."
                  emptyText="Nenhum usuário encontrado"
                  loadingText="Carregando..."
                  searchable={true}
                  clearable={true}
                />
                <p className="text-xs text-muted-foreground">
                  {isTemporalLocal
                    ? 'Em modo temporal, cada usuário selecionado vira uma série no gráfico.'
                    : 'Sem seleção = todos. Selecione 2+ para habilitar comparação.'}
                </p>
              </div>
            )}

            {/* Limit — only meaningful when items are on the x-axis. In temporal
                modes the limit is overridden internally (MAX_TEMPORAL_ITEMS for
                single-query and 100 for per-entity), so showing the input would
                mislead the user. */}
            {localX === 'item' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconNumbers className="h-4 w-4" />
                  Número de Resultados
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={localFilters.limit ?? 50}
                  onChange={v => {
                    const parsed = typeof v === 'number' ? v : parseInt(String(v ?? ''));
                    setLocalFilters(f => ({ ...f, limit: Number.isFinite(parsed) && parsed > 0 ? parsed : 50 }));
                  }}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Máximo de itens exibidos no gráfico (1–100).
                </p>
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

const ConsumptionPage = () => {
  usePageTracker({ page: 'consumption-analytics', title: 'Análise de Consumo' });

  const [showFilters, setShowFilters]   = useState(false);
  const [chartType, setChartType]       = useState<ConsumptionChartType>('bar');
  const [trendLine, setTrendLine]       = useState<TrendLineType | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState<ConsumptionAnalyticsFilters>({
    startDate: startOfDay(subMonths(new Date(), 1)),
    endDate:   endOfDay(new Date()),
    operation: ACTIVITY_OPERATION.OUTBOUND,
    sortBy:    'quantity',
    sortOrder: 'desc',
    limit:     20,
  });

  const [xAxisMode, setXAxisMode]     = useState<ConsumptionXAxisMode>('item');
  const [yAxisMode, setYAxisMode]     = useState<ConsumptionYAxisMode>('quantity');
  const [compareMode, setCompareMode] = useState<ConsumptionCompareMode>('combined');
  const [selectedYears, setSelectedYears]   = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // ── Derived mode flags ──
  const isTemporalMode = xAxisMode === 'month' || xAxisMode === 'year';
  const isBothMode     = yAxisMode === 'both';
  const isStackedType  = chartType === 'bar-stacked' || chartType === 'line-stacked';

  const sectorIdsSelected = filters.sectorIds ?? [];
  const userIdsSelected   = filters.userIds   ?? [];

  // Temporal × entity comparison: the API can't compare periods AND entities in
  // one call, so we fan out one request per entity and merge client-side. We
  // prefer sectors if both are selected.
  const isMultiSectorTemporal = isTemporalMode && sectorIdsSelected.length >= 2;
  const isMultiUserTemporal   = isTemporalMode && !isMultiSectorTemporal && userIdsSelected.length >= 2;
  const isMultiEntityTemporal = isMultiSectorTemporal || isMultiUserTemporal;

  const isEntityComparisonMode = !isTemporalMode && !isBothMode &&
    (compareMode === 'separated' || compareMode === 'separatedWithTotal') &&
    ((sectorIdsSelected.length) >= 2 || (userIdsSelected.length) >= 2);

  const isPeriodComparisonMode = !isTemporalMode &&
    (filters.periods?.length ?? 0) >= 2;

  const isChartComparisonMode = isTemporalMode || isEntityComparisonMode || isPeriodComparisonMode;

  const includeAmbos = isEntityComparisonMode &&
    compareMode === 'separatedWithTotal' && !isStackedType;

  // ── Available chart types (context-aware) ──
  const availableChartTypes = useMemo<ChartTypeOption[]>(() => {
    if (isBothMode) return BOTH_MODE_CHART_TYPE_OPTIONS;
    if (isChartComparisonMode) return [...BASE_CHART_TYPE_OPTIONS, ...STACKED_CHART_TYPE_OPTIONS];
    const opts = [...BASE_CHART_TYPE_OPTIONS];
    if (!isTemporalMode) opts.push(PIE_OPTION);
    return opts;
  }, [isBothMode, isChartComparisonMode, isTemporalMode]);

  // Keep chartType valid when available types change
  useEffect(() => {
    const valid = availableChartTypes.some(t => t.value === chartType);
    if (!valid) setChartType(isBothMode ? 'bar-stacked' : 'bar');
  }, [availableChartTypes, chartType, isBothMode]);

  // ── API filters: auto-generate periods for temporal modes ──
  //
  // The `/consumption-comparison` endpoint enforces a single comparison axis:
  // periods + sectorIds≥2 + userIds≥2 cannot coexist. The single-query path
  // therefore strips multi-entity lists down to 1 (it's the scope filter for
  // a single sector/user). When the user picks 2+ entities in temporal mode
  // we fan out — see multiEntityIds + parallel queries below.
  const apiFilters = useMemo((): ConsumptionAnalyticsFilters => {
    const base = { ...filters, operation: ACTIVITY_OPERATION.OUTBOUND };
    if (!isTemporalMode) return base;

    const periods = xAxisMode === 'year'
      ? generateYearlyPeriods(filters.startDate, filters.endDate, selectedYears)
      : generateMonthlyPeriods(filters.startDate, filters.endDate, selectedYears, selectedMonths);

    if (periods.length === 0) return base;

    return {
      ...base,
      sectorIds: base.sectorIds && base.sectorIds.length > 0 ? [base.sectorIds[0]] : undefined,
      userIds:   base.userIds   && base.userIds.length   > 0 ? [base.userIds[0]]   : undefined,
      periods,
      limit:     MAX_TEMPORAL_ITEMS,
      sortBy:    'quantity',
      sortOrder: 'desc',
    };
  }, [filters, isTemporalMode, xAxisMode, selectedYears, selectedMonths]);

  // Multi-entity temporal: per-sector (or per-user) queries with a stripped
  // base. We bump the limit so item-level aggregation includes everything
  // matching the other filters (the API caps at 500).
  const multiEntityIds = isMultiSectorTemporal
    ? sectorIdsSelected
    : isMultiUserTemporal ? userIdsSelected : [];

  const multiBaseFilters = useMemo((): ConsumptionAnalyticsFilters | null => {
    if (!isMultiEntityTemporal) return null;
    return {
      ...apiFilters,
      sectorIds: undefined,
      userIds:   undefined,
      // The analytics endpoint caps `limit` at 100; we use the max so
      // per-period aggregations include as many items as possible per entity.
      limit:     100,
    };
  }, [apiFilters, isMultiEntityTemporal]);

  const singleQuery = useConsumptionAnalytics(apiFilters, { enabled: !isMultiEntityTemporal });

  const multiQueries = useQueries({
    queries: isMultiEntityTemporal && multiBaseFilters
      ? multiEntityIds.map(id => ({
          queryKey: [
            ...consumptionAnalyticsKeys.comparisons(),
            isMultiSectorTemporal ? 'by-sector' : 'by-user',
            id,
            multiBaseFilters,
          ],
          queryFn: async (): Promise<ConsumptionAnalyticsResponse> =>
            getConsumptionComparison({
              ...multiBaseFilters,
              ...(isMultiSectorTemporal ? { sectorIds: [id] } : { userIds: [id] }),
            }),
          staleTime: 3 * 60 * 1000,
          gcTime:    10 * 60 * 1000,
          retry:     2,
        }))
      : [],
  });

  // Resolve entity ids to display names so chart series carry human-readable labels.
  const { data: sectorsData } = useSectors(
    { where: { id: { in: sectorIdsSelected } }, limit: 100 },
    { enabled: isMultiSectorTemporal && sectorIdsSelected.length > 0 },
  );
  const { data: usersData } = useUsers(
    { where: { id: { in: userIdsSelected } }, limit: 100 },
    { enabled: isMultiUserTemporal && userIdsSelected.length > 0 },
  );

  const entityNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (isMultiSectorTemporal) {
      (sectorsData?.data ?? []).forEach((s: { id: string; name: string }) => map.set(s.id, s.name));
    } else if (isMultiUserTemporal) {
      (usersData?.data ?? []).forEach((u: { id: string; name: string }) => map.set(u.id, u.name));
    }
    return map;
  }, [sectorsData, usersData, isMultiSectorTemporal, isMultiUserTemporal]);

  // Unified loading / error / refetch surface so renderChart doesn't need to
  // branch on which query path is active.
  const isLoading = isMultiEntityTemporal
    ? multiQueries.some(q => q.isLoading)
    : singleQuery.isLoading;
  const isError = isMultiEntityTemporal
    ? multiQueries.some(q => q.isError)
    : singleQuery.isError;
  const error = isMultiEntityTemporal
    ? (multiQueries.find(q => q.isError)?.error as Error | undefined)
    : singleQuery.error;
  const refetch = useCallback(() => {
    if (isMultiEntityTemporal) {
      void Promise.all(multiQueries.map(q => q.refetch()));
    } else {
      void singleQuery.refetch();
    }
  }, [isMultiEntityTemporal, multiQueries, singleQuery]);

  const data = singleQuery.data;
  const rawItems: ConsumptionItem[] = data?.data?.items ?? [];

  // Summary is aggregated when multi-entity (sum totals across per-entity
  // responses); otherwise it's just the single response's summary.
  const summary = useMemo(() => {
    if (!isMultiEntityTemporal) return data?.data?.summary;
    if (multiQueries.some(q => !q.data)) return undefined;
    let totalQty = 0, totalVal = 0;
    const itemIds = new Set<string>();
    multiQueries.forEach(q => {
      const s = q.data?.data?.summary;
      if (s) { totalQty += s.totalQuantity; totalVal += s.totalValue; }
      (q.data?.data?.items ?? []).forEach(item => itemIds.add(item.itemId));
    });
    const itemCount = itemIds.size;
    return {
      totalQuantity: totalQty,
      totalValue:    totalVal,
      itemCount,
      averageConsumptionPerItem: itemCount > 0 ? totalQty / itemCount : 0,
      averageValuePerItem:       itemCount > 0 ? totalVal / itemCount : 0,
    };
  }, [isMultiEntityTemporal, data, multiQueries]);

  // ── Y value accessors ──
  const getValue = useCallback((qty: number, val: number) =>
    yAxisMode === 'value' ? val : qty, [yAxisMode]);

  const getSecondary = useCallback((_qty: number, val: number): number | undefined =>
    isBothMode ? val : undefined, [isBothMode]);

  // ── Client-side data transforms ──
  const chartData = useMemo(() => {
    const empty = [] as Array<{
      name: string;
      value: number;
      secondaryValue?: number;
      comparisons?: Array<{ entityName: string; value: number; secondaryValue?: number }>;
    }>;

    // MULTI-ENTITY TEMPORAL MODE: pivot per-entity responses → periods × entities.
    // Each parallel response is item-level data for one sector/user. For each
    // (period, entity) we sum the item-level period totals to get a single
    // consumption value, then assemble periods on x-axis with one series per
    // selected entity.
    if (isMultiEntityTemporal && multiBaseFilters?.periods?.length) {
      const periods = multiBaseFilters.periods;
      // Bail out until every per-entity response has loaded — partial data
      // would render a chart with missing series and confuse trend analysis.
      if (multiQueries.some(q => !q.data)) return empty;

      const entityTotals = new Map<string, Map<string, { qty: number; val: number }>>();
      multiQueries.forEach((q, idx) => {
        const id = multiEntityIds[idx];
        if (!id) return;
        const perPeriod = new Map<string, { qty: number; val: number }>();
        (q.data?.data?.items ?? []).forEach(item => {
          if (!isComparisonItem(item)) return;
          item.comparisons.forEach(c => {
            const cur = perPeriod.get(c.entityId) ?? { qty: 0, val: 0 };
            perPeriod.set(c.entityId, { qty: cur.qty + c.quantity, val: cur.val + c.value });
          });
        });
        entityTotals.set(id, perPeriod);
      });

      return periods.map(period => {
        const comparisons = multiEntityIds.map(id => {
          const totals = entityTotals.get(id)?.get(period.id) ?? { qty: 0, val: 0 };
          return {
            entityName:     entityNameById.get(id) ?? id,
            value:          getValue(totals.qty, totals.val),
            secondaryValue: getSecondary(totals.qty, totals.val),
          };
        });
        const periodTotal = comparisons.reduce(
          (acc, c) => ({ value: acc.value + c.value, sec: acc.sec + (c.secondaryValue ?? 0) }),
          { value: 0, sec: 0 },
        );
        return {
          name:           period.label,
          value:          periodTotal.value,
          secondaryValue: isBothMode ? periodTotal.sec : undefined,
          comparisons,
        };
      });
    }

    if (!rawItems.length) return empty;

    // TEMPORAL MODE: pivot → periods × items
    if (isTemporalMode && apiFilters.periods && apiFilters.periods.length > 0) {
      const topItems = rawItems.slice(0, MAX_TEMPORAL_ITEMS);
      return apiFilters.periods.map(period => {
        const comparisons = topItems.map(item => {
          if (!isComparisonItem(item)) return { entityName: item.itemName, value: 0 };
          const comp = item.comparisons.find(c => c.entityId === period.id);
          return {
            entityName:     item.itemName,
            value:          comp ? getValue(comp.quantity, comp.value) : 0,
            secondaryValue: comp ? getSecondary(comp.quantity, comp.value) : undefined,
          };
        });
        const totalQty = topItems.reduce((s, item) => {
          if (!isComparisonItem(item)) return s;
          const comp = item.comparisons.find(c => c.entityId === period.id);
          return s + (comp?.quantity ?? 0);
        }, 0);
        const totalVal = topItems.reduce((s, item) => {
          if (!isComparisonItem(item)) return s;
          const comp = item.comparisons.find(c => c.entityId === period.id);
          return s + (comp?.value ?? 0);
        }, 0);
        return {
          name:           period.label,
          value:          getValue(totalQty, totalVal),
          secondaryValue: getSecondary(totalQty, totalVal),
          comparisons,
        };
      });
    }

    // ITEM MODE (default)
    return rawItems.map(item => {
      const primary   = getValue(item.totalQuantity, item.totalValue);
      const secondary = getSecondary(item.totalQuantity, item.totalValue);
      let comps: Array<{ entityName: string; value: number; secondaryValue?: number }> | undefined;
      if ((isEntityComparisonMode || isPeriodComparisonMode) && isComparisonItem(item)) {
        comps = [
          ...item.comparisons.map(comp => ({
            entityName:     comp.entityName,
            value:          getValue(comp.quantity, comp.value),
            secondaryValue: getSecondary(comp.quantity, comp.value),
          })),
          ...(includeAmbos ? [{ entityName: 'Total', value: primary, secondaryValue: secondary }] : []),
        ];
      }
      return { name: item.itemName, value: primary, secondaryValue: secondary, comparisons: comps };
    });
  }, [rawItems, xAxisMode, yAxisMode, isTemporalMode, isEntityComparisonMode, isPeriodComparisonMode,
      includeAmbos, apiFilters.periods, getValue, getSecondary, isBothMode,
      isMultiEntityTemporal, multiBaseFilters, multiQueries, multiEntityIds, entityNameById]);

  // ── StatisticsChart props ──
  const chartYAxisMode: YAxisMode = isBothMode ? 'both' : yAxisMode === 'value' ? 'value' : 'quantity';

  const valueFormatter = useCallback((v: number, mode: YAxisMode) => {
    if (mode === 'value' || mode === 'both') return formatCurrency(v);
    return formatNumber(v);
  }, []);

  const secondaryValueFormatter = useCallback((v: number) => formatCurrency(v), []);

  const chartDataKey = useMemo(() =>
    `${xAxisMode}-${yAxisMode}-${compareMode}-${isChartComparisonMode}-${chartType}`,
    [xAxisMode, yAxisMode, compareMode, isChartComparisonMode, chartType]);

  const yAxisLabel = yAxisMode === 'value' ? 'Valor (R$)' : 'Quantidade';

  // ── Per-x-axis derived stats ──
  //
  // The API's summary.averageConsumptionPerItem / averageValuePerItem are
  // total ÷ itemCount — useful in item mode but wrong as a "Média por Mês"
  // label in temporal mode. We compute everything off chartData so the cards
  // always reflect what the chart is actually showing.
  const peakRow = useMemo(() => {
    if (!chartData.length) return null;
    return chartData.reduce((max, d) => d.value > max.value ? d : max, chartData[0]);
  }, [chartData]);

  const averagePerXAxis = useMemo(() => {
    if (!chartData.length) return 0;
    const total = chartData.reduce((s, d) => s + d.value, 0);
    return total / chartData.length;
  }, [chartData]);

  // ── Active filter badge count ──
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.sectorIds?.length) c++;
    if (filters.userIds?.length) c++;
    if (filters.itemIds?.length) c++;
    if (selectedYears.length) c++;
    if (selectedMonths.length) c++;
    if (xAxisMode !== 'item') c++;
    if (yAxisMode !== 'quantity') c++;
    return c;
  }, [filters, selectedYears, selectedMonths, xAxisMode, yAxisMode]);

  // ── Handlers ──
  const handleFilterApply = useCallback((
    newFilters: ConsumptionAnalyticsFilters,
    options: {
      xAxisMode: ConsumptionXAxisMode;
      yAxisMode: ConsumptionYAxisMode;
      compareMode: ConsumptionCompareMode;
      selectedYears: string[];
      selectedMonths: string[];
    },
  ) => {
    setFilters({ ...newFilters, operation: ACTIVITY_OPERATION.OUTBOUND, limit: newFilters.limit || 20 });
    setXAxisMode(options.xAxisMode);
    setYAxisMode(options.yAxisMode);
    setCompareMode(options.compareMode);
    setSelectedYears(options.selectedYears);
    setSelectedMonths(options.selectedMonths);
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!chartData.length) return;
    try {
      const rows: string[] = [];
      if (isChartComparisonMode && chartData[0]?.comparisons?.length) {
        const entities = chartData[0].comparisons.map(c => c.entityName);
        rows.push(['Nome', ...entities, 'Total'].join(','));
        chartData.forEach(d => {
          const vals = d.comparisons?.map(c => c.value.toFixed(2)) ?? [];
          rows.push([`"${d.name}"`, ...vals, d.value.toFixed(2)].join(','));
        });
      } else {
        rows.push(['Nome', yAxisMode === 'value' ? 'Valor (R$)' : 'Quantidade'].join(','));
        chartData.forEach(d => rows.push([`"${d.name}"`, d.value.toFixed(2)].join(',')));
      }
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `consumo-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('CSV exportado com sucesso!');
    } catch {
      toast.error('Erro ao exportar CSV');
    }
  }, [chartData, isChartComparisonMode, yAxisMode]);

  const handleExportXLSX = useCallback(() => {
    if (!chartData.length) return;
    try {
      let rows: unknown[][];
      if (isChartComparisonMode && chartData[0]?.comparisons?.length) {
        const entities = chartData[0].comparisons.map(c => c.entityName);
        rows = [
          ['Nome', ...entities, 'Total'],
          ...chartData.map(d => [d.name, ...(d.comparisons?.map(c => c.value) ?? []), d.value]),
        ];
      } else {
        rows = [
          ['Nome', yAxisMode === 'value' ? 'Valor (R$)' : 'Quantidade'],
          ...chartData.map(d => [d.name, d.value]),
        ];
      }
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Consumo');
      XLSX.writeFile(wb, `consumo-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`);
      toast.success('XLSX exportado com sucesso!');
    } catch {
      toast.error('Erro ao exportar XLSX');
    }
  }, [chartData, isChartComparisonMode, yAxisMode]);

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
      doc.text(cardTitle[xAxisMode], pageW / 2, 14, { align: 'center' });

      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pageW / 2, 20, { align: 'center' });

      const filterParts: string[] = [];
      filterParts.push(`Agrupamento: ${xAxisPluralLabel[xAxisMode]}`);
      if (selectedYears.length) filterParts.push(`Anos: ${[...selectedYears].sort().join(', ')}`);
      if (selectedMonths.length) filterParts.push(`Meses: ${selectedMonths.length} selecionados`);
      filterParts.push(`Métrica: ${isBothMode ? 'Quantidade + Valor' : yAxisMode === 'value' ? 'Valor (R$)' : 'Quantidade'}`);
      if (isEntityComparisonMode && comparisonEntities.length) {
        filterParts.push(`Comparação: ${comparisonEntities.filter(e => e !== 'Total').join(', ')}`);
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
      if (footerY < pageH - 3 && summary) {
        doc.setFontSize(8);
        doc.setTextColor(70, 70, 70);
        const stats: string[] = [
          `Quantidade Total: ${formatNumber(summary.totalQuantity, 0)}`,
          `Valor Total: ${formatCurrency(summary.totalValue)}`,
          `${isTemporalMode ? 'Períodos' : xAxisPluralLabel[xAxisMode]}: ${isTemporalMode ? (apiFilters.periods?.length ?? 0) : chartData.length}`,
        ];
        doc.text(stats.join('   |   '), pageW / 2, footerY, { align: 'center' });
      }

      doc.save(`consumo-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.pdf`);
      toast.dismiss(toastId);
      toast.success('PDF exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      toast.dismiss(toastId);
      toast.error('Erro ao exportar PDF');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, xAxisMode, yAxisMode, isBothMode, isTemporalMode, isEntityComparisonMode,
      selectedYears, selectedMonths, summary, apiFilters.periods]);

  // ── Chart render ──
  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 460px)', minHeight: '320px' }}>
          <div className="space-y-3 w-full px-8">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-[380px] w-full" />
          </div>
        </div>
      );
    }
    if (isError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4" style={{ height: 'calc(100vh - 460px)', minHeight: '320px' }}>
          <IconAlertCircle className="h-12 w-12 text-destructive" />
          <div className="text-center">
            <p className="font-semibold">Erro ao carregar dados</p>
            <p className="text-sm text-muted-foreground">{(error as Error)?.message}</p>
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
        <div className="flex flex-col items-center justify-center gap-4" style={{ height: 'calc(100vh - 460px)', minHeight: '320px' }}>
          <IconPackage className="h-12 w-12 text-muted-foreground" />
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
        chartType={chartType as StatisticsChartType}
        yAxisMode={chartYAxisMode}
        isComparisonMode={isChartComparisonMode}
        height="calc(100vh - 460px)"
        yAxisLabel={yAxisLabel}
        valueFormatter={valueFormatter}
        secondaryValueFormatter={secondaryValueFormatter}
        tooltipLabels={{
          primary:   isBothMode ? 'Quantidade' : yAxisLabel,
          secondary: isBothMode ? 'Valor (R$)' : undefined,
        }}
        trendLine={trendLine}
      />
    );
  };

  const currentChartTypeOption = availableChartTypes.find(t => t.value === chartType) ?? availableChartTypes[0];
  const ChartIcon = currentChartTypeOption.icon;

  const comparisonEntities = useMemo(() => {
    if (!isChartComparisonMode || !chartData[0]?.comparisons?.length) return [];
    return chartData[0].comparisons.map(c => c.entityName);
  }, [isChartComparisonMode, chartData]);

  const xAxisSingularLabel: Record<ConsumptionXAxisMode, string> = {
    item:  'Item',
    month: 'Mês',
    year:  'Ano',
  };

  const xAxisPluralLabel: Record<ConsumptionXAxisMode, string> = {
    item:  'Itens',
    month: 'Meses',
    year:  'Anos',
  };

  const cardTitle: Record<ConsumptionXAxisMode, string> = {
    item:  'Análise de Consumo de Itens',
    month: 'Evolução do Consumo por Mês',
    year:  'Evolução do Consumo por Ano',
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4 pb-4 overflow-hidden">
      <div className="flex-shrink-0">
        <PageHeader
          title="Análise de Consumo"
          icon={IconChartBar}
          favoritePage={FAVORITE_PAGES.ESTOQUE_ESTATISTICAS}
          breadcrumbs={[
            { label: 'Início',       href: routes.home },
            { label: 'Estoque',      href: routes.inventory.root },
            { label: 'Estatísticas', href: routes.statistics.inventory.root },
            { label: 'Consumo' },
          ]}
        />
      </div>

      <div className="flex-1 min-h-0 mt-4 overflow-hidden">
        <Card className="h-full flex flex-col">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle>{cardTitle[xAxisMode]}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span>Saídas do estoque no período selecionado</span>
                    {isBothMode && <Badge variant="outline" className="text-xs">Qtde + Valor</Badge>}
                    {isEntityComparisonMode && (
                      <Badge variant="secondary" className="text-xs">
                        {compareMode === 'separatedWithTotal' ? 'Comparação + Total' : 'Comparação'}
                      </Badge>
                    )}
                    {isPeriodComparisonMode && (
                      <Badge variant="secondary" className="text-xs">Comparação por Períodos</Badge>
                    )}
                    {isTemporalMode && <Badge variant="secondary" className="text-xs">Modo Temporal</Badge>}
                    {isMultiSectorTemporal && (
                      <Badge variant="secondary" className="text-xs">
                        {multiEntityIds.length} setores × períodos
                      </Badge>
                    )}
                    {isMultiUserTemporal && (
                      <Badge variant="secondary" className="text-xs">
                        {multiEntityIds.length} usuários × períodos
                      </Badge>
                    )}
                    {trendLine && <Badge variant="outline" className="text-xs">{TREND_LABELS[trendLine]}</Badge>}
                    {selectedYears.length > 0 && (
                      <Badge variant="outline" className="text-xs">{[...selectedYears].sort().join(', ')}</Badge>
                    )}
                    {selectedMonths.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {selectedMonths.length} {selectedMonths.length === 1 ? 'mês' : 'meses'}
                      </Badge>
                    )}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">

                  {/* Chart type */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ChartIcon className="h-4 w-4 mr-2" />
                        {currentChartTypeOption.label}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      <DropdownMenuLabel>Tipo de Gráfico</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup value={chartType} onValueChange={v => setChartType(v as ConsumptionChartType)}>
                        {availableChartTypes.map(opt => {
                          const Icon = opt.icon;
                          return (
                            <DropdownMenuRadioItem key={opt.value} value={opt.value} className="group">
                              <Icon className="h-4 w-4 mr-2" />
                              <div className="flex flex-col">
                                <span>{opt.label}</span>
                                <span className="text-xs text-muted-foreground group-data-[highlighted]:text-white/80">
                                  {opt.description}
                                </span>
                              </div>
                            </DropdownMenuRadioItem>
                          );
                        })}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Trend line */}
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
                        <DropdownMenuRadioItem value="sma3">Média Móvel 3 meses</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma6">Média Móvel 6 meses</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma12">Média Móvel 12 meses</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

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
                      <Button variant="outline" size="sm" disabled={isLoading || !chartData.length}>
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

            <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-4">

              {/* Summary Cards — order mirrors productivity: Total → Média → Pico → Períodos */}
              {summary && (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  {/* 1. Total (quantity or value depending on y-mode) */}
                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">
                        {yAxisMode === 'value' ? 'Valor Total' : 'Quantidade Total'}
                      </CardTitle>
                      {yAxisMode === 'value'
                        ? <IconCash className="h-3.5 w-3.5 text-muted-foreground" />
                        : <IconBox  className="h-3.5 w-3.5 text-muted-foreground" />}
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">
                        {yAxisMode === 'value'
                          ? formatCurrency(summary.totalValue)
                          : formatNumber(summary.totalQuantity, 0)}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 2. Média per X-axis category */}
                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">
                        Média por {xAxisSingularLabel[xAxisMode]}
                      </CardTitle>
                      <IconCalendarStats className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">
                        {yAxisMode === 'value'
                          ? formatCurrency(averagePerXAxis)
                          : formatNumber(averagePerXAxis, 1)}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 3. Peak (or Valor Total when y-mode = both, since Pico would duplicate the qty signal) */}
                  {yAxisMode === 'both' ? (
                    <Card className="py-2">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                        <CardTitle className="text-xs font-medium">Valor Total</CardTitle>
                        <IconCash className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="pb-0 px-4">
                        <div className="text-xl font-bold">{formatCurrency(summary.totalValue)}</div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="py-2">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                        <CardTitle className="text-xs font-medium">
                          Pico de Uso{peakRow ? ` (${peakRow.name})` : ''}
                        </CardTitle>
                        <IconTrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="pb-0 px-4">
                        <div className="text-xl font-bold">
                          {yAxisMode === 'value'
                            ? formatCurrency(peakRow?.value ?? 0)
                            : formatNumber(peakRow?.value ?? 0, 0)}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 4. Períodos / Itens analisados */}
                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">
                        {isTemporalMode ? 'Períodos Analisados' : `${xAxisPluralLabel[xAxisMode]} Analisados`}
                      </CardTitle>
                      <IconPackage className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">
                        {isTemporalMode ? (apiFilters.periods?.length ?? 0) : chartData.length}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

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
      </div>

      <ConsumptionFiltersSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        xAxisMode={xAxisMode}
        yAxisMode={yAxisMode}
        compareMode={compareMode}
        selectedYears={selectedYears}
        selectedMonths={selectedMonths}
        onApply={handleFilterApply}
      />
    </div>
  );
};

export const InventoryConsumptionStatisticsPage = () => <ConsumptionPage />;
export default InventoryConsumptionStatisticsPage;
