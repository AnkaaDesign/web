import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { TaskCreateForm } from "@/components/production/task/form/task-create-form";

export const TaskCreatePage = () => {
  // Track page access
  usePageTracker({
    title: "Criar Tarefa",
    icon: "clipboard-list",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.LOGISTIC]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <TaskCreateForm />
      </div>
    </PrivilegeRoute>
  );
};

export default TaskCreatePage;
