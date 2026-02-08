import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES, DASHBOARD_TIME_PERIOD, VACATION_STATUS, PPE_DELIVERY_STATUS } from "../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useHRDashboard, useVacations, usePpeDeliveries } from "../../hooks";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatNumber, formatDate, addDays } from "../../utils";
import { useState, useMemo } from "react";
import {
  IconUsers,
  IconPlus,
  IconCalendar,
  IconCalendarEvent,
  IconBellRinging,
  IconShieldCheck,
  IconUser,
  IconUserCheck,
  IconUserX,
  IconClock,
  IconActivity,
  IconTrendingUp,
  IconTrendingDown,
  IconSun,
  IconMoodHappy,
  IconChartBar,
  IconChartPie,
  IconBriefcase,
  IconUserCog,
  IconGift,
  IconBeach,
  IconMail,
  IconCrown,
  IconBadge,
  IconTrophy,
  IconHome,
  IconSchool,
  IconHeart,
  IconCalendarX,
  IconCheck,
} from "@tabler/icons-react";
import {
  RecentActivitiesCard,
  TrendCard,
  ActivityPatternCard,
  StatusCard,
  QuickAccessCard,
  AnalysisCard,
  TimePeriodSelector,
  SimpleVacationCard,
  SimplePpeDeliveryCard,
  type Activity,
  type PatternData,
  type AnalysisData,
} from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import { cn } from "@/lib/utils";

export const HumanResourcesRootPage = () => {
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState(DASHBOARD_TIME_PERIOD.THIS_MONTH);

  // Track page access
  usePageTracker({
    title: "Dashboard de Recursos Humanos",
    icon: "users",
  });

  // Fetch dashboard data with time period
  const { data: dashboard, isLoading, error } = useHRDashboard({ timePeriod });

  // Memoize date ranges to prevent recreating them on every render
  const vacationDateRange = useMemo(() => {
    const now = new Date();
    return {
      gte: now.toISOString(),
      lte: addDays(now, 90).toISOString(), // Next 3 months
    };
  }, []); // Empty dependency array - calculated once

  const ppeDeliveryDateRange = useMemo(() => {
    const now = new Date();
    return {
      gte: addDays(now, -7).toISOString(), // Last 7 days
      lte: now.toISOString(),
    };
  }, []); // Empty dependency array - calculated once

  // Fetch vacations with extreme caching to prevent throttling
  const { data: vacationsData } = useVacations(
    {
      statuses: [VACATION_STATUS.APPROVED, VACATION_STATUS.IN_PROGRESS],
      startAtRange: vacationDateRange,
      orderBy: { startAt: "asc" },
      limit: 5,
      include: { user: true },
    },
    {
      enabled: !isLoading, // Only fetch after dashboard loads
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: false,
      retryOnMount: false,
      staleTime: Infinity, // Never consider stale
      cacheTime: 60 * 60 * 1000, // 1 hour cache
      refetchInterval: false,
    },
  );

  // Fetch PPE deliveries with extreme caching to prevent throttling
  const { data: ppeDeliveriesData } = usePpeDeliveries(
    {
      statuses: [PPE_DELIVERY_STATUS.DELIVERED],
      actualDeliveryDateRange: ppeDeliveryDateRange,
      orderBy: { actualDeliveryDate: "desc" },
      limit: 5,
      include: { user: true, item: true },
    },
    {
      enabled: !isLoading, // Only fetch after dashboard loads
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: false,
      retryOnMount: false,
      staleTime: Infinity, // Never consider stale
      cacheTime: 60 * 60 * 1000, // 1 hour cache
      refetchInterval: false,
    },
  );

  // Transform vacation data for the component
  const vacations = useMemo(() => {
    if (!vacationsData?.data) return [];

    return vacationsData.data.map((vacation) => ({
      id: vacation.id,
      userName: vacation.user?.name || "Funcionário",
      startDate: formatDate(new Date(vacation.startAt)),
      endDate: formatDate(new Date(vacation.endAt)),
    }));
  }, [vacationsData]);

  // Transform PPE delivery data for the component
  const ppeDeliveries = useMemo(() => {
    if (!ppeDeliveriesData?.data) return [];

    return ppeDeliveriesData.data.map((delivery) => ({
      id: delivery.id,
      userName: delivery.user?.name || "Funcionário",
      itemName: delivery.item?.name || "EPI",
      quantity: delivery.quantity,
      date: formatDate(new Date(delivery.actualDeliveryDate || delivery.createdAt)),
    }));
  }, [ppeDeliveriesData]);

  // Transform recent activities for the component
  const transformRecentActivities = (): Activity[] => {
    if (!dashboard?.data?.recentActivities) return [];

    return dashboard.data.recentActivities.slice(0, 10).map((activity) => ({
      item: activity.employeeName || activity.entity || "Sistema",
      info: activity.action || activity.user || "Sistema",
      quantity: activity.type || "",
      time: new Date(activity.createdAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
  };

  // Transform position activity patterns
  const getPositionPatterns = (): PatternData[] => {
    if (!dashboard?.data?.positionMetrics?.employeesByPosition) return [];

    const positionData = dashboard.data.positionMetrics.employeesByPosition;
    if (!positionData.labels || !positionData.datasets?.[0]?.data) return [];

    // Show ALL positions, not just first 5
    return positionData.labels.map((label, index) => ({
      label: label.substring(0, 20),
      value: positionData.datasets[0].data[index] || 0,
    }));
  };

  // Get vacation status distribution
  const getVacationStatus = () => {
    if (!dashboard?.data?.vacationMetrics) return [];

    const { totalVacations, pending, approved, inProgress, completed } = dashboard.data.vacationMetrics;

    return [
      {
        status: "Pendente",
        quantity: pending,
        total: totalVacations,
        icon: IconClock,
        color: "orange" as const,
      },
      {
        status: "Aprovado",
        quantity: approved,
        total: totalVacations,
        icon: IconUserCheck,
        color: "green" as const,
      },
      {
        status: "Em Andamento",
        quantity: inProgress,
        total: totalVacations,
        icon: IconBeach,
        color: "blue" as const,
      },
      {
        status: "Concluído",
        quantity: completed,
        total: totalVacations,
        icon: IconCheck,
        color: "purple" as const,
      },
    ];
  };

  // Get employee analysis data
  const getEmployeeAnalysis = (): AnalysisData[] => {
    if (!dashboard?.data?.sectorAnalysis?.employeesBySector) return [];

    const chartData = dashboard.data.sectorAnalysis.employeesBySector;
    if (!chartData.datasets || !chartData.datasets[0]) return [];

    const departments = chartData.labels.map((label, index) => ({
      name: label,
      count: chartData.datasets[0].data[index],
    }));

    const total = departments.reduce((sum, dept) => sum + dept.count, 0);

    return departments.slice(0, 6).map((dept, index) => {
      const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-red-500", "bg-teal-500"];
      return {
        label: dept.name.substring(0, 3).toUpperCase(),
        value: dept.count,
        percentage: total > 0 ? Math.round((dept.count / total) * 100) : 0,
        info: dept.name,
        color: colors[index % colors.length],
      };
    });
  };

  // Get seniority data from position levels
  const getSeniorityAnalysis = (): AnalysisData[] => {
    if (!dashboard?.data?.overview?.employeesByPositionLevel) return [];

    const levelData = dashboard.data.overview.employeesByPositionLevel;
    if (!levelData.datasets || !levelData.datasets[0]) return [];

    // Get data for each performance level (1-5)
    const levels = [];
    const total = levelData.datasets[0].data.reduce((sum, val) => sum + val, 0);

    for (let i = 0; i < 5; i++) {
      const value = levelData.datasets[0].data[i] || 0;
      const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-blue-500"];

      levels.push({
        label: `Nível ${i + 1}`,
        value: value,
        percentage: total > 0 ? Math.round((value / total) * 100) : 0,
        info: `${value} funcionários`,
        color: colors[i],
      });
    }

    return levels;
  };

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col bg-background">
          {/* Fixed Header */}
          <div className="flex-shrink-0 bg-background">
            <div className="px-4 py-4">
              <PageHeader
                title="Recursos Humanos"
                icon={IconUsers}
                favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_CARGOS_LISTAR}
                breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Recursos Humanos" }]}
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
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col bg-background">
          {/* Fixed Header */}
          <div className="flex-shrink-0 bg-background">
            <div className="px-4 py-4">
              <PageHeader
                title="Recursos Humanos"
                icon={IconUsers}
                favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_CARGOS_LISTAR}
                breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Recursos Humanos" }]}
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
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col bg-background">
        {/* Fixed Header */}
        <div className="flex-shrink-0 bg-background">
          <div className="px-4 py-4">
            <PageHeader
              title="Recursos Humanos"
              icon={IconUsers}
              favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_CARGOS_LISTAR}
              breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Recursos Humanos" }]}
              actions={[
                {
                  key: "time-period",
                  label: <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} className="mr-2" />,
                  variant: "ghost",
                  className: "p-0 hover:bg-transparent",
                },
                {
                  key: "create-position",
                  label: "Novo Cargo",
                  icon: IconPlus,
                  onClick: () => navigate(routes.humanResources.positions.create),
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <QuickAccessCard
                  title="Cargos"
                  icon={IconBriefcase}
                  onClick={() => navigate(routes.humanResources.positions.root)}
                  count={data?.positionMetrics?.totalPositions}
                  color="blue"
                />
                <QuickAccessCard
                  title="Férias"
                  icon={IconBeach}
                  onClick={() => navigate(routes.humanResources.vacations.root)}
                  count={data?.vacationMetrics?.totalVacations}
                  color="green"
                />
                <QuickAccessCard
                  title="Feriados"
                  icon={IconCalendarEvent}
                  onClick={() => navigate(routes.humanResources.holidays.root)}
                  count={data?.holidayMetrics?.totalHolidays}
                  color="purple"
                />
                <QuickAccessCard
                  title="Avisos"
                  icon={IconBellRinging}
                  onClick={() => navigate(routes.humanResources.notices.root)}
                  count={data?.noticeMetrics?.totalNotices}
                  color="orange"
                />
                <QuickAccessCard title="EPIs" icon={IconShieldCheck} onClick={() => navigate(routes.humanResources.ppe.root)} count={data?.ppeMetrics?.totalPPE} color="red" />
                <QuickAccessCard
                  title="Setores"
                  icon={IconHome}
                  onClick={() => navigate(routes.administration.sectors.root)}
                  count={data?.sectorMetrics?.totalSectors}
                  color="teal"
                />
              </div>
            </div>

            {/* Recent Activities */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Atividades Recentes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <RecentActivitiesCard title="Atividades Recentes" activities={transformRecentActivities()} icon={IconActivity} color="blue" />
                <SimpleVacationCard vacations={vacations} />
                <SimplePpeDeliveryCard deliveries={ppeDeliveries} />
                <RecentActivitiesCard
                  title="Avisos Ativos"
                  activities={[
                    {
                      item: `${data?.noticeMetrics?.activeNotices || 0} avisos`,
                      info: "Ativos",
                      quantity: `${data?.noticeMetrics?.newNotices || 0}`,
                      time: "Novos",
                    },
                  ]}
                  icon={IconMail}
                  color="purple"
                />
              </div>
            </div>

            {/* Metrics */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Métricas de Recursos Humanos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                <TrendCard
                  title="Total Funcionários"
                  value={data?.overview?.totalEmployees?.value || 0}
                  trend="stable"
                  percentage={0}
                  icon={IconUsers}
                  subtitle="Colaboradores ativos"
                />
                <TrendCard
                  title="Cargos Ativos"
                  value={data?.positionMetrics?.totalPositions || 0}
                  trend="stable"
                  percentage={0}
                  icon={IconBriefcase}
                  subtitle="Posições disponíveis"
                />
                <TrendCard
                  title="Férias Aprovadas"
                  value={data?.vacationMetrics?.approvedThisMonth || 0}
                  trend={data?.vacationMetrics?.vacationTrend}
                  percentage={data?.vacationMetrics?.vacationPercent}
                  icon={IconBeach}
                  subtitle="Este mês"
                />
                <TrendCard
                  title="EPIs Entregues"
                  value={data?.ppeMetrics?.deliveredThisMonth || 0}
                  trend={data?.ppeMetrics?.deliveryTrend}
                  percentage={data?.ppeMetrics?.deliveryPercent}
                  icon={IconShieldCheck}
                  subtitle="Este mês"
                />
                <TrendCard title="Avisos Enviados" value={data?.noticeMetrics?.sentThisMonth || 0} trend="up" percentage={8} icon={IconBellRinging} subtitle="Este mês" />
              </div>
            </div>

            {/* Activity Patterns */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Padrões de Atividade</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <ActivityPatternCard title="Colaboradores por Cargo" data={getPositionPatterns()} icon={IconUserCog} color="blue" />
                <ActivityPatternCard
                  title="Colaboradores por Setor"
                  data={
                    data?.sectorMetrics?.employeesBySector?.map((sector) => ({
                      label: sector.name,
                      value: sector.value,
                    })) || []
                  }
                  icon={IconHome}
                  color="green"
                />
                <ActivityPatternCard
                  title="Férias por Mês"
                  data={
                    data?.vacationMetrics?.vacationsByMonth?.map((monthData) => {
                      // Convert YYYY-MM to complete month name
                      const [year, month] = monthData.month.split("-");
                      const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                      const monthName = monthNames[parseInt(month) - 1];
                      return {
                        label: monthName,
                        value: monthData.count,
                      };
                    }) || []
                  }
                  icon={IconCalendar}
                  color="purple"
                />
              </div>
            </div>

            {/* Vacation Status */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Status das Férias</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {getVacationStatus().map((status, index) => (
                  <StatusCard key={index} status={status.status} quantity={status.quantity} total={status.total} icon={status.icon} color={status.color} unit="solicitações" />
                ))}
              </div>
            </div>

            {/* Analysis */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Análises de RH</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnalysisCard
                  title="Distribuição por Departamento"
                  type="DEPARTMENT"
                  data={getEmployeeAnalysis()}
                  icon={IconChartPie}
                  onDetailsClick={() => navigate(routes.humanResources.sectors.root)}
                />
                <AnalysisCard
                  title="Análise de Desempenho"
                  type="PERFORMANCE"
                  data={getSeniorityAnalysis()}
                  icon={IconTrophy}
                  onDetailsClick={() => navigate(routes.humanResources.positions.root)}
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
