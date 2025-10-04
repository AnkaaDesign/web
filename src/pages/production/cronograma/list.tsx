import { TaskScheduleContent } from "@/components/production/task/schedule/task-schedule-content";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconClipboardList, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const TaskListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Cronograma",
    icon: "clipboard-list",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.PRODUCTION}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Cronograma"
            icon={IconClipboardList}
            favoritePage={FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção", href: routes.production.root }, { label: "Cronograma" }]}
            actions={[
              {
                key: "create",
                label: "Nova Tarefa",
                icon: IconPlus,
                onClick: () => navigate(routes.production.schedule.create),
                variant: "default",
              },
            ]}
          />
        </div>
        <TaskScheduleContent className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};

export default TaskListPage;
