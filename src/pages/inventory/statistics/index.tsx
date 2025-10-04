import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExportButton } from "@/components/ui/export-button";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { useInventoryStatistics } from "../../../hooks";
import { formatCurrency, formatNumber } from "../../../utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ChartExportData } from "../../../utils";
import {
  IconChartBar,
  IconChartPie,
  IconChartLine,
  IconTrendingUp,
  IconTrendingDown,
  IconPackage,
  IconActivity,
  IconUsers,
  IconShoppingCart,
  IconCurrencyDollar,
  IconClock,
  IconArrowRight,
  IconExternalLink,
  IconAlertCircle,
  IconCircleCheck,
  IconBarcode,
  IconTag,
} from "@tabler/icons-react";

interface StatisticsCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  metrics?: {
    label: string;
    value: string | number;
    trend?: number;
  }[];
}

const StatisticsCard = ({ title, description, icon: Icon, href, color, metrics }: StatisticsCardProps) => {
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all duration-200 border-l-4"
      style={{ borderLeftColor: color }}
      onClick={() => navigate(href)}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20` }}>
              <Icon className="h-6 w-6" style={{ color }} />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(href);
            }}
          >
            <IconArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      {metrics && metrics.length > 0 && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 gap-3">
            {metrics.map((metric, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{metric.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{metric.value}</span>
                  {metric.trend !== undefined && (
                    <Badge variant={metric.trend > 0 ? "default" : metric.trend < 0 ? "destructive" : "secondary"}>
                      {metric.trend > 0 && <IconTrendingUp className="h-3 w-3 mr-1" />}
                      {metric.trend < 0 && <IconTrendingDown className="h-3 w-3 mr-1" />}
                      {Math.abs(metric.trend)}%
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export const InventoryStatisticsPage = () => {
  const navigate = useNavigate();

  // Page tracking
  usePageTracker({
    title: "Hub de Estatísticas do Estoque",
    icon: "chart-bar",
  });

  // Fetch overview statistics
  const { data: statistics, isLoading, error } = useInventoryStatistics({});

  // Statistics categories
  const statisticsCategories = useMemo(() => [
    {
      title: "Análise de Consumo",
      description: "Padrões de consumo, itens mais utilizados e previsões",
      icon: IconTrendingDown,
      href: routes.statistics.inventory.consumption,
      color: "#3b82f6",
      metrics: statistics ? [
        { label: "Total de Itens", value: formatNumber(statistics.totalItems) },
        { label: "Valor Total", value: formatCurrency(statistics.totalValue) },
        { label: "Itens em Baixo Estoque", value: statistics.lowStockItems },
        { label: "Taxa de Giro", value: `${statistics.turnoverRate}%`, trend: statistics.turnoverTrend },
      ] : undefined,
    },
    {
      title: "Movimentação de Estoque",
      description: "Entradas, saídas, transferências e análise de fluxo",
      icon: IconActivity,
      href: routes.statistics.inventory.stockMovement,
      color: "#10b981",
      metrics: statistics ? [
        { label: "Atividades do Mês", value: formatNumber(statistics.monthlyActivities) },
        { label: "Média Diária", value: formatNumber(statistics.dailyAverage) },
        { label: "Usuários Ativos", value: statistics.activeUsers },
        { label: "Crescimento", value: `${statistics.activityGrowth}%`, trend: statistics.activityGrowth },
      ] : undefined,
    },
    {
      title: "Análise de Tendências",
      description: "Tendências temporais, sazonalidade e análise preditiva",
      icon: IconTrendingUp,
      href: routes.statistics.inventory.trends,
      color: "#8b5cf6",
      metrics: statistics ? [
        { label: "Itens para Reposição", value: statistics.itemsToReorder },
        { label: "Previsão Demanda", value: `${statistics.demandForecast}%`, trend: statistics.demandTrend },
        { label: "Economia Prevista", value: formatCurrency(statistics.projectedSavings) },
        { label: "Acurácia", value: `${statistics.forecastAccuracy}%` },
      ] : undefined,
    },
    {
      title: "Performance de Usuários",
      description: "Análise de produtividade e eficiência por colaborador",
      icon: IconUsers,
      href: "/estoque/estatisticas/usuarios",
      color: "#8b5cf6",
      metrics: statistics ? [
        { label: "Top Performer", value: statistics.topUser?.name || "N/A" },
        { label: "Atividades", value: formatNumber(statistics.topUser?.activities || 0) },
        { label: "Setores Ativos", value: statistics.activeSectors },
        { label: "Eficiência Média", value: `${statistics.averageEfficiency}%` },
      ] : undefined,
    },
    {
      title: "Análise de Pedidos",
      description: "Desempenho de fornecedores e cumprimento de prazos",
      icon: IconShoppingCart,
      href: "/estoque/estatisticas/pedidos",
      color: "#f59e0b",
      metrics: statistics ? [
        { label: "Pedidos do Mês", value: formatNumber(statistics.monthlyOrders) },
        { label: "Taxa de Entrega", value: `${statistics.deliveryRate}%` },
        { label: "Tempo Médio", value: `${statistics.averageDeliveryTime} dias` },
        { label: "Fornecedores Ativos", value: statistics.activeSuppliers },
      ] : undefined,
    },
    {
      title: "Custo & Valor",
      description: "Evolução de preços, custos e análise financeira",
      icon: IconCurrencyDollar,
      href: "/estoque/estatisticas/custos",
      color: "#ef4444",
      metrics: statistics ? [
        { label: "Variação de Preços", value: `${statistics.priceVariation}%`, trend: statistics.priceVariation },
        { label: "Economia do Mês", value: formatCurrency(statistics.monthlySavings) },
        { label: "Maior Categoria", value: statistics.topCategory?.name || "N/A" },
        { label: "ROI Médio", value: `${statistics.averageROI}%` },
      ] : undefined,
    },
    {
      title: "Análise Preditiva",
      description: "Previsões de demanda e otimização de estoques",
      icon: IconTrendingUp,
      href: "/estoque/estatisticas/previsoes",
      color: "#06b6d4",
      metrics: statistics ? [
        { label: "Itens para Reposição", value: statistics.itemsToReorder },
        { label: "Previsão Demanda", value: `${statistics.demandForecast}%`, trend: statistics.demandTrend },
        { label: "Economia Prevista", value: formatCurrency(statistics.projectedSavings) },
        { label: "Acurácia", value: `${statistics.forecastAccuracy}%` },
      ] : undefined,
    },
  ], [statistics]);

  // Quick metrics overview
  const quickMetrics = useMemo(() => {
    if (!statistics) return [];

    return [
      {
        label: "Total de Produtos",
        value: formatNumber(statistics.totalItems),
        icon: IconPackage,
        color: "#3b82f6",
        trend: statistics.itemsGrowth,
      },
      {
        label: "Valor do Estoque",
        value: formatCurrency(statistics.totalValue),
        icon: IconCurrencyDollar,
        color: "#10b981",
        trend: statistics.valueGrowth,
      },
      {
        label: "Atividades Hoje",
        value: formatNumber(statistics.todayActivities),
        icon: IconActivity,
        color: "#f59e0b",
        trend: statistics.activityGrowth,
      },
      {
        label: "Alertas Ativos",
        value: statistics.activeAlerts,
        icon: IconAlertCircle,
        color: statistics.activeAlerts > 0 ? "#ef4444" : "#10b981",
      },
    ];
  }, [statistics]);

  // Recent activity summary
  const recentSummary = useMemo(() => {
    if (!statistics?.recentActivity) return [];

    return [
      {
        type: "Produtos Adicionados",
        count: statistics.recentActivity.productsAdded,
        icon: IconPackage,
        color: "#3b82f6",
      },
      {
        type: "Movimentações",
        count: statistics.recentActivity.movements,
        icon: IconActivity,
        color: "#10b981",
      },
      {
        type: "Pedidos Criados",
        count: statistics.recentActivity.ordersCreated,
        icon: IconShoppingCart,
        color: "#f59e0b",
      },
      {
        type: "Atualizações de Preço",
        count: statistics.recentActivity.priceUpdates,
        icon: IconTag,
        color: "#8b5cf6",
      },
    ];
  }, [statistics]);

  // Prepare export data for overview statistics
  const exportData = useMemo((): ChartExportData[] => {
    if (!statistics) return [];

    const data: ChartExportData[] = [];

    // Overview metrics
    data.push({
      chartTitle: 'Métricas Gerais do Estoque',
      data: quickMetrics.map(metric => ({
        metrica: metric.label,
        valor: typeof metric.value === 'string' ? metric.value : metric.value.toString(),
        tendencia: metric.trend !== undefined ? `${metric.trend >= 0 ? '+' : ''}${metric.trend}%` : 'N/A',
      })),
      metadata: {
        'Tipo de Análise': 'Métricas Gerais',
        'Data de Geração': format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        'Total de Métricas': quickMetrics.length.toString(),
      },
    });

    // Statistics categories summary
    data.push({
      chartTitle: 'Categorias de Análise Disponíveis',
      data: statisticsCategories.map(category => ({
        categoria: category.title,
        descricao: category.description,
        metricas_disponiveis: category.metrics?.length || 0,
      })),
      metadata: {
        'Total de Categorias': statisticsCategories.length.toString(),
        'Categorias Ativas': statisticsCategories.filter(cat => cat.metrics && cat.metrics.length > 0).length.toString(),
      },
    });

    // Recent activity summary
    if (recentSummary.length > 0) {
      data.push({
        chartTitle: 'Atividade Recente (Últimas 24h)',
        data: recentSummary.map(item => ({
          tipo: item.type,
          quantidade: item.count,
        })),
        metadata: {
          'Período': 'Últimas 24 horas',
          'Total de Atividades': recentSummary.reduce((sum, item) => sum + item.count, 0).toString(),
        },
      });
    }

    // Detailed metrics for each category
    statisticsCategories.forEach(category => {
      if (category.metrics && category.metrics.length > 0) {
        data.push({
          chartTitle: `Detalhes - ${category.title}`,
          data: category.metrics.map(metric => ({
            metrica: metric.label,
            valor: metric.value,
            tendencia: metric.trend !== undefined ? `${metric.trend >= 0 ? '+' : ''}${metric.trend}%` : 'N/A',
          })),
          metadata: {
            'Categoria': category.title,
            'Descrição': category.description,
            'Cor da Categoria': category.color,
          },
        });
      }
    });

    return data;
  }, [statistics, quickMetrics, statisticsCategories, recentSummary]);

  // Export configuration
  const exportConfig = useMemo(() => ({
    title: 'Relatório Geral de Estatísticas do Estoque',
    subtitle: 'Visão consolidada de todas as métricas e indicadores',
    filename: `estatisticas_estoque_geral_${format(new Date(), 'yyyyMMdd_HHmmss')}`,
    includeTimestamp: true,
    includeFilters: false, // No filters on overview page
    filters: {
      tipoRelatorio: 'Visão Geral',
      dataGeracao: format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      status: isLoading ? 'Carregando' : error ? 'Erro' : statistics ? 'Dados Disponíveis' : 'Sem Dados',
    },
  }), [isLoading, error, statistics]);

  if (error) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
        <div className="flex flex-col h-full">
          <PageHeaderWithFavorite
            title="Estatísticas do Estoque"
            icon={IconChartBar}
            favoritePage={FAVORITE_PAGES.ESTOQUE_ESTATISTICAS}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Estatísticas" }
            ]}
          />
          <div className="flex-1 flex items-center justify-center">
            <Card className="max-w-md">
              <CardContent className="p-6 text-center">
                <IconAlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Erro ao Carregar Estatísticas</h3>
                <p className="text-muted-foreground mb-4">
                  Não foi possível carregar os dados estatísticos. Tente novamente mais tarde.
                </p>
                <Button onClick={() => window.location.reload()}>
                  Tentar Novamente
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full space-y-6">
        {/* Page Header */}
        <PageHeaderWithFavorite
          title="Hub de Estatísticas do Estoque"
          icon={IconChartBar}
          favoritePage={FAVORITE_PAGES.ESTOQUE_ESTATISTICAS}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Estatísticas" }
          ]}
          actions={[
            {
              key: "consumption-analysis",
              label: "Análise de Consumo",
              icon: IconTrendingDown,
              onClick: () => navigate(routes.statistics.inventory.consumption),
              variant: "outline",
            },
            {
              key: "trends-analysis",
              label: "Análise de Tendências",
              icon: IconTrendingUp,
              onClick: () => navigate(routes.statistics.inventory.trends),
              variant: "default",
            },
          ]}
        />

        {/* Export Section */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Relatórios e Exportação</h2>
            <p className="text-sm text-muted-foreground">
              Exporte o resumo geral das estatísticas do estoque
            </p>
          </div>
          <ExportButton
            data={exportData}
            config={exportConfig}
            variant="default"
            showDataCount={true}
            availableFormats={["csv", "excel", "pdf", "json"]}
            disabled={isLoading || !!error || !statistics}
            onExportStart={(format) => {
              console.log(`Iniciando exportação do resumo geral em formato ${format}`);
            }}
            onExportComplete={(format) => {
              console.log(`Exportação do resumo geral concluída em formato ${format}`);
            }}
          />
        </div>

        {/* Quick Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickMetrics.map((metric) => (
            <Card key={metric.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className="text-2xl font-bold">{metric.value}</p>
                    {metric.trend !== undefined && (
                      <div className="flex items-center mt-1">
                        {metric.trend > 0 ? (
                          <IconTrendingUp className="h-4 w-4 text-green-500 mr-1" />
                        ) : metric.trend < 0 ? (
                          <IconTrendingDown className="h-4 w-4 text-red-500 mr-1" />
                        ) : null}
                        <span className={`text-sm ${
                          metric.trend > 0 ? 'text-green-500' :
                          metric.trend < 0 ? 'text-red-500' :
                          'text-muted-foreground'
                        }`}>
                          {metric.trend > 0 ? '+' : ''}{metric.trend}%
                        </span>
                      </div>
                    )}
                  </div>
                  <div
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: `${metric.color}20` }}
                  >
                    <metric.icon
                      className="h-6 w-6"
                      style={{ color: metric.color }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Statistics Categories */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold">Categorias de Análise</h2>
              <p className="text-muted-foreground">
                Explore diferentes aspectos das estatísticas do estoque
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {statisticsCategories.map((category) => (
              <StatisticsCard
                key={category.title}
                title={category.title}
                description={category.description}
                icon={category.icon}
                href={category.href}
                color={category.color}
                metrics={isLoading ? undefined : category.metrics}
              />
            ))}
          </div>
        </div>

        {/* Recent Activity Summary */}
        {!isLoading && recentSummary.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconClock className="h-5 w-5" />
                Atividade Recente (Últimas 24h)
              </CardTitle>
              <CardDescription>
                Resumo das principais atividades do estoque
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {recentSummary.map((item) => (
                  <div key={item.type} className="text-center">
                    <div
                      className="inline-flex p-3 rounded-lg mb-2"
                      style={{ backgroundColor: `${item.color}20` }}
                    >
                      <item.icon
                        className="h-6 w-6"
                        style={{ color: item.color }}
                      />
                    </div>
                    <p className="text-2xl font-bold">{item.count}</p>
                    <p className="text-sm text-muted-foreground">{item.type}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Access Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>
              Acesso direto às funcionalidades mais utilizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-auto py-4 justify-start"
                onClick={() => navigate(routes.inventory.products.list)}
              >
                <IconPackage className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Gerenciar Produtos</div>
                  <div className="text-sm text-muted-foreground">
                    Adicionar, editar e visualizar produtos
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4 justify-start"
                onClick={() => navigate(routes.inventory.movements.list)}
              >
                <IconActivity className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Ver Movimentações</div>
                  <div className="text-sm text-muted-foreground">
                    Histórico completo de atividades
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4 justify-start"
                onClick={() => navigate(routes.inventory.orders.list)}
              >
                <IconShoppingCart className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Pedidos e Fornecedores</div>
                  <div className="text-sm text-muted-foreground">
                    Gerenciar pedidos de compra
                  </div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PrivilegeRoute>
  );
};

export default InventoryStatisticsPage;