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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getBonusPeriodStart, getBonusPeriodEnd } from '@/utils/bonus';
import { GOAL_METRIC, GOAL_METRIC_UNIT, routes, FAVORITE_PAGES } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useChartTheme } from '@/hooks/common/use-chart-theme';
import { useDefaultGoal } from '@/hooks/administration/use-default-goal';
import { GoalMetaPopover } from '@/components/statistics/goal-meta-popover';
import {
  useCollectionAnalytics,
  useReceivablesAnalytics,
  useQuoteFunnelAnalytics,
} from '@/hooks/financial/use-financial-analytics';
import type {
  FinancialAnalyticsFilters,
  ReceivablesAnalyticsFilters,
  ForecastPeriodBucket,
  QuoteFunnelAnalyticsFilters,
} from '@/types/financial-analytics';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import {
  CHART_COLORS,
  FUNNEL_STAGE_COLORS,
  formatCurrency,
  formatNumber,
  formatPercentage,
} from '@/types/statistics-common';
import type { YAxisMode, StatisticsChartType, TrendLineType } from '@/types/statistics-common';
import { getCustomers } from '@/api-client/customer';
import { getSectors } from '@/api-client/sector';
import { customerKeys, sectorKeys } from '@/hooks/common/query-keys';
import { ForecastBucketInstallmentsModal } from '@/components/financial/forecast-bucket-installments-modal';
import ReactECharts from 'echarts-for-react';
import { format } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { useStatisticsPagePersistence } from '@/hooks/common/use-statistics-page-persistence';
import { StatisticsPresetsMenu } from '@/components/statistics/statistics-presets-menu';
import {
  IconChartBar,
  IconChartLine,
  IconChartArea,
  IconChartPie,
  IconChartDonut3,
  IconChartArcs3,
  IconStack2,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconReportMoney,
  IconUsers,
  IconBuilding,
  IconCalendarStats,
  IconX,
  IconReceipt,
  IconClock,
  IconCash,
  IconTrendingUp,
  IconFileTypeCsv,
  IconFileTypeXls,
  IconAlertTriangle,
  IconArrowsExchange2,
  IconInfoCircle,
  IconLayoutGrid,
  IconAdjustmentsHorizontal,
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
  return Array.from({ length: 6 }, (_, i) => {
    const y = cy - 4 + i;
    return { value: y.toString(), label: y.toString() };
  });
};
const YEAR_OPTIONS = generateYearOptions();

// Status da Fatura — applies to receivables/collection endpoints (invoice side)
const INVOICE_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'ACTIVE', label: 'Ativa' },
  { value: 'PARTIALLY_PAID', label: 'Parcialmente Paga' },
  { value: 'PAID', label: 'Paga' },
];

// Estágios do Orçamento — applies to quote-funnel endpoint (sales side)
const QUOTE_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendente' },
  { value: 'BUDGET_APPROVED', label: 'Orçamento Aprovado' },
  { value: 'COMMERCIAL_APPROVED', label: 'Aprovado pelo Comercial' },
  { value: 'BILLING_APPROVED', label: 'Faturamento Aprovado' },
  { value: 'UPCOMING', label: 'A Vencer' },
  { value: 'DUE', label: 'Vencido' },
  { value: 'PARTIAL', label: 'Parcial' },
  { value: 'SETTLED', label: 'Liquidado' },
];

type XMode = 'month' | 'year';
const X_AXIS_OPTIONS: Array<{ value: XMode; label: string }> = [
  { value: 'month', label: 'Meses' },
  { value: 'year',  label: 'Anos' },
];

type CompareMode = 'combined' | 'separated' | 'separatedWithTotal';
const COMPARE_MODE_OPTIONS: Array<{ value: CompareMode; label: string }> = [
  { value: 'combined',           label: 'Combinado (uma série)' },
  { value: 'separated',          label: 'Separado (por cliente)' },
  { value: 'separatedWithTotal', label: 'Separado + Total' },
];

// =====================================================================
// Dimensão & Métrica & Tipo de Gráfico — analysis model
//
// The page is filter-driven. The "Dimensão" picks how to slice the data
// (period / status / cliente / setor), the "Métrica" picks what to measure
// on the Y-axis, and the "Tipo de Gráfico" is constrained by the Dimensão
// (e.g., funnel only makes sense when grouping by status — not by period).
// =====================================================================

type Dimension =
  | 'periodo'           // time series, x = months/years
  | 'status-fatura'     // invoice flow: Faturado → Boletos → Recebido → Pendente
  | 'status-orcamento'  // sales funnel: 8 stages from PENDING → SETTLED
  | 'cliente'           // top N clientes ranking
  | 'setor';            // distribution by setor

const DIMENSION_OPTIONS: Array<{ value: Dimension; label: string; icon: typeof IconChartBar; description: string }> = [
  { value: 'periodo',          label: 'Por Período',              icon: IconCalendarStats, description: 'Série temporal por mês ou ano' },
  { value: 'status-fatura',    label: 'Por Status da Fatura',     icon: IconReceipt,        description: 'Fluxo Faturado → Recebido' },
  { value: 'status-orcamento', label: 'Por Estágio do Orçamento', icon: IconChartArcs3,    description: 'Funil de vendas (8 estágios)' },
  { value: 'cliente',          label: 'Por Cliente',              icon: IconUsers,          description: 'Top 10 clientes por valor' },
  { value: 'setor',            label: 'Por Setor',                icon: IconBuilding,       description: 'Distribuição por setor da tarefa' },
];

type MetricKey =
  // Cobranças
  | 'faturado' | 'recebido' | 'em-atraso' | 'qtd-parcelas' | 'taxa-recebimento' | 'dso'
  // Receita / Orçamentos
  | 'liquidado' | 'backlog' | 'qtd-orcamentos' | 'taxa-conversao' | 'ticket-medio' | 'ciclo';

type MetricUnit = 'currency' | 'count' | 'percent' | 'days';

interface MetricDef {
  value: MetricKey;
  label: string;
  unit: MetricUnit;
  // Which dimensions can render this metric. If empty for a chosen dimension,
  // the combobox disables the metric and explains why on hover.
  validDims: Dimension[];
  // Which underlying analytics endpoint provides this metric.
  source: 'collection' | 'receivables' | 'quote-funnel';
}

const METRIC_OPTIONS: MetricDef[] = [
  // Cobranças metrics
  { value: 'faturado',         label: 'Faturado (R$)',            unit: 'currency', validDims: ['periodo', 'status-fatura'],                                    source: 'collection' },
  { value: 'recebido',         label: 'Recebido (R$)',            unit: 'currency', validDims: ['periodo', 'status-fatura'],                                    source: 'collection' },
  { value: 'em-atraso',        label: 'Em Atraso (R$)',           unit: 'currency', validDims: ['periodo'],                                                     source: 'collection' },
  { value: 'qtd-parcelas',     label: 'Quantidade de Parcelas',   unit: 'count',    validDims: ['periodo'],                                                     source: 'receivables' },
  { value: 'taxa-recebimento', label: 'Taxa de Recebimento (%)',  unit: 'percent',  validDims: ['periodo'],                                                     source: 'collection' },
  { value: 'dso',              label: 'DSO (dias até receber)',   unit: 'days',     validDims: ['periodo'],                                                     source: 'receivables' },
  // Receita / Orçamentos metrics
  { value: 'liquidado',        label: 'Receita Liquidada (R$)',   unit: 'currency', validDims: ['periodo', 'status-orcamento', 'cliente', 'setor'],             source: 'quote-funnel' },
  { value: 'backlog',          label: 'Backlog Ativo (R$)',       unit: 'currency', validDims: ['periodo'],                                                     source: 'quote-funnel' },
  { value: 'qtd-orcamentos',   label: 'Quantidade de Orçamentos', unit: 'count',    validDims: ['periodo', 'status-orcamento', 'cliente', 'setor'],             source: 'quote-funnel' },
  { value: 'taxa-conversao',   label: 'Taxa de Conversão (%)',    unit: 'percent',  validDims: ['periodo', 'cliente'],                                          source: 'quote-funnel' },
  { value: 'ticket-medio',     label: 'Ticket Médio (R$)',        unit: 'currency', validDims: ['periodo'],                                                     source: 'quote-funnel' },
  { value: 'ciclo',            label: 'Ciclo de Fechamento (dias)', unit: 'days',   validDims: ['periodo', 'status-orcamento'],                                 source: 'quote-funnel' },
];

type ChartTypeKey =
  | 'bar' | 'bar-stacked' | 'line' | 'line-smooth' | 'area' // time-series
  | 'funnel' | 'pie' | 'donut' | 'hbar';                    // categorical

interface ChartTypeDef {
  value: ChartTypeKey;
  label: string;
  icon: typeof IconChartBar;
  description: string;
  validDims: Dimension[];
}

const CHART_TYPE_OPTIONS: ChartTypeDef[] = [
  // Time-series only (Por Período)
  { value: 'bar',         label: 'Colunas',             icon: IconChartBar,     description: 'Barras lado a lado por período',            validDims: ['periodo'] },
  { value: 'bar-stacked', label: 'Colunas Empilhadas',  icon: IconStack2,       description: 'Séries empilhadas por período',             validDims: ['periodo'] },
  { value: 'line',        label: 'Linha',               icon: IconChartLine,    description: 'Linha reta por período',                    validDims: ['periodo'] },
  { value: 'line-smooth', label: 'Linha Suave',         icon: IconChartLine,    description: 'Linha suavizada por período',               validDims: ['periodo'] },
  { value: 'area',        label: 'Área',                icon: IconChartArea,    description: 'Área preenchida por período',               validDims: ['periodo'] },
  // Categorical (Status / Cliente / Setor)
  { value: 'funnel',      label: 'Funil',               icon: IconFilter,       description: 'Progressão entre estágios (status)',         validDims: ['status-fatura', 'status-orcamento'] },
  { value: 'pie',         label: 'Pizza',               icon: IconChartPie,     description: 'Distribuição entre categorias',              validDims: ['status-fatura', 'status-orcamento', 'setor'] },
  { value: 'donut',       label: 'Donut',               icon: IconChartDonut3,  description: 'Distribuição entre categorias (anel)',       validDims: ['status-fatura', 'status-orcamento', 'setor', 'cliente'] },
  { value: 'hbar',        label: 'Barras Horizontais',  icon: IconChartBar,     description: 'Ranking horizontal por categoria',           validDims: ['cliente', 'setor', 'status-fatura', 'status-orcamento'] },
];

const TREND_LABELS: Record<TrendLineType, string> = {
  linear: 'Linear', sma3: 'Média 3m', sma6: 'Média 6m', sma12: 'Média 12m',
};

const FORECAST_PERIOD_COUNT = 3;

// =====================================================================
// Helpers
// =====================================================================

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

function metricDef(metric: MetricKey): MetricDef {
  return METRIC_OPTIONS.find(m => m.value === metric) ?? METRIC_OPTIONS[0];
}

function isMetricValidForDim(metric: MetricKey, dim: Dimension): boolean {
  return metricDef(metric).validDims.includes(dim);
}

function availableChartTypes(dim: Dimension): ChartTypeDef[] {
  return CHART_TYPE_OPTIONS.filter(c => c.validDims.includes(dim));
}

function defaultChartTypeFor(dim: Dimension): ChartTypeKey {
  // Period: stacked bars compare faturado/recebido/atraso well.
  // Status: funnel reads as flow.
  // Cliente: hbar reads as ranking.
  // Setor: donut reads as distribution.
  if (dim === 'periodo') return 'bar-stacked';
  if (dim === 'status-fatura' || dim === 'status-orcamento') return 'funnel';
  if (dim === 'cliente') return 'hbar';
  return 'donut';
}

function formatByUnit(value: number, unit: MetricUnit): string {
  if (unit === 'currency') return formatCurrency(value);
  if (unit === 'percent')  return formatPercentage(value);
  if (unit === 'days')     return `${formatNumber(value, 1)} dias`;
  return formatNumber(value, 0);
}

function metricYAxisMode(unit: MetricUnit): YAxisMode {
  if (unit === 'currency') return 'value';
  if (unit === 'percent')  return 'percentage';
  return 'count';
}

function goalMetricFor(metric: MetricKey): GOAL_METRIC | null {
  const m = metricDef(metric);
  if (m.unit === 'currency' && m.source !== 'quote-funnel') return GOAL_METRIC.INVOICES_PAID;
  if (m.value === 'liquidado' || m.value === 'backlog' || m.value === 'ticket-medio') return GOAL_METRIC.INVOICES_PAID;
  if (m.value === 'taxa-recebimento') return GOAL_METRIC.FINANCE_COLLECTION_RATE;
  if (m.value === 'qtd-orcamentos')   return GOAL_METRIC.FINANCE_QUOTES_PER_PERIOD;
  return null;
}

// Spec for a single summary card. Each metric maps to 3-4 of these — all
// describing different angles of the SAME metric (total / peak / average /
// count), never mixing in foreign metrics like Recebido when viewing Faturado.
interface CardSpec {
  key: string;
  icon: React.ElementType;
  label: string;
  tooltip?: string;
  value: string;
  hint: string;
  loading: boolean;
  onClick?: () => void;
  tone?: 'default' | 'success' | 'danger';
}

// =====================================================================
// Page config persistence (last-seen config + named presets)
// =====================================================================
//
// Plain-JSON snapshot of every user-configurable knob on this page. Per-field
// `.catch()` keeps stale stored configs from ever breaking the page; derived
// values (date ranges, periods, goals) are never persisted — they're re-derived
// from selectedYears/selectedMonths on apply. `goalOverride`, `openBucket` and
// modal/sheet state are session-only by design.
const pageConfigSchema = z.object({
  version: z.literal(1).catch(1),
  selectedYears: z.array(z.string()).catch([]),
  selectedMonths: z.array(z.string()).catch([]),
  customerIds: z.array(z.string()).catch([]),
  sectorIds: z.array(z.string()).catch([]),
  invoiceStatus: z.array(z.string()).catch([]),
  quoteStatus: z.array(z.string()).catch([]),
  dimension: z
    .enum(['periodo', 'status-fatura', 'status-orcamento', 'cliente', 'setor'])
    .catch('periodo'),
  metric: z
    .enum([
      'faturado', 'recebido', 'em-atraso', 'qtd-parcelas', 'taxa-recebimento', 'dso',
      'liquidado', 'backlog', 'qtd-orcamentos', 'taxa-conversao', 'ticket-medio', 'ciclo',
    ])
    .catch('faturado'),
  chartType: z
    .enum(['bar', 'bar-stacked', 'line', 'line-smooth', 'area', 'funnel', 'pie', 'donut', 'hbar'])
    .catch('bar-stacked'),
  xMode: z.enum(['month', 'year']).catch('month'),
  compareMode: z.enum(['combined', 'separated', 'separatedWithTotal']).catch('combined'),
  yearCompareMode: z.boolean().catch(false),
  trendLine: z.enum(['linear', 'sma3', 'sma6', 'sma12']).nullable().catch(null),
});

type PageConfig = z.infer<typeof pageConfigSchema>;

// =====================================================================
// FilterSheet
// =====================================================================

interface FilterState {
  customerIds?: string[];
  sectorIds?: string[];
  // Status da Fatura — applies to cobrança data (collection + receivables).
  invoiceStatus?: string[];
  // Estágios do Orçamento — applies to quote-funnel data.
  quoteStatus?: string[];
}

interface AnalysisState {
  dimension: Dimension;
  metric: MetricKey;
  chartType: ChartTypeKey;
}

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: FilterState;
  analysis: AnalysisState;
  xMode: XMode;
  compareMode: CompareMode;
  selectedYears: string[];
  selectedMonths: string[];
  yearCompareMode: boolean;
  onApply: (next: {
    scope: FilterState;
    analysis: AnalysisState;
    xMode: XMode;
    compareMode: CompareMode;
    years: string[];
    months: string[];
    yearCompareMode: boolean;
  }) => void;
}

function FilterSheet({
  open, onOpenChange, scope, analysis, xMode, compareMode,
  selectedYears, selectedMonths, yearCompareMode, onApply,
}: FilterSheetProps) {
  const [localScope, setLocalScope] = useState<FilterState>(scope);
  const [localAnalysis, setLocalAnalysis] = useState<AnalysisState>(analysis);
  const [localX, setLocalX] = useState<XMode>(xMode);
  const [localCmp, setLocalCmp] = useState<CompareMode>(compareMode);
  const [localYears, setLocalYears] = useState<string[]>(selectedYears);
  const [localMonths, setLocalMonths] = useState<string[]>(selectedMonths);
  const [localYearCompare, setLocalYearCompare] = useState(yearCompareMode);

  useEffect(() => {
    if (open) {
      setLocalScope(scope);
      setLocalAnalysis(analysis);
      setLocalX(xMode);
      setLocalCmp(compareMode);
      setLocalYears(selectedYears);
      setLocalMonths(selectedMonths);
      setLocalYearCompare(yearCompareMode);
    }
  }, [open, scope, analysis, xMode, compareMode, selectedYears, selectedMonths, yearCompareMode]);

  const fetchCustomers = useCallback(async (search: string, page: number = 1) => {
    const r = await getCustomers({ search: search || undefined, page, limit: COMBOBOX_PAGE_SIZE });
    return {
      data: (r.data || []).map(c => ({ value: c.id, label: c.fantasyName })),
      hasMore: r.meta?.hasNextPage || false,
    };
  }, []);

  const fetchSectors = useCallback(async (search: string, page: number = 1) => {
    const r = await getSectors({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      page, limit: COMBOBOX_PAGE_SIZE, orderBy: { name: 'asc' },
    });
    return {
      data: (r.data || []).map((s: { id: string; name: string }) => ({ value: s.id, label: s.name })),
      hasMore: r.meta?.hasNextPage || false,
    };
  }, []);

  const canCompare = (localScope.customerIds?.length ?? 0) >= 2;

  // Reset chart type to a valid default whenever Dimensão changes.
  const handleDimensionChange = useCallback((v: string) => {
    const dim = v as Dimension;
    setLocalAnalysis(prev => ({
      ...prev,
      dimension: dim,
      // If current metric is invalid for new dimension, fall back to a metric that fits.
      metric: isMetricValidForDim(prev.metric, dim)
        ? prev.metric
        : (METRIC_OPTIONS.find(m => m.validDims.includes(dim))?.value ?? prev.metric),
      // Chart type must fit the new dimension.
      chartType: availableChartTypes(dim).some(c => c.value === prev.chartType)
        ? prev.chartType
        : defaultChartTypeFor(dim),
    }));
  }, []);

  const metricOptionsForDim = useMemo(() => {
    return METRIC_OPTIONS.map(m => ({
      value: m.value,
      label: m.label,
      disabled: !m.validDims.includes(localAnalysis.dimension),
    }));
  }, [localAnalysis.dimension]);

  const chartTypeOptionsForDim = useMemo(() => {
    return availableChartTypes(localAnalysis.dimension).map(c => ({
      value: c.value,
      label: c.label,
    }));
  }, [localAnalysis.dimension]);

  // Whether the current Métrica concerns cobrança data (affects which status
  // filter is shown — to avoid two confusing "Status" controls side by side).
  const metricIsInvoiceSide = ['collection', 'receivables'].includes(metricDef(localAnalysis.metric).source);
  const metricIsQuoteSide   = metricDef(localAnalysis.metric).source === 'quote-funnel';

  const apply = useCallback(() => {
    onApply({
      scope: localScope,
      analysis: localAnalysis,
      xMode: localX,
      compareMode: canCompare ? localCmp : 'combined',
      years: localYears,
      months: localMonths,
      yearCompareMode: localYears.length >= 2 && localX !== 'year' ? localYearCompare : false,
    });
    onOpenChange(false);
  }, [localScope, localAnalysis, localX, localCmp, localYears, localMonths, localYearCompare, canCompare, onApply, onOpenChange]);

  const clear = useCallback(() => {
    const cy = new Date().getFullYear().toString();
    setLocalScope({});
    setLocalAnalysis({
      dimension: 'periodo',
      metric: 'faturado',
      chartType: 'bar-stacked',
    });
    setLocalX('month');
    setLocalCmp('combined');
    setLocalYears([cy]);
    setLocalMonths([]);
    setLocalYearCompare(false);
  }, []);

  const activeCount = [
    (localScope.customerIds?.length ?? 0) > 0,
    (localScope.sectorIds?.length ?? 0) > 0,
    (localScope.invoiceStatus?.length ?? 0) > 0,
    (localScope.quoteStatus?.length ?? 0) > 0,
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
            Configure a análise: o que medir, como agrupar e qual janela de tempo considerar.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-4">

            {/* ===== Análise — what to show ===== */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconAdjustmentsHorizontal className="h-4 w-4" /> Dimensão
              </Label>
              <Combobox
                value={localAnalysis.dimension}
                onValueChange={(v) => {
                  const s = Array.isArray(v) ? v[0] : v;
                  if (s) handleDimensionChange(s);
                }}
                options={DIMENSION_OPTIONS.map(d => ({ value: d.value, label: d.label }))}
                searchable={false}
                clearable={false}
              />
              <p className="text-xs text-muted-foreground">
                {DIMENSION_OPTIONS.find(d => d.value === localAnalysis.dimension)?.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconChartBar className="h-4 w-4" /> Métrica
              </Label>
              <Combobox
                value={localAnalysis.metric}
                onValueChange={(v) => {
                  const s = Array.isArray(v) ? v[0] : v;
                  if (s && !metricOptionsForDim.find(o => o.value === s)?.disabled) {
                    setLocalAnalysis(prev => ({ ...prev, metric: s as MetricKey }));
                  }
                }}
                options={metricOptionsForDim}
                searchable={false}
                clearable={false}
              />
              <p className="text-xs text-muted-foreground">
                Métricas em cinza não fazem sentido para a dimensão escolhida.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconChartPie className="h-4 w-4" /> Tipo de Gráfico
              </Label>
              <Combobox
                value={localAnalysis.chartType}
                onValueChange={(v) => {
                  const s = Array.isArray(v) ? v[0] : v;
                  if (s) setLocalAnalysis(prev => ({ ...prev, chartType: s as ChartTypeKey }));
                }}
                options={chartTypeOptionsForDim}
                searchable={false}
                clearable={false}
              />
            </div>

            {/* ===== Eixo X (só relevante quando Dimensão = Por Período) ===== */}
            {localAnalysis.dimension === 'periodo' && (
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
                  Os cartões de previsão de caixa acompanham essa escolha.
                </p>
              </div>
            )}

            {/* ===== Período ===== */}
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

            {/* Meses — escondido quando agrupado por ano */}
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

            {/* Year-on-year — só quando 2+ anos + Por Período em meses */}
            {localAnalysis.dimension === 'periodo' && localYears.length >= 2 && localX !== 'year' && (
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

            {/* ===== Clientes ===== */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconUsers className="h-4 w-4" />
                Clientes
              </Label>
              <Combobox
                mode="multiple"
                async
                value={localScope.customerIds || []}
                onValueChange={v => setLocalScope({ ...localScope, customerIds: Array.isArray(v) && v.length ? v : undefined })}
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

            {/* Modo de Comparação — só com 2+ clientes */}
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

            {/* ===== Setores ===== */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <IconBuilding className="h-4 w-4" />
                Setores
              </Label>
              <Combobox
                mode="multiple"
                async
                value={localScope.sectorIds || []}
                onValueChange={v => setLocalScope({ ...localScope, sectorIds: Array.isArray(v) && v.length ? v : undefined })}
                queryKey={[...sectorKeys.lists(), 'visao-financeira']}
                queryFn={fetchSectors}
                minSearchLength={0}
                placeholder="Todos os setores..."
                searchPlaceholder="Buscar setor..."
                emptyText="Nenhum setor encontrado"
                loadingText="Carregando setores..."
                searchable
                clearable
              />
              <p className="text-xs text-muted-foreground">
                Filtra orçamentos pelo setor da tarefa associada. (As cobranças não são afetadas por este filtro.)
              </p>
            </div>

            {/* ===== Status da Fatura — mostrado quando a Métrica é do lado cobrança ===== */}
            {metricIsInvoiceSide && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconReceipt className="h-4 w-4" />
                  Status da Fatura
                </Label>
                <Combobox
                  mode="multiple"
                  value={localScope.invoiceStatus || []}
                  onValueChange={v => setLocalScope({ ...localScope, invoiceStatus: Array.isArray(v) && v.length ? v : undefined })}
                  options={INVOICE_STATUS_OPTIONS}
                  placeholder="Todos os status"
                  searchable={false}
                  clearable
                />
                <p className="text-xs text-muted-foreground">
                  Aplica-se às parcelas (faturado, recebido, em atraso).
                </p>
              </div>
            )}

            {/* ===== Estágios do Orçamento — mostrado quando a Métrica é do lado receita ===== */}
            {metricIsQuoteSide && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <IconChartArcs3 className="h-4 w-4" />
                  Estágios do Orçamento
                </Label>
                <Combobox
                  mode="multiple"
                  value={localScope.quoteStatus || []}
                  onValueChange={v => setLocalScope({ ...localScope, quoteStatus: Array.isArray(v) && v.length ? v : undefined })}
                  options={QUOTE_STATUS_OPTIONS}
                  placeholder="Todos os estágios"
                  searchable={false}
                  clearable
                />
                <p className="text-xs text-muted-foreground">
                  Aplica-se ao funil de vendas (receita liquidada, backlog, ticket médio).
                </p>
              </div>
            )}
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

const FinancialOverviewPage = () => {
  usePageTracker({ page: 'financial-overview-analytics', title: 'Visão Financeira' });

  const theme = useChartTheme();

  const initialYear = useMemo(() => new Date().getFullYear().toString(), []);
  const [selectedYears, setSelectedYears] = useState<string[]>([initialYear]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const [scope, setScope] = useState<FilterState>({});
  const [analysis, setAnalysis] = useState<AnalysisState>({
    dimension: 'periodo',
    metric: 'faturado',
    chartType: 'bar-stacked',
  });

  const [showFilters, setShowFilters] = useState(false);
  const [xMode, setXMode] = useState<XMode>('month');
  const [compareMode, setCompareMode] = useState<CompareMode>('combined');
  const [yearCompareMode, setYearCompareMode] = useState(false);
  const [trendLine, setTrendLine] = useState<TrendLineType | null>(null);
  const [openBucket, setOpenBucket] = useState<ForecastPeriodBucket | null>(null);
  const [goalOverride, setGoalOverride] = useState<number | null>(null);

  // Reset goal override whenever the metric or grouping changes.
  useEffect(() => {
    setGoalOverride(null);
  }, [analysis.metric, xMode]);

  // ── Page config persistence (auto-restore last config + named presets) ──
  const pageConfig = useMemo<PageConfig>(() => ({
    version: 1,
    selectedYears,
    selectedMonths,
    customerIds: scope.customerIds ?? [],
    sectorIds: scope.sectorIds ?? [],
    invoiceStatus: scope.invoiceStatus ?? [],
    quoteStatus: scope.quoteStatus ?? [],
    dimension: analysis.dimension,
    metric: analysis.metric,
    chartType: analysis.chartType,
    xMode,
    compareMode,
    yearCompareMode,
    trendLine,
  }), [selectedYears, selectedMonths, scope, analysis, xMode, compareMode, yearCompareMode, trendLine]);

  const applyPageConfig = useCallback((config: PageConfig) => {
    // Years drive the date range — an empty list would blank the page, so fall
    // back to the page's default (current year) when none were persisted.
    setSelectedYears(config.selectedYears.length ? config.selectedYears : [initialYear]);
    setSelectedMonths(config.selectedMonths);
    setScope({
      customerIds: config.customerIds.length ? config.customerIds : undefined,
      sectorIds: config.sectorIds.length ? config.sectorIds : undefined,
      invoiceStatus: config.invoiceStatus.length ? config.invoiceStatus : undefined,
      quoteStatus: config.quoteStatus.length ? config.quoteStatus : undefined,
    });
    // Metric validity depends on the dimension — if a stale (dimension, metric)
    // pair is invalid, fall back to the dimension's first valid metric.
    const metric = isMetricValidForDim(config.metric, config.dimension)
      ? config.metric
      : (METRIC_OPTIONS.find(m => m.validDims.includes(config.dimension))?.value ?? config.metric);
    // Chart type must fit the dimension too.
    const chartType = availableChartTypes(config.dimension).some(c => c.value === config.chartType)
      ? config.chartType
      : defaultChartTypeFor(config.dimension);
    setAnalysis({ dimension: config.dimension, metric, chartType });
    setXMode(config.xMode);
    setCompareMode(config.compareMode);
    setYearCompareMode(config.yearCompareMode);
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
    pageKey: routes.statistics.financial.collection,
    schema: pageConfigSchema,
    current: pageConfig,
    apply: applyPageConfig,
  });

  const { startDate, endDate } = useMemo(
    () => computeDateRange(selectedYears, selectedMonths),
    [selectedYears, selectedMonths],
  );

  // -------- Filter shapes for the three analytics endpoints --------

  const collectionFilters = useMemo<FinancialAnalyticsFilters>(() => {
    const periods = buildPeriods(selectedYears, selectedMonths);
    return {
      startDate,
      endDate,
      customerIds: scope.customerIds,
      status: scope.invoiceStatus,
      sortBy: 'amount',
      sortOrder: 'desc',
      limit: 50,
      ...(periods ? { periods } : {}),
    };
  }, [startDate, endDate, scope.customerIds, scope.invoiceStatus, selectedYears, selectedMonths]);

  const receivablesFilters = useMemo<ReceivablesAnalyticsFilters>(() => ({
    startDate,
    endDate,
    customerIds: scope.customerIds,
    status: scope.invoiceStatus,
    forecastPeriodType: xMode,
    forecastPeriodCount: FORECAST_PERIOD_COUNT,
  }), [startDate, endDate, scope.customerIds, scope.invoiceStatus, xMode]);

  // Quote-funnel requires non-optional dates. Fall back to current year range.
  const quoteFunnelFilters = useMemo<QuoteFunnelAnalyticsFilters>(() => {
    const cy = new Date().getFullYear();
    const fallbackStart = new Date(cy, 0, 1);
    const fallbackEnd = new Date(cy, 11, 31, 23, 59, 59);
    return {
      startDate: startDate ?? fallbackStart,
      endDate: endDate ?? fallbackEnd,
      customerIds: scope.customerIds,
      sectorIds: scope.sectorIds,
      status: scope.quoteStatus,
    };
  }, [startDate, endDate, scope.customerIds, scope.sectorIds, scope.quoteStatus]);

  // -------- Fire all three analytics hooks in parallel --------

  const {
    data: collectionData,
    isLoading: collectionLoading,
    isError: collectionError,
    error: collectionErr,
    refetch: refetchCollection,
  } = useCollectionAnalytics(collectionFilters);

  const {
    data: receivablesData,
    isLoading: receivablesLoading,
    isError: receivablesIsError,
    error: receivablesErr,
    refetch: refetchReceivables,
  } = useReceivablesAnalytics(receivablesFilters);

  const {
    data: quoteFunnelData,
    isLoading: quoteFunnelLoading,
    isError: quoteFunnelError,
    error: quoteFunnelErr,
    refetch: refetchQuoteFunnel,
  } = useQuoteFunnelAnalytics(quoteFunnelFilters);

  const items = collectionData?.data?.items || [];
  const revenueFunnel = collectionData?.data?.revenueFunnel;
  const collectionSummary = collectionData?.data?.summary;

  const receivablesSummary = receivablesData?.data?.summary;
  const forecastBuckets = receivablesData?.data?.forecastBuckets || [];

  const quoteSummary = quoteFunnelData?.data?.summary;
  const quoteFunnel = quoteFunnelData?.data?.funnel || [];
  const quoteItems = quoteFunnelData?.data?.items || [];
  const topCustomers = quoteFunnelData?.data?.topCustomers || [];
  const topSectors = quoteFunnelData?.data?.topSectors || [];

  // -------- Goal --------

  const currentMetricDef = metricDef(analysis.metric);
  const goalMetric = goalMetricFor(analysis.metric);

  const defaultGoal = useDefaultGoal({
    metric: goalMetric ?? GOAL_METRIC.INVOICES_PAID,
    period:
      startDate && endDate
        ? { from: startDate, to: endDate }
        : null,
    aggregation:
      xMode === 'year' && currentMetricDef.unit === 'currency' ? 'TOTAL' : 'AVERAGE_PER_PERIOD',
    periodMode: 'calendar',
    enabled: !yearCompareMode && goalMetric != null && analysis.dimension === 'periodo',
  });

  const goalValue = goalMetric != null && analysis.dimension === 'periodo'
    ? (goalOverride ?? defaultGoal.value)
    : null;
  const goalSource: 'override' | 'default' | 'none' =
    goalOverride != null ? 'override' : defaultGoal.value != null ? 'default' : 'none';

  // -------- Loading / error state aggregation --------

  const isLoading = collectionLoading || receivablesLoading || quoteFunnelLoading;
  const isError = collectionError || receivablesIsError || quoteFunnelError;
  const error = collectionErr || receivablesErr || quoteFunnelErr;
  const refetch = useCallback(() => {
    refetchCollection();
    refetchReceivables();
    refetchQuoteFunnel();
  }, [refetchCollection, refetchReceivables, refetchQuoteFunnel]);

  // -------- Forecast buckets --------

  const bucketByKey = useMemo(() => {
    const m: Record<string, ForecastPeriodBucket> = {};
    forecastBuckets.forEach(b => { m[b.bucket] = b; });
    return m;
  }, [forecastBuckets]);

  const periodBuckets = useMemo(
    () => forecastBuckets.filter(b => /^P\d+$/.test(b.bucket)),
    [forecastBuckets],
  );

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

  // Narrow the chart filter to a single period (year + month) given the
  // period label as it appears on the chart x-axis (e.g., "Abril 2026").
  // Used by both X-axis clicks and card clicks like "Maior Período".
  const narrowToPeriod = useCallback((periodLabel: string) => {
    if (!periodLabel) return;
    const match = items.find(i => i.periodLabel === periodLabel);
    if (!match) {
      // Could be a future forecast bucket — try opening its installment list.
      const fb = forecastBuckets.find(b => b.bucketLabel === periodLabel);
      if (fb && fb.installmentCount > 0) {
        setOpenBucket(fb);
      } else {
        toast.info('Sem dados detalhados para este período.');
      }
      return;
    }
    const [year, month] = match.period.split('-');
    if (year) setSelectedYears([year]);
    if (month) setSelectedMonths([month]);
    setXMode('month');
  }, [items, forecastBuckets]);

  const handleChartPointClick = useCallback((_idx: number, name: string) => {
    if (analysis.dimension !== 'periodo') return;
    narrowToPeriod(name);
  }, [analysis.dimension, narrowToPeriod]);

  // -------- Active filter count + period summary --------

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (scope.customerIds?.length) n++;
    if (scope.sectorIds?.length) n++;
    if (scope.invoiceStatus?.length) n++;
    if (scope.quoteStatus?.length) n++;
    const cy = new Date().getFullYear().toString();
    const isDefaultYear = selectedYears.length === 1 && selectedYears[0] === cy;
    const isDefaultMonths = selectedMonths.length === 0;
    if (!(isDefaultYear && isDefaultMonths)) n++;
    return n;
  }, [scope, selectedYears, selectedMonths]);

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

  // -------- Main chart: aggregate items into display buckets (Por Período) --------

  type Bucket = {
    period: string;
    name: string;
    invoicedAmount: number;
    paidAmount: number;
    overdueAmount: number;
    collectionRate: number;
    // Quote-side metrics, if available (matched by period key)
    settledValue?: number;
    newQuotes?: number;
    settledQuotes?: number;
  };

  const displayBuckets: Bucket[] = useMemo(() => {
    if (!items.length) return [];

    const quoteItemsByPeriod = new Map<string, typeof quoteItems[0]>();
    quoteItems.forEach(q => quoteItemsByPeriod.set(q.period, q));

    const reduce = (rows: typeof items, name: string, periodKey?: string): Bucket => {
      const inv = rows.reduce((s, r) => s + r.invoicedAmount, 0);
      const paid = rows.reduce((s, r) => s + r.paidAmount, 0);
      const over = rows.reduce((s, r) => s + r.overdueAmount, 0);
      const q = periodKey ? quoteItemsByPeriod.get(periodKey) : undefined;
      return {
        period: periodKey ?? name,
        name,
        invoicedAmount: Math.round(inv * 100) / 100,
        paidAmount: Math.round(paid * 100) / 100,
        overdueAmount: Math.round(over * 100) / 100,
        collectionRate: inv > 0 ? Math.round((paid / inv) * 1000) / 10 : 0,
        settledValue: q?.settledValue,
        newQuotes: q?.newQuotes,
        settledQuotes: q?.settledQuotes,
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
      return Array.from(byYear.keys()).sort().map(y => reduce(byYear.get(y)!, y.toString(), y.toString()));
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
            result.push(reduce([row], `${MONTH_OPTIONS[m - 1]?.label} ${y}`, row.period));
          }
        }
      }
      return result;
    }

    return items
      .slice()
      .sort((a, b) => a.period.localeCompare(b.period))
      .map(it => reduce([it], it.periodLabel, it.period));
  }, [items, quoteItems, xMode, yearCompareMode, selectedYears, selectedMonths]);

  const perPeriodGoalValues = useMemo(() => {
    if (goalOverride != null || yearCompareMode || goalMetric == null || analysis.dimension !== 'periodo' || !defaultGoal.perPeriodValues) return null;
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
  }, [goalOverride, yearCompareMode, goalMetric, analysis.dimension, defaultGoal.perPeriodValues, displayBuckets, xMode]);

  // -------- Per-period chart data (responds to Métrica) --------

  // Picks the right per-period field per metric. Aggregate-only metrics (dso,
  // backlog, taxa-conversao, ticket-medio, ciclo) don't have a per-period
  // series — they return 0 here and the chart will be flat (caller should
  // pick a non-period dimension or accept the empty chart).
  const pickPerPeriod = useCallback((b: Bucket, metric: MetricKey): number => {
    switch (metric) {
      case 'faturado':         return b.invoicedAmount;
      case 'recebido':         return b.paidAmount;
      case 'em-atraso':        return b.overdueAmount;
      case 'qtd-parcelas':     return 0;
      case 'taxa-recebimento': return b.collectionRate;
      case 'liquidado':        return b.settledValue ?? 0;
      case 'qtd-orcamentos':   return b.newQuotes ?? 0;
      case 'dso':
      case 'backlog':
      case 'taxa-conversao':
      case 'ticket-medio':
      case 'ciclo':
        return 0;
    }
  }, []);

  const periodChartData = useMemo(() => {
    if (!displayBuckets.length) return [];
    return displayBuckets.map(b => ({ name: b.name, value: pickPerPeriod(b, analysis.metric) }));
  }, [displayBuckets, analysis.metric, pickPerPeriod]);

  const isComparisonMode = false;

  // -------- Per-metric stats (sum/avg/max across active periods) --------

  const metricStats = useMemo(() => {
    const series = displayBuckets.map(b => ({ name: b.name, value: pickPerPeriod(b, analysis.metric) }));
    const nonZero = series.filter(s => s.value !== 0);
    const sum = series.reduce((s, x) => s + x.value, 0);
    const maxItem = series.reduce<{ name: string; value: number }>(
      (acc, x) => (x.value > acc.value ? x : acc),
      { name: '-', value: -Infinity },
    );
    const minItem = nonZero.length
      ? nonZero.reduce((acc, x) => (x.value < acc.value ? x : acc), nonZero[0])
      : null;
    const avg = nonZero.length ? sum / nonZero.length : 0;
    return {
      sum,
      avg,
      max: maxItem.value === -Infinity ? { name: '-', value: 0 } : maxItem,
      min: minItem,
      activeCount: nonZero.length,
      totalCount: series.length,
    };
  }, [displayBuckets, analysis.metric, pickPerPeriod]);

  // -------- Funnel chart options --------

  // Status-da-fatura funnel: Faturado → Boletos → Recebido → Pendente (from collection).
  const invoiceFunnelOption = useMemo(() => {
    if (!revenueFunnel) return {};
    const data = [
      { name: 'Faturado',         value: revenueFunnel.invoiced },
      { name: 'Boletos Emitidos', value: revenueFunnel.billed },
      { name: 'Recebido',         value: revenueFunnel.collected },
      { name: 'Pendente',         value: revenueFunnel.outstanding },
    ];
    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.textColor },
        formatter: (p: { name: string; value: number }) => `<strong>${p.name}</strong><br/>${formatCurrency(p.value)}`,
      },
      // Shared funnel progression so both funnels read with the same language.
      color: FUNNEL_STAGE_COLORS,
      series: [{
        type: 'funnel' as const,
        left: '5%', right: '5%', top: 20, bottom: 30,
        sort: 'descending' as const,
        gap: 4,
        label: {
          show: true,
          position: 'inside' as const,
          formatter: (p: { name: string; value: number }) => `${p.name}\n${formatCurrency(p.value)}`,
          fontSize: 11,
          color: '#fff',
        },
        data,
      }],
    };
  }, [revenueFunnel, theme]);

  // Estágio-do-orçamento funnel: 8 sales stages.
  const quoteFunnelOption = useMemo(() => {
    if (!quoteFunnel.length) return {};
    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.textColor },
        formatter: (p: { dataIndex: number }) => {
          const stage = quoteFunnel[p.dataIndex];
          if (!stage) return '';
          return `<strong>${stage.stageLabel}</strong><br/>
            Quantidade: ${formatNumber(stage.count, 0)}<br/>
            Valor: ${formatCurrency(stage.totalValue)}<br/>
            Conversão da etapa anterior: ${formatPercentage(stage.conversionFromPrevious)}<br/>
            % do total: ${formatPercentage(stage.conversionFromTop)}`;
        },
      },
      color: FUNNEL_STAGE_COLORS,
      series: [{
        type: 'funnel' as const,
        left: '5%', right: '5%', top: 20, bottom: 30,
        sort: 'descending' as const,
        gap: 4,
        label: {
          show: true,
          position: 'inside' as const,
          formatter: (p: { dataIndex: number }) => {
            const s = quoteFunnel[p.dataIndex];
            return s ? `${s.stageLabel}\n${formatNumber(s.count, 0)} · ${formatCurrency(s.totalValue)}` : '';
          },
          fontSize: 11,
          color: '#fff',
        },
        data: quoteFunnel.map(s => ({ name: s.stageLabel, value: s.count || 1 })),
      }],
    };
  }, [quoteFunnel, theme]);

  // -------- Pie / Donut option builders (Por Status / Setor) --------

  const buildPieOption = useCallback((
    data: Array<{ name: string; value: number }>,
    radius: [string, string],
    valueFmt: (v: number) => string,
  ) => ({
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      textStyle: { color: theme.textColor },
      formatter: (p: { name: string; value: number; percent?: number }) =>
        `<strong>${p.name}</strong><br/>${valueFmt(p.value)}<br/>${formatPercentage(p.percent ?? 0)}`,
    },
    color: CHART_COLORS,
    legend: {
      orient: 'vertical' as const,
      right: 8,
      top: 'middle' as const,
      fontSize: 12,
      textStyle: { color: theme.textColor },
    },
    series: [{
      type: 'pie' as const,
      radius,
      center: ['35%', '50%'],
      avoidLabelOverlap: true,
      label: { show: false },
      data,
    }],
  }), [theme]);

  // -------- Horizontal bar option (Por Cliente / Setor) --------

  const buildHbarOption = useCallback((
    categories: string[],
    series: Array<{ name: string; data: number[] }>,
    valueFmt: (v: number) => string,
    extraTooltip?: (idx: number) => string,
  ) => ({
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      textStyle: { color: theme.textColor },
      formatter: (params: Array<{ dataIndex: number; seriesName: string; value: number }>) => {
        if (!Array.isArray(params) || !params.length) return '';
        const idx = params[0].dataIndex;
        const extra = extraTooltip ? extraTooltip(idx) : '';
        const lines = params.map(p => `${p.seriesName}: ${valueFmt(p.value)}`);
        return `<strong>${categories[idx]}</strong><br/>${lines.join('<br/>')}${extra ? '<br/>' + extra : ''}`;
      },
    },
    grid: { left: '3%', right: '8%', bottom: '4%', top: 30, containLabel: true },
    xAxis: {
      type: 'value' as const,
      axisLabel: {
        formatter: (v: number) => valueFmt(v).replace('R$', '').trim(),
        fontSize: 12,
        color: theme.subTextColor,
      },
      axisLine: { lineStyle: { color: theme.axisLineColor } },
      splitLine: { lineStyle: { color: theme.gridLineColor } },
    },
    yAxis: {
      type: 'category' as const,
      inverse: true,
      data: categories.map(c => c.length > 30 ? c.slice(0, 28) + '…' : c),
      axisLabel: { fontSize: 12, color: theme.textColor },
      axisLine: { lineStyle: { color: theme.axisLineColor } },
    },
    // First/third palette entries (blue/emerald) — same hues as before, but
    // sourced from the shared palette instead of hardcoded.
    color: [CHART_COLORS[0], CHART_COLORS[2]],
    series: series.map(s => ({
      name: s.name,
      type: 'bar' as const,
      data: s.data,
      itemStyle: { borderRadius: [0, 4, 4, 0] as [number, number, number, number] },
    })),
    legend: { top: 0, fontSize: 12, textStyle: { color: theme.textColor } },
  }), [theme]);

  // -------- Top customers chart options (Por Cliente) --------

  const topCustomersOption = useMemo(() => {
    if (!topCustomers.length) return {};
    const top = topCustomers.slice(0, 10);
    return buildHbarOption(
      top.map(c => c.customerName),
      [
        { name: 'Orçado',    data: top.map(c => c.totalValue) },
        { name: 'Liquidado', data: top.map(c => c.settledValue) },
      ],
      formatCurrency,
      (idx) => {
        const c = top[idx];
        return `Orçamentos: ${formatNumber(c.quoteCount, 0)} · Conversão: ${formatPercentage(c.conversionRate)}`;
      },
    );
  }, [topCustomers, buildHbarOption]);

  const topSectorsPieOption = useMemo(() => {
    if (!topSectors.length) return {};
    return buildPieOption(
      topSectors.map(s => ({ name: s.sectorName, value: s.totalValue })),
      ['40%', '70%'],
      formatCurrency,
    );
  }, [topSectors, buildPieOption]);

  // -------- Dimension-driven main chart options --------

  // For Status da Fatura — pie / donut / hbar data
  const invoiceStatusData = useMemo(() => {
    if (!revenueFunnel) return [];
    return [
      { name: 'Faturado',         value: revenueFunnel.invoiced },
      { name: 'Boletos Emitidos', value: revenueFunnel.billed },
      { name: 'Recebido',         value: revenueFunnel.collected },
      { name: 'Pendente',         value: revenueFunnel.outstanding },
    ];
  }, [revenueFunnel]);

  // For Estágio do Orçamento — depending on metric
  const quoteStageData = useMemo(() => {
    if (!quoteFunnel.length) return [];
    return quoteFunnel.map(s => {
      let value = s.count;
      if (analysis.metric === 'liquidado') value = s.totalValue;
      if (analysis.metric === 'ciclo') value = s.avgDaysFromCreation;
      return { name: s.stageLabel, value };
    });
  }, [quoteFunnel, analysis.metric]);

  // For Por Cliente — value depends on metric
  const customerRankingData = useMemo(() => {
    if (!topCustomers.length) return { categories: [], series: [] as Array<{ name: string; data: number[] }> };
    const top = topCustomers.slice(0, 10);
    if (analysis.metric === 'qtd-orcamentos') {
      return {
        categories: top.map(c => c.customerName),
        series: [{ name: 'Orçamentos', data: top.map(c => c.quoteCount) }],
      };
    }
    if (analysis.metric === 'taxa-conversao') {
      return {
        categories: top.map(c => c.customerName),
        series: [{ name: 'Conversão (%)', data: top.map(c => c.conversionRate) }],
      };
    }
    return {
      categories: top.map(c => c.customerName),
      series: [
        { name: 'Orçado',    data: top.map(c => c.totalValue) },
        { name: 'Liquidado', data: top.map(c => c.settledValue) },
      ],
    };
  }, [topCustomers, analysis.metric]);

  // For Por Setor — value depends on metric
  const sectorRankingData = useMemo(() => {
    if (!topSectors.length) return [];
    if (analysis.metric === 'qtd-orcamentos') {
      return topSectors.map(s => ({ name: s.sectorName, value: s.quoteCount }));
    }
    if (analysis.metric === 'liquidado') {
      return topSectors.map(s => ({ name: s.sectorName, value: s.settledValue }));
    }
    return topSectors.map(s => ({ name: s.sectorName, value: s.totalValue }));
  }, [topSectors, analysis.metric]);

  // -------- Main chart render --------

  const renderMainChart = () => {
    const chartHeightStyle = { height: '100%' };

    if (isLoading) {
      return (
        <div style={chartHeightStyle} className="flex items-center justify-center">
          <div className="space-y-3"><Skeleton className="h-4 w-[250px]" /><Skeleton className="h-[380px] w-[600px]" /></div>
        </div>
      );
    }

    if (isError) {
      return (
        <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
          <IconAlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
          <div className="text-center"><p className="font-semibold">Erro ao carregar dados</p><p className="text-sm text-foreground/70">{error?.message || 'Erro'}</p></div>
          <Button onClick={() => refetch()} variant="outline"><IconRefresh className="mr-2 h-4 w-4" /> Tentar novamente</Button>
        </div>
      );
    }

    // -------- Por Período --------
    if (analysis.dimension === 'periodo') {
      if (!periodChartData.length) {
        return (
          <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
            <IconCalendarStats className="h-12 w-12 text-foreground/50" />
            <div className="text-center"><p className="font-semibold">Nenhum dado encontrado</p><p className="text-sm text-foreground/70">Ajuste os filtros para visualizar os dados.</p></div>
          </div>
        );
      }
      const unit = currentMetricDef.unit;
      const yAxisMode = metricYAxisMode(unit);
      const valueFmt = (v: number, mode: YAxisMode) => {
        if (mode === 'percentage') return `${v.toFixed(1)}%`;
        if (mode === 'value') return formatCurrency(v);
        return formatNumber(v, 0);
      };
      return (
        <StatisticsChart
          data={periodChartData}
          chartType={analysis.chartType as StatisticsChartType}
          yAxisMode={yAxisMode}
          isComparisonMode={isComparisonMode}
          height="100%"
          yAxisLabel={unit === 'currency' ? 'Valor (R$)' : unit === 'percent' ? 'Taxa (%)' : unit === 'days' ? 'Dias' : 'Qtd'}
          valueFormatter={valueFmt}
          trendLine={trendLine}
          goalLine={goalValue != null && !perPeriodGoalValues?.some(v => v != null) ? { value: goalValue, label: 'Meta Cobrança' } : null}
          perPeriodGoalLine={perPeriodGoalValues?.some(v => v != null) ? { values: perPeriodGoalValues, label: 'Meta Cobrança' } : null}
          tooltipLabels={{ primary: currentMetricDef.label }}
          onDataPointClick={handleChartPointClick}
        />
      );
    }

    // -------- Por Status da Fatura --------
    if (analysis.dimension === 'status-fatura') {
      if (!invoiceStatusData.length) {
        return (
          <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
            <IconReceipt className="h-12 w-12 text-foreground/50" />
            <div className="text-center"><p className="font-semibold">Sem dados de funil de faturas</p><p className="text-sm text-foreground/70">Ajuste os filtros para visualizar os dados.</p></div>
          </div>
        );
      }
      if (analysis.chartType === 'funnel') {
        return <div style={chartHeightStyle}><ReactECharts option={invoiceFunnelOption} style={{ height: '100%' }} /></div>;
      }
      if (analysis.chartType === 'pie') {
        return <div style={chartHeightStyle}><ReactECharts option={buildPieOption(invoiceStatusData, ['0%', '70%'], formatCurrency)} style={{ height: '100%' }} /></div>;
      }
      if (analysis.chartType === 'donut') {
        return <div style={chartHeightStyle}><ReactECharts option={buildPieOption(invoiceStatusData, ['40%', '70%'], formatCurrency)} style={{ height: '100%' }} /></div>;
      }
      // hbar
      return <div style={chartHeightStyle}><ReactECharts
        option={buildHbarOption(
          invoiceStatusData.map(d => d.name),
          [{ name: currentMetricDef.label, data: invoiceStatusData.map(d => d.value) }],
          formatCurrency,
        )}
        style={{ height: '100%' }}
      /></div>;
    }

    // -------- Por Estágio do Orçamento --------
    if (analysis.dimension === 'status-orcamento') {
      if (!quoteStageData.length) {
        return (
          <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
            <IconChartArcs3 className="h-12 w-12 text-foreground/50" />
            <div className="text-center"><p className="font-semibold">Sem dados de funil de orçamentos</p><p className="text-sm text-foreground/70">Ajuste os filtros para visualizar os dados.</p></div>
          </div>
        );
      }
      const valueFmt = (v: number) => formatByUnit(v, currentMetricDef.unit);
      if (analysis.chartType === 'funnel') {
        return <div style={chartHeightStyle}><ReactECharts option={quoteFunnelOption} style={{ height: '100%' }} /></div>;
      }
      if (analysis.chartType === 'pie') {
        return <div style={chartHeightStyle}><ReactECharts option={buildPieOption(quoteStageData, ['0%', '70%'], valueFmt)} style={{ height: '100%' }} /></div>;
      }
      if (analysis.chartType === 'donut') {
        return <div style={chartHeightStyle}><ReactECharts option={buildPieOption(quoteStageData, ['40%', '70%'], valueFmt)} style={{ height: '100%' }} /></div>;
      }
      // hbar
      return <div style={chartHeightStyle}><ReactECharts
        option={buildHbarOption(
          quoteStageData.map(d => d.name),
          [{ name: currentMetricDef.label, data: quoteStageData.map(d => d.value) }],
          valueFmt,
        )}
        style={{ height: '100%' }}
      /></div>;
    }

    // -------- Por Cliente --------
    if (analysis.dimension === 'cliente') {
      if (!customerRankingData.categories.length) {
        return (
          <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
            <IconUsers className="h-12 w-12 text-foreground/50" />
            <div className="text-center"><p className="font-semibold">Nenhum cliente com orçamentos no período</p><p className="text-sm text-foreground/70">Ajuste os filtros para visualizar os dados.</p></div>
          </div>
        );
      }
      const valueFmt = (v: number) => formatByUnit(v, currentMetricDef.unit);
      if (analysis.chartType === 'donut') {
        return <div style={chartHeightStyle}><ReactECharts
          option={buildPieOption(
            customerRankingData.categories.map((name, i) => ({
              name,
              value: customerRankingData.series[0]?.data[i] ?? 0,
            })),
            ['40%', '70%'],
            valueFmt,
          )}
          style={{ height: '100%' }}
        /></div>;
      }
      return <div style={chartHeightStyle}><ReactECharts
        option={buildHbarOption(
          customerRankingData.categories,
          customerRankingData.series,
          valueFmt,
        )}
        style={{ height: '100%' }}
      /></div>;
    }

    // -------- Por Setor --------
    if (analysis.dimension === 'setor') {
      if (!sectorRankingData.length) {
        return (
          <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
            <IconBuilding className="h-12 w-12 text-foreground/50" />
            <div className="text-center"><p className="font-semibold">Nenhum setor com dados no período</p><p className="text-sm text-foreground/70">Ajuste os filtros para visualizar os dados.</p></div>
          </div>
        );
      }
      const valueFmt = (v: number) => formatByUnit(v, currentMetricDef.unit);
      if (analysis.chartType === 'pie') {
        return <div style={chartHeightStyle}><ReactECharts option={buildPieOption(sectorRankingData, ['0%', '70%'], valueFmt)} style={{ height: '100%' }} /></div>;
      }
      if (analysis.chartType === 'hbar') {
        return <div style={chartHeightStyle}><ReactECharts
          option={buildHbarOption(
            sectorRankingData.map(d => d.name),
            [{ name: currentMetricDef.label, data: sectorRankingData.map(d => d.value) }],
            valueFmt,
          )}
          style={{ height: '100%' }}
        /></div>;
      }
      // donut default
      return <div style={chartHeightStyle}><ReactECharts option={buildPieOption(sectorRankingData, ['40%', '70%'], valueFmt)} style={{ height: '100%' }} /></div>;
    }

    return null;
  };

  // -------- Exports --------

  const handleExportCSV = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const headers = ['Período', 'Faturado (R$)', 'Recebido (R$)', 'Taxa de Recebimento (%)', 'Em Atraso (R$)', 'Receita Liquidada (R$)', 'Orçamentos'];
      const rows = items.map(i => {
        const q = quoteItems.find(qi => qi.period === i.period);
        return [
          i.periodLabel,
          i.invoicedAmount.toFixed(2),
          i.paidAmount.toFixed(2),
          i.collectionRate.toFixed(1),
          i.overdueAmount.toFixed(2),
          (q?.settledValue ?? 0).toFixed(2),
          q?.newQuotes ?? 0,
        ];
      });
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `visao-financeira-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('CSV exportado');
    } catch { toast.error('Erro ao exportar CSV'); }
  }, [items, quoteItems]);

  const handleExportXLSX = useCallback(() => {
    if (!items.length && !quoteItems.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Cobranças por período
      if (items.length) {
        const headers = ['Período', 'Faturado (R$)', 'Recebido (R$)', 'Taxa de Recebimento (%)', 'Em Atraso (R$)'];
        const rows = items.map(i => [i.periodLabel, i.invoicedAmount, i.paidAmount, i.collectionRate, i.overdueAmount]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws['!cols'] = headers.map((_, idx) => ({ wch: idx === 0 ? 22 : 18 }));
        XLSX.utils.book_append_sheet(wb, ws, 'Cobranças');
      }

      // Sheet 2: Previsão de Caixa
      if (periodBuckets.length) {
        const fHeaders = ['Período', 'Vencimentos (R$)', 'Parcelas'];
        const fRows = periodBuckets.map(b => [b.bucketLabel, b.dueAmount, b.installmentCount]);
        const fws = XLSX.utils.aoa_to_sheet([fHeaders, ...fRows]);
        fws['!cols'] = fHeaders.map((_, idx) => ({ wch: idx === 0 ? 22 : 18 }));
        XLSX.utils.book_append_sheet(wb, fws, 'Previsão de Caixa');
      }

      // Sheet 3: Receita & Orçamentos por período
      if (quoteItems.length) {
        const qHeaders = ['Período', 'Criados', 'Aprovados', 'Faturados', 'Liquidados', 'Valor Orçado (R$)', 'Valor Liquidado (R$)'];
        const qRows = quoteItems.map(q => [q.periodLabel, q.newQuotes, q.approvedQuotes, q.billedQuotes, q.settledQuotes, q.totalValue, q.settledValue]);
        const qws = XLSX.utils.aoa_to_sheet([qHeaders, ...qRows]);
        qws['!cols'] = qHeaders.map((_, idx) => ({ wch: idx === 0 ? 22 : 16 }));
        XLSX.utils.book_append_sheet(wb, qws, 'Receita & Orçamentos');
      }

      // Sheet 4: Funil de Vendas
      if (quoteFunnel.length) {
        const sHeaders = ['Estágio', 'Quantidade', 'Valor Total (R$)', 'Conv. Anterior (%)', '% do Total', 'Dias Médios'];
        const sRows = quoteFunnel.map(s => [s.stageLabel, s.count, s.totalValue, s.conversionFromPrevious, s.conversionFromTop, s.avgDaysFromCreation]);
        const sws = XLSX.utils.aoa_to_sheet([sHeaders, ...sRows]);
        sws['!cols'] = sHeaders.map((_, idx) => ({ wch: idx === 0 ? 26 : 16 }));
        XLSX.utils.book_append_sheet(wb, sws, 'Funil de Vendas');
      }

      // Sheet 5: Top Clientes
      if (topCustomers.length) {
        const cHeaders = ['Cliente', 'Orçamentos', 'Valor Orçado (R$)', 'Valor Liquidado (R$)', 'Conversão (%)'];
        const cRows = topCustomers.map(c => [c.customerName, c.quoteCount, c.totalValue, c.settledValue, c.conversionRate]);
        const cws = XLSX.utils.aoa_to_sheet([cHeaders, ...cRows]);
        cws['!cols'] = cHeaders.map((_, idx) => ({ wch: idx === 0 ? 32 : 16 }));
        XLSX.utils.book_append_sheet(wb, cws, 'Top Clientes');
      }

      // Sheet 6: Top Setores
      if (topSectors.length) {
        const tHeaders = ['Setor', 'Orçamentos', 'Valor Orçado (R$)', 'Valor Liquidado (R$)'];
        const tRows = topSectors.map(s => [s.sectorName, s.quoteCount, s.totalValue, s.settledValue]);
        const tws = XLSX.utils.aoa_to_sheet([tHeaders, ...tRows]);
        tws['!cols'] = tHeaders.map((_, idx) => ({ wch: idx === 0 ? 28 : 16 }));
        XLSX.utils.book_append_sheet(wb, tws, 'Top Setores');
      }

      XLSX.writeFile(wb, `visao-financeira-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`);
      toast.success('XLSX exportado');
    } catch { toast.error('Erro ao exportar XLSX'); }
  }, [items, periodBuckets, quoteItems, quoteFunnel, topCustomers, topSectors]);

  // -------- Chart-type label (dimensão-aware) --------

  const currentChartTypeOption = useMemo(() => {
    const fromDim = availableChartTypes(analysis.dimension);
    return fromDim.find(o => o.value === analysis.chartType) ?? fromDim[0];
  }, [analysis.dimension, analysis.chartType]);

  // Show trend / goal controls only for time series.
  const showTrendControl = analysis.dimension === 'periodo';
  const showGoalControl = analysis.dimension === 'periodo' && goalMetric != null;

  // -------- Summary cards (3-4 cards, all describing the active metric) --------

  const summaryCards: CardSpec[] = useMemo(() => {
    const totalSettledQuotes = quoteItems.reduce((s, q) => s + q.settledQuotes, 0);
    const totalApprovedQuotes = quoteItems.reduce((s, q) => s + q.approvedQuotes, 0);
    const totalBilledQuotes = quoteItems.reduce((s, q) => s + q.billedQuotes, 0);
    const totalNewQuotes = quoteItems.reduce((s, q) => s + q.newQuotes, 0);
    const totalOpenInstallments = (paidBucket?.installmentCount ?? 0) + (allBucket?.installmentCount ?? 0);
    const overdueCount = bucketByKey['OVERDUE']?.installmentCount ?? 0;
    const pendingNonOverdue = (allBucket?.installmentCount ?? 0) - overdueCount;

    const periodMaxLabel = metricStats.max.value > 0 ? metricStats.max.name : '—';
    const periodMinLabel = metricStats.min && metricStats.min.value > 0 ? metricStats.min.name : '—';
    const activeOfTotal = `${metricStats.activeCount} de ${metricStats.totalCount} períodos`;
    const cycleSettled = quoteFunnel.find(s => s.stage === 'SETTLED');

    const peakClick = metricStats.max.value > 0 && metricStats.max.name !== '-'
      ? () => narrowToPeriod(metricStats.max.name)
      : undefined;
    const minItem = metricStats.min;
    const minClick = minItem && minItem.value > 0
      ? () => narrowToPeriod(minItem.name)
      : undefined;

    switch (analysis.metric) {
      case 'faturado':
        return [
          { key: 'total',  icon: IconReceipt,        label: 'Total Faturado',     value: formatCurrency(metricStats.sum),     hint: activeOfTotal,                           loading: collectionLoading },
          { key: 'peak',   icon: IconTrendingUp,     label: 'Maior Período',      value: formatCurrency(metricStats.max.value), hint: periodMaxLabel,                        loading: collectionLoading, onClick: peakClick },
          { key: 'avg',    icon: IconCalendarStats,  label: 'Faturamento Médio',  value: formatCurrency(metricStats.avg),     hint: 'Por período ativo',                   loading: collectionLoading },
          { key: 'count',  icon: IconChartArcs3,     label: 'Períodos com Mov.',  value: formatNumber(metricStats.activeCount, 0), hint: 'Com faturamento > 0',           loading: collectionLoading },
        ];
      case 'recebido':
        return [
          { key: 'total', icon: IconCash,           label: 'Total Recebido',     value: formatCurrency(metricStats.sum),     hint: activeOfTotal,                            loading: collectionLoading, tone: 'success', onClick: paidBucket?.installmentCount ? () => openBucketByKey('PAID') : undefined },
          { key: 'peak',  icon: IconTrendingUp,     label: 'Maior Período',      value: formatCurrency(metricStats.max.value), hint: periodMaxLabel,                         loading: collectionLoading, onClick: peakClick },
          { key: 'avg',   icon: IconCalendarStats,  label: 'Recebido Médio',     value: formatCurrency(metricStats.avg),     hint: 'Por período ativo',                    loading: collectionLoading },
          { key: 'count', icon: IconReceipt,        label: 'Parcelas Pagas',     value: formatNumber(paidBucket?.installmentCount ?? 0, 0), hint: 'Liquidações no período',  loading: receivablesLoading, onClick: paidBucket?.installmentCount ? () => openBucketByKey('PAID') : undefined },
        ];
      case 'em-atraso':
        return [
          { key: 'total',     icon: IconAlertTriangle, label: 'Total Em Atraso',      value: formatCurrency(receivablesSummary?.totalOverdue ?? 0), hint: 'Saldo vencido agora',          loading: receivablesLoading, tone: 'danger', onClick: overdueCount ? () => openBucketByKey('OVERDUE') : undefined },
          { key: 'count',     icon: IconReceipt,       label: 'Parcelas Atrasadas',  value: formatNumber(overdueCount, 0),                       hint: 'Vencidas em aberto',              loading: receivablesLoading, onClick: overdueCount ? () => openBucketByKey('OVERDUE') : undefined },
          { key: 'rate',      icon: IconChartArcs3,    label: 'Inadimplência',        value: formatPercentage(collectionSummary?.overdueRate ?? 0), hint: '% do total a receber em atraso', loading: collectionLoading },
          { key: 'peak',      icon: IconTrendingUp,    label: 'Maior Período',        value: formatCurrency(metricStats.max.value),               hint: periodMaxLabel,                    loading: collectionLoading, onClick: peakClick },
        ];
      case 'taxa-recebimento':
        return [
          { key: 'rate',      icon: IconChartArcs3,    label: 'Taxa Geral',        value: formatPercentage(collectionSummary?.collectionRate ?? 0), hint: 'Recebido ÷ faturado',         loading: collectionLoading },
          { key: 'best',      icon: IconTrendingUp,    label: 'Melhor Período',    value: formatPercentage(metricStats.max.value),                hint: periodMaxLabel,                 loading: collectionLoading, onClick: peakClick },
          { key: 'worst',     icon: IconAlertTriangle, label: 'Pior Período',      value: formatPercentage(metricStats.min?.value ?? 0),          hint: periodMinLabel,                 loading: collectionLoading, onClick: minClick },
          { key: 'active',    icon: IconCalendarStats, label: 'Períodos Ativos',   value: formatNumber(metricStats.activeCount, 0),               hint: 'Com movimentação',             loading: collectionLoading },
        ];
      case 'dso':
        return [
          { key: 'dso',       icon: IconClock,         label: 'Prazo Médio',           value: `${formatNumber(receivablesSummary?.avgDso ?? 0, 0)} dias`, hint: 'Da emissão ao pagamento', loading: receivablesLoading },
          { key: 'customers', icon: IconUsers,         label: 'Clientes com Saldo',    value: formatNumber(receivablesSummary?.activeCustomers ?? 0, 0), hint: 'Em aberto neste momento',  loading: receivablesLoading },
          { key: 'open',      icon: IconReceipt,       label: 'Parcelas em Aberto',    value: formatNumber(allBucket?.installmentCount ?? 0, 0),         hint: 'Aguardando pagamento',     loading: receivablesLoading, onClick: allBucket?.installmentCount ? () => openBucketByKey('ALL') : undefined },
        ];
      case 'qtd-parcelas':
        return [
          { key: 'total',   icon: IconReceipt,        label: 'Total de Parcelas', value: formatNumber(totalOpenInstallments, 0),                  hint: 'Pagas + em aberto',            loading: receivablesLoading },
          { key: 'paid',    icon: IconCash,           label: 'Pagas',             value: formatNumber(paidBucket?.installmentCount ?? 0, 0),      hint: 'Liquidadas',                   loading: receivablesLoading, tone: 'success', onClick: paidBucket?.installmentCount ? () => openBucketByKey('PAID') : undefined },
          { key: 'pending', icon: IconClock,          label: 'No Prazo',          value: formatNumber(Math.max(0, pendingNonOverdue), 0),         hint: 'Em aberto, não vencidas',      loading: receivablesLoading },
          { key: 'overdue', icon: IconAlertTriangle,  label: 'Em Atraso',         value: formatNumber(overdueCount, 0),                           hint: 'Vencidas',                     loading: receivablesLoading, tone: 'danger', onClick: overdueCount ? () => openBucketByKey('OVERDUE') : undefined },
        ];
      case 'liquidado':
        return [
          { key: 'total', icon: IconReportMoney,    label: 'Total Liquidado',       value: formatCurrency(quoteSummary?.totalSettledValue ?? 0),  hint: 'Receita efetiva no período', loading: quoteFunnelLoading, tone: 'success' },
          { key: 'peak',  icon: IconTrendingUp,     label: 'Maior Período',         value: formatCurrency(metricStats.max.value),                 hint: periodMaxLabel,                loading: quoteFunnelLoading, onClick: peakClick },
          { key: 'avg',   icon: IconCalendarStats,  label: 'Liquidação Média',      value: formatCurrency(metricStats.avg),                       hint: 'Por período ativo',           loading: quoteFunnelLoading },
          { key: 'count', icon: IconChartArcs3,     label: 'Orçamentos Liquidados', value: formatNumber(totalSettledQuotes, 0),                   hint: 'Fecharam no período',         loading: quoteFunnelLoading },
        ];
      case 'backlog': {
        const settledStage = quoteFunnel.find(s => s.stage === 'SETTLED');
        const settledQuoteCount = settledStage?.count ?? totalSettledQuotes;
        const pipelineCount = Math.max(0, (quoteSummary?.totalQuotes ?? 0) - settledQuoteCount);
        return [
          { key: 'value', icon: IconLayoutGrid,    label: 'Backlog Ativo',           value: formatCurrency(quoteSummary?.activeBacklogValue ?? 0), hint: 'Receita prevista no funil', loading: quoteFunnelLoading },
          { key: 'count', icon: IconChartArcs3,    label: 'Orçamentos no Pipeline',  value: formatNumber(pipelineCount, 0),                        hint: 'Ainda não liquidados',      loading: quoteFunnelLoading },
          { key: 'cycle', icon: IconClock,         label: 'Tempo Médio no Funil',    value: `${formatNumber(quoteSummary?.avgSalesCycleDays ?? 0, 1)} dias`, hint: 'Da criação à liquidação', loading: quoteFunnelLoading },
          { key: 'ticket',icon: IconCalendarStats, label: 'Ticket Médio',            value: formatCurrency(quoteSummary?.avgTicket ?? 0),          hint: 'Por orçamento liquidado',   loading: quoteFunnelLoading },
        ];
      }
      case 'taxa-conversao': {
        const conv = quoteSummary?.conversionRate ?? 0;
        return [
          { key: 'rate',    icon: IconChartArcs3,    label: 'Taxa de Conversão', value: formatPercentage(conv),                      hint: 'Liquidados ÷ criados', loading: quoteFunnelLoading },
          { key: 'created', icon: IconReceipt,       label: 'Orçamentos Criados', value: formatNumber(totalNewQuotes, 0),             hint: 'No período',           loading: quoteFunnelLoading },
          { key: 'settled', icon: IconReportMoney,   label: 'Orçamentos Liquidados', value: formatNumber(totalSettledQuotes, 0),     hint: 'Fecharam no período',  loading: quoteFunnelLoading, tone: 'success' },
          { key: 'cycle',   icon: IconClock,         label: 'Ciclo Médio',        value: `${formatNumber(quoteSummary?.avgSalesCycleDays ?? 0, 1)} dias`, hint: 'Tempo para fechar',    loading: quoteFunnelLoading },
        ];
      }
      case 'ticket-medio':
        return [
          { key: 'ticket', icon: IconCalendarStats,  label: 'Ticket Médio',       value: formatCurrency(quoteSummary?.avgTicket ?? 0),         hint: 'Por orçamento liquidado',    loading: quoteFunnelLoading },
          { key: 'count',  icon: IconReceipt,        label: 'Orçamentos',         value: formatNumber(quoteSummary?.totalQuotes ?? 0, 0),       hint: 'No período',                 loading: quoteFunnelLoading },
          { key: 'total',  icon: IconReportMoney,    label: 'Total Liquidado',    value: formatCurrency(quoteSummary?.totalSettledValue ?? 0), hint: 'Receita efetiva',            loading: quoteFunnelLoading, tone: 'success' },
          { key: 'cycle',  icon: IconClock,          label: 'Ciclo Médio',        value: `${formatNumber(quoteSummary?.avgSalesCycleDays ?? 0, 1)} dias`, hint: 'Tempo para fechar',       loading: quoteFunnelLoading },
        ];
      case 'ciclo':
        return [
          { key: 'cycle',  icon: IconClock,          label: 'Ciclo Médio',        value: `${formatNumber(quoteSummary?.avgSalesCycleDays ?? 0, 1)} dias`, hint: 'Da criação à liquidação', loading: quoteFunnelLoading },
          { key: 'count',  icon: IconReportMoney,    label: 'Orçamentos Liquidados', value: formatNumber(cycleSettled?.count ?? totalSettledQuotes, 0), hint: 'Base do cálculo',         loading: quoteFunnelLoading },
          { key: 'ticket', icon: IconCalendarStats,  label: 'Ticket Médio',       value: formatCurrency(quoteSummary?.avgTicket ?? 0),         hint: 'Por liquidação',             loading: quoteFunnelLoading },
          { key: 'conv',   icon: IconChartArcs3,     label: 'Taxa de Conversão',  value: formatPercentage(quoteSummary?.conversionRate ?? 0),  hint: 'Liquidados ÷ criados',       loading: quoteFunnelLoading },
        ];
      case 'qtd-orcamentos':
        return [
          { key: 'created', icon: IconReceipt,       label: 'Criados',     value: formatNumber(totalNewQuotes, 0),       hint: 'Novos orçamentos',  loading: quoteFunnelLoading },
          { key: 'approved',icon: IconChartArcs3,    label: 'Aprovados',   value: formatNumber(totalApprovedQuotes, 0),  hint: 'Aprovados pelo cliente', loading: quoteFunnelLoading },
          { key: 'billed',  icon: IconCash,          label: 'Faturados',   value: formatNumber(totalBilledQuotes, 0),    hint: 'Já faturados',      loading: quoteFunnelLoading },
          { key: 'settled', icon: IconReportMoney,   label: 'Liquidados',  value: formatNumber(totalSettledQuotes, 0),   hint: 'Receita efetiva',   loading: quoteFunnelLoading, tone: 'success' },
        ];
    }
  }, [
    analysis.metric, metricStats, collectionSummary, receivablesSummary, quoteSummary, quoteFunnel,
    collectionLoading, receivablesLoading, quoteFunnelLoading,
    paidBucket, allBucket, bucketByKey, quoteItems, openBucketByKey, narrowToPeriod,
  ]);

  // -------- Render --------

  void compareMode; // reserved for future per-customer multi-series support

  if (isError && !collectionData && !receivablesData && !quoteFunnelData) {
    return (
      <div className="h-full flex flex-col px-4 pt-4">
        <PageHeader
          title="Visão Financeira"
          icon={IconReportMoney}
          favoritePage={FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO_COBRANCAS}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Financeiro', href: routes.statistics.financial.root },
            { label: 'Visão Geral' },
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
      <div className="h-full flex flex-col px-4 pt-4 pb-4">
        <div className="flex-shrink-0">
          <PageHeader
            title="Visão Financeira"
            icon={IconReportMoney}
            favoritePage={FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO_COBRANCAS}
            breadcrumbs={[
              { label: 'Início', href: routes.home },
              { label: 'Estatísticas', href: routes.statistics.root },
              { label: 'Financeiro', href: routes.statistics.financial.root },
              { label: 'Visão Geral' },
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

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2" disabled={isLoading || (!items.length && !quoteItems.length)}>
                      <IconDownload className="h-4 w-4" /> Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={handleExportCSV}><IconFileTypeCsv className="h-4 w-4 mr-2" /> CSV dos Dados</DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleExportXLSX}><IconFileTypeXls className="h-4 w-4 mr-2" /> Excel (XLSX)</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            }
          />
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto pb-4 min-h-0">
          <Card className="mt-4 flex-1 flex flex-col min-h-0">
            <CardHeader className="flex-shrink-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <IconCash className="h-5 w-5 text-primary" />
                    {periodSummaryLabel || 'Visão Financeira'}
                  </CardTitle>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Chart type — options filtered by dimensão */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        {currentChartTypeOption && <currentChartTypeOption.icon className="h-4 w-4" />}
                        {currentChartTypeOption?.label ?? 'Gráfico'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>Tipo de gráfico</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={analysis.chartType}
                        onValueChange={v => setAnalysis(prev => ({ ...prev, chartType: v as ChartTypeKey }))}
                      >
                        {availableChartTypes(analysis.dimension).map(opt => (
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

                  {showTrendControl && (
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

                  {showGoalControl && goalMetric != null && (
                    <GoalMetaPopover
                      value={goalValue}
                      defaultValue={defaultGoal.value}
                      source={goalSource}
                      onOverride={setGoalOverride}
                      unit={GOAL_METRIC_UNIT[goalMetric]}
                    />
                  )}

                  <Button
                    variant={activeFilterCount > 0 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowFilters(true)}
                    className="gap-2"
                  >
                    <IconFilter className="h-4 w-4" /> Filtros
                    {activeFilterCount > 0 && <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-5 flex-1 min-h-0">
              {/* ===== Summary strip — cards describing the active metric from different angles ===== */}
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 flex-shrink-0">
                {summaryCards?.map((c) => {
                  const valueTone =
                    c.tone === 'success'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : c.tone === 'danger'
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-foreground';
                  return (
                    <Card
                      key={c.key}
                      className={c.onClick ? 'cursor-pointer transition-colors hover:bg-muted/50' : ''}
                      onClick={c.onClick}
                      role={c.onClick ? 'button' : undefined}
                      tabIndex={c.onClick ? 0 : undefined}
                      onKeyDown={c.onClick ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          c.onClick?.();
                        }
                      } : undefined}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                          <c.icon className="h-3.5 w-3.5" /> {c.label}
                          {c.tooltip && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex"><IconInfoCircle className="h-3 w-3 text-foreground/50" /></span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[260px]">{c.tooltip}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {c.loading ? (
                          <Skeleton className="h-7 w-24 mt-1" />
                        ) : (
                          <div className={`text-xl font-bold mt-0.5 ${valueTone}`}>{c.value}</div>
                        )}
                        <div className="text-[11px] text-foreground/70 mt-0.5">{c.hint}</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* ===== Main chart (dimension-aware) ===== */}
              <Card className="flex-1 flex flex-col min-h-[480px]">
                <CardHeader className="pb-2 flex-shrink-0">
                  <CardTitle className="text-base">
                    {DIMENSION_OPTIONS.find(d => d.value === analysis.dimension)?.label}
                    {' · '}
                    {currentMetricDef.label}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {DIMENSION_OPTIONS.find(d => d.value === analysis.dimension)?.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2 flex-1 min-h-0">
                  {renderMainChart()}
                </CardContent>
              </Card>

              {/* ===== Estágios do Funil — detail table (quote-funnel only) ===== */}
              {(currentMetricDef.source === 'quote-funnel' || analysis.dimension === 'status-orcamento') && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <IconChartArcs3 className="h-4 w-4 text-primary" /> Estágios do Funil — Detalhe
                  </CardTitle>
                  <CardDescription className="text-xs text-foreground/70">
                    Conversão entre etapas e tempo médio desde a criação do orçamento.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[360px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Estágio</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead className="text-right">Conv. Anterior</TableHead>
                          <TableHead className="text-right">% do Total</TableHead>
                          <TableHead className="text-right">Dias Médios</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quoteFunnelLoading ? (
                          <TableRow><TableCell colSpan={6}><Skeleton className="h-32 w-full" /></TableCell></TableRow>
                        ) : quoteFunnel.length > 0 ? quoteFunnel.map(s => (
                          <TableRow key={s.stage}>
                            <TableCell className="font-medium text-foreground">{s.stageLabel}</TableCell>
                            <TableCell className="text-right text-foreground/85">{formatNumber(s.count, 0)}</TableCell>
                            <TableCell className="text-right text-foreground/85">{formatCurrency(s.totalValue)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={s.conversionFromPrevious >= 75 ? 'completed' : s.conversionFromPrevious >= 40 ? 'pending' : 'red'}>
                                {formatPercentage(s.conversionFromPrevious)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-foreground/70">{formatPercentage(s.conversionFromTop)}</TableCell>
                            <TableCell className="text-right text-foreground/85">{formatNumber(s.avgDaysFromCreation, 1)}</TableCell>
                          </TableRow>
                        )) : (
                          <TableRow><TableCell colSpan={6} className="text-center text-sm text-foreground/60 py-6">Sem dados</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
              )}

              {/* ===== Top Clientes + Receita por Setor (dimension/source-aware) ===== */}
              {(() => {
                const showCustomers = analysis.dimension === 'cliente' || currentMetricDef.source === 'quote-funnel';
                const showSectors = analysis.dimension === 'setor' || currentMetricDef.source === 'quote-funnel';
                if (!showCustomers && !showSectors) return null;
                const both = showCustomers && showSectors;
                return (
                  <div className={both ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'}>
                    {showCustomers && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <IconUsers className="h-4 w-4 text-primary" /> Top 10 Clientes
                          </CardTitle>
                          <CardDescription className="text-xs text-foreground/70">
                            Comparativo entre valor total orçado e valor efetivamente liquidado.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-2">
                          {quoteFunnelLoading ? (
                            <Skeleton className="h-[420px] w-full" />
                          ) : topCustomers.length > 0 ? (
                            <ReactECharts option={topCustomersOption} style={{ height: 420 }} />
                          ) : (
                            <div className="h-[420px] flex items-center justify-center text-sm text-foreground/65">
                              Nenhum cliente com orçamentos no período.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {showSectors && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <IconBuilding className="h-4 w-4 text-primary" /> Receita por Setor
                          </CardTitle>
                          <CardDescription className="text-xs text-foreground/70">
                            Distribuição do valor orçado por setor das tarefas.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-2">
                          {quoteFunnelLoading ? (
                            <Skeleton className="h-[420px] w-full" />
                          ) : topSectors.length > 0 ? (
                            <ReactECharts option={topSectorsPieOption} style={{ height: 420 }} />
                          ) : (
                            <div className="h-[420px] flex items-center justify-center text-sm text-foreground/65">
                              Nenhum setor com orçamentos no período.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        <FilterSheet
          open={showFilters}
          onOpenChange={setShowFilters}
          scope={scope}
          analysis={analysis}
          xMode={xMode}
          compareMode={compareMode}
          selectedYears={selectedYears}
          selectedMonths={selectedMonths}
          yearCompareMode={yearCompareMode}
          onApply={({ scope: s, analysis: a, xMode: x, compareMode: c, years, months, yearCompareMode: yc }) => {
            setScope(s);
            setAnalysis(a);
            setXMode(x);
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

export default FinancialOverviewPage;
