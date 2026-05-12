// web/src/pages/inventory/statistics/consumption.tsx

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DateTimeInput } from '@/components/ui/date-time-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { routes, FAVORITE_PAGES, ACTIVITY_OPERATION } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useConsumptionAnalytics } from '@/hooks/inventory/use-consumption-analytics';
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
import { getItemBrands } from '@/api-client/item-brand';
import { getItemCategories } from '@/api-client/item-category';
import { sectorKeys, userKeys, itemKeys, itemBrandKeys, itemCategoryKeys } from '@/hooks/common/query-keys';
import {
  IconChartBar, IconChartPie, IconChartLine, IconChartArea, IconStack2,
  IconFilter, IconDownload, IconRefresh, IconAlertCircle,
  IconPackage, IconCash, IconBox, IconCalendarStats, IconChartArcs3,
  IconUsers, IconBuilding, IconX, IconInfoCircle, IconTag, IconNumbers,
  IconFileTypeCsv, IconFileTypeXls, IconTarget, IconTrendingUp,
  IconArrowsExchange2, IconCategory,
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

const STACKED_CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { value: 'bar-stacked',  label: 'Colunas Empilhadas', icon: IconStack2,    description: 'Colunas empilhadas' },
  { value: 'line-stacked', label: 'Linhas Empilhadas',  icon: IconChartLine, description: 'Linhas empilhadas' },
];

const BOTH_MODE_CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { value: 'bar-stacked',  label: 'Colunas', icon: IconChartBar,  description: 'Colunas com Qtde + Valor' },
  { value: 'line-stacked', label: 'Linhas',  icon: IconChartLine, description: 'Linhas com Qtde + Valor' },
];

const PIE_OPTION: ChartTypeOption = {
  value: 'pie', label: 'Pizza', icon: IconChartPie, description: 'Gráfico de pizza',
};

const X_AXIS_OPTIONS: Array<{ value: ConsumptionXAxisMode; label: string }> = [
  { value: 'item',     label: 'Itens' },
  { value: 'category', label: 'Categorias' },
  { value: 'brand',    label: 'Marcas' },
  { value: 'month',    label: 'Meses' },
  { value: 'year',     label: 'Anos' },
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

  const fetchItems = useCallback(async (search: string, page = 1) => {
    const res = await getItems({ search: search || undefined, page, limit: COMBOBOX_PAGE_SIZE });
    return {
      data: (res.data || []).map(i => ({ value: i.id, label: i.name, description: i.brand?.name || i.category?.name })),
      hasMore: res.meta?.hasNextPage ?? false,
    };
  }, []);

  const fetchBrands = useCallback(async (search: string, page = 1) => {
    const res = await getItemBrands({ search: search || undefined, page, limit: COMBOBOX_PAGE_SIZE });
    return { data: (res.data || []).map(b => ({ value: b.id, label: b.name })), hasMore: res.meta?.hasNextPage ?? false };
  }, []);

  const fetchCategories = useCallback(async (search: string, page = 1) => {
    const res = await getItemCategories({ search: search || undefined, page, limit: COMBOBOX_PAGE_SIZE });
    return { data: (res.data || []).map(c => ({ value: c.id, label: c.name })), hasMore: res.meta?.hasNextPage ?? false };
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localSectors.length > 0) count++;
    if (localUsers.length > 0) count++;
    if ((localFilters.itemIds?.length ?? 0) > 0) count++;
    if ((localFilters.brandIds?.length ?? 0) > 0) count++;
    if ((localFilters.categoryIds?.length ?? 0) > 0) count++;
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
                {localX === 'item'     && 'Cada item no eixo X. Comparação por setor/usuário/período disponível.'}
                {localX === 'category' && 'Itens agrupados por categoria no eixo X.'}
                {localX === 'brand'    && 'Itens agrupados por marca no eixo X.'}
                {localX === 'month'    && 'Evolução temporal mês a mês. Os itens são exibidos como séries.'}
                {localX === 'year'     && 'Evolução temporal ano a ano. Os itens são exibidos como séries.'}
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

            {/* Items filter */}
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

            {/* Categories — hidden when X-axis IS category */}
            {localX !== 'category' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconCategory className="h-4 w-4" />
                  Categorias
                </Label>
                <Combobox
                  mode="multiple"
                  async
                  value={localFilters.categoryIds ?? []}
                  onValueChange={v => setLocalFilters(f => ({ ...f, categoryIds: Array.isArray(v) && v.length > 0 ? v : undefined }))}
                  queryKey={[...itemCategoryKeys.lists()]}
                  queryFn={fetchCategories}
                  minSearchLength={0}
                  placeholder="Todas as categorias..."
                  searchPlaceholder="Buscar categoria..."
                  emptyText="Nenhuma categoria encontrada"
                  loadingText="Carregando..."
                  searchable={true}
                  clearable={true}
                />
              </div>
            )}

            {/* Brands — hidden when X-axis IS brand */}
            {localX !== 'brand' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconTag className="h-4 w-4" />
                  Marcas
                </Label>
                <Combobox
                  mode="multiple"
                  async
                  value={localFilters.brandIds ?? []}
                  onValueChange={v => setLocalFilters(f => ({ ...f, brandIds: Array.isArray(v) && v.length > 0 ? v : undefined }))}
                  queryKey={[...itemBrandKeys.lists()]}
                  queryFn={fetchBrands}
                  minSearchLength={0}
                  placeholder="Todas as marcas..."
                  searchPlaceholder="Buscar marca..."
                  emptyText="Nenhuma marca encontrada"
                  loadingText="Carregando..."
                  searchable={true}
                  clearable={true}
                />
              </div>
            )}

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
                    ? 'Filtra consumo por setor(es).'
                    : 'Sem seleção = todos. Selecione 2+ para habilitar comparação.'}
                </p>
              </div>
            )}

            {/* Users — hidden in 'both' y-mode and temporal mode */}
            {localY !== 'both' && !isTemporalLocal && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconUsers className="h-4 w-4" />
                  Usuários
                </Label>
                {localSectors.length >= 2 && (
                  <Alert variant="default" className="py-2">
                    <IconInfoCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Comparação por setor ativa. Filtro de usuários desativado.
                    </AlertDescription>
                  </Alert>
                )}
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
                  disabled={localSectors.length >= 2}
                />
                <p className="text-xs text-muted-foreground">Sem seleção = todos. Selecione 2+ para habilitar comparação.</p>
              </div>
            )}

            {/* Limit */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconNumbers className="h-4 w-4" />
                Número de Resultados
              </Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={localFilters.limit ?? 50}
                onChange={e => setLocalFilters(f => ({ ...f, limit: parseInt(e.target.value) || 50 }))}
                className="h-9"
              />
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
// Main Page
// =====================

const ConsumptionPage = () => {
  usePageTracker({ page: 'consumption-analytics', title: 'Análise de Consumo' });

  const [showFilters, setShowFilters]   = useState(false);
  const [chartType, setChartType]       = useState<ConsumptionChartType>('bar');
  const [trendLine, setTrendLine]       = useState<TrendLineType | null>(null);
  const [goalValue, setGoalValue]       = useState<number | null>(null);
  const [goalInput, setGoalInput]       = useState('');
  const [goalPopoverOpen, setGoalPopoverOpen] = useState(false);

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

  const isEntityComparisonMode = !isTemporalMode && !isBothMode &&
    (compareMode === 'separated' || compareMode === 'separatedWithTotal') &&
    ((filters.sectorIds?.length ?? 0) >= 2 || (filters.userIds?.length ?? 0) >= 2);

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
  const apiFilters = useMemo((): ConsumptionAnalyticsFilters => {
    const base = { ...filters, operation: ACTIVITY_OPERATION.OUTBOUND };
    if (!isTemporalMode) return base;

    const periods = xAxisMode === 'year'
      ? generateYearlyPeriods(filters.startDate, filters.endDate, selectedYears)
      : generateMonthlyPeriods(filters.startDate, filters.endDate, selectedYears, selectedMonths);

    if (periods.length === 0) return base;

    return { ...base, periods, limit: MAX_TEMPORAL_ITEMS, sortBy: 'quantity', sortOrder: 'desc' };
  }, [filters, isTemporalMode, xAxisMode, selectedYears, selectedMonths]);

  const { data, isLoading, isError, error, refetch } = useConsumptionAnalytics(apiFilters);

  const rawItems: ConsumptionItem[] = data?.data?.items ?? [];
  const summary = data?.data?.summary;

  // ── Y value accessors ──
  const getValue = useCallback((qty: number, val: number) =>
    yAxisMode === 'value' ? val : qty, [yAxisMode]);

  const getSecondary = useCallback((_qty: number, val: number): number | undefined =>
    isBothMode ? val : undefined, [isBothMode]);

  // ── Client-side data transforms ──
  const chartData = useMemo(() => {
    if (!rawItems.length) return [] as Array<{
      name: string;
      value: number;
      secondaryValue?: number;
      comparisons?: Array<{ entityName: string; value: number; secondaryValue?: number }>;
    }>;

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

    // CATEGORY / BRAND MODE: client-side group + aggregate
    if (xAxisMode === 'category' || xAxisMode === 'brand') {
      type GroupEntry = { name: string; totalQty: number; totalVal: number; compMap: Map<string, { qty: number; val: number }> };
      const map = new Map<string, GroupEntry>();
      rawItems.forEach(item => {
        const key = xAxisMode === 'category'
          ? (item.categoryName || 'Sem Categoria')
          : (item.brandName    || 'Sem Marca');
        if (!map.has(key)) map.set(key, { name: key, totalQty: 0, totalVal: 0, compMap: new Map() });
        const g = map.get(key)!;
        g.totalQty += item.totalQuantity;
        g.totalVal += item.totalValue;
        if (isComparisonItem(item)) {
          item.comparisons.forEach(comp => {
            const ex = g.compMap.get(comp.entityName) ?? { qty: 0, val: 0 };
            g.compMap.set(comp.entityName, { qty: ex.qty + comp.quantity, val: ex.val + comp.value });
          });
        }
      });
      return [...map.values()]
        .sort((a, b) => yAxisMode === 'value' ? b.totalVal - a.totalVal : b.totalQty - a.totalQty)
        .map(g => ({
          name:           g.name,
          value:          getValue(g.totalQty, g.totalVal),
          secondaryValue: getSecondary(g.totalQty, g.totalVal),
          comparisons:    g.compMap.size > 0
            ? [...g.compMap.entries()].map(([entityName, v]) => ({
                entityName,
                value:          getValue(v.qty, v.val),
                secondaryValue: getSecondary(v.qty, v.val),
              }))
            : undefined,
        }));
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
      includeAmbos, apiFilters.periods, getValue, getSecondary]);

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

  // ── Active filter badge count ──
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.sectorIds?.length) c++;
    if (filters.userIds?.length) c++;
    if (filters.itemIds?.length) c++;
    if (filters.brandIds?.length) c++;
    if (filters.categoryIds?.length) c++;
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

  // ── Chart render ──
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
        <div className="h-[480px] flex flex-col items-center justify-center gap-4">
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
        height="480px"
        yAxisLabel={yAxisLabel}
        valueFormatter={valueFormatter}
        secondaryValueFormatter={secondaryValueFormatter}
        tooltipLabels={{
          primary:   isBothMode ? 'Quantidade' : yAxisLabel,
          secondary: isBothMode ? 'Valor (R$)' : undefined,
        }}
        trendLine={trendLine}
        goalLine={goalValue != null ? { value: goalValue, label: 'Meta' } : null}
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
    item:     'Item',
    category: 'Categoria',
    brand:    'Marca',
    month:    'Mês',
    year:     'Ano',
  };

  const xAxisPluralLabel: Record<ConsumptionXAxisMode, string> = {
    item:     'Itens',
    category: 'Categorias',
    brand:    'Marcas',
    month:    'Meses',
    year:     'Anos',
  };

  const cardTitle: Record<ConsumptionXAxisMode, string> = {
    item:     'Análise de Consumo de Itens',
    category: 'Consumo por Categoria',
    brand:    'Consumo por Marca',
    month:    'Evolução do Consumo por Mês',
    year:     'Evolução do Consumo por Ano',
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
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

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4">
          <Card>
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
                    {trendLine && <Badge variant="outline" className="text-xs">Tendência</Badge>}
                    {goalValue != null && <Badge variant="outline" className="text-xs">Meta: {goalValue}</Badge>}
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
                    <DropdownMenuContent align="end">
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
                                <span className="text-xs text-muted-foreground group-data-[highlighted]:text-white/90">
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
                      <Button variant={trendLine ? 'secondary' : 'outline'} size="sm">
                        <IconTrendingUp className="h-4 w-4 mr-2" />
                        Tendência
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Linha de Tendência</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup value={trendLine ?? 'none'} onValueChange={v => setTrendLine(v === 'none' ? null : v as TrendLineType)}>
                        <DropdownMenuRadioItem value="none">Nenhuma</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="linear">Linear</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma3">Média Móvel 3</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma6">Média Móvel 6</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="sma12">Média Móvel 12</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Goal line */}
                  <Popover open={goalPopoverOpen} onOpenChange={setGoalPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant={goalValue != null ? 'secondary' : 'outline'} size="sm">
                        <IconTarget className="h-4 w-4 mr-2" />
                        Meta
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-52">
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Definir Meta</p>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Ex: 500"
                          value={goalInput}
                          onChange={e => setGoalInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const v = parseFloat(goalInput);
                              setGoalValue(isNaN(v) ? null : v);
                              setGoalPopoverOpen(false);
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1" onClick={() => {
                            const v = parseFloat(goalInput);
                            setGoalValue(isNaN(v) ? null : v);
                            setGoalPopoverOpen(false);
                          }}>Aplicar</Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setGoalValue(null); setGoalInput(''); setGoalPopoverOpen(false);
                          }}>Limpar</Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Export */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={isLoading || !chartData.length}>
                        <IconDownload className="h-4 w-4 mr-2" />
                        Exportar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Exportar Dados</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleExportCSV}>
                        <IconFileTypeCsv className="h-4 w-4 mr-2" />CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleExportXLSX}>
                        <IconFileTypeXls className="h-4 w-4 mr-2" />XLSX
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Filters */}
                  <Button
                    variant={activeFilterCount > 0 ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setShowFilters(true)}
                  >
                    <IconFilter className="h-4 w-4 mr-2" />
                    Filtros
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-2 h-4 w-4 p-0 flex items-center justify-center text-xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>

                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-4">

              {/* Summary Cards */}
              {summary && (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">
                        {isTemporalMode ? 'Períodos' : xAxisPluralLabel[xAxisMode]}
                      </CardTitle>
                      <IconPackage className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">
                        {isTemporalMode ? (apiFilters.periods?.length ?? 0) : chartData.length}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Quantidade Total</CardTitle>
                      <IconBox className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatNumber(summary.totalQuantity, 0)}</div>
                      {isTemporalMode && chartData.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(summary.totalQuantity / chartData.length, 1)} / {xAxisSingularLabel[xAxisMode].toLowerCase()}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Valor Total</CardTitle>
                      <IconCash className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatCurrency(summary.totalValue)}</div>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">
                        Média por {xAxisSingularLabel[xAxisMode]}
                      </CardTitle>
                      <IconCash className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">
                        {yAxisMode === 'value'
                          ? formatCurrency(summary.averageValuePerItem)
                          : formatNumber(summary.averageConsumptionPerItem, 1)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Chart */}
              <div ref={chartContainerRef}>
                {renderChart()}
              </div>

              {/* Data Table */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Detalhamento</CardTitle>
                  <CardDescription>
                    {chartData.length > 0
                      ? `${chartData.length} ${xAxisPluralLabel[xAxisMode].toLowerCase()}`
                      : 'Nenhum dado'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[360px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{xAxisSingularLabel[xAxisMode]}</TableHead>
                          {isChartComparisonMode && comparisonEntities.length > 0
                            ? comparisonEntities.map(e => (
                                <TableHead key={e} className="text-right">{e}</TableHead>
                              ))
                            : <>
                                <TableHead className="text-right">Quantidade</TableHead>
                                <TableHead className="text-right">Valor (R$)</TableHead>
                              </>
                          }
                          {isChartComparisonMode && comparisonEntities.length > 0 && (
                            <TableHead className="text-right">Total</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          Array.from({ length: 8 }).map((_, i) => (
                            <TableRow key={i}>
                              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                            </TableRow>
                          ))
                        ) : chartData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              Nenhum dado para exibir
                            </TableCell>
                          </TableRow>
                        ) : isChartComparisonMode && comparisonEntities.length > 0 ? (
                          chartData.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              {comparisonEntities.map(entity => {
                                const comp = row.comparisons?.find(c => c.entityName === entity);
                                return (
                                  <TableCell key={entity} className="text-right text-sm">
                                    {comp
                                      ? (yAxisMode === 'value' ? formatCurrency(comp.value) : formatNumber(comp.value))
                                      : '—'}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-right text-sm font-medium">
                                {yAxisMode === 'value' ? formatCurrency(row.value) : formatNumber(row.value)}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          chartData.map((row, i) => {
                            const srcItem = xAxisMode === 'item' ? (rawItems[i] ?? null) : null;
                            return (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{row.name}</TableCell>
                                <TableCell className="text-right text-sm">
                                  {formatNumber(srcItem ? srcItem.totalQuantity : (yAxisMode !== 'value' ? row.value : 0))}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                  {formatCurrency(srcItem ? srcItem.totalValue : (yAxisMode === 'value' ? row.value : 0))}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>

            </CardContent>
          </Card>
        </div>
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
