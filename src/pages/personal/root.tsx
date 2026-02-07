import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { useCurrentUser } from "@/hooks/use-auth";
import { useBorrows, usePpeDeliveries, useMyVacations, useActivities } from "../../hooks";
import { useNavigate } from "react-router-dom";
import { routes, PPE_DELIVERY_STATUS, BORROW_STATUS, USER_STATUS_LABELS } from "../../constants";
import { formatDate, getFileUrl } from "../../utils";
import {
  IconUserCircle,
  IconCalendarEvent,
  IconShieldCheck,
  IconTool,
  IconActivity,
  IconCalendarWeek,
  IconMail,
  IconPhone,
  IconBuilding,
  IconBriefcase,
  IconMapPin,
  IconClock,
  IconAlertCircle,
  IconCheck,
  IconHourglass,
} from "@tabler/icons-react";
import { QuickAccessCard, StatusCard, RecentActivitiesCard, type Activity } from "@/components/dashboard";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import { cn } from "@/lib/utils";

export function Personal() {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Área Pessoal",
    icon: "userCircle",
  });

  // Fetch current user data
  const { data: user, isLoading: isLoadingUser, error: userError } = useCurrentUser();

  // Fetch user's borrows (empréstimos) - active ones
  const { data: borrowsData } = useBorrows({
    where: {
      userId: user?.id,
      status: {
        in: [BORROW_STATUS.BORROWED, BORROW_STATUS.PARTIALLY_RETURNED],
      },
    },
    take: 10,
    include: {
      item: true,
    },
  }, {
    enabled: !!user?.id,
  });

  // Fetch user's PPE deliveries
  const { data: ppeData } = usePpeDeliveries({
    where: {
      userId: user?.id,
    },
    take: 10,
    include: {
      item: true,
    },
  }, {
    enabled: !!user?.id,
  });

  // Fetch user's vacations (uses /vacations/my-vacations endpoint)
  const { data: vacationsData } = useMyVacations({
    filters: {
      take: 5,
      orderBy: { startAt: "desc" },
    },
  }, {
    enabled: !!user?.id,
  });

  // Fetch user's activities
  const { data: activitiesData } = useActivities({
    where: {
      userId: user?.id,
    },
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      item: true,
    },
  }, {
    enabled: !!user?.id,
  });

  // Calculate PPE status counts
  const ppePendingCount = ppeData?.data?.filter(
    (d) => d.status === PPE_DELIVERY_STATUS.PENDING
  ).length || 0;
  const ppeApprovedCount = ppeData?.data?.filter(
    (d) => d.status === PPE_DELIVERY_STATUS.APPROVED
  ).length || 0;
  const ppeDeliveredCount = ppeData?.data?.filter(
    (d) => d.status === PPE_DELIVERY_STATUS.DELIVERED
  ).length || 0;
  const ppeTotalCount = ppeData?.meta?.totalRecords || 0;

  // Active borrows count
  const activeBorrowsCount = borrowsData?.meta?.totalRecords || 0;

  // Activities count
  const activitiesCount = activitiesData?.meta?.totalRecords || 0;

  // Vacations count
  const vacationsCount = vacationsData?.meta?.totalRecords || 0;

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Transform recent activities for display
  const getRecentActivities = (): Activity[] => {
    if (!activitiesData?.data || activitiesData.data.length === 0) {
      return [
        {
          item: "Nenhuma atividade",
          info: "Registrada",
          quantity: "",
          time: "✓",
        },
      ];
    }

    return activitiesData.data.slice(0, 10).map((activity) => ({
      item: activity.item?.name || "Item desconhecido",
      info: activity.reason || activity.operation,
      quantity: `${activity.operation === "INBOUND" ? "+" : "-"}${activity.quantity || 0}`,
      time: activity.createdAt
        ? new Date(activity.createdAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "--:--",
    }));
  };

  // Transform recent PPE requests for display
  const getRecentPpeRequests = (): Activity[] => {
    if (!ppeData?.data || ppeData.data.length === 0) {
      return [
        {
          item: "Nenhuma solicitação",
          info: "Registrada",
          quantity: "",
          time: "✓",
        },
      ];
    }

    return ppeData.data.slice(0, 10).map((delivery) => {
      const statusLabels: Record<string, string> = {
        PENDING: "Pendente",
        APPROVED: "Aprovado",
        DELIVERED: "Entregue",
        REPROVED: "Reprovado",
        CANCELLED: "Cancelado",
      };

      return {
        item: delivery.item?.name || "EPI desconhecido",
        info: statusLabels[delivery.status] || delivery.status,
        quantity: `${delivery.quantity || 1}`,
        time: delivery.createdAt
          ? new Date(delivery.createdAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })
          : "--/--",
      };
    });
  };

  // Transform recent borrows for display
  const getRecentBorrows = (): Activity[] => {
    if (!borrowsData?.data || borrowsData.data.length === 0) {
      return [
        {
          item: "Nenhum empréstimo",
          info: "Ativo",
          quantity: "",
          time: "✓",
        },
      ];
    }

    return borrowsData.data.slice(0, 10).map((borrow) => {
      const statusLabels: Record<string, string> = {
        BORROWED: "Emprestado",
        RETURNED: "Devolvido",
        PARTIALLY_RETURNED: "Parcial",
        LOST: "Perdido",
      };

      return {
        item: borrow.item?.name || "Item desconhecido",
        info: statusLabels[borrow.status] || borrow.status,
        quantity: `${borrow.quantity || 1}`,
        time: borrow.createdAt
          ? new Date(borrow.createdAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })
          : "--/--",
      };
    });
  };

  if (isLoadingUser) {
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Fixed Header */}
        <div className="flex-shrink-0 bg-background border-b border-border">
          <div className="px-4 py-4">
            <PageHeader
              title="Área Pessoal"
              icon={IconUserCircle}
              breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Pessoal" }]}
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-6">
            <div className="space-y-6 pb-6">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Fixed Header */}
        <div className="flex-shrink-0 bg-background border-b border-border">
          <div className="px-4 py-4">
            <PageHeader
              title="Área Pessoal"
              icon={IconUserCircle}
              breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Pessoal" }]}
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-6">
            <div className="space-y-6 pb-6">
              <Alert variant="destructive">
                <AlertDescription>Erro ao carregar dados do usuário: {userError.message}</AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-background border-b border-border">
        <div className="px-4 py-4">
          <PageHeader
            title="Área Pessoal"
            icon={IconUserCircle}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Pessoal" }]}
            actions={[
              {
                key: "request-ppe",
                label: "Solicitar EPI",
                icon: IconShieldCheck,
                onClick: () => navigate(routes.personal.myPpes.request),
                variant: "default",
              },
            ]}
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6">
          <div className="space-y-6 pb-6">
          {/* Profile Card */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row">
                {/* Left section - Avatar and basic info */}
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20">
                  <Avatar className="h-20 w-20 border-4 border-background shadow-sm">
                    <AvatarImage
                      src={user?.avatar ? getFileUrl(user.avatar) : undefined}
                      alt={user?.name}
                    />
                    <AvatarFallback className="text-xl font-semibold bg-primary/20 text-primary">
                      {user?.name ? getInitials(user.name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-foreground">{user?.name}</h2>
                    <p className="text-sm text-muted-foreground">{user?.position?.name || "Sem cargo"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={user?.isActive ? "default" : "destructive"}>
                        {user?.status ? USER_STATUS_LABELS[user.status] : "Desconhecido"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Right section - Contact and work info */}
                <div className="flex-1 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {user?.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <IconMail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{user.email}</span>
                      </div>
                    )}
                    {user?.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <IconPhone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{user.phone}</span>
                      </div>
                    )}
                    {user?.sector && (
                      <div className="flex items-center gap-2 text-sm">
                        <IconBuilding className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{user.sector.name}</span>
                      </div>
                    )}
                    {user?.position && (
                      <div className="flex items-center gap-2 text-sm">
                        <IconBriefcase className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{user.position.name}</span>
                      </div>
                    )}
                    {(user?.city || user?.state) && (
                      <div className="flex items-center gap-2 text-sm">
                        <IconMapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {[user.city, user.state].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}
                    {user?.lastLoginAt && (
                      <div className="flex items-center gap-2 text-sm">
                        <IconClock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Último acesso: {formatDate(user.lastLoginAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Access Section */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Acesso Rápido</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <QuickAccessCard
                title="Feriados"
                icon={IconCalendarEvent}
                onClick={() => navigate(routes.personal.myHolidays.root)}
                color="purple"
              />
              <QuickAccessCard
                title="Férias"
                icon={IconCalendarWeek}
                onClick={() => navigate(routes.personal.myVacations.root)}
                count={vacationsCount}
                color="blue"
              />
              <QuickAccessCard
                title="Meus EPIs"
                icon={IconShieldCheck}
                onClick={() => navigate(routes.personal.myPpes.root)}
                count={ppeTotalCount}
                color="teal"
              />
              <QuickAccessCard
                title="Empréstimos"
                icon={IconTool}
                onClick={() => navigate(routes.personal.myLoans.root)}
                count={activeBorrowsCount}
                color="orange"
              />
              <QuickAccessCard
                title="Atividades"
                icon={IconActivity}
                onClick={() => navigate(routes.personal.myActivities.root)}
                count={activitiesCount}
                color="green"
              />
            </div>
          </div>

          {/* Status Summary Section */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Resumo de Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <StatusCard
                status="EPIs Pendentes"
                quantity={ppePendingCount}
                total={ppeTotalCount || 1}
                icon={IconHourglass}
                color="yellow"
                unit="solicitações"
                onClick={() => navigate(routes.personal.myPpes.root)}
              />
              <StatusCard
                status="EPIs Aprovados"
                quantity={ppeApprovedCount}
                total={ppeTotalCount || 1}
                icon={IconCheck}
                color="blue"
                unit="solicitações"
                onClick={() => navigate(routes.personal.myPpes.root)}
              />
              <StatusCard
                status="EPIs Entregues"
                quantity={ppeDeliveredCount}
                total={ppeTotalCount || 1}
                icon={IconShieldCheck}
                color="green"
                unit="entregas"
                onClick={() => navigate(routes.personal.myPpes.root)}
              />
              <StatusCard
                status="Empréstimos Ativos"
                quantity={activeBorrowsCount}
                total={activeBorrowsCount || 1}
                icon={IconTool}
                color="orange"
                unit="itens"
                onClick={() => navigate(routes.personal.myLoans.root)}
              />
            </div>
          </div>

          {/* Recent Activities Section */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Atividades Recentes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <RecentActivitiesCard
                title="Movimentações"
                activities={getRecentActivities()}
                icon={IconActivity}
                color="green"
              />
              <RecentActivitiesCard
                title="Solicitações de EPI"
                activities={getRecentPpeRequests()}
                icon={IconShieldCheck}
                color="teal"
              />
              <RecentActivitiesCard
                title="Empréstimos"
                activities={getRecentBorrows()}
                icon={IconTool}
                color="orange"
              />
            </div>
          </div>

          {/* Upcoming Vacations */}
          {vacationsData?.data && vacationsData.data.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Minhas Férias</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vacationsData.data.slice(0, 3).map((vacation) => (
                  <Card
                    key={vacation.id}
                    className="hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => navigate(routes.personal.myVacations.details(vacation.id))}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 dark:bg-blue-400/20 rounded-lg">
                          <IconCalendarWeek className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {formatDate(vacation.startAt)} - {formatDate(vacation.endAt)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {vacation.type === "ANNUAL" ? "Férias Anuais" : vacation.type}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {new Date(vacation.startAt) > new Date() ? "Agendada" : "Concluída"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
