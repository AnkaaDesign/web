import { IconCalendarStats } from "@tabler/icons-react";

import { TaskScheduleCalendar } from "@/components/production/task/schedule/task-schedule-calendar";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const TaskScheduleCalendarPage = () => {
  usePageTracker({
    title: "Calendário de Produção",
    icon: "calendarStats",
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
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Calendário"
          favoritePage={FAVORITE_PAGES.PRODUCAO_CALENDARIO}
          icon={IconCalendarStats}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Produção", href: routes.production.root },
            { label: "Calendário" },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <TaskScheduleCalendar />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default TaskScheduleCalendarPage;
