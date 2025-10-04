import { useState, useMemo } from "react";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChartExportButton } from "@/components/ui/chart-export-button";
import { ConsumptionFiltersAdvanced, type XAxisType, type YAxisType, type PeriodType, type SortType, type LabelConfig } from "@/components/statistics/consumption-filters-advanced";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import {
  IconChartBar,
  IconReload,
  IconChartLine,
  IconChartPie,
  IconChartDonut,
  IconChartArea,
  IconChartRadar,
  IconChartTreemap,
  IconLayoutRows,
} from "@tabler/icons-react";
import { addDays, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, TrendingUp, TrendingDown, Package, Users, Building, Filter as FilterIcon } from "lucide-react";
import { ConsumptionChart, type ChartType } from "@/components/statistics/consumption-chart";
import { useInventoryStatistics, useItems, useSectors, useUsers } from "../../../hooks";

// Types for filters
interface DateRange {
  from: Date;
  to: Date;
}

interface ConsumptionFilters {
  dateRange: DateRange;
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  groupBy: 'sector' | 'user' | 'item';
  itemIds?: string[];
  sectorIds?: string[];
  userIds?: string[];
  metric: 'quantity' | 'totalPrice';
  sortBy: 'name' | 'value' | 'percentage';
  sortOrder: 'asc' | 'desc';
  showLabels: 'always' | 'hover' | 'never';
  showPercentages: boolean;
  showTrend: boolean;
}



export const InventoryConsumptionStatisticsPage = () => {
  // Page tracking
  usePageTracker({
    title: "Estatísticas de Consumo",
    icon: "chart-bar",
  });

  // State for filters and drawer
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [xAxis, setXAxis] = useState<XAxisType>('sector');
  const [yAxis, setYAxis] = useState<YAxisType>('quantity');
  const [period, setPeriod] = useState<PeriodType>('month');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [sort, setSort] = useState<SortType>('item_name');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [labelConfig, setLabelConfig] = useState<LabelConfig>({
    showUserName: false,
    showSectorName: true,
    showItemName: true,
    showItemUnicode: false,
    showItemQuantity: false,
    showItemConsumption: false,
    showItemPrice: false,
    showPercentage: true,
    showTotal: false,
    position: 'top',
  });
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [sectorIds, setSectorIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Map filter states to API parameters
  const groupBy = xAxis; // Now directly maps: 'sector' or 'user'
  const metric = yAxis === 'quantity' ? 'quantity' : 'totalPrice';

  // State for async search
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [sectorSearchTerm, setSectorSearchTerm] = useState('');

  // Fetch items, sectors and users for selectors with search
  const { data: itemsData } = useItems({
    take: 20,
    searchingFor: itemSearchTerm,
    orderBy: { name: 'asc' }
  });

  const { data: sectorsData } = useSectors({
    take: 20,
    searchingFor: sectorSearchTerm,
    orderBy: { name: 'asc' }
  });

  const { data: usersData } = useUsers({
    take: 20,
    searchingFor: userSearchTerm,
    orderBy: { name: 'asc' },
    include: {
      position: {
        include: {
          sector: true
        }
      }
    }
  });

  // Create mock data for testing - this should come from API
  const mockStatisticsData = useMemo(() => {
    // If no filters selected, use defaults
    let dataToDisplay = [];

    if (groupBy === 'sector') {
      // Use selected sectors or default to first 5
      const sectorsToShow = sectorIds.length > 0
        ? sectorsData?.data?.filter(s => sectorIds.includes(s.id))
        : sectorsData?.data?.slice(0, 5);

      dataToDisplay = sectorsToShow?.map(sector => ({
        id: sector.id,
        name: sector.name,
        value: Math.floor(Math.random() * 8000) + 1000,
        description: sector.description,
        trend: Math.random() * 20 - 10,
        previousValue: Math.floor(Math.random() * 7000) + 800,
      })) || [];
    } else if (groupBy === 'user') {
      // Use selected users or default to first 5
      const usersToShow = userIds.length > 0
        ? usersData?.data?.filter(u => userIds.includes(u.id))
        : usersData?.data?.slice(0, 5);

      dataToDisplay = usersToShow?.map(user => ({
        id: user.id,
        name: user.name,
        value: Math.floor(Math.random() * 5000) + 500,
        description: user.position?.sector?.name,
        trend: Math.random() * 20 - 10,
        previousValue: Math.floor(Math.random() * 4000) + 300,
      })) || [];
    }

    // If we have items filter, multiply values based on items count
    if (itemIds.length > 0) {
      dataToDisplay = dataToDisplay.map(item => ({
        ...item,
        value: item.value * (itemIds.length * 0.5 + 0.5)
      }));
    }

    return {
      data: dataToDisplay,
      success: true,
      message: "Dados carregados com sucesso"
    };
  }, [groupBy, sectorIds, userIds, itemIds, sectorsData, usersData, itemsData]);

  // Use mock data for now
  const statisticsData = mockStatisticsData;
  const isLoading = false;
  const error = null;
  const refetch = () => Promise.resolve();

  // Transform API data for selectors
  const itemOptions = useMemo(() => {
    if (!itemsData?.data) return [];
    return itemsData.data.map((item) => ({
      value: item.id,
      label: item.name,
      description: `Código: ${item.internalCode || item.barcode || 'N/A'}`,
    }));
  }, [itemsData]);

  const sectorOptions = useMemo(() => {
    if (!sectorsData?.data) return [];
    return sectorsData.data.map((sector) => ({
      value: sector.id,
      label: sector.name,
      description: sector.description || '',
    }));
  }, [sectorsData]);

  const userOptions = useMemo(() => {
    if (!usersData?.data) return [];
    return usersData.data.map((user) => ({
      value: user.id,
      label: user.name,
      description: user.position?.sector?.name || 'Sem setor',
    }));
  }, [usersData]);

  // Transform API response to chart data format
  const chartData = useMemo(() => {
    if (!statisticsData?.data) return [];

    const items = statisticsData.data || [];
    const totalValue = items.reduce((sum, item) => sum + (item.value || 0), 0);

    const mappedItems = items.map((item, index) => ({
      id: item.id || `item-${index}`,
      name: item.name || 'Sem nome',
      value: item.value || 0,
      percentage: totalValue > 0 ? ((item.value || 0) / totalValue) * 100 : 0,
      trend: item.trend,
      previousPeriodValue: item.previousValue,
      description: item.description,
    }));

    // Sort based on current sort selection
    const [sortBy, sortOrder] = sort.split('_') as [string, 'asc' | 'desc'];
    return mappedItems.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'value':
          comparison = a.value - b.value;
          break;
        case 'total':
        case 'consumption':
          comparison = a.value - b.value;
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [statisticsData, sort]);

  // Summary calculations
  const summary = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;

    const totalValue = chartData.reduce((acc, item) => acc + item.value, 0);
    const avgValue = totalValue / chartData.length;
    const maxItem = chartData.reduce((max, item) => item.value > max.value ? item : max, chartData[0]);
    const minItem = chartData.reduce((min, item) => item.value < min.value ? item : min, chartData[0]);

    // Calculate overall trend
    const totalPreviousValue = chartData.reduce((acc, item) => acc + (item.previousPeriodValue || 0), 0);
    const overallTrend = totalPreviousValue > 0 ? ((totalValue - totalPreviousValue) / totalPreviousValue) * 100 : 0;

    return {
      totalValue,
      avgValue: Math.round(avgValue),
      maxItem: { name: maxItem.name, value: maxItem.value },
      minItem: { name: minItem.name, value: minItem.value },
      itemCount: chartData.length,
      overallTrend: Math.round(overallTrend * 100) / 100,
    };
  }, [chartData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleApplyFilters = () => {
    // Filters are applied automatically through state changes
    setFiltersOpen(false);
    refetch();
  };

  const handleResetFilters = () => {
    // Reset all filters to default values
    setXAxis('sector');
    setYAxis('quantity');
    setPeriod('month');
    setDateRange({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    });
    setSort('item_name');
    setChartType('bar');
    setLabelConfig({
      showUserName: false,
      showSectorName: true,
      showItemName: true,
      showItemUnicode: false,
      showItemQuantity: false,
      showItemConsumption: false,
      showItemPrice: false,
      showPercentage: true,
      showTotal: false,
      position: 'top',
    });
    setItemIds([]);
    setSectorIds([]);
    setUserIds([]);
    setFiltersOpen(false);
    refetch();
  };


  const getActiveFiltersCount = () => {
    let count = 0;
    if (itemIds && itemIds.length > 0) count++;
    if (sectorIds && sectorIds.length > 0) count++;
    if (userIds && userIds.length > 0) count++;
    if (period === 'custom') count++;
    return count;
  };

  const formatTooltipValue = (value: number) => {
    if (metric === 'quantity') {
      return [value.toLocaleString('pt-BR'), 'Quantidade'];
    } else {
      return [value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 'Valor Total'];
    }
  };

  const formatChartValue = (value: number) => {
    if (metric === 'quantity') {
      return value.toLocaleString('pt-BR');
    } else {
      return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando dados de consumo...</span>
      </div>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full space-y-6">
        {/* Page Header */}
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Estatísticas de Consumo"
            icon={IconChartBar}
            favoritePage={FAVORITE_PAGES.ESTOQUE_ESTATISTICAS}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estatísticas", href: routes.statistics.root },
              { label: "Estoque", href: routes.statistics.inventory.root },
              { label: "Consumo" }
            ]}
            actions={[
              {
                key: "refresh",
                label: "Atualizar",
                icon: IconReload,
                onClick: handleRefresh,
                variant: "outline",
                loading: isRefreshing,
              },
            ]}
          />
        </div>


        {/* Main Dashboard Content */}
        <div className="flex-1 overflow-hidden">
          <Card className="h-full bg-card">
            <CardContent className="overflow-y-auto h-full p-6 space-y-6">
              {/* Filter and Export Buttons */}
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFiltersOpen(true)}
                >
                  <FilterIcon className="h-4 w-4 mr-2" />
                  Filtros
                  {getActiveFiltersCount() > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {getActiveFiltersCount()}
                    </Badge>
                  )}
                </Button>
                <ChartExportButton
                  chartElementId="consumption-chart"
                  infoElementId="consumption-info-cards"
                  filename="consumo-estatisticas"
                  variant="outline"
                  size="sm"
                  availableChartTypes={["bar", "line", "pie", "donut", "area", "radar", "treemap", "horizontal-bar"]}
                  currentChartType={chartType}
                  onChartTypeChange={setChartType}
                />
              </div>

              {/* Summary Cards */}
              {summary && (
          <div id="consumption-info-cards" className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Total de Itens</span>
                </div>
                <div className="text-2xl font-bold">{summary.itemCount}</div>
                <div className="text-sm text-muted-foreground">itens analisados</div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IconChartBar className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Total</span>
                </div>
                <div className="text-2xl font-bold">{formatChartValue(summary.totalValue)}</div>
                <div className="text-sm text-muted-foreground">
                  {metric === 'quantity' ? 'unidades' : 'em valor'}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-4 rounded bg-green-500"></div>
                  <span className="text-sm font-medium">Maior</span>
                </div>
                <div className="text-2xl font-bold">{formatChartValue(summary.maxItem.value)}</div>
                <div className="text-sm text-muted-foreground truncate" title={summary.maxItem.name}>
                  {summary.maxItem.name}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-4 rounded bg-blue-500"></div>
                  <span className="text-sm font-medium">Média</span>
                </div>
                <div className="text-2xl font-bold">{formatChartValue(summary.avgValue)}</div>
                <div className="text-sm text-muted-foreground">por item</div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {summary.overallTrend >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm font-medium">Tendência</span>
                </div>
                <div className={`text-2xl font-bold ${summary.overallTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.overallTrend >= 0 ? '+' : ''}{summary.overallTrend}%
                </div>
                <div className="text-sm text-muted-foreground">vs. período anterior</div>
              </CardContent>
            </Card>
          </div>
        )}

              {/* Chart Section */}
              <Card id="consumption-chart" className="bg-card">
                <CardHeader className="p-3">
                  <TooltipProvider>
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={chartType === 'bar' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setChartType('bar')}
                          >
                            <IconChartBar className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Gráfico de Barras</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={chartType === 'line' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setChartType('line')}
                          >
                            <IconChartLine className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Gráfico de Linha</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={chartType === 'pie' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setChartType('pie')}
                          >
                            <IconChartPie className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Gráfico de Pizza</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={chartType === 'donut' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setChartType('donut')}
                          >
                            <IconChartDonut className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Gráfico de Rosquinha</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={chartType === 'area' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setChartType('area')}
                          >
                            <IconChartArea className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Gráfico de Área</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={chartType === 'radar' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setChartType('radar' as ChartType)}
                          >
                            <IconChartRadar className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Gráfico de Radar</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={chartType === 'treemap' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setChartType('treemap')}
                          >
                            <IconChartTreemap className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Mapa de Árvore</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={chartType === 'horizontal-bar' ? 'default' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setChartType('horizontal-bar')}
                          >
                            <IconLayoutRows className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Barras Horizontais</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </CardHeader>
                <CardContent>
                  {error ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-red-500">
                        <span>Erro ao carregar dados: {error.message || 'Erro desconhecido'}</span>
                      </div>
                    </div>
                  ) : !chartData || chartData.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-muted-foreground">
                        <span>Nenhum dado disponível para os filtros selecionados</span>
                      </div>
                    </div>
                  ) : (
                    <ConsumptionChart
                      data={chartData}
                      metric={metric}
                      groupBy={groupBy}
                      showPercentages={labelConfig.showPercentage}
                      showTrend={false}
                      showLabels={labelConfig.position === 'top' ? 'always' : labelConfig.position === 'inside' ? 'hover' : 'never'}
                      loading={isLoading}
                      height={400}
                      chartType={chartType}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Data Table */}
              {chartData && chartData.length > 0 && (
                <Card className="mt-4">
            <CardHeader>
              <CardTitle>Dados Detalhados</CardTitle>
              <CardDescription>
                Visualização tabular dos dados de consumo com informações adicionais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">{groupBy === 'sector' ? 'Setor' : groupBy === 'user' ? 'Usuário' : 'Item'}</th>
                      <th className="text-right p-2">{metric === 'quantity' ? 'Quantidade' : 'Valor Total'}</th>
                      {labelConfig.showPercentage && (
                        <th className="text-right p-2">Percentual</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{item.name}</td>
                        <td className="text-right p-2">{formatChartValue(item.value)}</td>
                        {labelConfig.showPercentage && (
                          <td className="text-right p-2">{item.percentage.toFixed(1)}%</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filter Drawer */}
        <ConsumptionFiltersAdvanced
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          xAxis={xAxis}
          yAxis={yAxis}
          period={period}
          dateRange={dateRange}
          sort={sort}
          labelConfig={labelConfig}
          subOptions={{
            items: itemIds,
            users: userIds,
            sectors: sectorIds,
          }}
          itemOptions={itemOptions}
          userOptions={userOptions}
          sectorOptions={sectorOptions}
          onItemSearch={setItemSearchTerm}
          onUserSearch={setUserSearchTerm}
          onSectorSearch={setSectorSearchTerm}
          onXAxisChange={setXAxis}
          onYAxisChange={setYAxis}
          onPeriodChange={setPeriod}
          onDateRangeChange={setDateRange}
          onSortChange={setSort}
          onLabelConfigChange={setLabelConfig}
          onSubOptionsChange={(options) => {
            if (options.items !== undefined) setItemIds(options.items);
            if (options.users !== undefined) setUserIds(options.users);
            if (options.sectors !== undefined) setSectorIds(options.sectors);
          }}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        />
      </div>
    </PrivilegeRoute>
  );
};

export default InventoryConsumptionStatisticsPage;