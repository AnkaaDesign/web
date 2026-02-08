import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES, DASHBOARD_TIME_PERIOD, TASK_STATUS_LABELS } from "../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useAdministrationDashboard, usePositions } from "../../hooks";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatNumber } from "../../utils";
import { useState } from "react";
import {
  IconSettings,
  IconPlus,
  IconUsers,
  IconBuilding,
  IconCurrencyDollar,
  IconUser,
  IconUserCheck,
  IconBell,
  IconFolder,
  IconChartBar,
  IconUserPlus,
  IconBuildingBank,
  IconActivity,
  IconTrendingUp,
  IconTrendingDown,
  IconClock,
  IconUserX,
  IconFileUpload,
  IconMail,
  IconShield,
  IconEye,
  IconChartPie,
  IconUsersGroup,
} from "@tabler/icons-react";
import {
  RecentActivitiesCard,
  TrendCard,
  StatusCard,
  QuickAccessCard,
  AnalysisCard,
  ActivityPatternCard,
  TimePeriodSelector,
  type Activity,
  type AnalysisData,
  type PatternData,
} from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import { cn } from "@/lib/utils";

export const AdministrationRootPage = () => {
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState(DASHBOARD_TIME_PERIOD.THIS_MONTH);

  // Track page access
  usePageTracker({
    title: "Dashboard de Administração",
    icon: "settings",
  });

  // Fetch dashboard data with time period
  const { data: dashboard, isLoading, error } = useAdministrationDashboard({ timePeriod });

  // Fetch positions with remuneration data for sorting
  const { data: positions } = usePositions({
    include: {
      remunerations: true,
    },
    orderBy: { name: "asc" },
    take: 100, // Get all positions
  });

  // Transform recent activities for the component
  const transformRecentActivities = (): Activity[] => {
    if (!dashboard?.data?.recentActivities) return [];

    return dashboard.data.recentActivities.slice(0, 10).map((activity) => ({
      item: activity.title || "Sistema",
      info: activity.description || "Sistema operacional",
      quantity: activity.type || "",
      time: activity.timestamp
        ? new Date(activity.timestamp).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Agora",
    }));
  };

  // Get user status distribution
  const getUserStatus = () => {
    if (!dashboard?.data?.userMetrics) return [];

    const { totalUsers, experiencePeriod1Users, experiencePeriod2Users, effectedUsers, dismissedUsers } = dashboard.data.userMetrics;

    return [
      {
        status: "Experiência 1/2",
        quantity: experiencePeriod1Users?.value || 0,
        total: totalUsers?.value || 0,
        icon: IconClock,
        color: "orange" as const,
      },
      {
        status: "Experiência 2/2",
        quantity: experiencePeriod2Users?.value || 0,
        total: totalUsers?.value || 0,
        icon: IconClock,
        color: "blue" as const,
      },
      {
        status: "Efetivado",
        quantity: effectedUsers?.value || 0,
        total: totalUsers?.value || 0,
        icon: IconUserCheck,
        color: "green" as const,
      },
      {
        status: "Desligado",
        quantity: dismissedUsers?.value || 0,
        total: totalUsers?.value || 0,
        icon: IconUserX,
        color: "red" as const,
      },
    ];
  };

  // Get file type distribution
  const getFileTypeDistribution = (): PatternData[] => {
    if (!dashboard?.data?.fileMetrics?.fileTypeDistribution) return [];

    return dashboard.data.fileMetrics.fileTypeDistribution.map((item) => ({
      label: item.type,
      value: item.count,
    }));
  };

  // Get users by position
  const getUsersByPosition = (): PatternData[] => {
    if (!dashboard?.data?.userActivity?.byPosition) return [];

    const chartData = dashboard.data.userActivity.byPosition;
    if (!chartData.datasets || !chartData.datasets[0]) return [];

    // Take top 5 positions
    return chartData.labels.slice(0, 5).map((label, index) => ({
      label: label.substring(0, 10),
      value: chartData.datasets[0].data[index] || 0,
    }));
  };

  // Get top sectors
  const getTopSectors = (): PatternData[] => {
    if (!dashboard?.data?.sectorMetrics?.usersBySector) return [];

    const chartData = dashboard.data.sectorMetrics.usersBySector;
    if (!chartData.datasets || !chartData.datasets[0]) return [];

    // Take top 5 sectors
    return chartData.labels.slice(0, 5).map((label, index) => ({
      label: label.substring(0, 10),
      value: chartData.datasets[0].data[index] || 0,
    }));
  };

  // Get sector analysis data
  const getSectorAnalysis = (): AnalysisData[] => {
    if (!dashboard?.data?.sectorMetrics?.usersBySector) return [];

    const chartData = dashboard.data.sectorMetrics.usersBySector;
    if (!chartData.datasets || !chartData.datasets[0]) return [];

    const sectors = chartData.labels.map((label, index) => ({
      name: label,
      count: chartData.datasets[0].data[index],
    }));

    const total = sectors.reduce((sum, sector) => sum + sector.count, 0);

    return sectors.slice(0, 6).map((sector, index) => {
      const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-red-500", "bg-teal-500"];
      return {
        label: sector.name,
        value: sector.count,
        percentage: total > 0 ? Math.round((sector.count / total) * 100) : 0,
        info: sector.name,
        color: colors[index % colors.length],
      };
    });
  };

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <div className="h-full flex flex-col bg-background">
          {/* Fixed Header */}
          <div className="flex-shrink-0 bg-background">
            <div className="px-4 py-4">
              <PageHeader
                title="Administração"
                icon={IconSettings}
                favoritePage={FAVORITE_PAGES.ADMINISTRACAO_CLIENTES_LISTAR}
                breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Administração" }]}
                actions={[
                  {
                    key: "time-period",
                    label: <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} className="mr-2" />,
                    variant: "ghost",
                    className: "p-0 hover:bg-transparent",
                  },
                ]}
              />
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <Card>
              <CardContent className="p-6 space-y-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (error) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
        <div className="h-full flex flex-col bg-background">
          {/* Fixed Header */}
          <div className="flex-shrink-0 bg-background">
            <div className="px-4 py-4">
              <PageHeader
                title="Administração"
                icon={IconSettings}
                favoritePage={FAVORITE_PAGES.ADMINISTRACAO_CLIENTES_LISTAR}
                breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Administração" }]}
                actions={[
                  {
                    key: "time-period",
                    label: <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} className="mr-2" />,
                    variant: "ghost",
                    className: "p-0 hover:bg-transparent",
                  },
                ]}
              />
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <Card>
              <CardContent className="p-6">
                <Alert variant="destructive">
                  <AlertDescription>Erro ao carregar dashboard: {error.message}</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  const data = dashboard?.data;

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col bg-background">
        {/* Fixed Header */}
        <div className="flex-shrink-0 bg-background">
          <div className="px-4 py-4">
            <PageHeader
              title="Administração"
              icon={IconSettings}
              favoritePage={FAVORITE_PAGES.ADMINISTRACAO_CLIENTES_LISTAR}
              breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Administração" }]}
              actions={[
                {
                  key: "time-period",
                  label: <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} className="mr-2" />,
                  variant: "ghost",
                  className: "p-0 hover:bg-transparent",
                },
                {
                  key: "create-user",
                  label: "Novo Colaborador",
                  icon: IconUserPlus,
                  onClick: () => navigate(routes.administration.collaborators.create),
                  variant: "default",
                },
              ]}
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <Card>
            <CardContent className="p-6 space-y-6">
            {/* Quick Access Section */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Acesso Rápido</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <QuickAccessCard
                  title="Colaboradores"
                  icon={IconUsers}
                  onClick={() => navigate(routes.administration.collaborators.root)}
                  count={data?.userMetrics?.totalUsers?.value ?? 0}
                  color="blue"
                />
                <QuickAccessCard
                  title="Clientes"
                  icon={IconBuildingBank}
                  onClick={() => navigate(routes.administration.customers.root)}
                  count={data?.customerAnalysis?.totalCustomers?.value ?? 0}
                  color="green"
                />
                <QuickAccessCard
                  title="Setores"
                  icon={IconBuilding}
                  onClick={() => navigate(routes.administration.sectors.root)}
                  count={data?.sectorMetrics?.totalSectors?.value ?? 0}
                  color="purple"
                />
                <QuickAccessCard
                  title="Notificações"
                  icon={IconBell}
                  onClick={() => navigate(routes.administration.notifications.root)}
                  count={data?.notificationMetrics?.totalNotifications?.value ?? 0}
                  color="red"
                />
              </div>
            </div>

            {/* Recent Activities */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Atividades Recentes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <RecentActivitiesCard title="Ações Recentes" activities={transformRecentActivities()} icon={IconActivity} color="blue" />
                <RecentActivitiesCard
                  title="Novos Usuários"
                  activities={[
                    {
                      item: `${data?.userMetrics?.newUsersThisWeek?.value ?? 0} usuários`,
                      info: "Esta semana",
                      quantity: `${data?.userMetrics?.newUsersToday?.value ?? 0}`,
                      time: "Hoje",
                    },
                  ]}
                  icon={IconUserPlus}
                  color="green"
                />
                <RecentActivitiesCard
                  title="Notificações Enviadas"
                  activities={[
                    {
                      item: `${data?.notificationMetrics?.sentNotifications?.value ?? 0} enviadas`,
                      info: "Total",
                      quantity: `${data?.notificationMetrics?.totalNotifications?.value ?? 0}`,
                      time: "Criadas",
                    },
                  ]}
                  icon={IconMail}
                  color="orange"
                />
                <RecentActivitiesCard
                  title="Sistema"
                  activities={[
                    {
                      item: "Sistema operacional",
                      info: "Status: Online",
                      quantity: "99.9%",
                      time: "Uptime",
                    },
                  ]}
                  icon={IconShield}
                  color="teal"
                />
              </div>
            </div>

            {/* Metrics */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Métricas Administrativas</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <TrendCard
                  title="Total Usuários"
                  value={data?.userMetrics?.totalUsers?.value ?? 0}
                  trend={data?.userMetrics?.userGrowthTrend}
                  percentage={Number(data?.userMetrics?.userGrowthPercent ?? 0)}
                  icon={IconUsers}
                  subtitle="Colaboradores ativos"
                />
                <TrendCard
                  title="Total Clientes"
                  value={data?.customerAnalysis?.totalCustomers?.value ?? 0}
                  trend={data?.customerAnalysis?.totalCustomers?.trend}
                  percentage={data?.customerAnalysis?.totalCustomers?.changePercent ?? 0}
                  icon={IconBuildingBank}
                  subtitle="Clientes cadastrados"
                />
                <TrendCard title="Setores" value={data?.sectorMetrics?.totalSectors?.value ?? 0} trend="stable" percentage={0} icon={IconBuilding} subtitle="Departamentos" />
                <TrendCard
                  title="Tarefas Ativas"
                  value={data?.taskOverview?.totalTasks?.value ?? 0}
                  trend={data?.taskOverview?.totalTasks?.trend}
                  percentage={data?.taskOverview?.totalTasks?.changePercent ?? 0}
                  icon={IconChartBar}
                  subtitle="Tarefas em produção"
                />
                <TrendCard title="Arquivos" value={data?.fileMetrics?.totalFiles?.value ?? 0} trend="up" percentage={5} icon={IconFolder} subtitle="Documentos" />
              </div>
            </div>

            {/* User Status */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Status dos Usuários</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {getUserStatus().map((status, index) => (
                  <StatusCard key={index} status={status.status} quantity={status.quantity} total={status.total} icon={status.icon} color={status.color} unit="usuários" />
                ))}
              </div>
            </div>

            {/* Activity Patterns */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Padrões de Atividade</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ActivityPatternCard
                  title="Colaboradores por Cargo"
                  data={(() => {
                    if (!data?.userActivity?.byPosition?.labels) return [];

                    // Create array of position data with labels and values
                    const positionData = data.userActivity.byPosition.labels.map((label, index) => ({
                      label: label.substring(0, 20),
                      value: data.userActivity.byPosition.datasets[0]?.data[index] || 0,
                      fullLabel: label, // Keep full label for position lookup
                    }));

                    // Sort by remuneration if position data is available
                    if (positions?.data) {
                      return positionData
                        .sort((a, b) => {
                          // Find positions by name
                          const posA = positions.data.find((p) => p.name === a.fullLabel);
                          const posB = positions.data.find((p) => p.name === b.fullLabel);

                          // Get remuneration values (use first remuneration if multiple exist)
                          const remunerationA = posA?.remunerations?.[0]?.value || 0;
                          const remunerationB = posB?.remunerations?.[0]?.value || 0;

                          // Sort in descending order (highest remuneration first)
                          return remunerationB - remunerationA;
                        })
                        .map(({ label, value }) => ({ label, value })); // Remove fullLabel from final data
                    }

                    return positionData.map(({ label, value }) => ({ label, value }));
                  })()}
                  icon={IconUsers}
                  color="blue"
                />
                <ActivityPatternCard
                  title="Colaboradores por Setor"
                  data={
                    data?.sectorMetrics?.usersBySector?.labels?.map((label, index) => ({
                      label: label,
                      value: data.sectorMetrics.usersBySector.datasets[0]?.data[index] || 0,
                    })) || []
                  }
                  icon={IconBuilding}
                  color="purple"
                />
                <ActivityPatternCard
                  title="Status das Tarefas"
                  data={
                    data?.taskOverview?.tasksByStatus?.labels?.map((label, index) => ({
                      label: TASK_STATUS_LABELS[label as keyof typeof TASK_STATUS_LABELS] || label,
                      value: data.taskOverview.tasksByStatus.datasets[0]?.data[index] || 0,
                    })) || []
                  }
                  icon={IconChartBar}
                  color="green"
                />
              </div>
            </div>

            {/* Analysis */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Análises Administrativas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnalysisCard
                  title="Distribuição por Setor"
                  type="SECTOR"
                  data={getSectorAnalysis()}
                  icon={IconChartPie}
                  onDetailsClick={() => navigate(routes.administration.sectors.root)}
                />
                <AnalysisCard
                  title="Crescimento de Usuários (Últimos 6 meses)"
                  type="custom"
                  data={(() => {
                    const growth = data?.userMetrics?.monthlyGrowth || [];
                    const total = growth.reduce((sum, item) => sum + (item?.count || 0), 0);

                    // Full month names mapping
                    const fullMonthNames: Record<string, string> = {
                      Jan: "Janeiro",
                      Fev: "Fevereiro",
                      Mar: "Março",
                      Abr: "Abril",
                      Mai: "Maio",
                      Jun: "Junho",
                      Jul: "Julho",
                      Ago: "Agosto",
                      Set: "Setembro",
                      Out: "Outubro",
                      Nov: "Novembro",
                      Dez: "Dezembro",
                    };

                    // Show all 6 months of data
                    return growth.map((item, index) => {
                      const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-red-500", "bg-teal-500"];
                      const count = item?.count || 0;
                      const monthAbbr = item?.month || `Mês ${index + 1}`;
                      const fullMonth = fullMonthNames[monthAbbr] || monthAbbr;

                      return {
                        label: monthAbbr,
                        value: count,
                        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
                        info: fullMonth,
                        color: colors[index % colors.length],
                      };
                    });
                  })()}
                  icon={IconUsersGroup}
                  onDetailsClick={() => navigate(routes.administration.collaborators.root)}
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
