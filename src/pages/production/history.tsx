import { TaskHistoryList } from "@/components/production/task/history/task-history-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconHistory } from "@tabler/icons-react";

export const TaskHistoryPage = () => {
  // Track page access
  usePageTracker({
    title: "Histórico de Tarefas",
    icon: "history",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PLOTTING, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="default"
          title="Histórico de Tarefas"
          icon={IconHistory}
          favoritePage={FAVORITE_PAGES.PRODUCAO_HISTORICO_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Produção", href: routes.production.root },
            { label: "Histórico" },
          ]}
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <TaskHistoryList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default TaskHistoryPage;
