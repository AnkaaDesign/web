import { useState, useMemo, useCallback, useEffect } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Combobox } from '@/components/ui/combobox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getBonusPeriodStart, getBonusPeriodEnd } from '@/utils/bonus';
import { GOAL_METRIC, GOAL_METRIC_UNIT, routes, FAVORITE_PAGES } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useChartTheme } from '@/hooks/common/use-chart-theme';
import { useDefaultGoal } from '@/hooks/administration/use-default-goal';
import { GoalMetaPopover } from '@/components/statistics/goal-meta-popover';
import {
  useCollectionAnalytics,
  useReceivablesAnalytics,
} from '@/hooks/financial/use-financial-analytics';
import type {
  FinancialAnalyticsFilters,
  ReceivablesAnalyticsFilters,
  ForecastPeriodBucket,
} from '@/types/financial-analytics';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import {
  CHART_COLORS,
  formatCurrency,
  formatNumber,
} from '@/types/statistics-common';
import type { YAxisMode, StatisticsChartType, TrendLineType } from '@/types/statistics-common';
import { getCustomers } from '@/api-client/customer';
import { customerKeys } from '@/hooks/common/query-keys';
import { ForecastBucketInstallmentsModal } from '@/components/financial/forecast-bucket-installments-modal';
import ReactECharts from 'echarts-for-react';
import { format } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import * as XLSX from 'xlsx';
import {
  IconChartBar,
  IconChartLine,
  IconChartArea,
  IconStack2,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconReportMoney,
  IconUsers,
  IconCalendarStats,
  IconX,
  IconReceipt,
  IconClock,
  IconCash,
  IconTrendingUp,
  IconFileTypeCsv,
  IconFileTypeXls,
  IconRuler,
  IconAlertTriangle,
  IconArrowsExchange2,
  IconInfoCircle,
} from '@tabler/icons-react';
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

// =====================================================================
// Constants
// =====================================================================

const COMBOBOX_PAGE_SIZE = 20;

const MONTH_OPTIONS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },   { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },    { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },   { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },{ value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },{ value: '12', label: 'Dezembro' },
];

const generateYearOptions = () => {
  const cy = new Date().getFullYear();
  // Show 5 years back through 1 year forward so users can see future-period cards.
  return Array.from({ length: 6 }, (_, i) => {
    const y = cy - 4 + i;
    return { value: y.toString(), label: y.toString() };
  });
};
const YEAR_OPTIONS = generateYearOptions();

const INVOICE_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'ACTIVE', label: 'Ativa' },
  { value: 'PARTIALLY_PAID', label: 'Parcialmente Paga' },
  { value: 'PAID', label: 'Paga' },
];

type XMode = 'month' | 'year';
const X_AXIS_OPTIONS: Array<{ value: XMode; label: string }> = [
  { value: 'month', label: 'Meses' },
  { value: 'year',  label: 'Anos' },
];

type YMode = 'value' | 'percentage';
const Y_AXIS_OPTIONS: Array<{ value: YMode; label: string }> = [
  { value: 'value', label: 'Valor (R$)' },
  { value: 'percentage', label: 'Taxa de Recebimento (%)' },
];

type CompareMode = 'combined' | 'separated' | 'separatedWithTotal';
const COMPARE_MODE_OPTIONS: Array<{ value: CompareMode; label: string }> = [
  { value: 'combined',           label: 'Combinado (uma série)' },
  { value: 'separated',          label: 'Separado (por cliente)' },
  { value: 'separatedWithTotal', label: 'Separado + Total' },
];

type ChartTypeKey = 'bar' | 'bar-stacked' | 'line' | 'line-smooth' | 'area' | 'funnel';
const CHART_TYPE_OPTIONS: Array<{ value: ChartTypeKey; label: string; icon: typeof IconChartBar; description: string }> = [
  { value: 'bar',         label: 'Colunas',            icon: IconChartBar,  description: 'Barras lado a lado' },
  { value: 'bar-stacked', label: 'Colunas Empilhadas', icon: IconStack2,    description: 'Faturado/recebido/atraso empilhados' },
  { value: 'line',        label: 'Linha Reta',         icon: IconChartLine, description: 'Linhas retas' },
  { value: 'line-smooth', label: 'Linha Suave',        icon: IconChartLine, description: 'Linhas suavizadas' },
  { value: 'area',        label: 'Área',               icon: IconChartArea, description: 'Área preenchida' },
  { value: 'funnel',      label: 'Funil',              icon: IconFilter,    description: 'Faturado → Boletos → Recebido → Pendente' },
];

const TREND_LABELS: Record<TrendLineType, string> = {
  linear: 'Linear', sma3: 'Média 3m', sma6: 'Média 6m', sma12: 'Média 12m',
};

// Forecast bucket palette — OVERDUE always red; period buckets rotate through
// the same tones used in the drill-down modal so cards / chart / table agree.
const PERIOD_BUCKET_COLORS = ['#059669', '#0284c7', '#0891b2', '#7c3aed', '#d97706', '#c026d3'];
const OVERDUE_COLOR = '#dc2626';
function bucketColor(bucket: string): string {
  if (bucket === 'OVERDUE') return OVERDUE_COLOR;
  const match = /^P(\d+)$/.exec(bucket);
  const idx = match ? Math.max(0, parseInt(match[1], 10) - 1) : 0;
  return PERIOD_BUCKET_COLORS[idx % PERIOD_BUCKET_COLORS.length];
}

// Forecast cards always show 3 forward periods: the closest period to "now"
// plus the next 2. Hard-coded so the section stays focused and the filter
// sheet doesn't grow another knob.
const FORECAST_PERIOD_COUNT = 3;

// =====================================================================
// Helpers
// =====================================================================

// Derive a [startDate, endDate] from selected years/months. Mirrors the
// productivity page's helper so both stats pages behave identically when the
// user picks "current year" or "specific months across years".
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
      startDate: getBonusPeriodStart(minY, monthNums[0]),
      endDate: getBonusPeriodEnd(maxY, monthNums[monthNums.length - 1]),
    };
  }
  return {
    startDate: getBonusPeriodStart(minY, 1),
    endDate: getBonusPeriodEnd(maxY, 12),
  };
}

// Builds an explicit `periods` array when both years and months are selected,
// so the backend buckets exactly the cartesian product (instead of inferring
// every period inside the date range).
function buildPeriods(
  years: string[],
  months: string[],
): Array<{ year: number; month: number }> | undefined {
  if (!years.length || !months.length) return undefined;
  const out: Array<{ year: number; month: number }> = [];
  for (const y of years) {
    for (const m of months) {
      out.push({ year: parseInt(y, 10), month: parseInt(m, 10) });
    }
  }
  out.sort((a, b) => (a.year - b.year) || (a.month - b.month));
  return out;
}

// =====================================================================
// Filter Sheet
// =====================================================================

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FinancialAnalyticsFilters;
  xMode: XMode;
  yMode: YMode;
  compareMode: CompareMode;
  selectedYears: string[];
  selectedMonths: string[];
  yearCompareMode: boolean;
  onApply: (next: {
    filters: FinancialAnalyticsFilters;
    xMode: XMode;
    yMode: YMode;
    compareMode: CompareMode;
    years: string[];
    months: string[];
    yearCompareMode: boolean;
  }) => void;
}

function FilterSheet({
  open, onOpenChange, filters, xMode, yMode, compareMode,
  selectedYears, selectedMonths, yearCompareMode, onApply,
}: FilterSheetProps) {
  const [local, setLocal] = useState<FinancialAnalyticsFilters>(filters);
  const [localX, setLocalX] = useState<XMode>(xMode);
  const [localY, setLocalY] = useState<YMode>(yMode);
  const [localCmp, setLocalCmp] = useState<CompareMode>(compareMode);
  const [localYears, setLocalYears] = useState<string[]>(selectedYears);
  const [localMonths, setLocalMonths] = useState<string[]>(selectedMonths);
  const [localYearCompare, setLocalYearCompare] = useState(yearCompareMode);

  useEffect(() => {
    if (open) {
      setLocal(filters);
      setLocalX(xMode);
      setLocalY(yMode);
      setLocalCmp(compareMode);
      setLocalYears(selectedYears);
      setLocalMonths(selectedMonths);
      setLocalYearCompare(yearCompareMode);
    }
  }, [open, filters, xMode, yMode, compareMode, selectedYears, selectedMonths, yearCompareMode]);

  const fetchCustomers = useCallback(async (search: string, page: number = 1) => {
    const r = await getCustomers({ search: search || undefined, page, limit: COMBOBOX_PAGE_SIZE });
    return {
      data: (r.data || []).map(c => ({ value: c.id, label: c.fantasyName })),
      hasMore: r.meta?.hasNextPage || false,
    };
  }, []);

  const canCompare = (local.customerIds?.length ?? 0) >= 2;

  const apply = useCallback(() => {
    const next: FinancialAnalyticsFilters = { ...local };
    const periods = buildPeriods(localYears, localMonths);
    const { startDate, endDate } = computeDateRange(localYears, localMonths);

    if (periods) {
      next.periods = periods;
    } else {
      delete next.periods;
    }
    next.startDate = startDate;
    next.endDate = endDate;

    const yearCompare = localYears.length >= 2 && localX !== 'year' ? localYearCompare : false;
    onApply({
      filters: next,
      xMode: localX,
      yMode: localY,
      compareMode: canCompare ? localCmp : 'combined',
      years: localYears,
      months: localMonths,
      yearCompareMode: yearCompare,
    });
    onOpenChange(false);
  }, [local, localX, localY, localCmp, localYears, localMonths, localYearCompare, canCompare, onApply, onOpenChange]);

  // Clear resets to the same defaults the page initializes with: current year,
  // all months. Keeping defaults in one shape avoids drift.
  const clear = useCallback(() => {
    const cy = new Date().getFullYear().toString();
    setLocalX('month');
    setLocalY('value');
    setLocalCmp('combined');
    setLocalYears([cy]);
    setLocalMonths([]);
    setLocalYearCompare(false);
    setLocal({
      sortBy: 'amount',
      sortOrder: 'desc',
      limit: 50,
    });
  }, []);

  const activeCount = [
    (local.customerIds?.length ?? 0) > 0,
    (local.status?.length ?? 0) > 0,
    // Period filter is "active" only when it diverges from the default
    // (current year, all months).
    (() => {
      const cy = new Date().getFullYear().toString();
      const isDefaultYear = localYears.length === 1 && localYears[0] === cy;
      const isDefaultMonths = localMonths.length === 0;
      return !(isDefaultYear && isDefaultMonths);
    })(),
  ].filter(Boolean).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros
            {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
          </SheetTitle>
          <SheetDescription>
            Período, métrica e janela de previsão de caixa.
          </SheetDescription>
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
                onValueChange={v => setLocalX(v as XMode)}
                options={X_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
              <p className="text-xs text-muted-foreground">
                "Meses" exibe um período por barra. "Anos" soma todos os períodos do ano.
                Os cartões de previsão acompanham essa escolha.
              </p>
            </div>

            {/* Y-axis mode */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconRuler className="h-4 w-4" />
                Métrica do Eixo Y
              </Label>
              <Combobox
                value={localY}
                onValueChange={v => setLocalY(v as YMode)}
                options={Y_AXIS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable={false}
              />
              <p className="text-xs text-muted-foreground">
                {localY === 'value'
                  ? 'Valores em reais (faturado, recebido, em atraso).'
                  : 'Percentual do faturado que voltou ao caixa no período.'}
              </p>
            </div>

            {/* Year selector */}
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

            {/* Month selector — hidden when grouping by year */}
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

            {/* Year-over-year toggle — only when 2+ years and month mode */}
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

            {/* Customers */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconUsers className="h-4 w-4" />
                Clientes
              </Label>
              <Combobox
                mode="multiple"
                async
                value={local.customerIds || []}
                onValueChange={v => setLocal({ ...local, customerIds: Array.isArray(v) && v.length ? v : undefined })}
                queryKey={[...customerKeys.lists()]}
                queryFn={fetchCustomers}
                minSearchLength={0}
                placeholder="Todos os clientes..."
                searchPlaceholder="Buscar cliente..."
                emptyText="Nenhum cliente encontrado"
                loadingText="Carregando clientes..."
                searchable
                clearable
              />
              <p className="text-xs text-muted-foreground">
                Sem seleção = todos. Selecione 2+ para habilitar comparação.
              </p>
            </div>

            {/* Compare mode — only when 2+ customers */}
            {canCompare && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconUsers className="h-4 w-4" />
                  Modo de Comparação
                </Label>
                <Combobox
                  value={localCmp}
                  onValueChange={v => setLocalCmp(v as CompareMode)}
                  options={COMPARE_MODE_OPTIONS}
                  placeholder="Selecione..."
                  searchable={false}
                  clearable={false}
                />
              </div>
            )}

            {/* Invoice status */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconReceipt className="h-4 w-4" />
                Status da Fatura
              </Label>
              <Combobox
                mode="multiple"
                value={local.status || []}
                onValueChange={v => setLocal({ ...local, status: Array.isArray(v) && v.length ? v : undefined })}
                options={INVOICE_STATUS_OPTIONS}
                placeholder="Todos os status"
                searchable={false}
                clearable
              />
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={clear} className="flex-1">
            <IconX className="h-4 w-4 mr-2" /> Limpar
          </Button>
          <Button onClick={apply} className="flex-1">Aplicar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =====================================================================
// Page
// =====================================================================

const CashflowStatisticsPage = () => {
  usePageTracker({ page: 'financial-cashflow-analytics', title: 'Cobranças & Fluxo de Caixa' });

  const theme = useChartTheme();

  // Defaults match productivity: current year only, every month visible, but
  // months with no data are excluded from averages later in the page.
  const initialYear = useMemo(() => new Date().getFullYear().toString(), []);
  const [selectedYears, setSelectedYears] = useState<string[]>([initialYear]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const [filters, setFilters] = useState<FinancialAnalyticsFilters>(() => {
    const { startDate, endDate } = computeDateRange([initialYear], []);
    return {
      startDate,
      endDate,
      sortBy: 'amount',
      sortOrder: 'desc',
      limit: 50,
    };
  });

  const [showFilters, setShowFilters] = useState(false);
  const [xMode, setXMode] = useState<XMode>('month');
  const [yMode, setYMode] = useState<YMode>('value');
  const [compareMode, setCompareMode] = useState<CompareMode>('combined');
  const [yearCompareMode, setYearCompareMode] = useState(false);
  const [chartType, setChartType] = useState<ChartTypeKey>('bar-stacked');
  const [trendLine, setTrendLine] = useState<TrendLineType | null>(null);
  const [openBucket, setOpenBucket] = useState<ForecastPeriodBucket | null>(null);

  // Sister filter for the receivables endpoint. Customer + status + date
  // scope mirror the collection filter so the cards and chart never disagree
  // about which invoices count. Forecast unit follows xMode.
  const receivablesFilters = useMemo<ReceivablesAnalyticsFilters>(() => ({
    startDate: filters.startDate,
    endDate: filters.endDate,
    customerIds: filters.customerIds,
    status: filters.status,
    forecastPeriodType: xMode,
    forecastPeriodCount: FORECAST_PERIOD_COUNT,
  }), [filters.startDate, filters.endDate, filters.customerIds, filters.status, xMode]);

  const {
    data: collectionData,
    isLoading: collectionLoading,
    isError: collectionError,
    error: collectionErr,
    refetch: refetchCollection,
  } = useCollectionAnalytics(filters);
  const {
    data: receivablesData,
    isLoading: receivablesLoading,
    isError: receivablesIsError,
    error: receivablesErr,
    refetch: refetchReceivables,
  } = useReceivablesAnalytics(receivablesFilters);

  const items = collectionData?.data?.items || [];
  const revenueFunnel = collectionData?.data?.revenueFunnel;

  const receivablesSummary = receivablesData?.data?.summary;
  const forecastBuckets = receivablesData?.data?.forecastBuckets || [];

  // yMode='value' shows the period total invoiced/paid; we surface INVOICES_PAID
  // (the existing currency goal). yMode='percentage' shows the collection rate
  // (paid / receivable) — we use FINANCE_COLLECTION_RATE for that.
  const goalMetric =
    yMode === 'percentage' ? GOAL_METRIC.FINANCE_COLLECTION_RATE : GOAL_METRIC.INVOICES_PAID;

  const [goalOverride, setGoalOverride] = useState<number | null>(null);

  useEffect(() => {
    setGoalOverride(null);
  }, [yMode, xMode]);

  const defaultGoal = useDefaultGoal({
    metric: goalMetric,
    period:
      filters.startDate && filters.endDate
        ? { from: filters.startDate, to: filters.endDate }
        : null,
    // xMode='month' → each bar is one calendar month → per-period average.
    // xMode='year'  → each bar is one year (12 months summed) → TOTAL across the
    //                periods, but only for additive metrics (value). Percentage
    //                metrics like FINANCE_COLLECTION_RATE never sum — keep avg.
    aggregation:
      xMode === 'year' && yMode === 'value' ? 'TOTAL' : 'AVERAGE_PER_PERIOD',
    // Financial pages use calendar months, not bonus periods.
    periodMode: 'calendar',
    enabled: !yearCompareMode,
  });

  const goalValue = goalOverride ?? defaultGoal.value;
  const goalSource: 'override' | 'default' | 'none' =
    goalOverride != null ? 'override' : defaultGoal.value != null ? 'default' : 'none';

  const isLoading = collectionLoading || receivablesLoading;
  const isError = collectionError || receivablesIsError;
  const error = collectionErr || receivablesErr;
  const refetch = useCallback(() => {
    refetchCollection();
    refetchReceivables();
  }, [refetchCollection, refetchReceivables]);

  // Empty-period awareness — periods with absolutely no activity should not be
  // counted as "analyzed" in averages, matching productivity's behavior.
  const periodsWithData = useMemo(
    () => items.filter(i =>
      (i.invoicedAmount ?? 0) > 0 ||
      (i.paidAmount ?? 0) > 0 ||
      (i.overdueAmount ?? 0) > 0,
    ),
    [items],
  );

  const totalPaid = useMemo(() => items.reduce((s, i) => s + i.paidAmount, 0), [items]);
  const avgPaidPerActivePeriod = useMemo(
    () => periodsWithData.length
      ? periodsWithData.reduce((s, i) => s + i.paidAmount, 0) / periodsWithData.length
      : 0,
    [periodsWithData],
  );

  // Forecast bucket lookups for the cards + drill-down modal.
  const bucketByKey = useMemo(() => {
    const m: Record<string, ForecastPeriodBucket> = {};
    forecastBuckets.forEach(b => { m[b.bucket] = b; });
    return m;
  }, [forecastBuckets]);

  // Period cards are strictly P1, P2, …, PN — not OVERDUE/CURRENT/BEYOND/
  // PAID. A plain `startsWith('P')` would catch PAID too (and turn it into a
  // ghost "Em 4 Períodos" card), so match the exact P{digits} shape.
  const periodBuckets = useMemo(
    () => forecastBuckets.filter(b => /^P\d+$/.test(b.bucket)),
    [forecastBuckets],
  );

  // Synthetic "all open" bucket — drives the Total a Receber card click.
  // Includes OVERDUE + all forward periods + BEYOND so the modal's count and
  // amount match the summary's totalReceivable. Excludes PAID (different
  // semantics: paid in window vs. still owed).
  const allBucket = useMemo<ForecastPeriodBucket | null>(() => {
    const openBuckets = forecastBuckets.filter(b => b.bucket !== 'PAID');
    if (!openBuckets.length) return null;
    const installments = openBuckets.flatMap(b => b.installments ?? []);
    const installmentCount = openBuckets.reduce((s, b) => s + b.installmentCount, 0);
    const dueAmount = openBuckets.reduce((s, b) => s + b.dueAmount, 0);
    const truncated = openBuckets.some(b => b.truncated);
    return {
      bucket: 'ALL',
      bucketLabel: 'Todas as parcelas em aberto',
      periodStart: null,
      periodEnd: null,
      installments,
      installmentCount,
      dueAmount: Math.round(dueAmount * 100) / 100,
      truncated,
    };
  }, [forecastBuckets]);

  const paidBucket = useMemo(() => bucketByKey['PAID'] ?? null, [bucketByKey]);

  const openBucketByKey = useCallback((key: string) => {
    const b = key === 'ALL' ? allBucket : bucketByKey[key];
    if (!b) return;
    if (!b.installmentCount) {
      toast.info('Sem parcelas neste período.');
      return;
    }
    setOpenBucket(b);
  }, [bucketByKey, allBucket]);

  // Forecast card titles. P1 = next period; P2+ = N periods ahead. The
  // in-progress period has its own CURRENT bucket on the backend that's
  // surfaced only through the Total a Receber drilldown (no dedicated card).
  const forecastCardTitle = useCallback((idx: number) => {
    const unit = xMode === 'year' ? 'Ano' : 'Período';
    const unitPlural = xMode === 'year' ? 'Anos' : 'Períodos';
    if (idx === 0) return `Próximo ${unit}`;
    return `Em ${idx + 1} ${unitPlural}`;
  }, [xMode]);

  const forecastCardHint = useCallback((bucketLabel: string) => {
    return `Vencimentos em ${bucketLabel}`;
  }, []);

  // -------- Active filter count + period summary --------

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.customerIds?.length) n++;
    if (filters.status?.length) n++;
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

  // -------- Main chart: aggregate items into display buckets --------

  type Bucket = { name: string; invoicedAmount: number; paidAmount: number; overdueAmount: number; collectionRate: number };
  const displayBuckets: Bucket[] = useMemo(() => {
    if (!items.length) return [];

    const reduce = (rows: typeof items, name: string): Bucket => {
      const inv = rows.reduce((s, r) => s + r.invoicedAmount, 0);
      const paid = rows.reduce((s, r) => s + r.paidAmount, 0);
      const over = rows.reduce((s, r) => s + r.overdueAmount, 0);
      return {
        name,
        invoicedAmount: Math.round(inv * 100) / 100,
        paidAmount: Math.round(paid * 100) / 100,
        overdueAmount: Math.round(over * 100) / 100,
        collectionRate: inv > 0 ? Math.round((paid / inv) * 1000) / 10 : 0,
      };
    };

    const parse = (period: string) => {
      const [y, m] = period.split('-');
      return { year: parseInt(y, 10), month: parseInt(m, 10) };
    };

    if (xMode === 'year') {
      const byYear = new Map<number, typeof items>();
      for (const it of items) {
        const { year } = parse(it.period);
        if (!byYear.has(year)) byYear.set(year, []);
        byYear.get(year)!.push(it);
      }
      return Array.from(byYear.keys()).sort().map(y => reduce(byYear.get(y)!, y.toString()));
    }

    if (yearCompareMode && selectedYears.length >= 2) {
      const yearsSorted = [...selectedYears].map(Number).sort((a, b) => a - b);
      const monthsSorted = (selectedMonths.length > 0
        ? selectedMonths
        : MONTH_OPTIONS.map(o => o.value)
      ).map(Number).sort((a, b) => a - b);
      const result: Bucket[] = [];
      for (const m of monthsSorted) {
        for (const y of yearsSorted) {
          const row = items.find(it => {
            const p = parse(it.period);
            return p.year === y && p.month === m;
          });
          if (row) {
            result.push(reduce([row], `${MONTH_OPTIONS[m - 1]?.label} ${y}`));
          }
        }
      }
      return result;
    }

    return items
      .slice()
      .sort((a, b) => a.period.localeCompare(b.period))
      .map(it => reduce([it], it.periodLabel));
  }, [items, xMode, yearCompareMode, selectedYears, selectedMonths]);

  void compareMode; // reserved for future per-customer comparison series
  const isComparisonMode = yMode === 'value';
  const chartData = useMemo(() => {
    if (!displayBuckets.length) return [];
    if (yMode === 'percentage') {
      return displayBuckets.map(b => ({ name: b.name, value: b.collectionRate }));
    }
    return displayBuckets.map(b => ({
      name: b.name,
      value: b.invoicedAmount,
      comparisons: [
        { entityName: 'Faturado',   value: b.invoicedAmount },
        { entityName: 'Recebido',   value: b.paidAmount },
        { entityName: 'Em Atraso',  value: b.overdueAmount },
      ],
    }));
  }, [displayBuckets, yMode]);

  const valueFormatter = useCallback((value: number, mode: YAxisMode): string => {
    if (mode === 'percentage') return `${value.toFixed(1)}%`;
    if (mode === 'value') return formatCurrency(value);
    return formatNumber(value, 0);
  }, []);

  // -------- Funnel chart --------
  const funnelOption = useMemo(() => {
    if (!revenueFunnel) return {} as any;
    const funnelData = [
      { name: 'Faturado', value: revenueFunnel.invoiced },
      { name: 'Boletos Emitidos', value: revenueFunnel.billed },
      { name: 'Recebido', value: revenueFunnel.collected },
      { name: 'Pendente', value: revenueFunnel.outstanding },
    ];
    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.textColor },
        formatter: (p: any) => `<strong>${p.name}</strong><br/>${formatCurrency(p.value)}`,
      },
      color: CHART_COLORS,
      series: [{
        type: 'funnel' as const,
        left: '5%', right: '5%', top: 20, bottom: 30,
        sort: 'descending' as const,
        gap: 4,
        label: { show: true, position: 'inside' as const, formatter: (p: any) => `${p.name}\n${formatCurrency(p.value)}`, fontSize: 11, color: '#fff' },
        data: funnelData,
      }],
    };
  }, [revenueFunnel, theme]);

  // -------- Exports --------
  const handleExportCSV = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Faturado (R$)', 'Recebido (R$)', 'Taxa de Recebimento (%)', 'Em Atraso (R$)'];
      const rows = items.map(i => [i.periodLabel, i.invoicedAmount.toFixed(2), i.paidAmount.toFixed(2), i.collectionRate.toFixed(1), i.overdueAmount.toFixed(2)]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `cobrancas-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('CSV exportado');
    } catch { toast.error('Erro ao exportar CSV'); }
  }, [items]);

  const handleExportXLSX = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Faturado (R$)', 'Recebido (R$)', 'Taxa de Recebimento (%)', 'Em Atraso (R$)'];
      const rows = items.map(i => [i.periodLabel, i.invoicedAmount, i.paidAmount, i.collectionRate, i.overdueAmount]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((_, idx) => ({ wch: idx === 0 ? 22 : 18 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cobranças');

      // Forecast sheet: one row per period bucket (excludes OVERDUE — that's
      // a status, not a future window, and already on the position cards).
      if (periodBuckets.length) {
        const fHeaders = ['Período', 'Vencimentos (R$)', 'Parcelas'];
        const fRows = periodBuckets.map(b => [b.bucketLabel, b.dueAmount, b.installmentCount]);
        const fws = XLSX.utils.aoa_to_sheet([fHeaders, ...fRows]);
        fws['!cols'] = fHeaders.map((_, idx) => ({ wch: idx === 0 ? 22 : 18 }));
        XLSX.utils.book_append_sheet(wb, fws, 'Previsão de Caixa');
      }

      XLSX.writeFile(wb, `cobrancas-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`);
      toast.success('XLSX exportado');
    } catch { toast.error('Erro ao exportar XLSX'); }
  }, [items, periodBuckets]);

  // -------- Main chart render --------
  const renderMainChart = () => {
    const chartHeightStyle = { height: '100%' };
    if (collectionLoading) {
      return (
        <div style={chartHeightStyle} className="flex items-center justify-center">
          <div className="space-y-3"><Skeleton className="h-4 w-[250px]" /><Skeleton className="h-[380px] w-[600px]" /></div>
        </div>
      );
    }
    if (collectionError) {
      return (
        <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
          <IconAlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
          <div className="text-center"><p className="font-semibold">Erro ao carregar dados</p><p className="text-sm text-foreground/70">{collectionErr?.message || 'Erro'}</p></div>
          <Button onClick={() => refetchCollection()} variant="outline"><IconRefresh className="mr-2 h-4 w-4" /> Tentar novamente</Button>
        </div>
      );
    }

    // Funnel renders the global revenue funnel for the filtered window; ignores
    // xMode / yMode (it's a flow visualization, not a time series).
    if (chartType === 'funnel') {
      if (!revenueFunnel) {
        return (
          <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
            <IconCalendarStats className="h-12 w-12 text-foreground/50" />
            <div className="text-center"><p className="font-semibold">Sem dados de funil</p><p className="text-sm text-foreground/70">Ajuste os filtros para visualizar os dados.</p></div>
          </div>
        );
      }
      return (
        <div style={chartHeightStyle}>
          <ReactECharts option={funnelOption} style={{ height: '100%' }} />
        </div>
      );
    }

    if (!chartData.length) {
      return (
        <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
          <IconCalendarStats className="h-12 w-12 text-foreground/50" />
          <div className="text-center"><p className="font-semibold">Nenhum dado encontrado</p><p className="text-sm text-foreground/70">Ajuste os filtros para visualizar os dados.</p></div>
        </div>
      );
    }
    return (
      <StatisticsChart
        data={chartData}
        chartType={chartType as StatisticsChartType}
        yAxisMode={yMode as YAxisMode}
        isComparisonMode={isComparisonMode}
        height="100%"
        yAxisLabel={yMode === 'value' ? 'Valor (R$)' : 'Taxa (%)'}
        valueFormatter={valueFormatter}
        trendLine={trendLine}
        goalLine={goalValue != null ? { value: goalValue, label: 'Meta' } : null}
        tooltipLabels={{ primary: yMode === 'value' ? 'Faturado' : 'Taxa' }}
      />
    );
  };

  const currentChartTypeOption = CHART_TYPE_OPTIONS.find(o => o.value === chartType) ?? CHART_TYPE_OPTIONS[0];

  // -------- Render --------
  if (isError && !collectionData && !receivablesData) {
    return (
      <div className="h-full flex flex-col px-4 pt-4">
        <PageHeader
          title="Cobranças & Fluxo de Caixa"
          icon={IconReportMoney}
          favoritePage={FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO_COBRANCAS}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Financeiro', href: routes.statistics.financial.root },
            { label: 'Cobranças' },
          ]}
        />
        <Card className="mt-4 flex-1 flex items-center justify-center">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <IconAlertCircle className="h-12 w-12 text-destructive" />
            <p className="font-semibold">Erro ao carregar dados</p>
            <p className="text-sm text-foreground/70">{error?.message || 'Erro'}</p>
            <Button onClick={() => refetch()} variant="outline"><IconRefresh className="mr-2 h-4 w-4" /> Tentar novamente</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="h-full flex flex-col px-4 pt-4 pb-4 overflow-hidden">
        <div className="flex-shrink-0">
          <PageHeader
            title="Cobranças & Fluxo de Caixa"
            icon={IconReportMoney}
            favoritePage={FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO_COBRANCAS}
            breadcrumbs={[
              { label: 'Início', href: routes.home },
              { label: 'Estatísticas', href: routes.statistics.root },
              { label: 'Financeiro', href: routes.statistics.financial.root },
              { label: 'Cobranças' },
            ]}
          />
        </div>

          <Card className="mt-4 flex-1 min-h-0 flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <IconCash className="h-5 w-5 text-primary" />
                    {periodSummaryLabel || 'Cobranças por Período'}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-1.5 mt-1 text-foreground/75">
                    Valores recebidos e a receber por período.
                    {chartType !== 'funnel' && (
                      <Badge variant="outline" className="text-xs">
                        {xMode === 'year' ? 'Agrupamento: Anos' : 'Agrupamento: Meses'}
                      </Badge>
                    )}
                    {chartType !== 'funnel' && (
                      <Badge variant="outline" className="text-xs">{yMode === 'value' ? 'R$' : 'Taxa de Recebimento'}</Badge>
                    )}
                    {chartType !== 'funnel' && trendLine && (
                      <Badge variant="outline" className="text-xs">Tendência: {TREND_LABELS[trendLine]}</Badge>
                    )}
                    {chartType !== 'funnel' && yearCompareMode && (
                      <Badge variant="outline" className="text-xs">Comparação Ano a Ano</Badge>
                    )}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <currentChartTypeOption.icon className="h-4 w-4" />{currentChartTypeOption.label}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>Tipo de gráfico</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup value={chartType} onValueChange={v => setChartType(v as ChartTypeKey)}>
                        {CHART_TYPE_OPTIONS.map(opt => (
                          <DropdownMenuRadioItem key={opt.value} value={opt.value} className="group">
                            <div className="flex items-start gap-2">
                              <opt.icon className="h-4 w-4 mt-0.5" />
                              <div className="flex flex-col">
                                <span className="font-medium">{opt.label}</span>
                                <span className="text-xs text-muted-foreground group-data-[highlighted]:text-white/80">{opt.description}</span>
                              </div>
                            </div>
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {chartType !== 'funnel' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant={trendLine ? 'default' : 'outline'} size="sm" className="gap-2">
                          <IconTrendingUp className="h-4 w-4" />{trendLine ? TREND_LABELS[trendLine] : 'Tendência'}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Linha de tendência</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setTrendLine(null)}>Desativada</DropdownMenuItem>
                        {(['linear', 'sma3', 'sma6', 'sma12'] as TrendLineType[]).map(t => (
                          <DropdownMenuItem key={t} onSelect={() => setTrendLine(t)}>{TREND_LABELS[t]}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  <GoalMetaPopover
                    value={goalValue}
                    defaultValue={defaultGoal.value}
                    source={goalSource}
                    onOverride={setGoalOverride}
                    unit={GOAL_METRIC_UNIT[goalMetric]}
                  />

                  <Button
                    variant={activeFilterCount > 0 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowFilters(true)}
                    className="gap-2"
                  >
                    <IconFilter className="h-4 w-4" /> Filtros
                    {activeFilterCount > 0 && <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2" disabled={isLoading || !items.length}>
                        <IconDownload className="h-4 w-4" /> Exportar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={handleExportCSV}><IconFileTypeCsv className="h-4 w-4 mr-2" /> CSV dos Dados</DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleExportXLSX}><IconFileTypeXls className="h-4 w-4 mr-2" /> Excel (XLSX)</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 flex flex-col gap-5 overflow-hidden">
              {/* Unified KPI row — receivables position + forecast + period-scoped collection metrics */}
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 flex-shrink-0">
                  {/* Total a Receber — snapshot of every open installment right now (customer/status filter applies; date range does not) */}
                  <Card
                    className={`transition-colors ${!isLoading && allBucket?.installmentCount ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                    onClick={!isLoading && allBucket?.installmentCount ? () => openBucketByKey('ALL') : undefined}
                    role={!isLoading && allBucket?.installmentCount ? 'button' : undefined}
                    tabIndex={!isLoading && allBucket?.installmentCount ? 0 : undefined}
                    onKeyDown={e => {
                      if (!isLoading && allBucket?.installmentCount && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        openBucketByKey('ALL');
                      }
                    }}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                        <IconCash className="h-3.5 w-3.5" /> Total a Receber
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex"><IconInfoCircle className="h-3 w-3 text-foreground/50" /></span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[280px]">
                            Saldo total em aberto neste momento — soma de todas as parcelas não pagas, vencidas ou não. Independe do intervalo de período selecionado.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {receivablesLoading ? <Skeleton className="h-7 w-32 mt-1" /> :
                        <div className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(receivablesSummary?.totalReceivable ?? 0)}</div>}
                      <div className="text-[11px] text-foreground/70 mt-0.5">
                        {allBucket?.installmentCount ? `${formatNumber(allBucket.installmentCount, 0)} parcelas em aberto` : 'Sem saldo em aberto'}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Em Atraso — snapshot of overdue installments at this moment */}
                  <Card
                    className={`transition-colors ${!isLoading && bucketByKey['OVERDUE']?.installmentCount ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                    onClick={!isLoading && bucketByKey['OVERDUE']?.installmentCount ? () => openBucketByKey('OVERDUE') : undefined}
                    role={!isLoading && bucketByKey['OVERDUE']?.installmentCount ? 'button' : undefined}
                    tabIndex={!isLoading && bucketByKey['OVERDUE']?.installmentCount ? 0 : undefined}
                    onKeyDown={e => {
                      if (!isLoading && bucketByKey['OVERDUE']?.installmentCount && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        openBucketByKey('OVERDUE');
                      }
                    }}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                        <IconAlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" /> Em Atraso
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex"><IconInfoCircle className="h-3 w-3 text-foreground/50" /></span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[280px]">
                            Parcelas em aberto cuja data de vencimento já passou. Snapshot atual — independe do intervalo de período.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {receivablesLoading ? <Skeleton className="h-7 w-28 mt-1" /> :
                        <div className="text-xl font-bold text-red-700 dark:text-red-400 mt-0.5">{formatCurrency(receivablesSummary?.totalOverdue ?? 0)}</div>}
                      <div className="text-[11px] text-foreground/70 mt-0.5">
                        {bucketByKey['OVERDUE']?.installmentCount ? `${formatNumber(bucketByKey['OVERDUE']!.installmentCount, 0)} parcelas` : 'Nenhuma parcela vencida'}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Prazo Médio (DSO) */}
                  <Card>
                    <CardContent className="py-3 px-4">
                      <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                        <IconClock className="h-3.5 w-3.5" /> Prazo Médio de Pagamento
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex"><IconInfoCircle className="h-3 w-3 text-foreground/50" /></span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[260px]">
                            DSO (<em>Days Sales Outstanding</em>) — dias médios entre receber a fatura e pagá-la. Quanto menor, melhor.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {receivablesLoading ? <Skeleton className="h-7 w-20 mt-1" /> :
                        <div className="text-xl font-bold text-foreground mt-0.5">{formatNumber(receivablesSummary?.avgDso ?? 0, 0)} dias</div>}
                      <div className="text-[11px] text-foreground/70 mt-0.5">
                        Da emissão da fatura ao pagamento
                      </div>
                    </CardContent>
                  </Card>

                  {/* Total Recebido — clickable; opens PAID bucket modal */}
                  <Card
                    className={`transition-colors ${!isLoading && paidBucket?.installmentCount ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                    onClick={!isLoading && paidBucket?.installmentCount ? () => openBucketByKey('PAID') : undefined}
                    role={!isLoading && paidBucket?.installmentCount ? 'button' : undefined}
                    tabIndex={!isLoading && paidBucket?.installmentCount ? 0 : undefined}
                    onKeyDown={e => {
                      if (!isLoading && paidBucket?.installmentCount && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        openBucketByKey('PAID');
                      }
                    }}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                        <IconCash className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Total Recebido
                      </div>
                      {receivablesLoading ? <Skeleton className="h-7 w-28 mt-1" /> :
                        <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{formatCurrency(paidBucket?.dueAmount ?? totalPaid)}</div>}
                      <div className="text-[11px] text-foreground/70 mt-0.5">
                        {paidBucket?.installmentCount
                          ? `${formatNumber(paidBucket.installmentCount, 0)} parcelas pagas`
                          : 'Dinheiro que entrou nos períodos filtrados'}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Forecast cards (Atual + next periods) */}
                  {periodBuckets.map((b, idx) => {
                    const color = bucketColor(b.bucket);
                    const interactive = !receivablesLoading && b.installmentCount > 0;
                    const title = forecastCardTitle(idx);
                    return (
                      <Card
                        key={b.bucket}
                        className={`relative overflow-hidden transition-colors ${interactive ? 'cursor-pointer hover:bg-muted/50' : 'opacity-90'}`}
                        onClick={interactive ? () => openBucketByKey(b.bucket) : undefined}
                        role={interactive ? 'button' : undefined}
                        tabIndex={interactive ? 0 : undefined}
                        onKeyDown={e => {
                          if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            openBucketByKey(b.bucket);
                          }
                        }}
                      >
                        <span
                          aria-hidden
                          className="absolute left-0 top-0 h-full w-1"
                          style={{ background: color }}
                        />
                        <CardContent className="py-3 px-4 pl-5">
                          <div className="text-xs font-medium text-foreground/70 flex items-center justify-between gap-1.5">
                            <span>{title}</span>
                          </div>
                          {receivablesLoading ? (
                            <Skeleton className="h-7 w-32 mt-1" />
                          ) : (
                            <div className="text-xl font-bold mt-0.5" style={{ color }}>
                              {formatCurrency(b.dueAmount)}
                            </div>
                          )}
                          <div className="text-[11px] text-foreground/70 mt-0.5">
                            {b.installmentCount > 0
                              ? `${formatNumber(b.installmentCount, 0)} parcela${b.installmentCount !== 1 ? 's' : ''} · ${forecastCardHint(b.bucketLabel)}`
                              : forecastCardHint(b.bucketLabel)}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Média por Período Ativo */}
                  <Card>
                    <CardContent className="py-3 px-4">
                      <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                        <IconCalendarStats className="h-3.5 w-3.5" /> Média por Período Ativo
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex"><IconInfoCircle className="h-3 w-3 text-foreground/50" /></span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[260px]">
                            Média de recebimentos por período do filtro. Períodos sem nenhuma movimentação não entram no cálculo.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {collectionLoading ? <Skeleton className="h-7 w-20 mt-1" /> :
                        <div className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(avgPaidPerActivePeriod)}</div>}
                      <div className="text-[11px] text-foreground/70 mt-0.5">
                        {periodsWithData.length > 0 ? `${periodsWithData.length} ${periodsWithData.length === 1 ? 'período ativo' : 'períodos ativos'} de ${items.length}` : 'Sem períodos ativos'}
                      </div>
                    </CardContent>
                  </Card>
              </div>

              <Card className="flex-1 min-h-0 flex flex-col"><CardContent className="flex-1 min-h-0 p-4">{renderMainChart()}</CardContent></Card>
            </CardContent>
          </Card>

        <FilterSheet
          open={showFilters}
          onOpenChange={setShowFilters}
          filters={filters}
          xMode={xMode}
          yMode={yMode}
          compareMode={compareMode}
          selectedYears={selectedYears}
          selectedMonths={selectedMonths}
          yearCompareMode={yearCompareMode}
          onApply={({ filters: f, xMode: x, yMode: y, compareMode: c, years, months, yearCompareMode: yc }) => {
            setFilters(f);
            setXMode(x);
            setYMode(y);
            setCompareMode(c);
            setSelectedYears(years);
            setSelectedMonths(months);
            setYearCompareMode(yc);
          }}
        />

        {openBucket && (
          <ForecastBucketInstallmentsModal
            open={!!openBucket}
            onOpenChange={(o) => { if (!o) setOpenBucket(null); }}
            bucketLabel={openBucket.bucketLabel}
            bucketKey={openBucket.bucket}
            dueAmount={openBucket.dueAmount}
            installments={openBucket.installments || []}
            totalCount={openBucket.installmentCount}
            truncated={openBucket.truncated}
          />
        )}
      </div>
    </TooltipProvider>
  );
};

export default CashflowStatisticsPage;
