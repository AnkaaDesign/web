import { TaskScheduleContent } from "@/components/production/task/schedule/task-schedule-content";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const TaskListPage = () => {
  // Track page access
  usePageTracker({
    title: "Cronograma",
    icon: "clipboard-list",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Cronograma"
          favoritePage={FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção", href: routes.production.root }, { label: "Cronograma" }]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <TaskScheduleContent className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default TaskListPage;
