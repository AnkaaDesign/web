import { TaskHistoryList } from "@/components/production/task/history/task-history-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, TASK_STATUS } from "../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconClipboardList, IconPlus } from "@tabler/icons-react";
import { useAuth } from "@/contexts/auth-context";

export const PreparationPage = () => {
  const { user } = useAuth();

  // Track page access
  usePageTracker({
    title: "Agenda de Tarefas",
    icon: "clipboard-list",
  });

  // ADMIN and COMMERCIAL can create tasks
  const canCreateTasks = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN || user?.sector?.privileges === SECTOR_PRIVILEGES.COMMERCIAL;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
        <PageHeader
          className="flex-shrink-0"
          variant="default"
          title="Agenda"
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Produção", href: routes.production.root },
            { label: "Agenda" },
          ]}
          actions={
            canCreateTasks
              ? [
                  {
                    key: "create-task",
                    label: "Criar Tarefa",
                    icon: IconPlus,
                    onClick: () => window.location.href = routes.production.preparation.create,
                    variant: "default" as const,
                  },
                ]
              : undefined
          }
        />
        <TaskHistoryList
          className="flex-1 min-h-0"
          statusFilter={[TASK_STATUS.PREPARATION]}
          storageKey="task-preparation-visible-columns"
          searchPlaceholder="Buscar por nome, número de série, placa..."
          navigationRoute="preparation"
          hideStatusFilter={true}
        />
      </div>
    </PrivilegeRoute>
  );
};

export default PreparationPage;
