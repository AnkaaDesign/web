// web/src/pages/production/statistics/bottlenecks.tsx

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
import { DateTimeInput } from '@/components/ui/date-time-input';
import { Combobox } from '@/components/ui/combobox';
import { routes } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useProductionBottlenecks } from '@/hooks/production/use-production-analytics';
import type { ProductionAnalyticsFilters } from '@/types/production-analytics';
import { StatisticsChart } from '@/components/statistics/statistics-chart';
import { formatNumber, formatPercentage } from '@/types/statistics-common';
import type { YAxisMode } from '@/types/statistics-common';
import { getSectors } from '@/api-client/sector';
import { sectorKeys } from '@/hooks/common/query-keys';
import {
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconCalendarStats,
  IconArrowsSort,
  IconBuilding,
  IconCalendar,
  IconNumbers,
  IconX,
  IconGauge,
  IconClock,
  IconAlertTriangle,
  IconCut,
  IconTrendingDown,
  IconTrendingUp,
} from '@tabler/icons-react';
import { format, startOfDay, endOfDay, subMonths } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// =====================
// Constants
// =====================

const COMBOBOX_PAGE_SIZE = 20;

// =====================
// Filter Sheet Component (inline)
// =====================

interface BottleneckFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Omit<ProductionAnalyticsFilters, 'customerIds' | 'periods'>;
  onApply: (filters: Omit<ProductionAnalyticsFilters, 'customerIds' | 'periods'>) => void;
  onReset: () => void;
}

function BottleneckFilters({
  open,
  onOpenChange,
  filters,
  onApply,
  onReset: _onReset,
}: BottleneckFiltersProps) {
  const [localFilters, setLocalFilters] = useState<Omit<ProductionAnalyticsFilters, 'customerIds' | 'periods'>>(filters);

  // Sync local state when drawer opens or filters change
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  // Async query functions for comboboxes
  const fetchSectors = useCallback(async (search: string, page: number = 1) => {
    const response = await getSectors({
      searchingFor: search || undefined,
      page,
      limit: COMBOBOX_PAGE_SIZE,
    });
    return {
      data: (response.data || []).map((sector) => ({
        value: sector.id,
        label: sector.name,
      })),
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localFilters.sectorIds && localFilters.sectorIds.length > 0) count++;
    return count;
  }, [localFilters]);

  const handleApply = useCallback(() => {
    onApply(localFilters);
    onOpenChange(false);
  }, [localFilters, onApply, onOpenChange]);

  const handleClear = useCallback(() => {
    const defaultFilters: Omit<ProductionAnalyticsFilters, 'customerIds' | 'periods'> = {
      startDate: startOfDay(subMonths(new Date(), 1)),
      endDate: endOfDay(new Date()),
      sortBy: 'count',
      sortOrder: 'desc',
      limit: 50,
    };
    setLocalFilters(defaultFilters);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Gargalos - Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para refinar a análise de gargalos
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Limit */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconNumbers className="h-4 w-4" />
                Número de Resultados
              </Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={localFilters.limit || 50}
                onChange={(value: string | number | null) => {
                  const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseInt(value) || 50 : 50);
                  setLocalFilters({
                    ...localFilters,
                    limit: numValue,
                  });
                }}
                placeholder="50"
                className="bg-transparent"
              />
            </div>

            {/* Date Range Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconCalendar className="h-4 w-4" />
                Período
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                  <DateTimeInput
                    mode="date"
                    value={localFilters.startDate}
                    onChange={(date) => {
                      if (date && date instanceof Date) {
                        setLocalFilters({
                          ...localFilters,
                          startDate: startOfDay(date),
                        });
                      }
                    }}
                    hideLabel
                    placeholder="Selecionar data inicial..."
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                  <DateTimeInput
                    mode="date"
                    value={localFilters.endDate}
                    onChange={(date) => {
                      if (date && date instanceof Date) {
                        setLocalFilters({
                          ...localFilters,
                          endDate: endOfDay(date),
                        });
                      }
                    }}
                    hideLabel
                    placeholder="Selecionar data final..."
                  />
                </div>
              </div>
            </div>

            {/* Sectors Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconBuilding className="h-4 w-4" />
                Setores
              </Label>
              <Combobox
                mode="multiple"
                async
                value={localFilters.sectorIds || []}
                onValueChange={(value) => setLocalFilters({
                  ...localFilters,
                  sectorIds: Array.isArray(value) && value.length > 0 ? value : undefined,
                })}
                queryKey={[...sectorKeys.lists()]}
                queryFn={fetchSectors}
                minSearchLength={0}
                placeholder="Selecione setores..."
                searchPlaceholder="Buscar setor..."
                emptyText="Nenhum setor encontrado"
                loadingText="Carregando setores..."
                searchable={true}
                clearable={true}
              />
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            <IconX className="h-4 w-4 mr-2" />
            Limpar Tudo
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
// Main Page Component
// =====================

const BottlenecksPage = () => {
  usePageTracker({
    page: 'production-bottlenecks-analytics',
    title: 'Análise de Gargalos',
  });

  // Filter drawer state
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<Omit<ProductionAnalyticsFilters, 'customerIds' | 'periods'>>({
    startDate: startOfDay(subMonths(new Date(), 1)),
    endDate: endOfDay(new Date()),
    sortBy: 'count',
    sortOrder: 'desc',
    limit: 50,
  });

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.sectorIds && filters.sectorIds.length > 0) count++;
    return count;
  }, [filters]);

  // Fetch data
  const { data, isLoading, isError, error, refetch } = useProductionBottlenecks(filters);

  const summary = data?.data?.summary;
  const stageDistribution = data?.data?.stageDistribution || [];
  const garageUtilization = data?.data?.garageUtilization || [];
  const recutTrend = data?.data?.recutTrend || [];

  // Handle filter apply
  const handleFilterApply = useCallback((newFilters: Omit<ProductionAnalyticsFilters, 'customerIds' | 'periods'>) => {
    const updatedFilters = {
      ...newFilters,
      limit: newFilters.limit || 50,
    };
    setFilters(updatedFilters);
  }, []);

  // Handle filter reset
  const handleFilterReset = useCallback(() => {
    const defaultFilters: Omit<ProductionAnalyticsFilters, 'customerIds' | 'periods'> = {
      startDate: startOfDay(subMonths(new Date(), 1)),
      endDate: endOfDay(new Date()),
      sortBy: 'count',
      sortOrder: 'desc',
      limit: 50,
    };
    setFilters(defaultFilters);
  }, []);

  // Handle sort change
  const handleSortChange = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder,
    }));
  }, []);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    if (!stageDistribution || stageDistribution.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    try {
      const headers = ['Etapa', 'Quantidade', 'Média de Dias'];

      const rows = stageDistribution.map((item) => [
        item.stageLabel || '',
        (item.count ?? 0).toString(),
        (item.avgDays ?? 0).toFixed(1),
      ]);

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `gargalos-producao-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();

      toast.success('Dados exportados com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      toast.error('Erro ao exportar dados');
    }
  }, [stageDistribution]);

  // Prepare chart data for Stage Distribution (bar chart)
  const stageChartData = useMemo(() => {
    if (!stageDistribution || stageDistribution.length === 0) return [];
    return stageDistribution.map((item) => ({
      name: item.stageLabel,
      value: item.count,
      secondaryValue: item.avgDays,
    }));
  }, [stageDistribution]);

  // Prepare chart data for Garage Utilization (area chart)
  const garageChartData = useMemo(() => {
    if (!garageUtilization || garageUtilization.length === 0) return [];
    return garageUtilization.map((item) => ({
      name: item.periodLabel,
      value: item.utilizationPercent,
    }));
  }, [garageUtilization]);

  // Prepare chart data for Recut Trend (line chart)
  const recutChartData = useMemo(() => {
    if (!recutTrend || recutTrend.length === 0) return [];
    return recutTrend.map((item) => ({
      name: item.periodLabel,
      value: item.recutRate,
    }));
  }, [recutTrend]);

  // Value formatters
  const countFormatter = useCallback((value: number, _mode: YAxisMode): string => {
    return Math.round(value).toString();
  }, []);

  const percentageFormatter = useCallback((value: number, _mode: YAxisMode): string => {
    return `${value.toFixed(1)}%`;
  }, []);

  // Render loading state
  const renderLoadingChart = () => (
    <div className="h-[400px] flex items-center justify-center">
      <div className="space-y-3">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-[300px] w-[500px]" />
      </div>
    </div>
  );

  // Render error state
  const renderErrorState = () => (
    <div className="h-[400px] flex flex-col items-center justify-center gap-4">
      <IconAlertCircle className="h-12 w-12 text-destructive" />
      <div className="text-center">
        <p className="font-semibold">Erro ao carregar dados</p>
        <p className="text-sm text-muted-foreground">
          {error?.message || 'Ocorreu um erro ao buscar os dados'}
        </p>
      </div>
      <Button onClick={() => refetch()} variant="outline">
        <IconRefresh className="mr-2 h-4 w-4" />
        Tentar Novamente
      </Button>
    </div>
  );

  // Render empty state
  const renderEmptyState = () => (
    <div className="h-[400px] flex flex-col items-center justify-center gap-4">
      <IconCalendarStats className="h-12 w-12 text-muted-foreground" />
      <div className="text-center">
        <p className="font-semibold">Nenhum dado encontrado</p>
        <p className="text-sm text-muted-foreground">
          Tente ajustar os filtros para visualizar os dados
        </p>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Análise de Gargalos"
          icon={IconAlertTriangle}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Produção', href: routes.statistics.production.root },
            { label: 'Gargalos' },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Análise de Gargalos</CardTitle>
                  <CardDescription>
                    Identifique gargalos na produção, utilização de barracões e tendências de recorte
                  </CardDescription>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Sort Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <IconArrowsSort className="h-4 w-4 mr-2" />
                        Ordenar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleSortChange('count', 'desc')}>
                        <IconTrendingDown className="h-4 w-4 mr-2" />
                        Quantidade (maior primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('count', 'asc')}>
                        <IconTrendingUp className="h-4 w-4 mr-2" />
                        Quantidade (menor primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('avgDays', 'desc')}>
                        <IconClock className="h-4 w-4 mr-2" />
                        Dias na fila (maior primeiro)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSortChange('avgDays', 'asc')}>
                        <IconClock className="h-4 w-4 mr-2" />
                        Dias na fila (menor primeiro)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Filter Button */}
                  <Button
                    variant={activeFilterCount > 0 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowFilterDrawer(true)}
                  >
                    <IconFilter className="h-4 w-4 mr-2" />
                    Filtros
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>

                  {/* Export Button */}
                  <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={isLoading || !stageDistribution.length}>
                    <IconDownload className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-4 space-y-6">
              {/* Summary Cards */}
              {summary && (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Utilização Atual</CardTitle>
                      <IconGauge className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatPercentage(summary.currentUtilization)}</div>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Dias Médios na Fila</CardTitle>
                      <IconClock className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{summary.avgQueueDays.toFixed(1)}</div>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Gargalo Principal</CardTitle>
                      <IconAlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold truncate">{summary.bottleneckStage}</div>
                    </CardContent>
                  </Card>

                  <Card className="py-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                      <CardTitle className="text-xs font-medium">Taxa de Recorte</CardTitle>
                      <IconCut className="h-3.5 w-3.5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pb-0 px-4">
                      <div className="text-xl font-bold">{formatPercentage(summary.recutRate)}</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Stage Distribution Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribuição por Etapa</CardTitle>
                  <CardDescription>Quantidade de tarefas e tempo médio por etapa de produção</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {isLoading ? renderLoadingChart() : isError ? renderErrorState() : stageChartData.length === 0 ? renderEmptyState() : (
                    <StatisticsChart
                      data={stageChartData}
                      chartType="bar"
                      yAxisMode="count"
                      isComparisonMode={false}
                      height="400px"
                      yAxisLabel="Quantidade"
                      valueFormatter={countFormatter}
                      tooltipLabels={{
                        primary: 'Quantidade',
                        secondary: 'Média de Dias',
                      }}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Garage Utilization Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Utilização de Barracões</CardTitle>
                  <CardDescription>Percentual de utilização dos barracões ao longo do tempo</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {isLoading ? renderLoadingChart() : isError ? renderErrorState() : garageChartData.length === 0 ? renderEmptyState() : (
                    <StatisticsChart
                      data={garageChartData}
                      chartType="area"
                      yAxisMode="percentage"
                      isComparisonMode={false}
                      height="400px"
                      yAxisLabel="Utilização (%)"
                      valueFormatter={percentageFormatter}
                      tooltipLabels={{
                        primary: 'Utilização',
                      }}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Recut Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tendência de Recorte</CardTitle>
                  <CardDescription>Taxa de recorte ao longo dos meses</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {isLoading ? renderLoadingChart() : isError ? renderErrorState() : recutChartData.length === 0 ? renderEmptyState() : (
                    <StatisticsChart
                      data={recutChartData}
                      chartType="line"
                      yAxisMode="percentage"
                      isComparisonMode={false}
                      height="400px"
                      yAxisLabel="Taxa de Recorte (%)"
                      valueFormatter={percentageFormatter}
                      tooltipLabels={{
                        primary: 'Taxa de Recorte',
                      }}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Data Table */}
              <Card className="flex-1 flex flex-col">
                <CardHeader>
                  <CardTitle>Detalhamento dos Dados</CardTitle>
                  <CardDescription>
                    {stageDistribution.length > 0
                      ? `Exibindo ${stageDistribution.length} ${stageDistribution.length === 1 ? 'etapa' : 'etapas'}`
                      : 'Nenhuma etapa para exibir'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Etapa</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Média de Dias</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center">
                              Carregando...
                            </TableCell>
                          </TableRow>
                        ) : stageDistribution.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center">
                              Nenhum dado disponível
                            </TableCell>
                          </TableRow>
                        ) : (
                          stageDistribution.map((item, index) => (
                            <TableRow key={item.stage || index}>
                              <TableCell className="font-medium">{item.stageLabel}</TableCell>
                              <TableCell className="text-right">{formatNumber(item.count)}</TableCell>
                              <TableCell className="text-right">{(item.avgDays ?? 0).toFixed(1)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          {/* Filter Drawer */}
          <BottleneckFilters
            open={showFilterDrawer}
            onOpenChange={setShowFilterDrawer}
            filters={filters}
            onApply={handleFilterApply}
            onReset={handleFilterReset}
          />
        </div>
      </div>
    </div>
  );
};

export const ProductionBottlenecksStatisticsPage = () => {
  return <BottlenecksPage />;
};

export default ProductionBottlenecksStatisticsPage;
