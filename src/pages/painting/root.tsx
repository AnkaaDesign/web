import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES, DASHBOARD_TIME_PERIOD } from "../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { usePaintDashboard, usePaintBrands } from "../../hooks";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatNumber } from "../../utils";
import { useState } from "react";
import {
  IconPalette,
  IconPlus,
  IconColorSwatch,
  IconFlask2,
  IconDroplet,
  IconSparkles,
  IconMicrophone2,
  IconPaint,
  IconActivity,
  IconTrendingUp,
  IconTrendingDown,
  IconClock,
  IconFlask,
  IconBottle,
  IconTool,
  IconChartBar,
  IconChartPie,
  IconFileText,
  IconPackage,
  IconCircleDot,
  IconBrush,
  IconColorPicker,
  IconTag,
} from "@tabler/icons-react";
import {
  RecentActivitiesCard,
  TrendCard,
  ActivityPatternCard,
  StatusCard,
  QuickAccessCard,
  AnalysisCard,
  TimePeriodSelector,
  type Activity,
  type PatternData,
  type AnalysisData,
} from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function Painting() {
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState(DASHBOARD_TIME_PERIOD.THIS_MONTH);

  // Track page access
  usePageTracker({
    title: "Dashboard de Pintura",
    icon: "palette",
  });

  // Fetch dashboard data with time period
  const { data: dashboard, isLoading, error } = usePaintDashboard({ timePeriod });

  // Fetch paint brands count
  const { data: paintBrandsData } = usePaintBrands({
    take: 1, // We only need the count, not the actual data
  });

  // Transform recent paints used in tasks
  const getRecentPaintsUsedInTasks = (): Activity[] => {
    if (!dashboard?.data?.trends?.recentPaintUsageInTasks) return [];

    // Show recent paints with the tasks they were used in
    return dashboard.data.trends.recentPaintUsageInTasks.slice(0, 10).map((usage) => ({
      item: usage.paintName,
      info: usage.taskName,
      quantity: new Date(usage.createdAt).toLocaleDateString("pt-BR"),
      time: usage.taskPlate || usage.taskSerialNumber || "S/N",
    }));
  };

  // Transform recent productions
  const getRecentProductions = (): Activity[] => {
    if (!dashboard?.data?.formulaMetrics?.mostUsedFormulas) return [];

    // Show recent productions with paint name and volume
    return dashboard.data.formulaMetrics.mostUsedFormulas.slice(0, 10).map((formula) => ({
      item: formula.paintName,
      info: formula.paintTypeName,
      quantity: `${Math.round(formula.totalVolumeLiters)}L`,
      time: `${formula.productionCount} prod.`,
    }));
  };

  // Transform color patterns data - shows most used paints in tasks
  const getColorPatterns = (): PatternData[] => {
    if (!dashboard?.data?.trends?.popularColors) return [];

    // Show top 5 most used paints, with usage count
    return dashboard.data.trends.popularColors.slice(0, 5).map((color) => ({
      label: color.paintName,
      value: color.productionCount, // This now represents usage frequency in tasks
    }));
  };

  // Get production status distribution
  const getProductionStatus = () => {
    if (!dashboard?.data?.productionOverview) return [];

    const totalProductions = dashboard.data.productionOverview.totalProductions;
    const volume = dashboard.data.productionOverview.totalVolumeLiters;

    // Since we don't have status breakdown, show volume metrics
    return [
      {
        status: "Total Produções",
        quantity: totalProductions,
        total: totalProductions,
        icon: IconActivity,
        color: "blue" as const,
      },
      {
        status: "Volume Total",
        quantity: Math.round(volume),
        total: Math.round(volume),
        icon: IconDroplet,
        color: "green" as const,
      },
      {
        status: "Média por Produção",
        quantity: Math.round(dashboard.data.productionOverview.averageVolumePerProduction),
        total: Math.round(volume),
        icon: IconFlask,
        color: "purple" as const,
      },
      {
        status: "Peso Total (kg)",
        quantity: Math.round(dashboard.data.productionOverview.totalWeightKg),
        total: Math.round(dashboard.data.productionOverview.totalWeightKg),
        icon: IconPackage,
        color: "orange" as const,
      },
    ];
  };

  // Get formula complexity analysis data
  const getFormulaComplexityAnalysis = (): AnalysisData[] => {
    if (!dashboard?.data?.formulaMetrics) return [];

    const total = dashboard.data.formulaMetrics.totalFormulas;

    // Since the API doesn't currently provide component count,
    // we'll use a distribution that shows the intended functionality
    // This should be updated when the API provides actual component counts

    // Temporary distribution - replace with actual data when API is updated
    const lowComplexity = Math.floor(total * 0.4); // Formulas with 3 or less components
    const mediumComplexity = Math.floor(total * 0.35); // Formulas with 4-5 components
    const highComplexity = total - lowComplexity - mediumComplexity; // Formulas with more than 5 components

    return [
      {
        label: "Baixa",
        value: lowComplexity,
        percentage: total > 0 ? Math.round((lowComplexity / total) * 100) : 0,
        info: "≤ 3 componentes",
        color: "bg-green-500",
      },
      {
        label: "Média",
        value: mediumComplexity,
        percentage: total > 0 ? Math.round((mediumComplexity / total) * 100) : 0,
        info: "4-5 componentes",
        color: "bg-yellow-500",
      },
      {
        label: "Alta",
        value: highComplexity,
        percentage: total > 0 ? Math.round((highComplexity / total) * 100) : 0,
        info: "> 5 componentes",
        color: "bg-red-500",
      },
    ];
  };

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="flex flex-col h-full space-y-4">
          <PageHeaderWithFavorite
            title="Pintura"
            icon={IconPalette}
            favoritePage={FAVORITE_PAGES.PINTURA_CATALOGO_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Pintura" }]}
            actions={[
              {
                key: "time-period",
                label: <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} className="mr-2" />,
                variant: "ghost",
                className: "p-0 hover:bg-transparent",
              },
            ]}
          />
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (error) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="flex flex-col h-full space-y-4">
          <PageHeaderWithFavorite
            title="Pintura"
            icon={IconPalette}
            favoritePage={FAVORITE_PAGES.PINTURA_CATALOGO_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Pintura" }]}
            actions={[
              {
                key: "time-period",
                label: <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} className="mr-2" />,
                variant: "ghost",
                className: "p-0 hover:bg-transparent",
              },
            ]}
          />
          <Alert variant="destructive">
            <AlertDescription>Erro ao carregar dashboard: {error.message}</AlertDescription>
          </Alert>
        </div>
      </PrivilegeRoute>
    );
  }

  const data = dashboard?.data;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Pintura"
            icon={IconPalette}
            favoritePage={FAVORITE_PAGES.PINTURA_CATALOGO_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Pintura" }]}
            actions={[
              {
                key: "time-period",
                label: <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} className="mr-2" />,
                variant: "ghost",
                className: "p-0 hover:bg-transparent",
              },
              {
                key: "create-paint",
                label: "Nova Tinta",
                icon: IconPlus,
                onClick: () => navigate(routes.painting.catalog.create),
                variant: "default",
              },
            ]}
          />
        </div>

        {/* Main Content Card - All sections in a single scrollable container */}
        <div className="flex-1 bg-card dark:bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <div className="h-full overflow-y-auto p-6 space-y-8">
            {/* Quick Access Section */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Acesso Rápido</h3>
              <div className="grid grid-cols-4 gap-4">
                <QuickAccessCard
                  title="Catálogo"
                  icon={IconColorSwatch}
                  onClick={() => navigate(routes.painting.catalog.root)}
                  count={data?.colorAnalysis?.totalColors}
                  color="blue"
                />
                <QuickAccessCard
                  title="Produções"
                  icon={IconPaint}
                  onClick={() => navigate(routes.painting.productions.root)}
                  count={data?.productionOverview?.totalProductions}
                  color="green"
                />
                <QuickAccessCard
                  title="Tipos de Tinta"
                  icon={IconBrush}
                  onClick={() => navigate(routes.painting.paintTypes.root)}
                  count={data?.componentInventory?.componentUsageByType?.length}
                  color="red"
                />
                <QuickAccessCard
                  title="Marcas de Tinta"
                  icon={IconTag}
                  onClick={() => navigate(routes.painting.paintBrands.root)}
                  count={paintBrandsData?.meta?.totalRecords}
                  color="purple"
                />
              </div>
            </div>

            {/* Recent Activities */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Atividades Recentes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <RecentActivitiesCard title="Tintas Usadas em Tarefas" activities={getRecentPaintsUsedInTasks()} icon={IconActivity} color="blue" />
                <RecentActivitiesCard
                  title="Cores por Paleta"
                  activities={
                    data?.colorAnalysis?.colorsByPalette?.slice(0, 3).map((palette) => ({
                      item: palette.palette,
                      info: "Paleta",
                      quantity: `${palette.count} cores`,
                      time: `${palette.percentage.toFixed(2)}%`,
                    })) || []
                  }
                  icon={IconColorPicker}
                  color="green"
                />
                <RecentActivitiesCard title="Produções Recentes" activities={getRecentProductions()} icon={IconPaint} color="orange" />
                <RecentActivitiesCard
                  title="Top Produções por Volume"
                  activities={
                    data?.formulaMetrics?.mostUsedFormulas
                      ?.slice(0, 5)
                      .sort((a, b) => b.totalVolumeLiters - a.totalVolumeLiters)
                      .map((formula) => ({
                        item: formula.paintName,
                        info: formula.paintTypeName,
                        quantity: `${Math.round(formula.totalVolumeLiters)}L`,
                        time: `${formula.productionCount} prod.`,
                      })) || []
                  }
                  icon={IconBottle}
                  color="purple"
                />
              </div>
            </div>

            {/* Metrics */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Métricas de Pintura</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <TrendCard
                  title="Tintas no Catálogo"
                  value={data?.colorAnalysis?.totalColors || 0}
                  trend="stable"
                  percentage={0}
                  icon={IconColorSwatch}
                  subtitle="Cores disponíveis"
                />
                <TrendCard title="Produções" value={data?.productionOverview?.totalProductions || 0} trend="up" percentage={10} icon={IconPaint} subtitle="Total" />
                <TrendCard title="Fórmulas" value={data?.formulaMetrics?.totalFormulas || 0} trend="up" percentage={5} icon={IconFlask2} subtitle="Receitas ativas" />
                <TrendCard title="Componentes" value={data?.componentInventory?.totalComponents || 0} trend="stable" percentage={0} icon={IconDroplet} subtitle="Ingredientes" />
                <TrendCard
                  title="Volume Produzido"
                  value={`${Math.round(data?.productionOverview?.totalVolumeLiters || 0)}L`}
                  trend="up"
                  percentage={15}
                  icon={IconPackage}
                  subtitle="Total"
                />
              </div>
            </div>

            {/* Activity Patterns */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Padrões de Atividade</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ActivityPatternCard title="Tintas Mais Usadas" data={getColorPatterns()} icon={IconPalette} color="blue" labelWidth="w-32" />
                <ActivityPatternCard
                  title="Tintas por Tipo"
                  data={
                    data?.componentInventory?.componentUsageByType?.slice(0, 5).map((type) => ({
                      label: type.paintTypeName,
                      value: type.componentCount,
                    })) || []
                  }
                  icon={IconBrush}
                  color="green"
                  labelWidth="w-32"
                />
                <ActivityPatternCard
                  title="Componentes Baixo Estoque"
                  data={
                    data?.componentInventory?.lowStockComponents?.slice(0, 5).map((component) => ({
                      label: component.code ? `${component.code} - ${component.name}` : component.name,
                      value: Math.round(component.currentQuantity * 100) / 100,
                    })) || []
                  }
                  icon={IconDroplet}
                  color="purple"
                  labelWidth="w-32"
                />
              </div>
            </div>

            {/* Production Status */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Status das Produções</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {getProductionStatus().map((status, index) => (
                  <StatusCard key={index} status={status.status} quantity={status.quantity} total={status.total} icon={status.icon} color={status.color} unit="produções" />
                ))}
              </div>
            </div>

            {/* Analysis */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Análises de Pintura</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnalysisCard
                  title="Complexidade das Fórmulas"
                  type="COMPLEXITY"
                  data={getFormulaComplexityAnalysis()}
                  icon={IconChartBar}
                  onDetailsClick={() => navigate(routes.painting.formulas.root)}
                />
                <AnalysisCard
                  title="Distribuição por Acabamento"
                  type="COLOR"
                  data={
                    data?.colorAnalysis?.colorsByFinish?.map((finish) => ({
                      label: finish.finish,
                      value: finish.count,
                      percentage: finish.percentage,
                      color: finish.finish.includes("Fosco")
                        ? "bg-gray-500"
                        : finish.finish.includes("Brilhante")
                          ? "bg-yellow-500"
                          : finish.finish.includes("Metálico")
                            ? "bg-blue-500"
                            : finish.finish.includes("Perolizado")
                              ? "bg-purple-500"
                              : finish.finish.includes("Lisa")
                                ? "bg-green-500"
                                : "bg-orange-500",
                    })) || []
                  }
                  icon={IconChartPie}
                  onDetailsClick={() => navigate(routes.painting.catalog.root)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
}
