import { useState } from "react";
import { TaskHistoryList } from "@/components/production/task/history/task-history-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, TASK_STATUS } from "../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconClipboardList, IconPlus } from "@tabler/icons-react";
import { TaskQuickCreateDialog } from "@/components/production/task/modals/task-quick-create-dialog";
import { useAuth } from "@/contexts/auth-context";

export const PreparationPage = () => {
  const { user } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Track page access
  usePageTracker({
    title: "Agenda de Tarefas",
    icon: "clipboard-list",
  });

  // Only show create button for admin users
  const canCreateTasks = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
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
                    onClick: () => setCreateDialogOpen(true),
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

      <TaskQuickCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </PrivilegeRoute>
  );
};

export default PreparationPage;
