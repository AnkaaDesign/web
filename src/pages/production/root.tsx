import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES, DASHBOARD_TIME_PERIOD } from "../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useProductionDashboard } from "../../hooks";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "../../utils";
import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect } from "react";
import { IconTool } from "@tabler/icons-react";
import {
  CalendarDays,
  Scissors,
  SprayCan,
  Building2,
  ClipboardList,
  Activity as ActivityIcon,
  X,
  Calendar,
  PieChart,
  CheckCircle2,
  Play,
  Check,
  AlertCircle,
  Scissors as Cut,
  Gauge,
  DollarSign,
  Wrench,
} from "lucide-react";
import {
  RecentActivitiesCard,
  TrendCard,
  ActivityPatternCard,
  StatusCard,
  QuickAccessCard,
  AnalysisCard,
  TimePeriodSelector,
  type Activity,
  type AnalysisData,
} from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

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
  const { data: dashboard, isLoading, error } = useProductionDashboard({
    timePeriod,
    includeServiceOrders: true,
    includeCuts: true,
    includeAirbrush: true,
    includeTrucks: true,
  });

  // Transform recent activities from real data
  const getRecentActivities = (): Activity[] => {
    if (!dashboard?.data) {
      return [];
    }

    // Create activities based on real data
    const activities: Activity[] = [];
    const data = dashboard.data;

    // Add completed tasks activity
    if (data.overview?.tasksCompleted?.value) {
      activities.push({
        item: "Tarefas Concluídas",
        info: `${data.overview.tasksCompleted.value} concluídas`,
        quantity: "Hoje",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      });
    }

    // Add production activity
    if (data.overview?.tasksInProduction?.value) {
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
    const totalTasks = data?.totalTasks?.value ?? 0;
    const completedTasks = data?.tasksCompleted?.value ?? 0;
    const inProgressTasks = data?.tasksInProduction?.value ?? 0;
    const onHoldTasks = data?.tasksOnHold?.value ?? 0;
    const cancelledTasks = data?.tasksCancelled?.value ?? 0;

    return [
      {
        status: "Concluído",
        quantity: completedTasks,
        total: totalTasks,
        icon: Check,
        color: "green" as const,
      },
      {
        status: "Em Produção",
        quantity: inProgressTasks,
        total: totalTasks,
        icon: Play,
        color: "blue" as const,
      },
      {
        status: "Em Espera",
        quantity: onHoldTasks,
        total: totalTasks,
        icon: ClipboardList,
        color: "orange" as const,
      },
      {
        status: "Cancelado",
        quantity: cancelledTasks,
        total: totalTasks,
        icon: X,
        color: "red" as const,
      },
    ];
  };

  // Get production analysis data from real data
  const getProductionAnalysis = (): AnalysisData[] => {
    if (!dashboard?.data?.serviceOrders?.serviceOrdersByType?.datasets?.[0]?.data) {
      return [];
    }

    // Get service distribution data from the API
    const chartData = dashboard.data.serviceOrders.serviceOrdersByType;
    const labels = chartData.labels || [];
    const data = chartData.datasets[0].data || [];

    return labels.map((label: string, index: number) => {
      const colors = [
        "bg-blue-500",
        "bg-green-500",
        "bg-purple-500",
        "bg-orange-500",
        "bg-red-500",
        "bg-gray-500", // For "Outros"
      ];

      const value = data[index] || 0;
      const total = data.reduce((sum: number, val: number) => sum + val, 0);
      const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

      return {
        label: label || "Serviço sem nome",
        value: value,
        percentage: percentage,
        info: `${value} ordens`,
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
        garageOccupancy: [],
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
        value: Math.round(apiValue ?? 0), // Round for display in the chart
      };
    });

    // Get garage occupancy data - since garageUtilization is not in the API response,
    // we'll use placeholder data or derive it from truck positions if available
    // Filter out individual truck entries and only keep garage/position aggregates
    const truckPositions = data.truckMetrics?.trucksByPosition || [];
    const isAggregatedData = truckPositions.length <= 10 &&
      truckPositions.some((item: any) =>
        item.name?.toLowerCase().includes('barracão') ||
        item.name?.toLowerCase().includes('pátio') ||
        item.name?.toLowerCase().includes('patio')
      );

    const garageOccupancy = isAggregatedData
      ? truckPositions.map((item: any) => ({
          label: item.name || "Barracão",
          value: item.value || 0,
        }))
      : [
          { label: "Pátio", value: 0 },
          { label: "Barracão 1", value: 0 },
          { label: "Barracão 2", value: 0 },
          { label: "Barracão 3", value: 0 },
        ];

    return {
      tasksByType:
        data.productivityMetrics?.tasksBySector?.datasets?.[0]?.data?.map((value, index) => ({
          label: data.productivityMetrics?.tasksBySector?.labels?.[index] ?? `Setor ${index + 1}`,
          value: value ?? 0,
        })) ?? [],
      productionWeekly: productionByDay,
      garageOccupancy,
    };
  };

  // Helper function to get trend from dashboard metric
  const getTrend = (metric?: { trend?: "up" | "down" | "stable"; changePercent?: number }) => {
    if (!metric) return { trend: "stable" as const, percentage: 0 };
    return {
      trend: metric.trend ?? ("stable" as const),
      percentage: Math.abs(metric.changePercent ?? 0),
    };
  };

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col bg-background">
          {/* Fixed Header */}
          <div className="flex-shrink-0 bg-background px-4 pt-4 pb-4">
            <PageHeader
              title="Produção"
              icon={IconTool}
              favoritePage={FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR}
              breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção" }]}
              actions={[
                {
                  key: "time-period",
                  label: <TimePeriodSelector value={timePeriod} onChange={(val) => setTimePeriod(val as DASHBOARD_TIME_PERIOD)} /> as any,
                },
              ]}
            />
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <Card>
              <CardContent className="p-6 space-y-6">
              {/* Quick Access Loading */}
              <div>
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
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (error) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col bg-background">
          {/* Fixed Header */}
          <div className="flex-shrink-0 bg-background px-4 pt-4 pb-4">
            <PageHeader
              title="Produção"
              icon={IconTool}
              favoritePage={FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR}
              breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção" }]}
              actions={[
                {
                  key: "time-period",
                  label: <TimePeriodSelector value={timePeriod} onChange={(val) => setTimePeriod(val as DASHBOARD_TIME_PERIOD)} /> as any,
                },
              ]}
            />
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <Card>
              <CardContent className="p-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Erro ao carregar o dashboard de produção. Por favor, tente novamente mais tarde.
                    {error && (error as Error).message && <div className="mt-2 text-sm text-muted-foreground">Detalhes: {(error as Error).message}</div>}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  // Get activity patterns for components
  const activityPatterns = getActivityPatterns();

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col bg-background">
        {/* Fixed Header */}
        <div className="flex-shrink-0 bg-background px-4 pt-4 pb-4">
          <PageHeader
            title="Produção"
            icon={IconTool}
            favoritePage={FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção" }]}
            actions={[
              {
                key: "time-period",
                label: <TimePeriodSelector value={timePeriod} onChange={(val) => setTimePeriod(val as DASHBOARD_TIME_PERIOD)} /> as any,
              },
            ]}
          />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <Card>
            <CardContent className="p-6 space-y-6">
            {/* Quick Access Section */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Acesso Rápido</h3>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <QuickAccessCard
                  title="Cronograma"
                  icon={CalendarDays}
                  onClick={() => navigate(routes.production.schedule.root)}
                  count={dashboard?.data?.overview?.totalTasks?.value || 0}
                  color="blue"
                />
                <QuickAccessCard
                  title="Recorte"
                  icon={Scissors}
                  onClick={() => navigate(routes.production.cutting.root)}
                  count={dashboard?.data?.cuttingOperations?.totalCuts?.value || 0}
                  color="green"
                />
                <QuickAccessCard
                  title="Aerografia"
                  icon={SprayCan}
                  onClick={() => navigate(routes.production.airbrushings.root)}
                  count={dashboard?.data?.airbrushingMetrics?.totalAirbrushJobs?.value || 0}
                  color="purple"
                />
                <QuickAccessCard
                  title="Barracões"
                  icon={Building2}
                  onClick={() => navigate(routes.production.garages.root)}
                  count={dashboard?.data?.truckMetrics?.totalTrucks?.value || 0}
                  color="red"
                />
              </div>
            </div>

            {/* Recent Activities */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Atividades Recentes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <RecentActivitiesCard title="Atividades Recentes" activities={getRecentActivities()} icon={ActivityIcon} color="blue" />
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
                  icon={CheckCircle2}
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
                  icon={Cut}
                  color="orange"
                />
                <RecentActivitiesCard
                  title="Utilização de Barracões"
                  activities={[
                    {
                      item: `${dashboard?.data?.truckMetrics?.totalTrucks?.value || 0}/18`,
                      info: "Vagas ocupadas",
                      quantity: `${dashboard?.data?.truckMetrics?.trucksInProduction?.value || 0} em produção`,
                      time: "Capacidade: 2 por faixa",
                    },
                  ]}
                  icon={Gauge}
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
                  icon={CalendarDays}
                  subtitle="No sistema"
                />
                <TrendCard
                  title="Cortes Realizados"
                  value={dashboard?.data?.cuttingOperations?.totalCuts?.value || 0}
                  trend={getTrend(dashboard?.data?.cuttingOperations?.totalCuts).trend}
                  percentage={getTrend(dashboard?.data?.cuttingOperations?.totalCuts).percentage}
                  icon={Scissors}
                  subtitle="Total de operações"
                />
                <TrendCard
                  title="Aerografias"
                  value={dashboard?.data?.airbrushingMetrics?.totalAirbrushJobs?.value || 0}
                  trend={getTrend(dashboard?.data?.airbrushingMetrics?.totalAirbrushJobs).trend}
                  percentage={getTrend(dashboard?.data?.airbrushingMetrics?.totalAirbrushJobs).percentage}
                  icon={SprayCan}
                  subtitle="Trabalhos totais"
                />
                <TrendCard
                  title="Receita Total"
                  value={formatCurrency(
                    dashboard?.data?.revenueAnalysis?.revenueByMonth?.reduce((sum, point) => sum + point.value, 0) || 0
                  )}
                  trend="stable"
                  percentage={0}
                  icon={DollarSign}
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
                  data={activityPatterns.tasksByType.length > 0 ? activityPatterns.tasksByType : [{ label: "Sem setor", value: 0 }]}
                  icon={Wrench}
                  color="blue"
                />
                <ActivityPatternCard
                  title={timePeriod === DASHBOARD_TIME_PERIOD.THIS_WEEK ? "Produção por Dia (Total)" : "Produção por Dia (Média)"}
                  data={activityPatterns.productionWeekly}
                  icon={Calendar}
                  color="green"
                />
                <ActivityPatternCard
                  title="Ocupação por Barracão"
                  data={activityPatterns.garageOccupancy.length > 0 ? activityPatterns.garageOccupancy : [{ label: "Sem dados", value: 0 }]}
                  icon={Building2}
                  color="orange"
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
                  icon={PieChart}
                />
                <AnalysisCard
                  title="Receita por Setor"
                  type="REVENUE"
                  data={
                    dashboard?.data?.revenueAnalysis?.revenueBySector?.datasets?.[0]?.data?.map((value, index) => {
                      const totalRevenue = dashboard?.data?.revenueAnalysis?.revenueByMonth?.reduce((sum, point) => sum + point.value, 0) || 1;
                      return {
                        label: dashboard.data?.revenueAnalysis?.revenueBySector?.labels?.[index] ?? `Setor ${index + 1}`,
                        value: value ?? 0,
                        percentage: Math.round(((value ?? 0) / totalRevenue) * 100),
                        info: formatCurrency(value ?? 0),
                        color: `bg-${["blue", "green", "purple", "orange", "red", "yellow"][index % 6]}-500`,
                      };
                    }) ?? [{ label: "Sem dados", value: 0, percentage: 0, info: formatCurrency(0), color: "bg-gray-500" }]
                  }
                  icon={DollarSign}
                  onDetailsClick={() => navigate(routes.production.schedule.root)}
                />
              </div>
            </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PrivilegeRoute>
  );
};
