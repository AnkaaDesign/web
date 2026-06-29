import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { TaskPreparationPage } from "@/components/production/task/preparation-v2/task-prep-page";

/**
 * Task preparation ("Agenda") — reimplemented on the generic DataTable base: two stacked tables
 * (Em Produção / Em Preparação), name-cluster expand/collapse, a single trimmed query, and the
 * top-table-flows / bottom-table-body-scrolls layout. See `preparation-v2/`.
 */
export const PreparationPage = () => {
  usePageTracker({ title: "Agenda de Tarefas", icon: "clipboard-list" });

  return (
    <PrivilegeRoute
      requiredPrivilege={[
        SECTOR_PRIVILEGES.DESIGNER,
        SECTOR_PRIVILEGES.LOGISTIC,
        SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
        SECTOR_PRIVILEGES.COMMERCIAL,
        SECTOR_PRIVILEGES.ADMIN,
      ]}
    >
      <TaskPreparationPage />
    </PrivilegeRoute>
  );
};
