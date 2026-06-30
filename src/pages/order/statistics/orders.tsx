// web/src/pages/order/statistics/orders.tsx

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterDrawer } from '@/components/common/filters/ui/FilterDrawer';
import { Combobox } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GOAL_METRIC, GOAL_METRIC_UNIT, routes, FAVORITE_PAGES, ORDER_STATUS_LABELS } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useCanViewPrices } from '@/hooks';
import { useDefaultGoal } from '@/hooks/administration/use-default-goal';
import { GoalMetaPopover } from '@/components/statistics/goal-meta-popover';
import { useOrderAnalytics } from '@/hooks/inventory/use-order-analytics';
import type { OrderAnalyticsFilters } from '@/types/order-analytics';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import {
  formatCurrency,
  formatNumber,
} from '@/types/statistics-common';
import type { YAxisMode, StatisticsChartType, TrendLineType } from '@/types/statistics-common';
import { getOrders } from '@/api-client/order';
import { calculateOrderTotal } from '@/utils/order';
import { getSuppliers } from '@/api-client/supplier';
import { supplierKeys } from '@/hooks/common/query-keys';
import {
  IconChartBar,
  IconChartLine,
  IconChartArea,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconClipboardList,
  IconCash,
  IconBox,
  IconRuler,
  IconCalendarStats,
  IconTrendingUp,
  IconFileTypeCsv,
  IconArrowsExchange2,
  IconBuilding,
  IconReceipt,
} from '@tabler/icons-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/components/ui/sonner';
import { z } from 'zod';
import { useStatisticsPagePersistence } from '@/hooks/common/use-statistics-page-persistence';
import { StatisticsPresetsMenu } from '@/components/statistics/statistics-presets-menu';
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
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },   { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },    { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },   { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },{ value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },{ value: '12', label: 'Dezembro' },
];

const generateYearOptions = (yearsBack = 5) => {
  const cy = new Date().getFullYear();
  return Array.from({ length: yearsBack + 1 }, (_, i) => {
    const y = cy - i;
    return { value: y.toString(), label: y.toString() };
  });
};
const YEAR_OPTIONS = generateYearOptions();

type OrderYAxisMode = 'quantity' | 'value';
const Y_AXIS_OPTIONS: Array<{ value: OrderYAxisMode; label: string }> = [
  { value: 'quantity', label: 'Quantidade de Pedidos' },
  { value: 'value', label: 'Valor (R$)' },
];

type XMode = 'month' | 'year';
const X_AXIS_OPTIONS: Array<{ value: XMode; label: string }> = [
  { value: 'month', label: 'Meses' },
  { value: 'year', label: 'Anos' },
];

const TREND_LABELS: Record<TrendLineType, string> = {
  linear: 'Linear', sma3: 'Média 3m', sma6: 'Média 6m', sma12: 'Média 12m',
};

type OrderChartTypeKey = 'bar' | 'line' | 'line-smooth' | 'area' | 'area-smooth';
const CHART_TYPE_OPTIONS: Array<{
  value: OrderChartTypeKey;
  label: string;
  icon: typeof IconChartBar;
  description: string;
}> = [
  { value: 'bar',         label: 'Colunas',     icon: IconChartBar,  description: 'Colunas agrupadas' },
  { value: 'line',        label: 'Linha Reta',  icon: IconChartLine, description: 'Gráfico de linhas retas' },
  { value: 'line-smooth', label: 'Linha Suave', icon: IconChartLine, description: 'Gráfico de linhas suavizadas' },
  { value: 'area',        label: 'Área Reta',   icon: IconChartArea, description: 'Área preenchida com linhas retas' },
  { value: 'area-smooth', label: 'Área Suave',  icon: IconChartArea, description: 'Área preenchida suavizada' },
];

// =====================
// Page config persistence (last-seen config + named presets)
// =====================
//
// Plain-JSON snapshot of every user-configurable knob on this page. Dates are
// ISO strings; per-field `.catch()` keeps stale stored configs from ever
// breaking the page. Modal (showFilters) and drill-down state plus the
// goal override are session-only by design.
const pageConfigSchema = z.object({
  version: z.literal(1).catch(1),
  startDate: z.string().catch(''),
  endDate: z.string().catch(''),
  supplierIds: z.array(z.string()).catch([]),
  itemIds: z.array(z.string()).catch([]),
  brandIds: z.array(z.string()).catch([]),
  categoryIds: z.array(z.string()).catch([]),
  sortBy: z.enum(['quantity', 'value', 'name']).catch('quantity'),
  sortOrder: z.enum(['asc', 'desc']).catch('desc'),
  limit: z.number().int().min(1).catch(50),
  topSuppliersLimit: z.number().int().min(1).catch(10),
  topItemsLimit: z.number().int().min(1).catch(10),
  trendGroupBy: z.enum(['day', 'week', 'month']).catch('month'),
  xMode: z.enum(['month', 'year']).catch('month'),
  yMode: z.enum(['quantity', 'value']).catch('quantity'),
  yearCompareMode: z.boolean().catch(false),
  selectedYears: z.array(z.string()).catch([]),
  selectedMonths: z.array(z.string()).catch([]),
  chartType: z.enum(['bar', 'line', 'line-smooth', 'area', 'area-smooth']).catch('bar'),
  trendLine: z.enum(['linear', 'sma3', 'sma6', 'sma12']).nullable().catch(null),
});

type PageConfig = z.infer<typeof pageConfigSchema>;

function parseIsoDate(iso: string, fallback: Date): Date {
  if (!iso) return fallback;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? fallback : d;
}

// =====================
// Date range helpers — calendar months (orders are grouped by createdAt).
// =====================

function calendarStartDate(year: number, month: number): Date {
  return startOfDay(new Date(year, month - 1, 1));
}
function calendarEndDate(year: number, month: number): Date {
  return endOfDay(new Date(year, month, 0));
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
      startDate: calendarStartDate(minY, monthNums[0]),
      endDate: calendarEndDate(maxY, monthNums[monthNums.length - 1]),
    };
  }
  return {
    startDate: calendarStartDate(minY, 1),
    endDate: calendarEndDate(maxY, 12),
  };
}

// =====================
// Filter Sheet
// =====================

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: OrderAnalyticsFilters;
  xMode: XMode;
  yMode: OrderYAxisMode;
  selectedYears: string[];
  selectedMonths: string[];
  yearCompareMode: boolean;
  onApply: (next: {
    filters: OrderAnalyticsFilters;
    xMode: XMode;
    yMode: OrderYAxisMode;
    years: string[];
    months: string[];
    yearCompareMode: boolean;
  }) => void;
}

function OrderFiltersSheet({
  open, onOpenChange, filters, xMode, yMode,
  selectedYears, selectedMonths, yearCompareMode, onApply,
}: FilterSheetProps) {
  const canViewPrices = useCanViewPrices();
  const yAxisOptions = canViewPrices ? Y_AXIS_OPTIONS : Y_AXIS_OPTIONS.filter(o => o.value !== 'value');
  const [local, setLocal] = useState<OrderAnalyticsFilters>(filters);
  const [localX, setLocalX] = useState<XMode>(xMode);
  const [localY, setLocalY] = useState<OrderYAxisMode>(yMode);
  const [localYears, setLocalYears] = useState<string[]>(selectedYears);
  const [localMonths, setLocalMonths] = useState<string[]>(selectedMonths);
  const [localYearCompare, setLocalYearCompare] = useState(yearCompareMode);

  useEffect(() => {
    if (open) {
      setLocal(filters);
      setLocalX(xMode);
      setLocalY(yMode);
      setLocalYears(selectedYears);
      setLocalMonths(selectedMonths);
      setLocalYearCompare(yearCompareMode);
    }
  }, [open, filters, xMode, yMode, selectedYears, selectedMonths, yearCompareMode]);

  const fetchSuppliers = useCallback(async (search: string, page = 1) => {
    const res = await getSuppliers({
      search: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
    });
    return {
      data: (res.data || []).map(s => ({ value: s.id, label: s.fantasyName })),
      hasMore: res.meta?.hasNextPage || false,
    };
  }, []);

  const apply = useCallback(() => {
    const { startDate, endDate } = computeDateRange(localYears, localMonths);
    const next: OrderAnalyticsFilters = {
      ...local,
      startDate: startDate ?? local.startDate,
      endDate: endDate ?? local.endDate,
      sortBy: localY === 'value' ? 'value' : 'quantity',
    };
    const yearCompare = localYears.length >= 2 && localX !== 'year' ? localYearCompare : false;
    onApply({
      filters: next,
      xMode: localX,
      yMode: localY,
      years: localYears,
      months: localMonths,
      yearCompareMode: yearCompare,
    });
    onOpenChange(false);
  }, [local, localX, localY, localYears, localMonths, localYearCompare, onApply, onOpenChange]);

  const clear = useCallback(() => {
    const cy = new Date().getFullYear().toString();
    setLocalX('month');
    setLocalY('quantity');
    setLocalYears([cy]);
    setLocalMonths([]);
    setLocalYearCompare(false);
    setLocal({
      ...local,
      supplierIds: undefined,
      itemIds: undefined,
      brandIds: undefined,
      categoryIds: undefined,
    });
  }, [local]);

  const activeCount = [
    (local.supplierIds?.length ?? 0) > 0,
    (local.itemIds?.length ?? 0) > 0,
    (local.brandIds?.length ?? 0) > 0,
    (local.categoryIds?.length ?? 0) > 0,
    (() => {
      const cy = new Date().getFullYear().toString();
      const isDefaultYear = localYears.length === 1 && localYears[0] === cy;
      const isDefaultMonths = localMonths.length === 0;
      return !(isDefaultYear && isDefaultMonths);
    })(),
  ].filter(Boolean).length;

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Período, métrica e filtros de fornecedor."
      activeFilterCount={activeCount}
      onApply={apply}
      onReset={clear}
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
                onValueChange={v => setLocalX(v as XMode)}
                options={X_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
            </div>

            {/* Y-axis mode */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconRuler className="h-4 w-4" />
                Métrica do Eixo Y
              </Label>
              <Combobox
                value={canViewPrices ? localY : 'quantity'}
                onValueChange={v => setLocalY(v as OrderYAxisMode)}
                options={yAxisOptions}
                placeholder="Selecione..."
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
                  : localX === 'year'
                    ? `${localYears.length} ${localYears.length === 1 ? 'ano' : 'anos'} selecionados`
                    : `Exibe os meses dos anos: ${[...localYears].sort().join(', ')}`}
              </p>
            </div>

            {/* Months — hidden when grouping by year */}
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
                  searchable
                  clearable
                />
                <p className="text-xs text-muted-foreground">
                  {localMonths.length === 0
                    ? 'Sem seleção → todos os meses do(s) ano(s)'
                    : `Exibe apenas: ${[...localMonths].sort().map(m => MONTH_OPTIONS.find(o => o.value === m)?.label).join(', ')}`}
                </p>
              </div>
            )}

            {/* Year-over-year — only when 2+ years and month mode */}
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

            {/* Suppliers */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconBuilding className="h-4 w-4" />
                Fornecedores
              </Label>
              <Combobox
                mode="multiple"
                async
                value={local.supplierIds || []}
                onValueChange={v => setLocal({ ...local, supplierIds: Array.isArray(v) && v.length ? v : undefined })}
                queryKey={[...supplierKeys.lists()]}
                queryFn={fetchSuppliers}
                minSearchLength={0}
                placeholder="Todos os fornecedores..."
                searchPlaceholder="Buscar fornecedor..."
                emptyText="Nenhum fornecedor encontrado"
                loadingText="Carregando..."
                searchable
                clearable
              />
            </div>
    </FilterDrawer>
  );
}

// =====================
// Orders Drill-Down Modal
// =====================

interface OrdersDrilldownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  // Window of `createdAt` to filter orders.
  range?: { from: Date; to: Date };
  supplierId?: string;
  supplierIds?: string[];
}

function OrdersDrilldownModal({
  open, onOpenChange, title, range, supplierId, supplierIds,
}: OrdersDrilldownModalProps) {
  const canViewPrices = useCanViewPrices();
  const [search, setSearch] = useState('');

  useEffect(() => { if (open) setSearch(''); }, [open]);

  const effectiveSupplierIds = supplierId
    ? [supplierId]
    : (supplierIds?.length ? supplierIds : undefined);

  const queryKey = useMemo(
    () => ['orders-drill', range?.from?.toISOString(), range?.to?.toISOString(), effectiveSupplierIds],
    [range, effectiveSupplierIds],
  );

  const { data: response, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => getOrders({
      ...(range ? { createdAt: { gte: range.from, lte: range.to } } : {}),
      ...(effectiveSupplierIds ? { supplierIds: effectiveSupplierIds } : {}),
      limit: 100,
      orderBy: { createdAt: 'desc' as const },
      include: {
        supplier: true,
        items: true,
      } as any,
    } as any),
    enabled: open,
  });

  const rawOrders: any[] = (response as any)?.data ?? [];
  const total = (response as any)?.meta?.total ?? rawOrders.length;
  const orders = useMemo(
    () => [...rawOrders].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    }),
    [rawOrders],
  );

  const supplierName = (o: any) => o.supplier?.fantasyName ?? o.supplier?.name ?? '—';
  // Honors the manual `totalOverride` (via the shared helper) so this list agrees with the order
  // table/detail; falls back to items − discount when no override is set.
  const orderValue = (o: any): number => calculateOrderTotal(o);
  const itemCount = (o: any): number => (o.items || []).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(o =>
      supplierName(o).toLowerCase().includes(q) ||
      (o.description || '').toLowerCase().includes(q),
    );
  }, [orders, search]);

  const totalValueSum = useMemo(
    () => orders.reduce((s, o) => s + orderValue(o), 0),
    [orders],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <IconClipboardList className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-foreground/75">
            {isLoading
              ? 'Carregando pedidos…'
              : isError
              ? 'Erro ao carregar'
              : (
                <>
                  <span className="font-medium">{total}</span>{' '}
                  pedido{total !== 1 ? 's' : ''}
                  {canViewPrices && totalValueSum > 0 && (
                    <>
                      {' · '}
                      <span className="font-medium">{formatCurrency(totalValueSum)}</span>{' '}
                      em valor
                    </>
                  )}
                </>
              )
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 shrink-0">
              <IconReceipt className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold">Pedidos</span>
            </div>
            {search.trim() && (
              <span className="text-xs text-foreground/65">
                mostrando {filtered.length} de {orders.length}
              </span>
            )}
          </div>
          <div className="px-6 py-3 border-b shrink-0">
            <Input
              type="text"
              placeholder="Buscar por fornecedor ou descrição..."
              value={search}
              onChange={v => setSearch(v == null ? '' : String(v))}
              className="w-full"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <Table className="[&>div]:border-0 [&_th]:px-6 [&_td]:px-6">
              <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_hsl(var(--border))]">
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  {canViewPrices && <TableHead className="text-right">Valor</TableHead>}
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: canViewPrices ? 5 : 4 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={canViewPrices ? 5 : 4} className="text-center text-destructive py-10">
                      Erro ao carregar os pedidos. Tente novamente.
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canViewPrices ? 5 : 4} className="py-12 text-center text-sm text-foreground/60">
                      {search ? 'Nenhum resultado.' : 'Nenhum pedido encontrado'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(o => {
                    const date = o.createdAt
                      ? format(new Date(o.createdAt), 'dd/MM/yyyy', { locale: ptBR })
                      : '—';
                    const statusLabel = o.status ? (ORDER_STATUS_LABELS as any)[o.status] ?? o.status : '—';
                    return (
                      <TableRow key={o.id} className="text-sm">
                        <TableCell className="font-medium max-w-[220px] truncate">{supplierName(o)}</TableCell>
                        {canViewPrices && <TableCell className="text-right">{formatCurrency(orderValue(o))}</TableCell>}
                        <TableCell className="text-right">{itemCount(o)}</TableCell>
                        <TableCell className="text-right text-xs text-foreground/80 whitespace-nowrap">{date}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{statusLabel}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =====================
// Main Page
// =====================

const OrderPage = () => {
  usePageTracker({
    page: 'order-analytics',
    title: 'Análise de Pedidos',
  });

  const canViewPrices = useCanViewPrices();

  // Defaults match productivity / collection: current year, all months.
  const initialYear = useMemo(() => new Date().getFullYear().toString(), []);
  const [selectedYears, setSelectedYears] = useState<string[]>([initialYear]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const [filters, setFilters] = useState<OrderAnalyticsFilters>(() => {
    const { startDate, endDate } = computeDateRange([initialYear], []);
    return {
      startDate: startDate ?? startOfDay(new Date(parseInt(initialYear), 0, 1)),
      endDate: endDate ?? endOfDay(new Date(parseInt(initialYear), 11, 31)),
      sortBy: 'quantity',
      sortOrder: 'desc',
      limit: 50,
      topSuppliersLimit: 10,
      topItemsLimit: 10,
      trendGroupBy: 'month',
    };
  });

  const [showFilters, setShowFilters] = useState(false);
  const [xMode, setXMode] = useState<XMode>('month');
  const [yMode, setYMode] = useState<OrderYAxisMode>('quantity');
  const [yearCompareMode, setYearCompareMode] = useState(false);
  const [chartType, setChartType] = useState<OrderChartTypeKey>('bar');
  const [trendLine, setTrendLine] = useState<TrendLineType | null>(null);

  const [drilldown, setDrilldown] = useState<{
    title: string;
    range?: { from: Date; to: Date };
    supplierId?: string;
  } | null>(null);

  // ── Page config persistence (auto-restore last config + named presets) ──
  const pageConfig = useMemo<PageConfig>(() => ({
    version: 1,
    startDate: filters.startDate ? filters.startDate.toISOString() : '',
    endDate: filters.endDate ? filters.endDate.toISOString() : '',
    supplierIds: filters.supplierIds ?? [],
    itemIds: filters.itemIds ?? [],
    brandIds: filters.brandIds ?? [],
    categoryIds: filters.categoryIds ?? [],
    sortBy: (filters.sortBy ?? 'quantity') as PageConfig['sortBy'],
    sortOrder: (filters.sortOrder ?? 'desc') as PageConfig['sortOrder'],
    limit: filters.limit ?? 50,
    topSuppliersLimit: filters.topSuppliersLimit ?? 10,
    topItemsLimit: filters.topItemsLimit ?? 10,
    trendGroupBy: (filters.trendGroupBy ?? 'month') as PageConfig['trendGroupBy'],
    xMode,
    yMode,
    yearCompareMode,
    selectedYears,
    selectedMonths,
    chartType,
    trendLine,
  }), [filters, xMode, yMode, yearCompareMode, selectedYears, selectedMonths, chartType, trendLine]);

  const applyPageConfig = useCallback((config: PageConfig) => {
    const { startDate, endDate } = computeDateRange([initialYear], []);
    setFilters({
      startDate: parseIsoDate(config.startDate, startDate ?? startOfDay(new Date(parseInt(initialYear), 0, 1))),
      endDate: parseIsoDate(config.endDate, endDate ?? endOfDay(new Date(parseInt(initialYear), 11, 31))),
      sortBy: config.sortBy,
      sortOrder: config.sortOrder,
      limit: config.limit,
      topSuppliersLimit: config.topSuppliersLimit,
      topItemsLimit: config.topItemsLimit,
      trendGroupBy: config.trendGroupBy,
      supplierIds: config.supplierIds.length ? config.supplierIds : undefined,
      itemIds: config.itemIds.length ? config.itemIds : undefined,
      brandIds: config.brandIds.length ? config.brandIds : undefined,
      categoryIds: config.categoryIds.length ? config.categoryIds : undefined,
    });
    setXMode(config.xMode);
    // yMode is corrected for unprivileged users by the canViewPrices guard effect.
    setYMode(config.yMode);
    setYearCompareMode(config.yearCompareMode);
    // selectedYears default is [currentYear]; an empty stored value falls back to it.
    setSelectedYears(config.selectedYears.length ? config.selectedYears : [initialYear]);
    setSelectedMonths(config.selectedMonths);
    setChartType(config.chartType);
    setTrendLine(config.trendLine);
  }, [initialYear]);

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
    pageKey: routes.statistics.inventory.orders,
    schema: pageConfigSchema,
    current: pageConfig,
    apply: applyPageConfig,
  });

  const { data, isLoading, isError, error, refetch } = useOrderAnalytics(filters);
  const summary = data?.data?.summary;
  const trends = data?.data?.trends || [];
  const topSuppliers = data?.data?.topSuppliers || [];

  // 'quantity' mode → ORDER_COUNT_PER_PERIOD; 'value' → ORDER_TOTAL_VALUE.
  const goalMetric =
    yMode === 'value' ? GOAL_METRIC.ORDER_TOTAL_VALUE : GOAL_METRIC.ORDER_COUNT_PER_PERIOD;

  const [goalOverride, setGoalOverride] = useState<number | null>(null);

  useEffect(() => {
    setGoalOverride(null);
  }, [yMode, xMode]);

  // Warehouse users must never see monetary (value) mode
  useEffect(() => {
    if (!canViewPrices && yMode === 'value') {
      setYMode('quantity');
    }
  }, [canViewPrices, yMode]);

  const defaultGoal = useDefaultGoal({
    metric: goalMetric,
    period:
      filters.startDate && filters.endDate
        ? { from: filters.startDate, to: filters.endDate }
        : null,
    aggregation: xMode === 'year' ? 'TOTAL' : 'AVERAGE_PER_PERIOD',
    periodMode: 'calendar',
    enabled: !yearCompareMode,
  });

  const goalValue = goalOverride ?? defaultGoal.value;
  const goalSource: 'override' | 'default' | 'none' =
    goalOverride != null ? 'override' : defaultGoal.value != null ? 'default' : 'none';

  // -------- Active filter count + period summary --------

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.supplierIds?.length) n++;
    if (filters.itemIds?.length) n++;
    if (filters.brandIds?.length) n++;
    if (filters.categoryIds?.length) n++;
    const cy = new Date().getFullYear().toString();
    const isDefaultYear = selectedYears.length === 1 && selectedYears[0] === cy;
    const isDefaultMonths = selectedMonths.length === 0;
    if (!(isDefaultYear && isDefaultMonths)) n++;
    return n;
  }, [filters, selectedYears, selectedMonths]);

  const periodSummaryLabel = useMemo(() => {
    if (!selectedYears.length) return '';
    const yearsSorted = [...selectedYears].sort();
    const monthsSorted = [...selectedMonths].sort();
    if (xMode === 'year') {
      return yearsSorted.length === 1 ? `Ano ${yearsSorted[0]}` : `Anos: ${yearsSorted.join(', ')}`;
    }
    if (monthsSorted.length === 0) {
      return yearsSorted.length === 1 ? `Ano ${yearsSorted[0]}` : `Anos: ${yearsSorted.join(', ')}`;
    }
    const monthNames = monthsSorted.map(m => MONTH_OPTIONS.find(o => o.value === m)?.label).join(', ');
    return yearsSorted.length === 1
      ? `${monthNames} ${yearsSorted[0]}`
      : `${monthNames} · ${yearsSorted.length} anos`;
  }, [selectedYears, selectedMonths, xMode]);

  // -------- Chart data: aggregate the trend points by xMode --------

  type Bucket = { period: string; name: string; orderCount: number; totalValue: number; itemCount: number };

  // Parse "YYYY-MM" or "YYYY-MM-DD" or "YYYY" → { year, month? }
  const parseTrendDate = useCallback((date: string): { year: number; month: number | null } => {
    if (/^\d{4}$/.test(date)) return { year: parseInt(date, 10), month: null };
    const parts = date.split('-');
    return { year: parseInt(parts[0], 10), month: parts[1] ? parseInt(parts[1], 10) : null };
  }, []);

  const displayBuckets: Bucket[] = useMemo(() => {
    if (!trends.length) return [];

    const reduce = (rows: typeof trends, period: string, name: string): Bucket => ({
      period,
      name,
      orderCount: rows.reduce((s, r) => s + (r.orderCount || 0), 0),
      totalValue: Math.round(rows.reduce((s, r) => s + (r.totalValue || 0), 0) * 100) / 100,
      itemCount: rows.reduce((s, r) => s + (r.itemCount || 0), 0),
    });

    if (xMode === 'year') {
      const byYear = new Map<number, typeof trends>();
      for (const t of trends) {
        const { year } = parseTrendDate(t.date);
        if (!byYear.has(year)) byYear.set(year, []);
        byYear.get(year)!.push(t);
      }
      return Array.from(byYear.keys()).sort().map(y => reduce(byYear.get(y)!, y.toString(), y.toString()));
    }

    // Month mode — group by year-month
    const byYearMonth = new Map<string, typeof trends>();
    for (const t of trends) {
      const { year, month } = parseTrendDate(t.date);
      if (month == null) continue;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      if (!byYearMonth.has(key)) byYearMonth.set(key, []);
      byYearMonth.get(key)!.push(t);
    }
    const buckets = Array.from(byYearMonth.entries())
      .map(([key, rows]) => {
        const [yStr, mStr] = key.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        const monthLabel = MONTH_OPTIONS[m - 1]?.label ?? mStr;
        const showYear = selectedYears.length !== 1;
        const name = showYear ? `${monthLabel} ${y}` : monthLabel;
        return reduce(rows, key, name);
      });

    if (yearCompareMode && selectedYears.length >= 2) {
      // Reorder: month-major so January-of-all-years are adjacent.
      const yearsSorted = [...selectedYears].map(Number).sort((a, b) => a - b);
      const monthsToShow = (selectedMonths.length > 0
        ? selectedMonths
        : MONTH_OPTIONS.map(o => o.value)
      ).map(Number).sort((a, b) => a - b);
      const ordered: Bucket[] = [];
      for (const m of monthsToShow) {
        for (const y of yearsSorted) {
          const key = `${y}-${String(m).padStart(2, '0')}`;
          const b = buckets.find(b => b.period === key);
          if (b) ordered.push(b);
        }
      }
      return ordered;
    }

    return buckets.sort((a, b) => a.period.localeCompare(b.period));
  }, [trends, xMode, yearCompareMode, selectedYears, selectedMonths, parseTrendDate]);

  const perPeriodGoalValues = useMemo(() => {
    if (goalOverride != null || yearCompareMode || !defaultGoal.perPeriodValues) return null;
    return displayBuckets.map(b => {
      if (xMode === 'year') {
        let total = 0; let hasAny = false;
        for (let m = 1; m <= 12; m++) {
          const key = `${b.period}-${String(m).padStart(2, '0')}`;
          const v = defaultGoal.perPeriodValues!.get(key);
          if (v != null) { total += v; hasAny = true; }
        }
        return hasAny ? total : null;
      }
      return defaultGoal.perPeriodValues!.get(b.period) ?? null;
    });
  }, [goalOverride, yearCompareMode, defaultGoal.perPeriodValues, displayBuckets, xMode]);

  const chartData = useMemo(() => {
    if (!displayBuckets.length) return [];
    return displayBuckets.map(b => ({
      name: b.name,
      value: yMode === 'value' ? b.totalValue : b.orderCount,
      // Warehouse users must not see monetary values, even as a chart secondary series
      secondaryValue: canViewPrices ? (yMode === 'value' ? b.orderCount : b.totalValue) : undefined,
    }));
  }, [displayBuckets, yMode, canViewPrices]);

  const chartYAxisMode: YAxisMode = yMode === 'value' ? 'value' : 'quantity';

  const valueFormatter = useCallback((value: number, mode: YAxisMode): string => {
    if (mode === 'value') return formatCurrency(value);
    return formatNumber(value);
  }, []);

  const secondaryValueFormatter = useCallback((value: number) => {
    return yMode === 'value' ? formatNumber(value) : formatCurrency(value);
  }, [yMode]);

  // -------- Drill-down handlers --------

  const rangeForPeriod = useCallback((period: string): { from: Date; to: Date } | undefined => {
    if (/^\d{4}$/.test(period)) {
      const y = parseInt(period, 10);
      return {
        from: calendarStartDate(y, 1),
        to: calendarEndDate(y, 12),
      };
    }
    const [yStr, mStr] = period.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    if (!y || !m) return undefined;
    return {
      from: calendarStartDate(y, m),
      to: calendarEndDate(y, m),
    };
  }, []);

  const handleChartClick = useCallback((dataIndex: number) => {
    const b = displayBuckets[dataIndex];
    if (!b) return;
    const range = rangeForPeriod(b.period);
    if (!range) return;
    setDrilldown({ title: `Pedidos — ${b.name}`, range });
  }, [displayBuckets, rangeForPeriod]);

  const totalRange = useMemo<{ from: Date; to: Date } | undefined>(() => {
    if (!filters.startDate || !filters.endDate) return undefined;
    return { from: filters.startDate, to: filters.endDate };
  }, [filters.startDate, filters.endDate]);

  const openAllOrders = useCallback(() => {
    if (!totalRange) return;
    setDrilldown({ title: 'Pedidos do Período', range: totalRange });
  }, [totalRange]);

  const topSupplier = topSuppliers[0];
  const canDrillTopSupplier = !!topSupplier?.supplierId;
  const openTopSupplier = useCallback(() => {
    if (!topSupplier?.supplierId) return;
    setDrilldown({
      title: `Pedidos — ${topSupplier.supplierName}`,
      range: totalRange,
      supplierId: topSupplier.supplierId,
    });
  }, [topSupplier, totalRange]);

  // -------- Exports --------

  const handleExportCSV = useCallback(() => {
    if (!displayBuckets.length) {
      toast.error('Nenhum dado para exportar');
      return;
    }
    try {
      const headers = canViewPrices
        ? ['Período', 'Pedidos', 'Valor Total (R$)', 'Itens']
        : ['Período', 'Pedidos', 'Itens'];
      const rows = displayBuckets.map(b => canViewPrices
        ? [b.name, b.orderCount.toString(), b.totalValue.toFixed(2), b.itemCount.toString()]
        : [b.name, b.orderCount.toString(), b.itemCount.toString()]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `pedidos-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('CSV exportado');
    } catch {
      toast.error('Erro ao exportar dados');
    }
  }, [displayBuckets, canViewPrices]);

  // -------- Main chart render --------
  const renderMainChart = () => {
    const chartHeightStyle = { height: '100%' };
    if (isLoading) {
      return (
        <div style={chartHeightStyle} className="flex items-center justify-center">
          <div className="space-y-3 w-full px-8">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-[380px] w-full" />
          </div>
        </div>
      );
    }
    if (isError) {
      return (
        <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
          <IconAlertCircle className="h-12 w-12 text-destructive" />
          <div className="text-center">
            <p className="font-semibold">Erro ao carregar dados</p>
            <p className="text-sm text-muted-foreground">{error?.message || 'Ocorreu um erro ao buscar os dados'}</p>
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
        <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
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
        data={chartData}
        chartType={chartType as StatisticsChartType}
        yAxisMode={chartYAxisMode}
        isComparisonMode={false}
        height="100%"
        yAxisLabel={yMode === 'value' ? 'Valor (R$)' : 'Pedidos'}
        valueFormatter={valueFormatter}
        secondaryValueFormatter={secondaryValueFormatter}
        trendLine={trendLine}
        goalLine={goalValue != null && !perPeriodGoalValues?.some(v => v != null) ? { value: goalValue, label: 'Meta Pedidos' } : null}
        perPeriodGoalLine={perPeriodGoalValues?.some(v => v != null) ? { values: perPeriodGoalValues, label: 'Meta Pedidos' } : null}
        tooltipLabels={{
          primary: yMode === 'value' ? 'Valor' : 'Pedidos',
          secondary: !canViewPrices ? undefined : (yMode === 'value' ? 'Pedidos' : 'Valor (R$)'),
        }}
        onDataPointClick={handleChartClick}
      />
    );
  };

  const currentChartType = CHART_TYPE_OPTIONS.find(t => t.value === chartType) ?? CHART_TYPE_OPTIONS[0];
  const ChartIcon = currentChartType.icon;

  const canDrillTotal = !!totalRange && (summary?.totalOrders ?? 0) > 0;
  const canDrillTotalValue = canDrillTotal && (summary?.totalValue ?? 0) > 0;

  return (
    <div className="h-full flex flex-col px-4 pt-4 pb-4 overflow-hidden">
      <div className="flex-shrink-0">
        <PageHeader
          title="Análise de Pedidos"
          icon={IconClipboardList}
          favoritePage={FAVORITE_PAGES.ESTATISTICAS_PEDIDOS}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Estoque', href: routes.statistics.inventory.root },
            { label: 'Pedidos' },
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
                  <IconClipboardList className="h-5 w-5 text-primary" />
                  {periodSummaryLabel || 'Análise de Pedidos'}
                </CardTitle>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Chart Type */}
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
                      onValueChange={v => setChartType(v as OrderChartTypeKey)}
                    >
                      {CHART_TYPE_OPTIONS.map(opt => {
                        const Icon = opt.icon;
                        return (
                          <DropdownMenuRadioItem key={opt.value} value={opt.value} className="group">
                            <Icon className="h-4 w-4 mr-2" />
                            <div className="flex flex-col">
                              <span>{opt.label}</span>
                              <span className="text-xs text-muted-foreground group-data-[highlighted]:text-white/80">{opt.description}</span>
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
                <GoalMetaPopover
                  value={goalValue}
                  defaultValue={defaultGoal.value}
                  source={goalSource}
                  onOverride={setGoalOverride}
                  unit={GOAL_METRIC_UNIT[goalMetric]}
                />

                {/* Filters */}
                <Button
                  variant={activeFilterCount > 0 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowFilters(true)}
                >
                  <IconFilter className="h-4 w-4 mr-2" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>
                  )}
                </Button>

                {/* Export */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isLoading || !displayBuckets.length}>
                      <IconDownload className="h-4 w-4 mr-2" />
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Formato de Exportação</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleExportCSV}>
                      <IconFileTypeCsv className="h-4 w-4 mr-2" />
                      CSV dos Dados
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 min-h-0 flex flex-col gap-5 overflow-hidden">
            {/* Summary KPI strip */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 flex-shrink-0">
              {/* Pedidos Totais — clickable */}
              <Card
                className={`py-2 ${canDrillTotal ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                onClick={canDrillTotal ? openAllOrders : undefined}
                role={canDrillTotal ? 'button' : undefined}
                tabIndex={canDrillTotal ? 0 : undefined}
                onKeyDown={e => {
                  if (canDrillTotal && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    openAllOrders();
                  }
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                  <CardTitle className="text-xs font-medium">Pedidos Totais</CardTitle>
                  <IconClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pb-0 px-4">
                  {isLoading ? <Skeleton className="h-7 w-20" /> : (
                    <div className="text-xl font-bold">{formatNumber(summary?.totalOrders ?? 0)}</div>
                  )}
                </CardContent>
              </Card>

              {/* Valor Total — clickable */}
              {canViewPrices && (
                <Card
                  className={`py-2 ${canDrillTotalValue ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                  onClick={canDrillTotalValue ? openAllOrders : undefined}
                  role={canDrillTotalValue ? 'button' : undefined}
                  tabIndex={canDrillTotalValue ? 0 : undefined}
                  onKeyDown={e => {
                    if (canDrillTotalValue && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      openAllOrders();
                    }
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium">Valor Total</CardTitle>
                    <IconCash className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading ? <Skeleton className="h-7 w-20" /> : (
                      <div className="text-xl font-bold">{formatCurrency(summary?.totalValue ?? 0)}</div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Ticket Médio — not clickable, average */}
              {canViewPrices && (
                <Card className="py-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                    <CardTitle className="text-xs font-medium">Ticket Médio</CardTitle>
                    <IconBox className="h-3.5 w-3.5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="pb-0 px-4">
                    {isLoading ? <Skeleton className="h-7 w-20" /> : (
                      <div className="text-xl font-bold">{formatCurrency(summary?.averageOrderValue ?? 0)}</div>
                    )}
                    <div className="text-[11px] text-foreground/70 mt-0.5">valor médio por pedido</div>
                  </CardContent>
                </Card>
              )}

              {/* Top Fornecedor — clickable */}
              <Card
                className={`py-2 ${canDrillTopSupplier ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                onClick={canDrillTopSupplier ? openTopSupplier : undefined}
                role={canDrillTopSupplier ? 'button' : undefined}
                tabIndex={canDrillTopSupplier ? 0 : undefined}
                onKeyDown={e => {
                  if (canDrillTopSupplier && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    openTopSupplier();
                  }
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                  <CardTitle className="text-xs font-medium">Top Fornecedor</CardTitle>
                  <IconBuilding className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pb-0 px-4">
                  {isLoading ? <Skeleton className="h-7 w-20" /> : (
                    <div className="text-xl font-bold truncate">{topSupplier?.supplierName || '-'}</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main chart */}
            <Card className="flex-1 min-h-0 flex flex-col">
              <CardContent className="flex-1 min-h-0 p-4">
                {renderMainChart()}
              </CardContent>
            </Card>
          </CardContent>
        </Card>

      <OrderFiltersSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        xMode={xMode}
        yMode={yMode}
        selectedYears={selectedYears}
        selectedMonths={selectedMonths}
        yearCompareMode={yearCompareMode}
        onApply={({ filters: f, xMode: x, yMode: y, years, months, yearCompareMode: yc }) => {
          setFilters({ ...f, limit: f.limit || 50 });
          setXMode(x);
          setYMode(y);
          setSelectedYears(years);
          setSelectedMonths(months);
          setYearCompareMode(yc);
        }}
      />

      {drilldown && (
        <OrdersDrilldownModal
          open={!!drilldown}
          onOpenChange={o => { if (!o) setDrilldown(null); }}
          title={drilldown.title}
          range={drilldown.range}
          supplierId={drilldown.supplierId}
          supplierIds={filters.supplierIds}
        />
      )}
    </div>
  );
};

export const OrderStatisticsPage = () => {
  return <OrderPage />;
};

export default OrderStatisticsPage;
