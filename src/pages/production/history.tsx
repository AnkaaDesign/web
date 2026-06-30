import { TaskHistoryTablePage } from "@/components/production/task/history/table/task-history-table-page";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const TaskHistoryPage = () => {
  // Track page access
  usePageTracker({
    title: "Histórico de Tarefas",
    icon: "history",
  });

  return (
    <PrivilegeRoute
      requiredPrivilege={[
        SECTOR_PRIVILEGES.PRODUCTION,
        SECTOR_PRIVILEGES.WAREHOUSE,
        SECTOR_PRIVILEGES.DESIGNER,
        SECTOR_PRIVILEGES.FINANCIAL,
        SECTOR_PRIVILEGES.LOGISTIC,
        SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
        SECTOR_PRIVILEGES.PLOTTING,
        SECTOR_PRIVILEGES.COMMERCIAL,
        SECTOR_PRIVILEGES.ADMIN,
      ]}
    >
      <TaskHistoryTablePage />
    </PrivilegeRoute>
  );
};

export default TaskHistoryPage;
