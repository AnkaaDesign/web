// web/src/pages/inventory/statistics/consumption.tsx

import { useState, useMemo, useCallback, Suspense, lazy } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from '@/constants';
import { usePageTracker } from '@/hooks/common/use-page-tracker';
import { useConsumptionAnalytics, getComparisonType } from '@/hooks/inventory/use-consumption-analytics';
import type { ConsumptionAnalyticsFilters, ConsumptionChartType } from '@/types/consumption-analytics';
import {
  IconChartBar,
  IconChartPie,
  IconChartLine,
  IconFilter,
  IconDownload,
  IconRefresh,
  IconAlertCircle,
  IconTrendingUp,
  IconTrendingDown,
  IconPackage,
  IconCash,
  IconBox,
  IconArrowsSort,
  IconChartArea,
  IconChartDots,
  IconStack2,
  IconRuler,
} from '@tabler/icons-react';

// Y-axis display mode type
type YAxisMode = 'quantity' | 'value';
import { format, startOfDay, endOfDay, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ConsumptionFilters } from '@/components/inventory/statistics/consumption-filters';
import { ACTIVITY_OPERATION } from '@/constants';
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

// Format currency helper
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Color palette for charts
const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#ef4444', // red
];

// Chart type options with context awareness
const getAvailableChartTypes = (isComparisonMode: boolean) => {
  const baseTypes = [
    {
      value: 'bar' as const,
      label: 'Barras',
      icon: IconChartBar,
      description: 'Gráfico de barras vertical',
    },
    {
      value: 'line' as const,
      label: 'Linhas',
      icon: IconChartLine,
      description: 'Gráfico de linhas',
    },
    {
      value: 'area' as const,
      label: 'Área',
      icon: IconChartArea,
      description: 'Gráfico de área',
    },
  ];

  if (isComparisonMode) {
    baseTypes.push({
      value: 'bar-stacked' as const,
      label: 'Barras Empilhadas',
      icon: IconStack2,
      description: 'Barras empilhadas para comparação',
    });
  } else {
    baseTypes.push({
      value: 'pie' as const,
      label: 'Pizza',
      icon: IconChartPie,
      description: 'Gráfico de pizza',
    });
  }

  return baseTypes;
};

const ConsumptionPage = () => {
  usePageTracker({
    page: 'consumption-analytics',
    title: 'Análise de Consumo',
  });

  // Filter drawer state
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Filter state (operation is always OUTBOUND for consumption analysis)
  const [filters, setFilters] = useState<ConsumptionAnalyticsFilters>({
    startDate: startOfDay(subMonths(new Date(), 1)),
    endDate: endOfDay(new Date()),
    operation: ACTIVITY_OPERATION.OUTBOUND, // Consumption = Outbound only
    sortBy: 'quantity',
    sortOrder: 'desc',
    limit: 50,
  });

  // Chart type state
  const [selectedChartType, setSelectedChartType] = useState<ConsumptionChartType>('bar');

  // Y-axis mode state (quantity or value)
  const [yAxisMode, setYAxisMode] = useState<YAxisMode>('quantity');

  // Determine comparison mode
  const comparisonType = useMemo(() => getComparisonType(filters), [filters]);
  const isComparisonMode = comparisonType !== 'simple';

  // Get available chart types based on mode
  const availableChartTypes = useMemo(
    () => getAvailableChartTypes(isComparisonMode),
    [isComparisonMode]
  );

  // Auto-switch chart type if current type becomes unavailable
  useMemo(() => {
    const isCurrentTypeAvailable = availableChartTypes.some(
      (type) => type.value === selectedChartType
    );
    if (!isCurrentTypeAvailable) {
      setSelectedChartType('bar');
    }
  }, [availableChartTypes, selectedChartType]);

  // Count active filters (excluding operation since it's always OUTBOUND for consumption)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.sectorIds && filters.sectorIds.length > 0) count++;
    if (filters.userIds && filters.userIds.length > 0) count++;
    if (filters.itemIds && filters.itemIds.length > 0) count++;
    if (filters.brandIds && filters.brandIds.length > 0) count++;
    if (filters.categoryIds && filters.categoryIds.length > 0) count++;
    if (filters.periods && filters.periods.length >= 2) count++;
    return count;
  }, [filters]);

  // Fetch data
  const { data, isLoading, isError, error, refetch } = useConsumptionAnalytics(filters);

  const items = data?.data?.items || [];
  const summary = data?.data?.summary;
  const mode = data?.data?.mode || 'items';

  // Handle filter apply (ensure operation is always OUTBOUND)
  const handleFilterApply = useCallback((newFilters: ConsumptionAnalyticsFilters) => {
    const updatedFilters = {
      ...newFilters,
      operation: ACTIVITY_OPERATION.OUTBOUND, // Always enforce OUTBOUND for consumption
      // Ensure limit is preserved as a number
      limit: newFilters.limit || 50,
    };
    setFilters(updatedFilters);
  }, []);

  // Handle filter reset
  const handleFilterReset = useCallback(() => {
    const defaultFilters: ConsumptionAnalyticsFilters = {
      startDate: startOfDay(subMonths(new Date(), 1)),
      endDate: endOfDay(new Date()),
      operation: ACTIVITY_OPERATION.OUTBOUND, // Always OUTBOUND for consumption
      sortBy: 'quantity',
      sortOrder: 'desc',
      limit: 50,
    };
    setFilters(defaultFilters);
  }, []);

  // Handle sort change
  const handleSortChange = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters({
      ...filters,
      sortBy: sortBy as 'quantity' | 'value' | 'name',
      sortOrder,
    });
  }, [filters]);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    if (!items || items.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    try {
      const headers = isComparisonMode
        ? ['Item', 'Categoria', 'Marca', 'Quantidade Total', 'Valor Total', 'Preço Médio', 'Estoque Atual', 'Entidades']
        : ['Item', 'Categoria', 'Marca', 'Quantidade', 'Valor Total', 'Preço Médio', 'Estoque Atual', 'Movimentações'];

      const rows = items.map((item) => {
        if ('comparisons' in item) {
          const entities = item.comparisons.map((c) => `${c.entityName}: ${c.quantity}`).join('; ');
          return [
            item.itemName,
            item.categoryName || '-',
            item.brandName || '-',
            item.totalQuantity.toFixed(2),
            item.totalValue.toFixed(2),
            item.averagePrice.toFixed(2),
            item.currentStock.toFixed(2),
            entities,
          ];
        } else {
          return [
            item.itemName,
            item.categoryName || '-',
            item.brandName || '-',
            item.totalQuantity.toFixed(2),
            item.totalValue.toFixed(2),
            item.averagePrice.toFixed(2),
            item.currentStock.toFixed(2),
            item.movementCount.toString(),
          ];
        }
      });

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `consumo-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      link.click();

      toast.success('Dados exportados com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      toast.error('Erro ao exportar dados');
    }
  }, [items, isComparisonMode]);

  // Render chart based on selected type using ECharts
  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="h-[600px] flex items-center justify-center">
          <div className="space-y-3">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-[400px] w-[600px]" />
          </div>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="h-[600px] flex flex-col items-center justify-center gap-4">
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
    }

    if (!items || items.length === 0) {
      return (
        <div className="h-[600px] flex flex-col items-center justify-center gap-4">
          <IconPackage className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-semibold">Nenhum dado encontrado</p>
            <p className="text-sm text-muted-foreground">
              Tente ajustar os filtros para visualizar os dados
            </p>
          </div>
        </div>
      );
    }

    // Prepare chart data
    const chartLimit = Math.min(items.length, filters.limit || 50);
    const chartData = items.slice(0, chartLimit);

    // Calculate if we need dataZoom (more than 8 items)
    const needsScroll = chartData.length > 8;
    const zoomEnd = needsScroll ? (8 / chartData.length) * 100 : 100;

    // Helper to get display value based on Y-axis mode
    const getItemValue = (item: typeof chartData[0]) => {
      if (yAxisMode === 'quantity') {
        return 'totalQuantity' in item ? item.totalQuantity : 0;
      }
      return 'totalValue' in item ? item.totalValue : 0;
    };

    const getComparisonValue = (comp: { quantity: number; value: number }) => {
      return yAxisMode === 'quantity' ? comp.quantity : comp.value;
    };

    const yAxisLabel = yAxisMode === 'quantity' ? 'Quantidade' : 'Preço (R$)';

    const yAxisConfig = yAxisMode === 'value' ? {
      type: 'value' as const,
      axisLabel: {
        formatter: (value: number) => formatCurrency(value).replace('R$', '').trim(),
      },
    } : { type: 'value' as const };

    // PIE CHART
    if (selectedChartType === 'pie' && !isComparisonMode) {
      const pieData = chartData.map((item) => ({
        name: item.itemName,
        value: getItemValue(item),
        totalQuantity: 'totalQuantity' in item ? item.totalQuantity : 0,
        totalValue: 'totalValue' in item ? item.totalValue : 0,
      }));

      const option: EChartsOption = {
        tooltip: {
          trigger: 'item',
          formatter: (params: { name: string; value: number; percent: number; data: { totalQuantity: number; totalValue: number } }) => {
            const qty = Math.round(params.data.totalQuantity);
            const val = formatCurrency(params.data.totalValue);
            return `<strong>${params.name}</strong><br/>Quantidade: ${qty} un<br/>Valor: ${val}<br/>${params.percent}%`;
          },
        },
        legend: {
          bottom: 0,
          left: 'center',
        },
        color: CHART_COLORS,
        series: [
          {
            type: 'pie',
            radius: '60%',
            data: pieData,
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
            label: {
              formatter: (params: { name: string; value: number }) => {
                const formattedValue = yAxisMode === 'quantity'
                  ? Math.round(params.value).toString()
                  : formatCurrency(params.value);
                return `${params.name}: ${formattedValue}`;
              },
            },
          },
        ],
      };

      return <ReactECharts option={option} style={{ height: '600px', width: '100%' }} />;
    }

    // Prepare data for line/area/bar charts
    const xAxisData = chartData.map((item) => item.itemName);

    // LINE CHART
    if (selectedChartType === 'line') {
      if (isComparisonMode && chartData.length > 0 && 'comparisons' in chartData[0]) {
        const entities = chartData[0].comparisons.map((c) => c.entityName);
        const series = entities.map((entity, index) => ({
          name: entity,
          type: 'line' as const,
          data: chartData.map((item) => {
            if ('comparisons' in item) {
              const comp = item.comparisons.find((c) => c.entityName === entity);
              return comp ? getComparisonValue(comp) : 0;
            }
            return 0;
          }),
          smooth: true,
          itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
        }));

        const option: EChartsOption = {
          tooltip: { trigger: 'axis' },
          legend: { data: entities, bottom: 45 },
          grid: { left: '3%', right: '4%', bottom: needsScroll ? '25%' : '12%', containLabel: true },
          xAxis: { type: 'category', data: xAxisData, axisLabel: { rotate: 45, interval: 0 } },
          yAxis: yAxisConfig,
          color: CHART_COLORS,
          dataZoom: needsScroll ? [{ type: 'slider', start: 0, end: zoomEnd, bottom: 10, height: 25 }] : [],
          series,
        };

        return <ReactECharts option={option} style={{ height: '600px', width: '100%' }} />;
      } else {
        const seriesData = chartData.map((item) => getItemValue(item));

        const option: EChartsOption = {
          tooltip: { trigger: 'axis' },
          grid: { left: '3%', right: '4%', bottom: needsScroll ? '25%' : '12%', containLabel: true },
          xAxis: { type: 'category', data: xAxisData, axisLabel: { rotate: 45, interval: 0 } },
          yAxis: yAxisConfig,
          color: CHART_COLORS,
          dataZoom: needsScroll ? [{ type: 'slider', start: 0, end: zoomEnd, bottom: 10, height: 25 }] : [],
          series: [{ name: yAxisLabel, type: 'line', data: seriesData, smooth: true, itemStyle: { color: CHART_COLORS[0] } }],
        };

        return <ReactECharts option={option} style={{ height: '600px', width: '100%' }} />;
      }
    }

    // AREA CHART
    if (selectedChartType === 'area') {
      if (isComparisonMode && chartData.length > 0 && 'comparisons' in chartData[0]) {
        const entities = chartData[0].comparisons.map((c) => c.entityName);
        const series = entities.map((entity, index) => ({
          name: entity,
          type: 'line' as const,
          data: chartData.map((item) => {
            if ('comparisons' in item) {
              const comp = item.comparisons.find((c) => c.entityName === entity);
              return comp ? getComparisonValue(comp) : 0;
            }
            return 0;
          }),
          smooth: true,
          areaStyle: { opacity: 0.6 },
          itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
        }));

        const option: EChartsOption = {
          tooltip: { trigger: 'axis' },
          legend: { data: entities, bottom: 45 },
          grid: { left: '3%', right: '4%', bottom: needsScroll ? '25%' : '12%', containLabel: true },
          xAxis: { type: 'category', data: xAxisData, axisLabel: { rotate: 45, interval: 0 } },
          yAxis: yAxisConfig,
          color: CHART_COLORS,
          dataZoom: needsScroll ? [{ type: 'slider', start: 0, end: zoomEnd, bottom: 10, height: 25 }] : [],
          series,
        };

        return <ReactECharts option={option} style={{ height: '600px', width: '100%' }} />;
      } else {
        const seriesData = chartData.map((item) => getItemValue(item));

        const option: EChartsOption = {
          tooltip: { trigger: 'axis' },
          grid: { left: '3%', right: '4%', bottom: needsScroll ? '25%' : '12%', containLabel: true },
          xAxis: { type: 'category', data: xAxisData, axisLabel: { rotate: 45, interval: 0 } },
          yAxis: yAxisConfig,
          color: CHART_COLORS,
          dataZoom: needsScroll ? [{ type: 'slider', start: 0, end: zoomEnd, bottom: 10, height: 25 }] : [],
          series: [{ name: yAxisLabel, type: 'line', data: seriesData, smooth: true, areaStyle: { opacity: 0.6 }, itemStyle: { color: CHART_COLORS[0] } }],
        };

        return <ReactECharts option={option} style={{ height: '600px', width: '100%' }} />;
      }
    }

    // STACKED BAR CHART
    if (selectedChartType === 'bar-stacked' && isComparisonMode && chartData.length > 0 && 'comparisons' in chartData[0]) {
      const entities = chartData[0].comparisons.map((c) => c.entityName);
      const series = entities.map((entity, index) => ({
        name: entity,
        type: 'bar' as const,
        stack: 'total',
        data: chartData.map((item) => {
          if ('comparisons' in item) {
            const comp = item.comparisons.find((c) => c.entityName === entity);
            return comp ? getComparisonValue(comp) : 0;
          }
          return 0;
        }),
        itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
      }));

      const option: EChartsOption = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { data: entities, bottom: 45 },
        grid: { left: '3%', right: '4%', bottom: needsScroll ? '25%' : '12%', containLabel: true },
        xAxis: { type: 'category', data: xAxisData, axisLabel: { rotate: 45, interval: 0 } },
        yAxis: yAxisConfig,
        color: CHART_COLORS,
        dataZoom: needsScroll ? [{ type: 'slider', start: 0, end: zoomEnd, bottom: 10, height: 25 }] : [],
        series,
      };

      return <ReactECharts option={option} style={{ height: '600px', width: '100%' }} />;
    }

    // BAR CHART (default - grouped or simple)
    if (isComparisonMode && chartData.length > 0 && 'comparisons' in chartData[0]) {
      const entities = chartData[0].comparisons.map((c) => c.entityName);
      const series = entities.map((entity, index) => ({
        name: entity,
        type: 'bar' as const,
        data: chartData.map((item) => {
          if ('comparisons' in item) {
            const comp = item.comparisons.find((c) => c.entityName === entity);
            return {
              value: comp ? getComparisonValue(comp) : 0,
              quantity: comp ? comp.quantity : 0,
              totalValue: comp ? comp.value : 0,
            };
          }
          return { value: 0, quantity: 0, totalValue: 0 };
        }),
        itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
        label: {
          show: true,
          position: 'top',
          fontSize: 9,
          formatter: (params: { data: { value: number } }) => {
            if (params.data.value > 0) {
              return yAxisMode === 'quantity'
                ? Math.round(params.data.value).toString()
                : formatCurrency(params.data.value).replace('R$', '').trim();
            }
            return '';
          },
        },
      }));

      const option: EChartsOption = {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: Array<{ seriesName: string; marker: string; data: { quantity: number; totalValue: number } }>) => {
            if (!Array.isArray(params) || params.length === 0) return '';
            const itemName = xAxisData[params[0].dataIndex as unknown as number] || '';
            let content = `<strong>${itemName}</strong>`;
            params.forEach((p, idx) => {
              const qty = Math.round(p.data.quantity);
              const price = formatCurrency(p.data.totalValue);
              if (idx > 0) content += '<hr style="margin: 8px 0; border: 0; border-top: 1px solid #e5e5e5;"/>';
              content += `<br/>${p.marker} <strong>${p.seriesName}</strong>`;
              content += `<br/>Quantidade: ${qty} un`;
              content += `<br/>Valor: ${price}`;
            });
            return content;
          },
        },
        legend: { data: entities, bottom: 45 },
        grid: { left: '3%', right: '4%', bottom: needsScroll ? '25%' : '12%', containLabel: true },
        xAxis: { type: 'category', data: xAxisData, axisLabel: { rotate: 45, interval: 0 } },
        yAxis: yAxisConfig,
        color: CHART_COLORS,
        dataZoom: needsScroll ? [{ type: 'slider', start: 0, end: zoomEnd, bottom: 10, height: 25 }] : [],
        series,
      };

      return <ReactECharts option={option} style={{ height: '600px', width: '100%' }} />;
    } else {
      const seriesData = chartData.map((item) => ({
        value: getItemValue(item),
        quantity: 'totalQuantity' in item ? item.totalQuantity : 0,
        totalValue: 'totalValue' in item ? item.totalValue : 0,
      }));

      const option: EChartsOption = {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: Array<{ marker: string; data: { quantity: number; totalValue: number }; name: string }>) => {
            if (!Array.isArray(params) || params.length === 0) return '';
            const p = params[0];
            const qty = Math.round(p.data.quantity);
            const price = formatCurrency(p.data.totalValue);
            return `<strong>${p.name}</strong><br/>Quantidade: ${qty} un<br/>Valor: ${price}`;
          },
        },
        grid: { left: '3%', right: '4%', bottom: needsScroll ? '25%' : '12%', containLabel: true },
        xAxis: { type: 'category', data: xAxisData, axisLabel: { rotate: 45, interval: 0 } },
        yAxis: yAxisConfig,
        color: CHART_COLORS,
        dataZoom: needsScroll ? [{ type: 'slider', start: 0, end: zoomEnd, bottom: 10, height: 25 }] : [],
        series: [{
          name: yAxisLabel,
          type: 'bar',
          data: seriesData,
          itemStyle: { color: CHART_COLORS[0] },
          label: {
            show: true,
            position: 'top',
            fontSize: 9,
            formatter: (params: { data: { value: number } }) => {
              if (params.data.value > 0) {
                return yAxisMode === 'quantity'
                  ? Math.round(params.data.value).toString()
                  : formatCurrency(params.data.value).replace('R$', '').trim();
              }
              return '';
            },
          },
        }],
      };

      return <ReactECharts option={option} style={{ height: '600px', width: '100%' }} />;
    }
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Análise de Consumo"
          icon={IconChartBar}
          favoriteKey={FAVORITE_PAGES.STATISTICS_CONSUMPTION}
          breadcrumbs={[
            { label: 'Início', href: routes.home },
            { label: 'Estatísticas', href: routes.statistics.root },
            { label: 'Estoque', href: routes.statistics.inventory.root },
            { label: 'Consumo' },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4">
          <Card className="flex-1 flex flex-col">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Análise de Consumo de Itens</CardTitle>
              <CardDescription>
                Visualize e compare o consumo de itens por período, setor e usuário
                {isComparisonMode && (
                  <Badge variant="secondary" className="ml-2">
                    Modo Comparação: {comparisonType === 'sectors' ? 'Setores' : comparisonType === 'users' ? 'Usuários' : 'Períodos'}
                  </Badge>
                )}
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Chart Type Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {(() => {
                      const currentChartType = availableChartTypes.find((t) => t.value === selectedChartType);
                      const Icon = currentChartType?.icon;
                      return (
                        <>
                          {Icon && <Icon className="h-4 w-4 mr-2" />}
                          {currentChartType?.label}
                        </>
                      );
                    })()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Tipo de Gráfico</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={selectedChartType}
                    onValueChange={(value) => setSelectedChartType(value as ConsumptionChartType)}
                  >
                    {availableChartTypes.map((chartType) => {
                      const ChartIcon = chartType.icon;
                      return (
                        <DropdownMenuRadioItem key={chartType.value} value={chartType.value} className="group">
                          <ChartIcon className="h-4 w-4 mr-2" />
                          <div className="flex flex-col">
                            <span>{chartType.label}</span>
                            <span className="text-xs text-muted-foreground group-data-[highlighted]:text-white/90">{chartType.description}</span>
                          </div>
                        </DropdownMenuRadioItem>
                      );
                    })}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

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
                  <DropdownMenuItem onClick={() => handleSortChange('quantity', 'desc')}>
                    <IconTrendingDown className="h-4 w-4 mr-2" />
                    Quantidade (maior primeiro)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('quantity', 'asc')}>
                    <IconTrendingUp className="h-4 w-4 mr-2" />
                    Quantidade (menor primeiro)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('value', 'desc')}>
                    <IconCash className="h-4 w-4 mr-2" />
                    Valor (maior primeiro)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('value', 'asc')}>
                    <IconCash className="h-4 w-4 mr-2" />
                    Valor (menor primeiro)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('name', 'asc')}>
                    Nome (A-Z)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange('name', 'desc')}>
                    Nome (Z-A)
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
              <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={isLoading || !items.length}>
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
                  <CardTitle className="text-xs font-medium">Total de Itens</CardTitle>
                  <IconPackage className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pb-0 px-4">
                  <div className="text-xl font-bold">{summary.itemCount}</div>
                </CardContent>
              </Card>

              <Card className="py-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                  <CardTitle className="text-xs font-medium">Quantidade Total</CardTitle>
                  <IconBox className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pb-0 px-4">
                  <div className="text-xl font-bold">{summary.totalQuantity.toFixed(2)}</div>
                </CardContent>
              </Card>

              <Card className="py-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                  <CardTitle className="text-xs font-medium">Valor Total</CardTitle>
                  <IconCash className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pb-0 px-4">
                  <div className="text-xl font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.totalValue)}
                  </div>
                </CardContent>
              </Card>

              <Card className="py-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-0 px-4">
                  <CardTitle className="text-xs font-medium">Valor Médio por Item</CardTitle>
                  <IconCash className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pb-0 px-4">
                  <div className="text-xl font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.averageValuePerItem)}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Chart Section */}
          <Card>
            <CardContent className="p-4">
              {renderChart()}
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle>Detalhamento dos Dados</CardTitle>
              <CardDescription>
                {items.length > 0
                  ? `Exibindo ${items.length} ${items.length === 1 ? 'item' : 'itens'}`
                  : 'Nenhum item para exibir'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Marca</TableHead>
                      {isComparisonMode ? (
                        <>
                          <TableHead className="text-right">Quantidade Total</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead>Comparações</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead className="text-right">Preço Médio</TableHead>
                          <TableHead className="text-right">Estoque Atual</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={isComparisonMode ? 6 : 7} className="text-center">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isComparisonMode ? 6 : 7} className="text-center">
                          Nenhum dado disponível
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={item.itemId}>
                          <TableCell className="font-medium">{item.itemName}</TableCell>
                          <TableCell>{item.categoryName || '-'}</TableCell>
                          <TableCell>{item.brandName || '-'}</TableCell>
                          {isComparisonMode && 'comparisons' in item ? (
                            <>
                              <TableCell className="text-right">{item.totalQuantity.toFixed(2)}</TableCell>
                              <TableCell className="text-right">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalValue)}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {item.comparisons.map((comp, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {comp.entityName}: {comp.quantity.toFixed(2)}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="text-right">
                                {'totalQuantity' in item && item.totalQuantity.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                {'totalValue' in item &&
                                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalValue)}
                              </TableCell>
                              <TableCell className="text-right">
                                {'averagePrice' in item &&
                                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.averagePrice)}
                              </TableCell>
                              <TableCell className="text-right">
                                {'currentStock' in item && item.currentStock.toFixed(2)}
                              </TableCell>
                            </>
                          )}
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
      <ConsumptionFilters
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        filters={filters}
        onApply={handleFilterApply}
        onReset={handleFilterReset}
        yAxisMode={yAxisMode}
        onYAxisModeChange={setYAxisMode}
      />
        </div>
      </div>
    </div>
  );
};

// Privilege-protected wrapper
export const InventoryConsumptionStatisticsPage = () => {
  return <ConsumptionPage />;
};

export default InventoryConsumptionStatisticsPage;
