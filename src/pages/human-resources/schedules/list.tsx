import { PageHeader } from "@/components/ui/page-header";
import { SchedulesList } from "@/components/integrations/secullum/schedules/list";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const SchedulesListPage = () => {
  usePageTracker({ title: "Horários", icon: "clock" });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Horários"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "Horários" },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <SchedulesList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default SchedulesListPage;
