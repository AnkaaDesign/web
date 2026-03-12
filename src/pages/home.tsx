import { useAuth } from "../contexts/auth-context";
import { useFavorites } from "../contexts/favorites-context";
import { SECTOR_PRIVILEGES } from "../constants";
import { getIconInfoByPath } from "../utils";
import { IconStar } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { usePageTracker } from "../hooks/common/use-page-tracker";
import { useHomeDashboard } from "../hooks/common/use-dashboard";
import { usePrivileges } from "../hooks/common/use-privileges";
import { useSectionVisibility } from "../hooks/common/use-section-visibility";
import type { SectionConfig } from "../hooks/common/use-section-visibility";
import { SectionVisibilityManager } from "../components/ui/section-visibility-manager";
import { HomeDashboardSection, HomeDashboardSkeleton, TimeEntriesCard, RecentMessagesList } from "../components/home-dashboard";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** All possible home dashboard sections — filtered at runtime based on user data */
const ALL_HOME_SECTIONS: Record<string, SectionConfig> = {
  favorites: { id: "favorites", label: "Favoritos", defaultVisible: true, fields: [] },
  tasksCloseDeadline: { id: "tasksCloseDeadline", label: "Tarefas com Prazo Hoje", defaultVisible: true, fields: [] },
  openServiceOrders: { id: "openServiceOrders", label: "Ordens de Serviço Abertas", defaultVisible: true, fields: [] },
  tasksCloseForecast: { id: "tasksCloseForecast", label: "Tarefas com Liberação Próxima", defaultVisible: true, fields: [] },
  lowStockItems: { id: "lowStockItems", label: "Estoque Baixo", defaultVisible: true, fields: [] },
  completedTasks: { id: "completedTasks", label: "Tarefas Concluídas", defaultVisible: true, fields: [] },
  tasksAwaitingPaymentApproval: { id: "tasksAwaitingPaymentApproval", label: "Aguardando Aprovação de Pagamento", defaultVisible: true, fields: [] },
  tasksAwaitingPricingApproval: { id: "tasksAwaitingPricingApproval", label: "Aguardando Aprovação Interna", defaultVisible: true, fields: [] },
  timeEntries: { id: "timeEntries", label: "Ponto da Semana", defaultVisible: true, fields: [] },
  recentMessages: { id: "recentMessages", label: "Mensagens Recentes", defaultVisible: true, fields: [] },
};

export function HomePage() {
  const { user } = useAuth();
  const { favorites } = useFavorites();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  usePageTracker({
    title: "Página Inicial",
    icon: "home",
  });

  const { data: dashboardResponse, isLoading: isDashboardLoading } = useHomeDashboard({ platform: "web" });
  const { currentPrivilege } = usePrivileges();
  const isAdmin = currentPrivilege === SECTOR_PRIVILEGES.ADMIN;
  const needsTimeEntries = currentPrivilege === SECTOR_PRIVILEGES.LOGISTIC ||
    currentPrivilege === SECTOR_PRIVILEGES.DESIGNER ||
    currentPrivilege === SECTOR_PRIVILEGES.PRODUCTION ||
    currentPrivilege === SECTOR_PRIVILEGES.PRODUCTION_MANAGER ||
    currentPrivilege === SECTOR_PRIVILEGES.WAREHOUSE;

  const dashboardData = dashboardResponse?.data;

  // Build available sections based on what data the API returned for this user
  const availableSections = useMemo(() => {
    const sections: SectionConfig[] = [];

    // Favorites only when user has some
    if (favorites.length > 0) {
      sections.push(ALL_HOME_SECTIONS.favorites);
    }

    if (dashboardData?.tasksCloseDeadline && dashboardData.tasksCloseDeadline.length > 0) {
      sections.push(ALL_HOME_SECTIONS.tasksCloseDeadline);
    }
    if (dashboardData?.openServiceOrders && dashboardData.openServiceOrders.length > 0) {
      sections.push(ALL_HOME_SECTIONS.openServiceOrders);
    }
    if (dashboardData?.tasksCloseForecast && dashboardData.tasksCloseForecast.length > 0) {
      sections.push(ALL_HOME_SECTIONS.tasksCloseForecast);
    }
    if (dashboardData?.lowStockItems && dashboardData.lowStockItems.length > 0) {
      sections.push(ALL_HOME_SECTIONS.lowStockItems);
    }
    if (dashboardData?.completedTasks && dashboardData.completedTasks.length > 0) {
      sections.push(ALL_HOME_SECTIONS.completedTasks);
    }
    if (dashboardData?.tasksAwaitingPaymentApproval && dashboardData.tasksAwaitingPaymentApproval.length > 0) {
      sections.push(ALL_HOME_SECTIONS.tasksAwaitingPaymentApproval);
    }
    if (dashboardData?.tasksAwaitingPricingApproval && dashboardData.tasksAwaitingPricingApproval.length > 0) {
      sections.push(ALL_HOME_SECTIONS.tasksAwaitingPricingApproval);
    }
    if (needsTimeEntries) {
      sections.push(ALL_HOME_SECTIONS.timeEntries);
    }
    if (dashboardData?.recentMessages && dashboardData.recentMessages.length > 0) {
      sections.push(ALL_HOME_SECTIONS.recentMessages);
    }

    return sections;
  }, [dashboardData, needsTimeEntries, favorites.length]);

  const sectionVisibility = useSectionVisibility("home-dashboard-visibility", availableSections);

  const isVisible = (id: string) => !isAdmin || sectionVisibility.isSectionVisible(id);

  const hasBasicPrivilegeOnly = user?.sector?.privileges === SECTOR_PRIVILEGES.BASIC || !user?.sector;

  if (hasBasicPrivilegeOnly) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center space-y-8 max-w-md">
          <h1 className="text-4xl font-bold text-foreground">Bem-vindo ao Ankaa</h1>
          <p className="text-lg text-muted-foreground">Você está autenticado, mas ainda não possui permissões para acessar as funcionalidades do sistema.</p>
          <p className="text-muted-foreground">Entre em contato com o administrador para solicitar acesso aos módulos necessários.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="m-4 p-4 rounded-xl flex flex-col gap-5 bg-card border border-border shadow-sm min-h-[calc(100vh-6rem)]">
      {/* Welcome Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-base sm:text-xl md:text-2xl font-bold text-secondary-foreground">
            {getGreeting()}, {user?.name || "Usuário"}!
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && !isDashboardLoading && availableSections.length > 0 && (
            <SectionVisibilityManager
              sections={availableSections}
              visibilityState={sectionVisibility.visibilityState}
              onToggleSection={sectionVisibility.toggleSection}
              onToggleField={sectionVisibility.toggleField}
              onReset={sectionVisibility.resetToDefaults}
            />
          )}
          <span className="text-sm sm:text-base md:text-lg text-secondary-foreground tabular-nums w-[5.5em] text-right">
            {currentTime.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* Favoritos - FIRST (hidden when empty) */}
      {isVisible("favorites") && favorites.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <IconStar className="h-4 w-4 text-yellow-500" />
            <h3 className="text-base font-semibold text-secondary-foreground">Favoritos</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {favorites.map((fav) => {
              const iconInfo = getIconInfoByPath(fav.path);
              const IconComponent = iconInfo.icon;
              return (
                <div
                  key={fav.id}
                  className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] rounded-lg bg-secondary border border-border p-4"
                  onClick={() => navigate(fav.path)}
                >
                  <div className={`${iconInfo.color} text-white p-3 rounded-lg inline-block mb-2`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-sm text-secondary-foreground">{fav.title}</h3>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dashboard Section (tables grid) */}
      {isDashboardLoading ? (
        <HomeDashboardSkeleton />
      ) : (
        dashboardData && (
          <HomeDashboardSection
            data={dashboardData}
            sector={currentPrivilege || undefined}
            isSectionVisible={isAdmin ? sectionVisibility.isSectionVisible : undefined}
          />
        )
      )}
      {isVisible("timeEntries") && needsTimeEntries && <TimeEntriesCard />}

      {/* Recent Messages - card layout */}
      {isVisible("recentMessages") && dashboardData?.recentMessages && dashboardData.recentMessages.length > 0 && (
        <RecentMessagesList
          messages={dashboardData.recentMessages}
          unreadCount={dashboardData.counts.unreadMessages}
        />
      )}
    </div>
  );
}
