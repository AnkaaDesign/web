import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES, DASHBOARD_TIME_PERIOD } from "../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { useProductionDashboard } from "../../hooks";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatNumber } from "../../utils";
import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect } from "react";
import {
  IconTool,
  IconPlus,
  IconCalendarStats,
  IconScissors,
  IconSpray,
  IconBuildingStore,
  IconClipboardList,
  IconHistory,
  IconActivity,
  IconTrendingUp,
  IconTrendingDown,
  IconClock,
  IconCheckbox,
  IconX,
  IconCalendar,
  IconCar,
  IconSettings,
  IconChartBar,
  IconChartPie,
  IconProgressCheck,
  IconPlayerPlay,
  IconPlayerPause,
  IconCheck,
  IconExclamationCircle,
  IconCalendarTime,
  IconBrush,
  IconCut,
  IconNote,
  IconTruckDelivery,
  IconFileReport,
  IconUsers,
  IconGauge,
  IconGitBranch,
  IconCurrencyDollar,
} from "@tabler/icons-react";
import {
  RecentActivitiesCard,
  TrendCard,
  ActivityPatternCard,
  StatusCard,
  QuickAccessCard,
  AnalysisCard,
  DashboardSection,
  TimePeriodSelector,
  type Activity,
  type PatternData,
  type AnalysisData,
} from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const ProductionRootPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [timePeriod, setTimePeriod] = useState(DASHBOARD_TIME_PERIOD.THIS_MONTH);

  // Only ADMIN and FINANCIAL users can access the production dashboard
  // All others should be redirected to the schedule page
  useEffect(() => {
    if (user?.sector?.privileges &&
        user.sector.privileges !== SECTOR_PRIVILEGES.ADMIN &&
        user.sector.privileges !== SECTOR_PRIVILEGES.FINANCIAL) {
      navigate(routes.production.schedule.root, { replace: true });
    }
  }, [user, navigate]);

  // Track page access
  usePageTracker({
    title: "Dashboard de Produção",
    icon: "tool",
  });

  // Fetch dashboard data with time period
  const { data: dashboard, isLoading, error } = useProductionDashboard({ timePeriod });

  // Transform recent activities from real data
  const getRecentActivities = (): Activity[] => {
    if (!dashboard?.data) {
      return [];
    }

    // Create activities based on real data
    const activities: Activity[] = [];
    const data = dashboard.data;

    // Add completed tasks activity
    if (data.overview.tasksCompleted?.value) {
      activities.push({
        item: "Tarefas Concluídas",
        info: `${data.overview.tasksCompleted.value} concluídas`,
        quantity: "Hoje",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      });
    }

    // Add production activity
    if (data.overview.tasksInProduction?.value) {
      activities.push({
        item: "Produção Ativa",
        info: `${data.overview.tasksInProduction.value} em andamento`,
        quantity: "Agora",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      });
    }

    // Add cutting activity
    if (data.cuttingOperations?.completedCuts?.value) {
      activities.push({
        item: "Cortes Finalizados",
        info: `${data.cuttingOperations.completedCuts.value} processados`,
        quantity: "Hoje",
        time: new Date(Date.now() - 15 * 60 * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      });
    }

    // Add airbrush activity
    if (data.airbrushingMetrics?.completedAirbrushJobs?.value) {
      activities.push({
        item: "Aerografias",
        info: `${data.airbrushingMetrics.completedAirbrushJobs.value} finalizadas`,
        quantity: "Hoje",
        time: new Date(Date.now() - 30 * 60 * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      });
    }

    return activities.slice(0, 5); // Limit to 5 most recent
  };

  // Get task status distribution from real data
  const getTaskStatus = () => {
    if (!dashboard?.data?.overview) {
      return [];
    }

    const data = dashboard.data.overview;
    const totalTasks = data.totalTasks?.value || 0;
    const completedTasks = data.tasksCompleted?.value || 0;
    const inProgressTasks = data.tasksInProduction?.value || 0;
    const onHoldTasks = data.tasksOnHold?.value || 0;
    const cancelledTasks = data.tasksCancelled?.value || 0;

    return [
      {
        status: "Concluído",
        quantity: completedTasks,
        total: totalTasks,
        icon: IconCheck,
        color: "green" as const,
      },
      {
        status: "Em Produção",
        quantity: inProgressTasks,
        total: totalTasks,
        icon: IconPlayerPlay,
        color: "blue" as const,
      },
      {
        status: "Em Espera",
        quantity: onHoldTasks,
        total: totalTasks,
        icon: IconPlayerPause,
        color: "orange" as const,
      },
      {
        status: "Cancelado",
        quantity: cancelledTasks,
        total: totalTasks,
        icon: IconX,
        color: "red" as const,
      },
    ];
  };

  // Get production analysis data from real data
  const getProductionAnalysis = (): AnalysisData[] => {
    if (!dashboard?.data?.serviceOrders?.byService) {
      return [];
    }

    // Get service distribution data from the API
    const serviceData = dashboard.data.serviceOrders.byService;

    return serviceData.map((service, index) => {
      const colors = [
        "bg-blue-500",
        "bg-green-500",
        "bg-purple-500",
        "bg-orange-500",
        "bg-red-500",
        "bg-gray-500", // For "Outros"
      ];

      return {
        label: service.serviceName || "Serviço sem nome",
        value: service.count,
        percentage: service.percentage,
        info: `${service.count} ordens`,
        color: colors[index % colors.length],
      };
    });
  };

  // Get activity patterns from real data
  const getActivityPatterns = () => {
    if (!dashboard?.data) {
      return {
        tasksByType: [],
        productionWeekly: [],
        garagesByStatus: [],
        productivityShift: [],
      };
    }

    const data = dashboard.data;

    // Use the actual average tasks by weekday from the API
    // tasksByShift now contains average tasks per weekday
    const dayAbbreviations = ["Seg", "Ter", "Qua", "Qui", "Sex"];

    // Ensure we always have all 5 weekdays with proper rounding for display
    const productionByDay = dayAbbreviations.map((dayLabel, index) => {
      const apiValue = data.productivityMetrics?.tasksByShift?.datasets?.[0]?.data?.[index];
      return {
        label: dayLabel,
        value: Math.round(apiValue || 0), // Round for display in the chart
      };
    });

    return {
      tasksByType:
        data.productivityMetrics?.tasksBySector?.datasets?.[0]?.data?.map((value, index) => ({
          label: data.productivityMetrics.tasksBySector.labels[index] || `Setor ${index + 1}`,
          value: value || 0,
        })) || [],
      productionWeekly: productionByDay,
      garagesByStatus: [],
      productivityShift: data.productivityMetrics?.tasksByShift?.datasets?.[0]?.data?.map((value, index) => ({
        label: data.productivityMetrics.tasksByShift.labels[index] || `Turno ${index + 1}`,
        value: value || 0,
      })) || [
        { label: "Manhã", value: 0 },
        { label: "Tarde", value: 0 },
        { label: "Noite", value: 0 },
      ],
    };
  };

  // Helper function to get trend from dashboard metric
  const getTrend = (metric?: { trend?: "up" | "down" | "stable"; changePercent?: number }) => {
    if (!metric) return { trend: "stable" as const, percentage: 0 };
    return {
      trend: metric.trend || ("stable" as const),
      percentage: Math.abs(metric.changePercent || 0),
    };
  };

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="flex flex-col h-full space-y-6">
          <PageHeaderWithFavorite
            title="Produção"
            icon={IconTool}
            favoritePage={FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção" }]}
            actions={[
              {
                key: "time-period",
                label: <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} className="mr-2" />,
                variant: "ghost",
                className: "p-0 hover:bg-transparent",
              },
              {
                key: "create-task",
                label: "Nova Tarefa",
                icon: IconPlus,
                onClick: () => navigate(routes.production.schedule.create),
                variant: "default",
              },
            ]}
          />

          {/* Loading state with skeleton components */}
          <div className="space-y-6">
            {/* Quick Access Loading */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-foreground mb-4">Acesso Rápido</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-card dark:bg-card rounded-lg border border-border p-4 space-y-2">
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-6 w-8" />
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activities Loading */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Atividades Recentes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-card dark:bg-card rounded-lg border border-border p-4">
                    <Skeleton className="h-4 w-24 mb-3" />
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, j) => (
                        <div key={j} className="flex justify-between">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Metrics Loading */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Métricas de Produção</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-card dark:bg-card rounded-lg border border-border p-4 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-12" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (error) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="flex flex-col h-full space-y-4">
          <PageHeaderWithFavorite
            title="Produção"
            icon={IconTool}
            favoritePage={FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção" }]}
            actions={[
              {
                key: "time-period",
                label: <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} className="mr-2" />,
                variant: "ghost",
                className: "p-0 hover:bg-transparent",
              },
              {
                key: "create-task",
                label: "Nova Tarefa",
                icon: IconPlus,
                onClick: () => navigate(routes.production.schedule.create),
                variant: "default",
              },
            ]}
          />
          <Alert>
            <IconExclamationCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar o dashboard de produção. Por favor, tente novamente mais tarde.
              {error && (error as Error).message && <div className="mt-2 text-sm text-muted-foreground">Detalhes: {(error as Error).message}</div>}
            </AlertDescription>
          </Alert>
        </div>
      </PrivilegeRoute>
    );
  }

  // Get activity patterns for components
  const activityPatterns = getActivityPatterns();

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Produção"
            icon={IconTool}
            favoritePage={FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção" }]}
            actions={[
              {
                key: "time-period",
                label: <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} className="mr-2" />,
                variant: "ghost",
                className: "p-0 hover:bg-transparent",
              },
              {
                key: "create-task",
                label: "Nova Tarefa",
                icon: IconPlus,
                onClick: () => navigate(routes.production.schedule.create),
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
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <QuickAccessCard
                  title="Cronograma"
                  icon={IconCalendarStats}
                  onClick={() => navigate(routes.production.schedule.root)}
                  count={dashboard?.data?.overview?.totalTasks?.value || 0}
                  color="blue"
                />
                <QuickAccessCard
                  title="Recorte"
                  icon={IconScissors}
                  onClick={() => navigate(routes.production.cutting.root)}
                  count={dashboard?.data?.cuttingOperations?.totalCuts?.value || 0}
                  color="green"
                />
                <QuickAccessCard
                  title="Aerografia"
                  icon={IconSpray}
                  onClick={() => navigate(routes.production.airbrush.root)}
                  count={dashboard?.data?.airbrushingMetrics?.totalAirbrushJobs?.value || 0}
                  color="purple"
                />
                <QuickAccessCard
                  title="Garagens"
                  icon={IconBuildingStore}
                  onClick={() => navigate(routes.production.garages.root)}
                  count={dashboard?.data?.garageUtilization?.totalGarages?.value || 0}
                  color="red"
                />
              </div>
            </div>

            {/* Recent Activities */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Atividades Recentes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <RecentActivitiesCard title="Atividades Recentes" activities={getRecentActivities()} icon={IconActivity} color="blue" />
                <RecentActivitiesCard
                  title="Tarefas Concluídas"
                  activities={[
                    {
                      item: `${dashboard?.data?.overview?.tasksCompleted?.value || 0} tarefas`,
                      info: "Concluídas hoje",
                      quantity: `${Math.round(((dashboard?.data?.overview?.tasksCompleted?.value || 0) / Math.max(dashboard?.data?.overview?.totalTasks?.value || 1, 1)) * 100)}%`,
                      time: "Taxa",
                    },
                  ]}
                  icon={IconProgressCheck}
                  color="green"
                />
                <RecentActivitiesCard
                  title="Cortes em Andamento"
                  activities={[
                    {
                      item: `${dashboard?.data?.cuttingOperations?.pendingCuts?.value || 0} cortes`,
                      info: "Em produção",
                      quantity: `${dashboard?.data?.cuttingOperations?.completedCuts?.value || 0}`,
                      time: "Finalizados",
                    },
                  ]}
                  icon={IconCut}
                  color="orange"
                />
                <RecentActivitiesCard
                  title="Utilização de Garagens"
                  activities={[
                    {
                      item: `${dashboard?.data?.garageUtilization?.totalGarages?.value || 0} garagens`,
                      info: "Total disponível",
                      quantity: `${dashboard?.data?.garageUtilization?.utilizationRate?.value || 0}%`,
                      time: "Taxa de uso",
                    },
                  ]}
                  icon={IconGauge}
                  color="purple"
                />
              </div>
            </div>

            {/* Metrics */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Métricas de Produção</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <TrendCard
                  title="Total de Tarefas"
                  value={dashboard?.data?.overview?.totalTasks?.value || 0}
                  trend={getTrend(dashboard?.data?.overview?.totalTasks).trend}
                  percentage={getTrend(dashboard?.data?.overview?.totalTasks).percentage}
                  icon={IconCalendarStats}
                  subtitle="No sistema"
                />
                <TrendCard
                  title="Cortes Realizados"
                  value={dashboard?.data?.cuttingOperations?.totalCuts?.value || 0}
                  trend={getTrend(dashboard?.data?.cuttingOperations?.totalCuts).trend}
                  percentage={getTrend(dashboard?.data?.cuttingOperations?.totalCuts).percentage}
                  icon={IconScissors}
                  subtitle="Total de operações"
                />
                <TrendCard
                  title="Aerografias"
                  value={dashboard?.data?.airbrushingMetrics?.totalAirbrushJobs?.value || 0}
                  trend={getTrend(dashboard?.data?.airbrushingMetrics?.totalAirbrushJobs).trend}
                  percentage={getTrend(dashboard?.data?.airbrushingMetrics?.totalAirbrushJobs).percentage}
                  icon={IconSpray}
                  subtitle="Trabalhos totais"
                />
                <TrendCard
                  title="Receita Total"
                  value={formatCurrency(dashboard?.data?.revenueAnalysis?.totalRevenue?.value || 0)}
                  trend={getTrend(dashboard?.data?.revenueAnalysis?.totalRevenue).trend}
                  percentage={getTrend(dashboard?.data?.revenueAnalysis?.totalRevenue).percentage}
                  icon={IconCurrencyDollar}
                  subtitle="Faturamento"
                />
              </div>
            </div>

            {/* Activity Patterns */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Padrões de Atividade</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ActivityPatternCard
                  title="Tarefas por Setor"
                  data={activityPatterns.tasksByType.length > 0 ? activityPatterns.tasksByType : [{ label: "Sem dados", value: 0 }]}
                  icon={IconTool}
                  color="blue"
                />
                <ActivityPatternCard
                  title={timePeriod === DASHBOARD_TIME_PERIOD.THIS_WEEK ? "Produção por Dia (Total)" : "Produção por Dia (Média)"}
                  data={activityPatterns.productionWeekly}
                  icon={IconCalendar}
                  color="green"
                />
              </div>
            </div>

            {/* Task Status */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Status das Tarefas</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {getTaskStatus().map((status, index) => (
                  <StatusCard key={index} status={status.status} quantity={status.quantity} total={status.total} icon={status.icon} color={status.color} unit="tarefas" />
                ))}
              </div>
            </div>

            {/* Analysis */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Análises de Produção</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnalysisCard
                  title="Distribuição por Serviço"
                  type="SERVICE"
                  data={getProductionAnalysis()}
                  icon={IconChartPie}
                />
                <AnalysisCard
                  title="Receita por Setor"
                  type="REVENUE"
                  data={
                    dashboard?.data?.revenueAnalysis?.revenueBySector?.datasets?.[0]?.data?.map((value, index) => ({
                      label: dashboard.data.revenueAnalysis.revenueBySector.labels[index] || `Setor ${index + 1}`,
                      value: value || 0,
                      percentage: Math.round(((value || 0) / (dashboard.data.revenueAnalysis.totalRevenue?.value || 1)) * 100),
                      info: formatCurrency(value || 0),
                      color: `bg-${["blue", "green", "purple", "orange", "red", "yellow"][index % 6]}-500`,
                    })) || [{ label: "Sem dados", value: 0, percentage: 0, info: formatCurrency(0), color: "bg-gray-500" }]
                  }
                  icon={IconCurrencyDollar}
                  onDetailsClick={() => navigate(routes.production.schedule.root)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
