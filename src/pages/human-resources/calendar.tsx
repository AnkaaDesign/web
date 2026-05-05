import { IconCalendarStats } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { AbsencesCalendar } from "@/components/human-resources/absence";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const HRCalendarPage = () => {
  usePageTracker({ title: "Calendário RH", icon: "calendarStats" });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Calendário"
          icon={IconCalendarStats}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "Calendário" },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <AbsencesCalendar />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default HRCalendarPage;
