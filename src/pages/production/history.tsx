import { TaskHistoryList } from "@/components/production/task/history/task-history-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes } from "../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconHistory } from "@tabler/icons-react";

export const TaskHistoryPage = () => {
  // Track page access
  usePageTracker({
    title: "Histórico de Tarefas",
    icon: "history",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="Histórico de Tarefas"
            icon={IconHistory}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Produção", href: routes.production.root },
              { label: "Histórico" },
            ]}
          />
        </div>
        <TaskHistoryList className="flex-1 min-h-0" navigationRoute="history" />
      </div>
    </PrivilegeRoute>
  );
};

export default TaskHistoryPage;
