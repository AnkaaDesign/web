import { TaskPreparationView } from "@/components/production/task/preparation/task-preparation-view";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../constants";
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

  // ADMIN, COMMERCIAL, and LOGISTIC can create tasks
  const canCreateTasks =
    user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN ||
    user?.sector?.privileges === SECTOR_PRIVILEGES.COMMERCIAL ||
    user?.sector?.privileges === SECTOR_PRIVILEGES.LOGISTIC;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
        <PageHeader
          variant="default"
          title="Agenda"
          icon={IconClipboardList}
          favoritePage={FAVORITE_PAGES.PRODUCAO_AGENDA_LISTAR}
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
        <TaskPreparationView
          storageKey="task-preparation-visible-columns"
          searchPlaceholder="Buscar por nome, número de série, placa..."
        />
      </div>
    </PrivilegeRoute>
  );
};

export default PreparationPage;
