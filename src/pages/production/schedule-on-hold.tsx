import { TaskHistoryList } from "@/components/production/task/history/task-history-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, TASK_STATUS } from "../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPlayerPause } from "@tabler/icons-react";

export const ScheduleOnHoldPage = () => {
  // Track page access
  usePageTracker({
    title: "Tarefas em Espera",
    icon: "player-pause",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="Em Espera"
            icon={IconPlayerPause}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Produção", href: routes.production.root },
              { label: "Em Espera" },
            ]}
          />
        </div>
        <TaskHistoryList
          className="flex-1 min-h-0"
          statusFilter={[TASK_STATUS.ON_HOLD]}
          storageKey="task-on-hold-visible-columns"
          searchPlaceholder="Buscar por nome, número de série, placa..."
          navigationRoute="onHold"
        />
      </div>
    </PrivilegeRoute>
  );
};

export default ScheduleOnHoldPage;
