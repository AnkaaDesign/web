import { IconCalendarStats } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { AbsencesCalendar } from "@/components/human-resources/absence";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const HRCalendarPage = () => {
  usePageTracker({ title: "Calendário", icon: "calendarStats" });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Calendário"
          icon={IconCalendarStats}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Ferramentas", href: routes.tools.root },
            { label: "Calendário" },
          ]}
          className="flex-shrink-0"
        />
        {/* Scroll container with a column flex: the calendar card fills the
            viewport when it fits and grows past it (page scrolls) when the
            month grid needs more height. */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-6 flex flex-col">
          <AbsencesCalendar />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default HRCalendarPage;
