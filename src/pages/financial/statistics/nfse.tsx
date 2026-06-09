import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DateTimeInput } from '@/components/ui/date-time-input';
import { Combobox } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
import { routes, FAVORITE_PAGES } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useChartTheme } from '@/hooks/common/use-chart-theme';
import { useNfseAnalytics } from '@/hooks/financial/use-financial-analytics';
import type { NfseAnalyticsFilters } from '@/types/financial-analytics';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import { formatCurrency, formatNumber, formatPercentage } from '@/types/statistics-common';
import type { YAxisMode, StatisticsChartType, TrendLineType } from '@/types/statistics-common';
import ReactECharts from 'echarts-for-react';
import { format, startOfDay, endOfDay, subMonths } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { useStatisticsPagePersistence } from '@/hooks/common/use-statistics-page-persistence';
import { StatisticsPresetsMenu } from '@/components/statistics/statistics-presets-menu';
import {
  IconChartBar,
  IconChartLine,
  IconChartArea,
  IconStack2,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconCalendar,
  IconCalendarStats,
  IconX,
  IconCircleCheck,
  IconAlertTriangle,
  IconFileTypePdf,
  IconFileTypeCsv,
  IconFileTypeXls,
  IconReceipt2,
  IconTrendingUp,
  IconClock,
  IconReload,
  IconCash,
  IconPercentage,
  IconCoin,
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

const NFSE_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendente' },
  { value: 'PROCESSING', label: 'Processando' },
  { value: 'AUTHORIZED', label: 'Autorizada' },
  { value: 'CANCELLED', label: 'Cancelada' },
  { value: 'ERROR', label: 'Erro' },
];

type ChartTypeKey = 'bar' | 'bar-stacked' | 'line' | 'line-smooth' | 'area';
const CHART_TYPE_OPTIONS: Array<{ value: ChartTypeKey; label: string; icon: typeof IconChartBar; description: string }> = [
  { value: 'bar',         label: 'Colunas',            icon: IconChartBar,  description: 'Barras lado a lado' },
  { value: 'bar-stacked', label: 'Colunas Empilhadas', icon: IconStack2,    description: 'Status empilhados por mês' },
  { value: 'line',        label: 'Linha Reta',         icon: IconChartLine, description: 'Linhas retas' },
  { value: 'line-smooth', label: 'Linha Suave',        icon: IconChartLine, description: 'Linhas suavizadas' },
  { value: 'area',        label: 'Área',               icon: IconChartArea, description: 'Área preenchida' },
];

const TREND_LABELS: Record<TrendLineType, string> = {
  linear: 'Linear', sma3: 'Média 3m', sma6: 'Média 6m', sma12: 'Média 12m',
};

const STATUS_COLORS: Record<string, string> = {
  AUTHORIZED: '#10b981',
  PENDING: '#94a3b8',
  PROCESSING: '#3b82f6',
  CANCELLED: '#6b7280',
  ERROR: '#ef4444',
};

// Default colors for the monthly bar series, keyed by series name. Derived
// from STATUS_COLORS so the bar chart and the status pie speak the same color
// language ("Autorizadas" is the same green in both).
const STATUS_SERIES_COLORS: Record<string, string> = {
  Autorizadas: STATUS_COLORS.AUTHORIZED,
  Pendentes: STATUS_COLORS.PENDING,
  Erro: STATUS_COLORS.ERROR,
  Canceladas: STATUS_COLORS.CANCELLED,
};

// =====================
// Page config persistence (last-seen config + named presets)
// =====================
//
// Plain-JSON snapshot of the user-configurable knobs on this page. Dates are
// ISO strings (revived on apply with the default 12-month range as fallback);
// per-field `.catch()` keeps stale stored configs from ever breaking the page.
// `drillDown`, `drillDownSearch` and sheet state are session-only by design.
const pageConfigSchema = z.object({
  version: z.literal(1).catch(1),
  startDate: z.string().catch(''),
  endDate: z.string().catch(''),
  status: z.array(z.string()).catch([]),
  chartType: z.enum(['bar', 'bar-stacked', 'line', 'line-smooth', 'area']).catch('bar-stacked'),
  trendLine: z.enum(['linear', 'sma3', 'sma6', 'sma12']).nullable().catch(null),
});

type PageConfig = z.infer<typeof pageConfigSchema>;

function parseIsoDate(iso: string, fallback: Date): Date {
  if (!iso) return fallback;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? fallback : d;
}

// =====================
// Filter Sheet
// =====================

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: NfseAnalyticsFilters;
  onApply: (f: NfseAnalyticsFilters) => void;
}

function FilterSheet({ open, onOpenChange, filters, onApply }: FilterSheetProps) {
  const [local, setLocal] = useState<NfseAnalyticsFilters>(filters);

  useEffect(() => { if (open) setLocal(filters); }, [open, filters]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (local.status?.length) n++;
    return n;
  }, [local]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-xl border-border/50 flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" /> Filtros — NFS-e
            {activeCount > 0 && <Badge variant="secondary" className="ml-2">{activeCount}</Badge>}
          </SheetTitle>
          <SheetDescription>
            Acompanhe a emissão e o status das notas fiscais de serviço eletrônicas.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm"><IconCalendar className="h-4 w-4" /> Intervalo</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                  <DateTimeInput
                    mode="date"
                    value={local.startDate}
                    onChange={d => d && d instanceof Date && setLocal({ ...local, startDate: startOfDay(d) })}
                    hideLabel
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                  <DateTimeInput
                    mode="date"
                    value={local.endDate}
                    onChange={d => d && d instanceof Date && setLocal({ ...local, endDate: endOfDay(d) })}
                    hideLabel
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm"><IconReceipt2 className="h-4 w-4" /> Status</Label>
              <Combobox
                mode="multiple"
                value={local.status || []}
                onValueChange={v => setLocal({ ...local, status: Array.isArray(v) && v.length ? v : undefined })}
                options={NFSE_STATUS_OPTIONS}
                placeholder="Todos os status"
                searchable={false}
                clearable
              />
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t border-border/50">
          <Button
            variant="outline"
            onClick={() => setLocal({
              startDate: startOfDay(subMonths(new Date(), 12)),
              endDate: endOfDay(new Date()),
            })}
            className="flex-1"
          >
            <IconX className="h-4 w-4 mr-2" /> Limpar
          </Button>
          <Button onClick={() => { onApply(local); onOpenChange(false); }} className="flex-1">Aplicar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =====================
// Page
// =====================

const NfseStatisticsPage = () => {
  usePageTracker({ page: 'financial-nfse-analytics', title: 'NFS-e' });

  const theme = useChartTheme();

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<NfseAnalyticsFilters>({
    startDate: startOfDay(subMonths(new Date(), 12)),
    endDate: endOfDay(new Date()),
  });
  const [chartType, setChartType] = useState<ChartTypeKey>('bar-stacked');
  const [trendLine, setTrendLine] = useState<TrendLineType | null>(null);
  // Seeded with the semantic status colors; the legend's color picker can
  // still override per series.
  const [seriesColors, setSeriesColors] = useState<Record<string, string>>(STATUS_SERIES_COLORS);
  // Drill-down modal: opens when a summary card is clicked. Per-status NFS-e
  // record listings aren't returned by the analytics endpoint yet, so this is
  // a placeholder UI with search + empty state for visual consistency.
  const [drillDown, setDrillDown] = useState<{ title: string; count: number } | null>(null);
  const [drillDownSearch, setDrillDownSearch] = useState('');

  // ── Page config persistence (auto-restore last config + named presets) ──
  const pageConfig = useMemo<PageConfig>(() => ({
    version: 1,
    startDate: filters.startDate ? filters.startDate.toISOString() : '',
    endDate: filters.endDate ? filters.endDate.toISOString() : '',
    status: filters.status ?? [],
    chartType,
    trendLine,
  }), [filters, chartType, trendLine]);

  const applyPageConfig = useCallback((config: PageConfig) => {
    setFilters({
      startDate: parseIsoDate(config.startDate, startOfDay(subMonths(new Date(), 12))),
      endDate: parseIsoDate(config.endDate, endOfDay(new Date())),
      status: config.status.length ? config.status : undefined,
    });
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
    pageKey: routes.statistics.financial.nfse,
    schema: pageConfigSchema,
    current: pageConfig,
    apply: applyPageConfig,
  });

  const { data, isLoading, isError, error, refetch } = useNfseAnalytics(filters);
  const summary = data?.data?.summary;
  const statusDistribution = data?.data?.statusDistribution || [];
  const items = data?.data?.items || [];
  const errorBreakdown = data?.data?.errorBreakdown || [];

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.status?.length) n++;
    return n;
  }, [filters]);

  // Main chart — monthly NFS-e by status (stacked)
  const isComparisonMode = true;
  const chartData = useMemo(() => {
    if (!items.length) return [];
    return items.map(i => ({
      name: i.periodLabel,
      value: i.total,
      comparisons: [
        { entityName: 'Autorizadas',  value: i.authorized },
        { entityName: 'Pendentes',    value: i.pending + i.processing },
        { entityName: 'Erro',         value: i.error },
        { entityName: 'Canceladas',   value: i.cancelled },
      ],
    }));
  }, [items]);

  const valueFormatter = useCallback((value: number) => formatNumber(value, 0), []);

  // Status pie
  const statusOption = useMemo(() => {
    if (!statusDistribution.length) return {} as any;
    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        textStyle: { color: theme.textColor },
        formatter: (p: any) => {
          const s = statusDistribution[p.dataIndex];
          if (!s) return '';
          return `<strong>${s.statusLabel}</strong><br/>Documentos: ${formatNumber(s.count, 0)}<br/>${formatPercentage(p.percent ?? 0)}`;
        },
      },
      legend: { orient: 'vertical' as const, right: 8, top: 'middle' as const, fontSize: 12, textStyle: { color: theme.textColor } },
      series: [{
        type: 'pie' as const,
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        data: statusDistribution.map(s => ({
          name: s.statusLabel,
          value: s.count,
          itemStyle: { color: STATUS_COLORS[s.status] || '#888' },
        })),
      }],
    };
  }, [statusDistribution, theme]);

  const handleExportCSV = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado'); return; }
    try {
      const headers = ['Período', 'Total', 'Autorizadas', 'Pendentes', 'Processando', 'Erro', 'Canceladas'];
      const rows = items.map(i => [i.periodLabel, i.total, i.authorized, i.pending, i.processing, i.error, i.cancelled]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `nfse-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();
      toast.success('CSV exportado');
    } catch { toast.error('Erro ao exportar CSV'); }
  }, [items]);

  const handleExportXLSX = useCallback(() => {
    if (!items.length) { toast.error('Nenhum dado'); return; }
    try {
      const wb = XLSX.utils.book_new();
      const headers = ['Período', 'Total', 'Autorizadas', 'Pendentes', 'Processando', 'Erro', 'Canceladas'];
      const rows = items.map(i => [i.periodLabel, i.total, i.authorized, i.pending, i.processing, i.error, i.cancelled]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((_, idx) => ({ wch: idx === 0 ? 22 : 14 }));
      XLSX.utils.book_append_sheet(wb, ws, 'NFS-e Mensal');
      if (errorBreakdown.length) {
        const eh = ['Mensagem', 'Ocorrências', 'Última'];
        const er = errorBreakdown.map(e => [e.errorMessage, e.count, e.lastOccurred ? format(new Date(e.lastOccurred), 'dd/MM/yyyy HH:mm') : '']);
        const ws2 = XLSX.utils.aoa_to_sheet([eh, ...er]);
        ws2['!cols'] = [{ wch: 60 }, { wch: 14 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Erros');
      }
      XLSX.writeFile(wb, `nfse-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.xlsx`);
      toast.success('XLSX exportado');
    } catch { toast.error('Erro ao exportar XLSX'); }
  }, [items, errorBreakdown]);

  const handleExportPDF = useCallback(async () => { toast.info('Geração de PDF em breve.'); }, []);

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
          <IconAlertCircle className="h-12 w-12 text-destructive" />
          <div className="text-center"><p className="font-semibold">Erro ao carregar dados</p><p className="text-sm text-foreground/70">{error?.message || 'Erro'}</p></div>
          <Button onClick={() => refetch()} variant="outline"><IconRefresh className="mr-2 h-4 w-4" /> Tentar novamente</Button>
        </div>
      );
    }
    if (!chartData.length) {
      return (
        <div style={chartHeightStyle} className="flex flex-col items-center justify-center gap-4">
          <IconCalendarStats className="h-12 w-12 text-foreground/50" />
          <div className="text-center">
            <p className="font-semibold">Nenhum dado encontrado</p>
            <p className="text-sm text-foreground/70">Ajuste os filtros para visualizar os dados.</p>
          </div>
        </div>
      );
    }
    return (
      <StatisticsChart
        data={chartData}
        chartType={chartType as StatisticsChartType}
        yAxisMode={'count' as YAxisMode}
        isComparisonMode={isComparisonMode}
        height="100%"
        yAxisLabel="Documentos"
        valueFormatter={valueFormatter}
        trendLine={trendLine}
        tooltipLabels={{ primary: 'Documentos' }}
        seriesColors={seriesColors}
        onSeriesColorChange={(name, color) => setSeriesColors(prev => ({ ...prev, [name]: color }))}
      />
    );
  };

  const currentChartTypeOption = CHART_TYPE_OPTIONS.find(o => o.value === chartType) ?? CHART_TYPE_OPTIONS[0];

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="NFS-e"
          icon={IconReceipt2}
          favoritePage={FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO_NFSE}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Financeiro', href: routes.statistics.financial.root },
            { label: 'NFS-e' },
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

      <div className="flex-1 overflow-y-auto pb-6">
        <Card className="mt-4">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <IconReceipt2 className="h-5 w-5 text-primary" /> Emissão de Notas Fiscais
                </CardTitle>
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
                    <DropdownMenuItem onSelect={handleExportPDF}><IconFileTypePdf className="h-4 w-4 mr-2" /> PDF do Gráfico</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleExportCSV}><IconFileTypeCsv className="h-4 w-4 mr-2" /> CSV dos Dados</DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleExportXLSX}><IconFileTypeXls className="h-4 w-4 mr-2" /> Excel (XLSX)</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* All KPIs in one row — emissão status (4) + receita & impostos (4). */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 2xl:grid-cols-8 flex-shrink-0">
              <Card
                className={cn(
                  'transition-colors',
                  !isLoading && (summary?.totalDocuments ?? 0) > 0 && 'cursor-pointer hover:bg-muted/50',
                )}
                onClick={!isLoading && (summary?.totalDocuments ?? 0) > 0
                  ? () => setDrillDown({ title: 'Total de NFS-e', count: summary?.totalDocuments ?? 0 })
                  : undefined}
                role={!isLoading && (summary?.totalDocuments ?? 0) > 0 ? 'button' : undefined}
                tabIndex={!isLoading && (summary?.totalDocuments ?? 0) > 0 ? 0 : undefined}
                onKeyDown={e => {
                  if (!isLoading && (summary?.totalDocuments ?? 0) > 0 && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setDrillDown({ title: 'Total de NFS-e', count: summary?.totalDocuments ?? 0 });
                  }
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconReceipt2 className="h-3.5 w-3.5" /> Total de NFS-e
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> :
                    <div className="text-xl font-bold text-foreground mt-0.5">{formatNumber(summary?.totalDocuments ?? 0, 0)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">
                    {(summary?.totalDocuments ?? 0) > 0
                      ? 'Documentos no período'
                      : 'Sem documentos no período'}
                  </div>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  'transition-colors',
                  !isLoading && (summary?.totalAuthorized ?? 0) > 0 && 'cursor-pointer hover:bg-muted/50',
                )}
                onClick={!isLoading && (summary?.totalAuthorized ?? 0) > 0
                  ? () => setDrillDown({ title: 'NFS-e Autorizadas', count: summary?.totalAuthorized ?? 0 })
                  : undefined}
                role={!isLoading && (summary?.totalAuthorized ?? 0) > 0 ? 'button' : undefined}
                tabIndex={!isLoading && (summary?.totalAuthorized ?? 0) > 0 ? 0 : undefined}
                onKeyDown={e => {
                  if (!isLoading && (summary?.totalAuthorized ?? 0) > 0 && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setDrillDown({ title: 'NFS-e Autorizadas', count: summary?.totalAuthorized ?? 0 });
                  }
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconCircleCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" /> Autorizadas
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> :
                    <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{formatNumber(summary?.totalAuthorized ?? 0, 0)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">
                    {formatPercentage(summary?.authorizationRate ?? 0)} do total
                  </div>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  'transition-colors',
                  !isLoading && ((summary?.totalPending ?? 0) + (summary?.totalProcessing ?? 0)) > 0 && 'cursor-pointer hover:bg-muted/50',
                )}
                onClick={!isLoading && ((summary?.totalPending ?? 0) + (summary?.totalProcessing ?? 0)) > 0
                  ? () => setDrillDown({ title: 'NFS-e Pendentes', count: (summary?.totalPending ?? 0) + (summary?.totalProcessing ?? 0) })
                  : undefined}
                role={!isLoading && ((summary?.totalPending ?? 0) + (summary?.totalProcessing ?? 0)) > 0 ? 'button' : undefined}
                tabIndex={!isLoading && ((summary?.totalPending ?? 0) + (summary?.totalProcessing ?? 0)) > 0 ? 0 : undefined}
                onKeyDown={e => {
                  if (!isLoading && ((summary?.totalPending ?? 0) + (summary?.totalProcessing ?? 0)) > 0 && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setDrillDown({ title: 'NFS-e Pendentes', count: (summary?.totalPending ?? 0) + (summary?.totalProcessing ?? 0) });
                  }
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconClock className="h-3.5 w-3.5" /> Pendentes
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> :
                    <div className="text-xl font-bold text-foreground mt-0.5">{formatNumber((summary?.totalPending ?? 0) + (summary?.totalProcessing ?? 0), 0)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">
                    Aguardando envio ou processamento
                  </div>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  'transition-colors',
                  !isLoading && (summary?.totalError ?? 0) > 0 && 'cursor-pointer hover:bg-muted/50',
                )}
                onClick={!isLoading && (summary?.totalError ?? 0) > 0
                  ? () => setDrillDown({ title: 'NFS-e em Erro', count: summary?.totalError ?? 0 })
                  : undefined}
                role={!isLoading && (summary?.totalError ?? 0) > 0 ? 'button' : undefined}
                tabIndex={!isLoading && (summary?.totalError ?? 0) > 0 ? 0 : undefined}
                onKeyDown={e => {
                  if (!isLoading && (summary?.totalError ?? 0) > 0 && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setDrillDown({ title: 'NFS-e em Erro', count: summary?.totalError ?? 0 });
                  }
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconAlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" /> Em Erro
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> :
                    <div className="text-xl font-bold text-red-700 dark:text-red-400 mt-0.5">{formatNumber(summary?.totalError ?? 0, 0)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">
                    {formatPercentage(summary?.errorRate ?? 0)} · {summary?.documentsAtRetryLimit ?? 0} no limite
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconReload className="h-3.5 w-3.5" /> Retentativas Médias
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> :
                    <div className="text-xl font-bold text-foreground mt-0.5">{formatNumber(summary?.avgRetryCount ?? 0, 2)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">
                    Tentativas por documento
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconCash className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" /> Receita Bruta
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-24 mt-1" /> :
                    <div className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(summary?.grossServiceRevenue ?? 0)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">
                    Total faturado em NFS-e
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconPercentage className="h-3.5 w-3.5 text-red-600 dark:text-red-400" /> ISS Estimado
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-24 mt-1" /> :
                    <div className="text-xl font-bold text-red-700 dark:text-red-400 mt-0.5">{formatCurrency(summary?.estimatedIssAmount ?? 0)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">
                    Bruto × {formatNumber(summary?.issRatePercent ?? 2, 1)}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-3 px-4">
                  <div className="text-xs font-medium text-foreground/70 flex items-center gap-1.5">
                    <IconCoin className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" /> Receita Líquida
                  </div>
                  {isLoading ? <Skeleton className="h-7 w-24 mt-1" /> :
                    <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{formatCurrency(summary?.netServiceRevenue ?? 0)}</div>}
                  <div className="text-[11px] text-foreground/70 mt-0.5">
                    Bruto − ISS estimado
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card><CardContent className="p-4" style={{ height: 'max(420px, calc(100vh - 540px))' }}>{renderMainChart()}</CardContent></Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Distribuição por Status</CardTitle>
                  <CardDescription className="text-xs text-foreground/70">Quantas NFS-e estão em cada situação no período.</CardDescription>
                </CardHeader>
                <CardContent className="p-2">
                  {isLoading ? <Skeleton className="h-[380px] w-full" /> : statusDistribution.length > 0 ? (
                    <ReactECharts option={statusOption} style={{ height: 380 }} />
                  ) : (
                    <div className="h-[380px] flex items-center justify-center text-sm text-foreground/65">Sem dados</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <IconAlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" /> Erros mais frequentes
                  </CardTitle>
                  <CardDescription className="text-xs text-foreground/70">Top 20 motivos de rejeição na emissão.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[440px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mensagem</TableHead>
                          <TableHead className="text-right">Ocorrências</TableHead>
                          <TableHead className="text-right">Última</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow><TableCell colSpan={3}><Skeleton className="h-32 w-full" /></TableCell></TableRow>
                        ) : errorBreakdown.length > 0 ? errorBreakdown.map((e, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs text-foreground/85">{e.errorMessage.length > 60 ? e.errorMessage.slice(0, 60) + '…' : e.errorMessage}</TableCell>
                            <TableCell className="text-right text-foreground/85">{formatNumber(e.count, 0)}</TableCell>
                            <TableCell className="text-right text-xs text-foreground/70">
                              {e.lastOccurred ? format(new Date(e.lastOccurred), 'dd/MM/yyyy') : '-'}
                            </TableCell>
                          </TableRow>
                        )) : (
                          <TableRow><TableCell colSpan={3} className="text-center text-sm text-foreground/60 py-6">Sem erros registrados</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>

      <FilterSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        onApply={setFilters}
      />

      {/* Drill-down placeholder modal — the analytics endpoint doesn't return
          per-record listings yet, so this renders a search bar and an empty
          state for UI consistency with other statistics pages. */}
      <Dialog
        open={!!drillDown}
        onOpenChange={(o) => {
          if (!o) {
            setDrillDown(null);
            setDrillDownSearch('');
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconReceipt2 className="h-5 w-5 text-primary" />
              {drillDown?.title}
              {drillDown && (
                <Badge variant="secondary" className="ml-2">{formatNumber(drillDown.count, 0)}</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Lista de NFS-e correspondentes ao status selecionado no período filtrado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <Input
              placeholder="Buscar por número, cliente ou mensagem..."
              value={drillDownSearch}
              onChange={(v) => setDrillDownSearch(v == null ? '' : String(v))}
              className="w-full"
            />
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <IconCalendarStats className="h-12 w-12 text-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">Detalhamento por documento em breve</p>
                <p className="text-xs text-foreground/65 mt-1 max-w-sm">
                  A listagem individual de cada NFS-e ainda não é exposta por esta tela.
                  Por enquanto, consulte a página de NFS-e para o registro completo.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NfseStatisticsPage;
