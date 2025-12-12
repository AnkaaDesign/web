import { TaskScheduleContent } from "@/components/production/task/schedule/task-schedule-content";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { usePrivileges } from "@/hooks/usePrivileges";
import { IconClipboardList, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const TaskListPage = () => {
  const navigate = useNavigate();
  const { canCreateTasks } = usePrivileges();

  // Track page access
  usePageTracker({
    title: "Cronograma",
    icon: "clipboard-list",
  });

  // Define actions based on user privileges
  const actions = canCreateTasks ? [
    {
      key: "create",
      label: "Nova Tarefa",
      icon: IconPlus,
      onClick: () => navigate(routes.production.schedule.create),
      variant: "default" as const,
    },
  ] : [];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Cronograma"
            icon={IconClipboardList}
            favoritePage={FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção", href: routes.production.root }, { label: "Cronograma" }]}
            actions={actions}
          />
        </div>
        <TaskScheduleContent className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};

export default TaskListPage;
